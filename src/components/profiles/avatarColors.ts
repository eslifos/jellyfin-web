/** Gradient colors for avatars without an image (same name → same color everywhere). */
const GRADIENTS: [ string, string ][] = [
    [ '#00a4dc', '#0077b6' ], [ '#aa5cc3', '#7b3f92' ], [ '#4caf50', '#2e7d32' ], [ '#ff9800', '#e65100' ], [ '#e91e63', '#ad1457' ]
];

const hash = (text: string) => [ ...text ].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const getAvatarGradient = (name?: string | null) => {
    const [ from, to ] = GRADIENTS[hash(name ?? '') % GRADIENTS.length];
    return `linear-gradient(135deg, ${from}, ${to})`;
};

export const getInitial = (name?: string | null) => (name?.trim()[0] ?? '?').toUpperCase();
