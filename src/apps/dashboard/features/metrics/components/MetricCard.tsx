import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import SvgIcon from '@mui/material/SvgIcon';
import Typography from '@mui/material/Typography';
import React, { type FC } from 'react';

import { useLocale } from 'hooks/useLocale';
import { toDecimalString } from 'utils/number';

interface Metric {
    label: string
    value?: number
}

export interface MetricCardProps {
    metrics: Metric[]
    Icon: typeof SvgIcon
    /** Accent color for the icon, accent line and glow. */
    color?: string
}

const MetricCard: FC<MetricCardProps> = ({
    metrics,
    Icon,
    color = '#00a4dc'
}) => {
    const { dateTimeLocale } = useLocale();

    return (
        <Card
            elevation={0}
            sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 10px 28px rgba(0,0,0,0.4), 0 0 18px ${color}22` }
            }}
        >
            <Box sx={{
                position: 'absolute', top: 0, left: '1.2rem', right: '1.2rem', height: '2px', pointerEvents: 'none',
                background: `linear-gradient(90deg, transparent, ${color}, transparent)`
            }} />
            <Stack
                direction='row'
                spacing={2}
                sx={{
                    width: '100%',
                    padding: 2,
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                {metrics.map(({ label, value }) => (
                    <Box key={label}>
                        <Typography sx={{ fontSize: '0.68rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                            {label}
                        </Typography>
                        <Typography
                            component='div'
                            sx={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2, color: '#fff' }}
                        >
                            {typeof value !== 'undefined' ? (
                                toDecimalString(value, dateTimeLocale)
                            ) : (
                                <Skeleton width={48} />
                            )}
                        </Typography>
                    </Box>
                ))}
                <Box sx={{
                    width: 48, height: 48, flexShrink: 0, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${color}1f`, border: `1px solid ${color}44`
                }}>
                    <Icon sx={{ color, fontSize: '1.6rem' }} />
                </Box>
            </Stack>
        </Card>
    );
};

export default MetricCard;
