/**
 * Settings → Home: order and visibility of the home screen sections (each library is a section).
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import HeadphonesRoundedIcon from '@mui/icons-material/HeadphonesRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RecommendRoundedIcon from '@mui/icons-material/RecommendRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import React, { type FC, type ReactNode, useCallback } from 'react';

import globalize from 'lib/globalize';

import LibraryIcon from '../LibraryIcon';
import { libraryAccent } from './libraryAccent';
import { SECTION_LABELS, isLibKey } from './homeSections';

const ICONS: Record<string, [ReactNode, string]> = {
    resume: [ <HistoryRoundedIcon key='i' />, '#00a4dc' ],
    nextup: [ <SkipNextRoundedIcon key='i' />, '#aa5cc3' ],
    listening: [ <HeadphonesRoundedIcon key='i' />, '#ff7043' ],
    spotlight: [ <CasinoRoundedIcon key='i' />, '#ffca28' ],
    upcoming: [ <EventRoundedIcon key='i' />, '#26c6da' ],
    recommendations: [ <RecommendRoundedIcon key='i' />, '#66bb6a' ],
    genres: [ <CategoryRoundedIcon key='i' />, '#ff7043' ],
    favorites: [ <FavoriteRoundedIcon key='i' />, '#ef5350' ]
};

interface RowProps {
    sectionKey: string;
    label: string;
    icon: ReactNode;
    color: string;
    index: number;
    count: number;
    visible: boolean;
    onMove: (index: number, delta: number) => void;
    onToggle: (key: string, visible: boolean) => void;
}

const SectionRow: FC<RowProps> = ({ sectionKey, label, icon, color, index, count, visible, onMove, onToggle }) => {
    const up = useCallback(() => onMove(index, -1), [ onMove, index ]);
    const down = useCallback(() => onMove(index, 1), [ onMove, index ]);
    const toggle = useCallback((_: React.ChangeEvent, checked: boolean) => onToggle(sectionKey, checked), [ onToggle, sectionKey ]);

    return (
        <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, px: 1.25, py: 0.6, mb: 0.75, borderRadius: '12px',
            background: visible ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)', border: '1px solid ' + (visible ? color + '33' : 'rgba(255,255,255,0.05)'),
            opacity: visible ? 1 : 0.55, transition: 'all 0.2s'
        }}>
            <Typography sx={{ width: 20, textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.35)' }}>{index + 1}</Typography>
            <Box sx={{ display: 'flex', color, '& svg': { fontSize: '1.2rem' } }}>{icon}</Box>
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: '0.88rem', fontWeight: 600, color: 'rgba(255,255,255,0.88)' }} noWrap>{label}</Typography>
            <Switch size='small' checked={visible} onChange={toggle} />
            <IconButton size='small' title={globalize.translate('Up')} disabled={index === 0} onClick={up}><KeyboardArrowUpIcon fontSize='small' /></IconButton>
            <IconButton size='small' title={globalize.translate('Down')} disabled={index === count - 1} onClick={down}><KeyboardArrowDownIcon fontSize='small' /></IconButton>
        </Box>
    );
};

interface HomeSectionsEditorProps {
    views: BaseItemDto[];
    order: string[];
    hidden: string[];
    onOrderChange: (order: string[]) => void;
    onHiddenChange: (hidden: string[]) => void;
}

const HomeSectionsEditor: FC<HomeSectionsEditorProps> = ({ views, order, hidden, onOrderChange, onHiddenChange }) => {
    const onMove = useCallback((index: number, delta: number) => {
        const to = index + delta;
        if (to < 0 || to >= order.length) return;
        const next = [ ...order ];
        [ next[index], next[to] ] = [ next[to], next[index] ];
        onOrderChange(next);
    }, [ order, onOrderChange ]);

    const onToggle = useCallback((key: string, visible: boolean) => {
        onHiddenChange(visible ? hidden.filter(k => k !== key) : [ ...hidden.filter(k => k !== key), key ]);
    }, [ hidden, onHiddenChange ]);

    return (
        <Box>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', mb: 1.25 }}>{globalize.translate('HfSectionsHelp')}</Typography>
            {order.map((key, i) => {
                let label = globalize.translate(SECTION_LABELS[key] ?? key);
                let icon: ReactNode = ICONS[key]?.[0];
                let color = ICONS[key]?.[1] ?? '#00a4dc';
                if (isLibKey(key)) {
                    const view = views.find(v => `lib:${v.Id}` === key);
                    if (!view) return null;
                    label = view.Name ?? '';
                    icon = <LibraryIcon item={view} />;
                    color = libraryAccent(view);
                }
                return (
                    <SectionRow
                        key={key}
                        sectionKey={key}
                        label={label}
                        icon={icon}
                        color={color}
                        index={i}
                        count={order.length}
                        visible={!hidden.includes(key)}
                        onMove={onMove}
                        onToggle={onToggle}
                    />
                );
            })}
        </Box>
    );
};

export default HomeSectionsEditor;
