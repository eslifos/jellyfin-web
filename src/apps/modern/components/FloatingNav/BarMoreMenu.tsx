/**
 * "More" button of the floating bars on narrow phones: what does not fit in the bar goes into a small panel,
 * each entry with its name. Tools that open their own menu (watch together, cast) are placed as they are, with their
 * name next to them; a tool that is not available is left out with its name.
 */
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import React, { type FC, type ReactNode, useCallback, useState } from 'react';

import globalize from 'lib/globalize';

export interface MoreEntry {
    key: string;
    icon: ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
    /** Opens a page outside the app (help) */
    href?: string;
}

export interface MoreTool {
    key: string;
    label: string;
    /** A button that opens its own menu; it may render nothing */
    node: ReactNode;
}

interface BarMoreMenuProps {
    entries: MoreEntry[];
    tools?: MoreTool[];
    buttonSx: object;
}

const rowSx = {
    display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', px: 1.5, py: 1.1, borderRadius: '12px',
    color: 'rgba(255,255,255,0.85)', fontSize: '0.92rem', fontWeight: 600, textAlign: 'left', textDecoration: 'none',
    '& svg': { fontSize: '1.35rem' },
    '&:hover, &:focus-visible': { background: 'rgba(0,164,220,0.14)', color: '#00a4dc' }
};

/** The name of a tool works like its button. */
const pressTool = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.querySelector('button')?.click();
};

const BarMoreMenu: FC<BarMoreMenuProps> = ({ entries, tools = [], buttonSx }) => {
    const [ anchor, setAnchor ] = useState<HTMLElement | null>(null);
    const label = globalize.translate('ButtonMore');

    const open = useCallback((e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget), []);
    const close = useCallback(() => setAnchor(null), []);
    const pick = useCallback((entry: MoreEntry) => () => {
        setAnchor(null);
        entry.onClick?.();
    }, []);

    if (!entries.length && !tools.length) return null;

    return (
        <>
            <Tooltip title={label} placement='top'>
                <IconButton onClick={open} aria-label={label} aria-haspopup='true' aria-expanded={Boolean(anchor)} sx={buttonSx}>
                    <MoreHorizRoundedIcon />
                </IconButton>
            </Tooltip>
            <Popover
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={close}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: -1.5, p: 0.75, minWidth: 220, maxWidth: 'calc(100vw - 24px)', borderRadius: '18px',
                            background: 'rgba(14,17,34,0.97)', border: '1px solid rgba(0,164,220,0.25)',
                            boxShadow: '0 12px 36px rgba(0,0,0,0.6)'
                        }
                    }
                }}
            >
                <Box component='nav' aria-label={label} sx={{ display: 'flex', flexDirection: 'column' }}>
                    {entries.map(entry => (
                        <ButtonBase
                            key={entry.key}
                            {...(entry.href ?
                                { component: 'a', href: entry.href, target: '_blank', rel: 'noopener noreferrer', onClick: close } :
                                { onClick: pick(entry) })}
                            aria-current={entry.active ? 'page' : undefined}
                            sx={{ ...rowSx, ...(entry.active && { color: '#00a4dc' }) }}
                        >
                            {entry.icon}
                            {entry.label}
                        </ButtonBase>
                    ))}
                    {tools.map(tool => (
                        <Box
                            key={tool.key}
                            onClick={pressTool}
                            sx={{
                                display: 'flex', alignItems: 'center', gap: 0.5, pl: 0.25, pr: 1.5, borderRadius: '12px', cursor: 'pointer',
                                '&:hover': { background: 'rgba(0,164,220,0.14)' },
                                color: 'rgba(255,255,255,0.85)', fontSize: '0.92rem', fontWeight: 600,
                                '& button': { color: 'inherit', borderRadius: '12px', padding: '8px 10px' },
                                '& svg': { fontSize: '1.35rem' },
                                '&:not(:has(button))': { display: 'none' }
                            }}
                        >
                            {tool.node}
                            <span>{tool.label}</span>
                        </Box>
                    ))}
                </Box>
            </Popover>
        </>
    );
};

export default BarMoreMenu;
