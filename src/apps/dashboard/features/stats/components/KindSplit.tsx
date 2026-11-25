import React, { type FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import globalize from 'lib/globalize';

import { KINDS, type StatsRank, formatDuration } from '../api/playbackStats';

/** One stacked bar with how much time went to each kind of library, and its legend with values. */
const KindSplit: FC<{ rows: StatsRank[]; emptyKey: string }> = ({ rows, emptyKey }) => {
    const parts = KINDS
        .map(kind => ({ ...kind, value: rows.find(r => r.Name === kind.key)?.WatchedSeconds ?? 0 }))
        .filter(part => part.value > 0);
    const total = parts.reduce((sum, part) => sum + part.value, 0);

    if (!total) {
        return <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate(emptyKey)}</Typography>;
    }

    return (
        <Box>
            <Box role='img' aria-label={parts.map(p => `${globalize.translate(p.labelKey)} ${Math.round((p.value / total) * 100)}%`).join(', ')}
                sx={{ display: 'flex', gap: '2px', height: 14, borderRadius: '7px', overflow: 'hidden' }}>
                {parts.map(p => <Box key={p.key} title={globalize.translate(p.labelKey)} sx={{ flexGrow: p.value, flexBasis: 0, minWidth: 2, background: p.color }} />)}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                {parts.map(p => (
                    <Box key={p.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '3px', background: p.color, flexShrink: 0 }} />
                        <Typography noWrap sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', flex: 1 }}>{globalize.translate(p.labelKey)}</Typography>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{formatDuration(p.value)}</Typography>
                        <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', width: 40, textAlign: 'right' }}>{Math.round((p.value / total) * 100)}%</Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default KindSplit;
