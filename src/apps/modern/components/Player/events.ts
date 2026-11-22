/** Event that opens the full player: the "now playing" and "remote control" buttons of the app send it. */
export const OPEN_PLAYER_EVENT = 'abp-open';

export const openPlayer = () => {
    window.dispatchEvent(new Event(OPEN_PLAYER_EVENT));
};
