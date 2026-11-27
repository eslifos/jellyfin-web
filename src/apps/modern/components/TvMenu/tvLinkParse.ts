/** A link of the Android TV home screen, "play/<id>" or "details/<id>", into its action and id; null otherwise. */
export const parseTvLink = (link: string | null) => {
    const match = /^(play|details)\/([0-9a-f-]{32,36})$/i.exec(link ?? '');
    return match ? { action: match[1].toLowerCase() as 'play' | 'details', id: match[2] } : null;
};
