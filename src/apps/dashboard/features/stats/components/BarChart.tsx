/**
 * Lightweight bar chart (stacked when a bar has several segments).
 * Thin bars, rounded top, 2px gap between stacked segments, recessive grid,
 * one y-axis, per-bar hover tooltip and a legend when there are 2+ series.
 */
import React, { type FC, useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export interface BarSegment {
    key: string;
    label: string;
    value: number;
    color: string;
}

export interface BarDatum {
    id: string;
    /** Axis label; empty to hide this tick. */
    label: string;
    /** Tooltip title. */
    title: string;
    segments: BarSegment[];
}

interface BarChartProps {
    data: BarDatum[];
    height?: number;
    formatValue: (v: number) => string;
    /** Series shown in the legend (only rendered for 2+ series). */
    legend?: { key: string; label: string; color: string }[];
    /** Accessible description of the chart. */
    ariaLabel: string;
}

const GRID = 'rgba(255,255,255,0.07)';
const AXIS_TEXT = 'rgba(255,255,255,0.45)';

/** Rounds the max up to a "nice" number so gridlines land on round values. */
const niceMax = (max: number) => {
    if (max <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const n = max / pow;
    const step = [ 1, 2, 2.5, 5, 10 ].find(s => n <= s) ?? 10;
    return step * pow;
};

const BarChart: FC<BarChartProps> = ({ data, height = 200, formatValue, legend, ariaLabel }) => {
    const [ hover, setHover ] = useState<{ index: number; x: number; y: number } | null>(null);
    const totals = useMemo(() => data.map(d => d.segments.reduce((s, x) => s + x.value, 0)), [ data ]);
    const max = niceMax(Math.max(0, ...totals));
    const ticks = [ max, max * 0.75, max * 0.5, max * 0.25, 0 ];
    const barWidth = Math.max(2, Math.min(22, Math.floor(560 / Math.max(1, data.length))));

    const onLeave = useCallback(() => setHover(null), []);
    const hovered = hover ? data[hover.index] : null;

    return (
        <Box role='img' aria-label={ariaLabel} sx={{ position: 'relative' }} onMouseLeave={onLeave}>
            <Box sx={{ display: 'flex', gap: 1 }}>
                {/* Y axis */}
                <Box sx={{ height, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0, minWidth: 34, textAlign: 'right' }}>
                    {ticks.map(t => (
                        <Typography key={t} sx={{ fontSize: '0.64rem', color: AXIS_TEXT, lineHeight: 1, transform: 'translateY(-50%)', '&:first-of-type': { transform: 'none' }, '&:last-of-type': { transform: 'translateY(-100%)' } }}>
                            {formatValue(t)}
                        </Typography>
                    ))}
                </Box>

                {/* Plot */}
                <Box sx={{ flex: 1, minWidth: 0, position: 'relative', height }}>
                    {ticks.map((t, i) => (
                        <Box key={t} sx={{ position: 'absolute', left: 0, right: 0, top: `${(i / (ticks.length - 1)) * 100}%`, borderTop: `1px solid ${i === ticks.length - 1 ? 'rgba(255,255,255,0.18)' : GRID}` }} />
                    ))}
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around' }}>
                        {data.map((d, i) => {
                            const total = totals[i];
                            const active = hover?.index === i;
                            return (
                                <Box
                                    key={d.id}
                                    onMouseEnter={e => {
                                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        setHover({ index: i, x: r.left + r.width / 2, y: r.top });
                                    }}
                                    sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'default', background: active ? 'rgba(255,255,255,0.04)' : 'transparent', borderRadius: '4px' }}
                                >
                                    <Box sx={{ width: barWidth, height: `${(total / max) * 100}%`, display: 'flex', flexDirection: 'column-reverse', gap: total > 0 ? '2px' : 0 }}>
                                        {d.segments.filter(s => s.value > 0).map((s, si, arr) => (
                                            <Box key={s.key} sx={{
                                                flexGrow: s.value, flexBasis: 0, minHeight: 2, background: s.color,
                                                borderRadius: si === arr.length - 1 ? '4px 4px 0 0' : 0,
                                                opacity: hover && !active ? 0.55 : 1, transition: 'opacity 0.15s'
                                            }} />
                                        ))}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Box>

            {/* X axis */}
            <Box sx={{ display: 'flex', ml: '42px', mt: 0.75 }}>
                {data.map(d => (
                    <Typography key={d.id} sx={{ flex: 1, fontSize: '0.64rem', color: AXIS_TEXT, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}>
                        {d.label}
                    </Typography>
                ))}
            </Box>

            {legend && legend.length > 1 && (
                <Box sx={{ display: 'flex', gap: 2, mt: 1.25, flexWrap: 'wrap' }}>
                    {legend.map(l => (
                        <Box key={l.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '3px', background: l.color }} />
                            <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)' }}>{l.label}</Typography>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Tooltip */}
            {hover && hovered && (
                <Box sx={{
                    position: 'fixed', left: hover.x, top: hover.y - 8, transform: 'translate(-50%, -100%)', zIndex: 1500, pointerEvents: 'none',
                    px: 1.25, py: 0.9, borderRadius: '10px', background: 'rgba(8,10,22,0.96)', border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 140
                }}>
                    <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, mb: 0.5, color: '#fff' }}>{hovered.title}</Typography>
                    {hovered.segments.map(s => (
                        <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '2px', background: s.color, flexShrink: 0 }} />
                            <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', flex: 1 }}>{s.label}</Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: '#fff', fontWeight: 600 }}>{formatValue(s.value)}</Typography>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default BarChart;
