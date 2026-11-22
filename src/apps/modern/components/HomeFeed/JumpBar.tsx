/**
 * Row of chips that scroll to each section of a page.
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import React, { type FC, type ReactNode, useCallback } from 'react';

export const JumpChip: FC<{ id: string, label: string, color: string, onJump: (id: string) => void }> = ({ id, label, color, onJump }) => {
    const onClick = useCallback(() => onJump(id), [ onJump, id ]);
    return (
        <Chip label={label} onClick={onClick} sx={{
            flexShrink: 0, fontWeight: 700, color: '#fff', background: `${color}22`, border: `1px solid ${color}55`,
            '&:hover': { background: `${color}44` }
        }} />
    );
};

export const JumpBar: FC<{ chips: { id: string, label: string, color: string }[], extra?: ReactNode }> = ({ chips, extra }) => {
    const jump = useCallback((id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);
    if (chips.length < 2 && !extra) return null;
    return (
        <Box className='padded-left padded-right' sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflowX: 'auto', py: 1.5, mb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
            {chips.map(c => <JumpChip key={c.id} id={c.id} label={c.label} color={c.color} onJump={jump} />)}
            {extra}
        </Box>
    );
};
