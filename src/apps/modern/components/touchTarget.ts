/**
 * On phones the buttons of a group (filters, order, views, pages) are at least 44 px: the size a finger hits
 * without missing. Tablets and computers keep their compact size.
 */
import type { SxProps, Theme } from '@mui/material/styles';

/** The smallest button a finger hits reliably (WCAG 2.5.5, Apple and Material guidelines). */
export const MIN_TOUCH_PX = 44;

/** Below the "sm" breakpoint (600 px) of the theme. */
const PHONE = '@media (max-width: 599.95px)';

/** For a ButtonGroup or ToggleButtonGroup: every button inside, at least 44 × 44 px on phones. */
export const touchGroupSx: SxProps<Theme> = {
    [PHONE]: {
        '& .MuiButtonBase-root': {
            minHeight: MIN_TOUCH_PX,
            minWidth: MIN_TOUCH_PX
        }
    }
};
