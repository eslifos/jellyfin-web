import { Api } from '@jellyfin/sdk';
import type { EndPointInfo } from '@jellyfin/sdk/lib/generated-client/models/end-point-info';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';

/** Maximum bitrate (Int32) */
const MAX_BITRATE = 2147483647;
/** Approximate LAN bitrate */
const LAN_BITRATE = 140000000;
/** Bitrate test timeout in milliseconds */
const BITRATETEST_TIMEOUT = 5000;
/** Bitrate cache time in milliseconds */
export const BITRATE_CACHE_DURATION = 3600000;
/** Where the last result of each server is kept, so a reload does not measure again. */
const STORAGE_PREFIX = 'jfBitrateTest:';

let lastDetectedBitrate: number;
let lastDetectedBitrateTime: number;
let pendingBitrateDetection: Promise<number> | null = null;

export interface BitrateTest {
    bytes: number;
    threshold: number;
}

/**
 * The network of the device, as the browser tells it:
 *  - saveData: the person asked to save data;
 *  - cellular: a mobile network (data may be paid by the megabyte);
 *  - normal: anything else (or the browser does not say).
 */
export type NetworkProfile = 'saveData' | 'cellular' | 'normal';

interface NetworkInformationLike {
    saveData?: boolean;
    type?: string;
    downlinkMax?: number;
}

const connectionInfo = () => (navigator as unknown as { connection?: NetworkInformationLike }).connection;

export const getNetworkProfile = (connection: NetworkInformationLike | undefined = connectionInfo()): NetworkProfile => {
    if (connection?.saveData) return 'saveData';
    if (connection?.type === 'cellular') return 'cellular';
    return 'normal';
};

/** The full series grows up to 4.5 MB; on a constrained network only the first 500 KB test is made. */
const FULL_TESTS: BitrateTest[] = [
    { bytes: 500000, threshold: 500000 },
    { bytes: 1000000, threshold: 20000000 },
    { bytes: 3000000, threshold: 50000000 }
];

export const testsFor = (profile: NetworkProfile): BitrateTest[] => (profile === 'normal' ? FULL_TESTS : FULL_TESTS.slice(0, 1));

/** A prudent top quality where data is scarce or asked to be saved (bits per second). */
export const PROFILE_CAPS: Record<NetworkProfile, number> = {
    saveData: 2000000,
    cellular: 4000000,
    normal: MAX_BITRATE
};

export const capForProfile = (bitrate: number, profile: NetworkProfile) => Math.min(bitrate, PROFILE_CAPS[profile]);

interface StoredBitrate {
    bitrate: number;
    at: number;
    profile: NetworkProfile;
}

const storageKey = (serverAddress: string) => STORAGE_PREFIX + serverAddress;

/** The result kept for this server, if it is recent and was measured on the same kind of network. */
export const readStoredBitrate = (serverAddress: string, profile: NetworkProfile, now = Date.now()): number | undefined => {
    try {
        const stored = JSON.parse(localStorage.getItem(storageKey(serverAddress)) ?? 'null') as StoredBitrate | null;
        if (!stored || typeof stored.bitrate !== 'number' || stored.bitrate <= 0) return undefined;
        if (stored.profile !== profile || now - stored.at > BITRATE_CACHE_DURATION || stored.at > now) return undefined;
        return stored.bitrate;
    } catch {
        return undefined;
    }
};

export const storeBitrate = (serverAddress: string, bitrate: number, profile: NetworkProfile, now = Date.now()) => {
    try {
        localStorage.setItem(storageKey(serverAddress), JSON.stringify({ bitrate, at: now, profile } satisfies StoredBitrate));
    } catch {
        // Storage blocked: the result is kept for this page only
    }
};

/** Gets a normalized maximum downlink speed (only supported on certain browsers) */
const getMaxBandwidth = () => {
    const connection = connectionInfo();
    if (connection) {
        let max = connection.downlinkMax;
        if (max && max > 0 && max < Number.POSITIVE_INFINITY) {
            max /= 8;
            max *= 1000000;
            max *= 0.7;
            return max;
        }
    }

    return null;
};

/**
 * Perform a download speed test
 * @param {Api} api The Api client
 * @param {number} bytes The bytes to download
 * @returns {number} Download speed in bits per second
 */
const getDownloadSpeed = (api: Api, bytes: number) => {
    return new Promise<number>((resolve, reject) => {
        const url = api.basePath + '/Playback/BitrateTest?' + new URLSearchParams({
            Size: bytes.toString()
        });

        const xhr = new XMLHttpRequest;

        xhr.open('GET', url, true);

        xhr.responseType = 'blob';
        xhr.timeout = BITRATETEST_TIMEOUT;

        const headers = {
            'Cache-Control': 'no-cache, no-store',
            'Authorization': api.authorizationHeader
        };

        for (const key in headers) {
            xhr.setRequestHeader(key, headers[key as keyof typeof headers]);
        }

        let startTime: number;

        xhr.onreadystatechange = () => {
            if (xhr.readyState == XMLHttpRequest.HEADERS_RECEIVED) {
                startTime = performance.now();
            }
        };

        xhr.onload = () => {
            if (xhr.status < 400) {
                const responseTimeSeconds = (performance.now() - startTime) * 1e-3;
                const bytesLoaded = xhr.response.size;
                const bytesPerSecond = bytesLoaded / responseTimeSeconds;
                const bitrate = Math.round(bytesPerSecond * 8);

                console.debug(`[bitratetest] ${bytesLoaded} bytes loaded (${bytes} requested) in ${responseTimeSeconds} seconds -> ${bitrate} bps`);

                resolve(bitrate);
            } else {
                reject(new Error(`[bitratetest] failed with ${xhr.status} status`));
            }
        };

        xhr.onabort = () => {
            reject(new Error('[bitratetest] abort'));
        };

        xhr.onerror = () => {
            reject(new Error('[bitratetest] error'));
        };

        xhr.ontimeout = () => {
            reject(new Error('[bitratetest] timeout'));
        };

        xhr.send(null);
    });
};

/**
 * Normalizes the bitrate value by reducing it by 30% (to account for network overhead)
 * and limits the value by MAX_BITRATE
 * @param bitrate The bitrate to normalize
 * @returns {number} Normalized bitrate
 */
const normalizeReturnBitrate = (bitrate: number) => {
    if (!bitrate) {
        if (lastDetectedBitrate) {
            return lastDetectedBitrate;
        }
    }

    let result = Math.min(Math.round(bitrate * 0.7), MAX_BITRATE);

    const maxRate = getMaxBandwidth();
    if (maxRate) {
        result = Math.min(result, maxRate);
    }

    lastDetectedBitrate = result;
    lastDetectedBitrateTime = Date.now();

    return result;
};

/**
 *
 * @param {Api} api The Api client
 * @param {BitrateTest[]} tests The tests to perform
 * @param {number} index Current test index
 * @param {number | undefined} currentBitrate Current bitrate
 * @returns {number} Normalized bitrate
 */
const detectBitrateInternal = (api: Api, tests: BitrateTest[], index: number, currentBitrate: number | undefined): Promise<number> => {
    if (index >= tests.length) {
        return Promise.resolve(normalizeReturnBitrate(currentBitrate || 0));
    }

    const test = tests[index];

    return getDownloadSpeed(api, test.bytes).then(
        // eslint-disable-next-line sonarjs/function-return-type
        (bitrate) => {
            if (bitrate < test.threshold) {
                return normalizeReturnBitrate(bitrate);
            } else {
                return detectBitrateInternal(api, tests, index + 1, bitrate);
            }
        },
        () => normalizeReturnBitrate(currentBitrate || 0)
    );
};

/**
 * Detects the bitrate using a series of tests
 * @param {Api} api The api client
 * @param {EndPointInfo} endpointInfo Endpoint info for special handling on local networks
 * @returns {number} Normalized bitrate
 */
const detectBitrateWithEndpointInfo = (api: Api, endpointInfo: EndPointInfo, profile: NetworkProfile) => {
    return detectBitrateInternal(api, testsFor(profile), 0, undefined).then(result => {
        const bitrateInMbps = (result / 1048576).toFixed(2);
        console.debug(`[bitratetest] bitrate detected as ${bitrateInMbps} Mbps (${profile} network)`);
        // A mobile network is never the server's own network, whatever the address says
        if (endpointInfo.IsInNetwork && profile === 'normal') {
            result = Math.max(result || 0, LAN_BITRATE);
        }
        result = capForProfile(result, profile);
        lastDetectedBitrate = result;
        lastDetectedBitrateTime = Date.now();
        if (result > 0) storeBitrate(api.basePath, result, profile, lastDetectedBitrateTime);
        return result;
    });
};

/**
 * Detects the bitrate on the current device. Called by the player right before a playback that needs it (quality
 * set to automatic); a result of less than an hour for this server, kept in local storage, is used instead of
 * measuring again (also after a reload), unless forced.
 * @param {Api} api The Api client
 * @param {boolean} force Ignore the cached bitrate and force a re-detection
 * @returns {number} The detected bitrate
 */
export const detectBitrate = (api: Api, force = false) => {
    const profile = getNetworkProfile();

    if (!force) {
        if (lastDetectedBitrate && Date.now() - (lastDetectedBitrateTime || 0) <= BITRATE_CACHE_DURATION) {
            return Promise.resolve(capForProfile(lastDetectedBitrate, profile));
        }
        const stored = readStoredBitrate(api.basePath, profile);
        if (stored) {
            console.debug(`[bitratetest] using the result kept for this server: ${(stored / 1048576).toFixed(2)} Mbps`);
            return Promise.resolve(stored);
        }
    }

    if (pendingBitrateDetection) {
        return pendingBitrateDetection;
    }

    pendingBitrateDetection = getSystemApi(api)
        .getEndpointInfo()
        .then(
            (response) => detectBitrateWithEndpointInfo(api, response.data, profile),
            () => detectBitrateWithEndpointInfo(api, {}, profile)
        ).finally(() => {
            pendingBitrateDetection = null;
        });

    return pendingBitrateDetection;
};
