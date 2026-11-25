/* eslint-disable sonarjs/no-hardcoded-ip -- these tests are about telling home network addresses from the internet */
import { describe, expect, it } from 'vitest';
import type { NetworkConfiguration } from '@jellyfin/sdk/lib/generated-client/models/network-configuration';
import type { TaskInfo } from '@jellyfin/sdk/lib/generated-client/models/task-info';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';

import { type SetupInput, getSetupSteps, isPrivateHost } from './setupSteps';

const NEW_SERVER: SetupInput = {
    libraries: [],
    scanTask: { Key: 'RefreshLibrary' } as TaskInfo,
    itemCounts: { MovieCount: 0, SeriesCount: 0 },
    users: [ { Name: 'admin' } as UserDto ],
    network: { EnableRemoteAccess: true } as NetworkConfiguration,
    encoding: { HardwareAccelerationType: 'none' },
    hostname: '192.168.1.20'
};

const done = (input: SetupInput) => Object.fromEntries((getSetupSteps(input) ?? []).map(s => [ s.id, s.done ]));

describe('Dashboard: setup steps', () => {
    it('Should wait while something is loading', () => {
        expect(getSetupSteps({ ...NEW_SERVER, network: undefined })).toBeNull();
    });

    it('Should have every step pending on a new server, in order and with its screen', () => {
        const steps = getSetupSteps(NEW_SERVER) ?? [];
        expect(steps.map(s => s.id)).toEqual([ 'library', 'scan', 'user', 'remote', 'hardware' ]);
        expect(steps.every(s => !s.done)).toBe(true);
        expect(steps.map(s => s.to)).toEqual([ '/dashboard/libraries', '/dashboard/libraries', '/dashboard/users/add', '/dashboard/networking', '/dashboard/playback/transcoding' ]);
    });

    it('Should mark the library and the first scan when they happen', () => {
        const withLibrary = { ...NEW_SERVER, libraries: [ { Name: 'Películas' } ] };
        expect(done(withLibrary)).toMatchObject({ library: true, scan: false });
        expect(done({ ...withLibrary, scanTask: { LastExecutionResult: { Status: 'Completed' } } as TaskInfo }).scan).toBe(true);
        expect(done({ ...withLibrary, itemCounts: { MovieCount: 12 } }).scan).toBe(true);
        // A scan that failed is not a finished first scan
        expect(done({ ...withLibrary, scanTask: { LastExecutionResult: { Status: 'Failed' } } as TaskInfo }).scan).toBe(false);
        // Items without a library (removed) do not count
        expect(done({ ...NEW_SERVER, itemCounts: { MovieCount: 3 } }).scan).toBe(false);
    });

    it('Should need a second active user', () => {
        expect(done({ ...NEW_SERVER, users: [ { Name: 'admin' }, { Name: 'Ana', Policy: { IsDisabled: true } } ] as UserDto[] }).user).toBe(false);
        expect(done({ ...NEW_SERVER, users: [ { Name: 'admin' }, { Name: 'Ana' } ] as UserDto[] }).user).toBe(true);
    });

    it('Should see remote access once there is a way in from outside', () => {
        const net = (n: Partial<NetworkConfiguration>) => ({ ...NEW_SERVER, network: { EnableRemoteAccess: true, ...n } as NetworkConfiguration });
        expect(done(net({})).remote).toBe(false);
        expect(done(net({ EnableHttps: true })).remote).toBe(true);
        expect(done(net({ KnownProxies: [ '172.18.0.2' ] })).remote).toBe(true);
        expect(done(net({ PublishedServerUriBySubnet: [ 'all=https://media.example.com' ] })).remote).toBe(true);
        // Opened from the internet (a domain): it already works
        expect(done({ ...NEW_SERVER, hostname: 'media.example.com' }).remote).toBe(true);
        // Not allowed: never done
        expect(done({ ...NEW_SERVER, hostname: 'media.example.com', network: { EnableRemoteAccess: false } as NetworkConfiguration }).remote).toBe(false);
    });

    it('Should mark hardware acceleration when one is chosen', () => {
        expect(done({ ...NEW_SERVER, encoding: { HardwareAccelerationType: 'vaapi' } }).hardware).toBe(true);
        expect(done({ ...NEW_SERVER, encoding: { HardwareAccelerationType: 'None' } }).hardware).toBe(false);
        expect(done({ ...NEW_SERVER, encoding: {} }).hardware).toBe(false);
    });

    it('Should tell the home network from the internet', () => {
        for (const host of [ 'localhost', '127.0.0.1', '10.0.0.5', '172.16.4.1', '172.31.255.1', '192.168.0.10', '100.100.1.1', 'nas.local', 'router.lan', '[::1]', 'fd12:3456::1', 'fe80::1' ]) {
            expect(isPrivateHost(host), host).toBe(true);
        }
        for (const host of [ 'media.example.com', '8.8.8.8', '172.32.0.1', '2001:db8::1' ]) {
            expect(isPrivateHost(host), host).toBe(false);
        }
    });
});
/* eslint-enable sonarjs/no-hardcoded-ip */
