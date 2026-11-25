/**
 * "Your server in 5 steps": which steps of a new server are done, read from what the server reports.
 * Each step is done by itself once it is true, so the guide always matches the real state.
 */
import type { ItemCounts } from '@jellyfin/sdk/lib/generated-client/models/item-counts';
import type { NetworkConfiguration } from '@jellyfin/sdk/lib/generated-client/models/network-configuration';
import type { TaskInfo } from '@jellyfin/sdk/lib/generated-client/models/task-info';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import type { VirtualFolderInfo } from '@jellyfin/sdk/lib/generated-client/models/virtual-folder-info';

export type SetupStepId = 'library' | 'scan' | 'user' | 'remote' | 'hardware';

export interface SetupStep {
    id: SetupStepId;
    /** Translation keys: name and short explanation. */
    titleKey: string;
    helpKey: string;
    /** Dashboard screen where it is done. */
    to: string;
    done: boolean;
}

export interface SetupInput {
    libraries?: VirtualFolderInfo[];
    /** The "Scan media library" scheduled task (RefreshLibrary). */
    scanTask?: TaskInfo;
    itemCounts?: ItemCounts;
    users?: UserDto[];
    network?: NetworkConfiguration;
    /** Encoding options: only the kind of hardware acceleration is needed. */
    encoding?: { HardwareAccelerationType?: string | null };
    /** The host the dashboard is opened with (window.location.hostname). */
    hostname?: string;
}

/** A host of the home network (or this computer): reaching the server through it says nothing about remote access. */
export const isPrivateHost = (hostname = ''): boolean => {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.lan') || host.endsWith('.home.arpa')) return true;
    const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
    if (v4) {
        const [ a, b ] = [ Number(v4[1]), Number(v4[2]) ];
        return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
    }
    // IPv6: loopback, unique local (fc00::/7) and link local (fe80::/10)
    return host === '::1' || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
};

const hasItems = (counts?: ItemCounts) => !!counts && Object.values(counts).some(n => typeof n === 'number' && n > 0);

/** Remote access is allowed and there is a way in from outside: HTTPS, a published address, a proxy, or this very visit. */
const remoteReady = (network?: NetworkConfiguration, hostname?: string) => !!network?.EnableRemoteAccess && (
    !!network.EnableHttps
    || !!network.PublishedServerUriBySubnet?.length
    || !!network.KnownProxies?.length
    || !isPrivateHost(hostname)
);

/**
 * The five steps, or null while something needed is still loading (the card waits, so it does not flash).
 * @param {SetupInput} input What the server reports.
 * @returns {SetupStep[] | null} The steps in order.
 */
export const getSetupSteps = (input: SetupInput): SetupStep[] | null => {
    const { libraries, scanTask, itemCounts, users, network, encoding, hostname } = input;
    if (!libraries || !users || !network || !encoding) return null;
    const hasLibrary = libraries.length > 0;
    return [
        { id: 'library', titleKey: 'SetupLibrary', helpKey: 'SetupLibraryHelp', to: '/dashboard/libraries', done: hasLibrary },
        {
            id: 'scan', titleKey: 'SetupScan', helpKey: 'SetupScanHelp', to: '/dashboard/libraries',
            done: hasLibrary && (scanTask?.LastExecutionResult?.Status === 'Completed' || hasItems(itemCounts))
        },
        {
            id: 'user', titleKey: 'SetupUser', helpKey: 'SetupUserHelp', to: '/dashboard/users/add',
            done: users.filter(u => !u.Policy?.IsDisabled).length >= 2
        },
        { id: 'remote', titleKey: 'SetupRemote', helpKey: 'SetupRemoteHelp', to: '/dashboard/networking', done: remoteReady(network, hostname) },
        {
            id: 'hardware', titleKey: 'SetupHardware', helpKey: 'SetupHardwareHelp', to: '/dashboard/playback/transcoding',
            done: !!encoding.HardwareAccelerationType && encoding.HardwareAccelerationType.toLowerCase() !== 'none'
        }
    ];
};
