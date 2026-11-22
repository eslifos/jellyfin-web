/** Glass look shared by the toolbar menus (play on, watch together). */
export const glassPaperSx = {
    background: 'rgba(8, 10, 22, 0.94)',
    backdropFilter: 'blur(24px) saturate(1.5)',
    border: '1px solid rgba(0, 164, 220, 0.2)',
    borderRadius: '16px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
    color: '#fff',
    overflowX: 'hidden',
    '& .MuiListItemButton-root': {
        borderRadius: '10px',
        mx: 0.8,
        mb: 0.3,
        px: 1.5,
        transition: 'background 0.15s',
        '&:hover': { background: 'rgba(0,164,220,0.12)' },
        '&.Mui-selected': { background: 'rgba(0,164,220,0.14)' }
    },
    '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.6)', minWidth: 38 },
    '& .MuiListItemText-primary': { fontSize: '0.92rem', fontWeight: 600 },
    '& .MuiListItemText-secondary': { fontSize: '0.76rem', color: 'rgba(255,255,255,0.5)' }
};

/** Opens downwards from a top bar and upwards from the bottom navigation. */
export const popoverPlacement = (anchor: Element | null) => {
    const below = !anchor || anchor.getBoundingClientRect().top < window.innerHeight / 2;
    return below ?
        { anchorOrigin: { vertical: 'bottom', horizontal: 'right' }, transformOrigin: { vertical: 'top', horizontal: 'right' } } as const :
        { anchorOrigin: { vertical: 'top', horizontal: 'center' }, transformOrigin: { vertical: 'bottom', horizontal: 'center' } } as const;
};
