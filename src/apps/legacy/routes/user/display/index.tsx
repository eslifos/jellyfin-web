/**
 * DisplayPreferencesPage — React migration of the legacy display/visualization settings page.
 *
 * Two-column grid with custom collapsible glassmorphism cards.
 * Uses manual expand/collapse via useState instead of MUI Accordion to avoid event conflicts.
 */
import React, { type FC, useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CodeIcon from '@mui/icons-material/Code';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import LanguageIcon from '@mui/icons-material/Language';
import PaletteIcon from '@mui/icons-material/Palette';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import SaveIcon from '@mui/icons-material/Save';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import { useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import globalize from 'lib/globalize';
import * as userSettings from 'scripts/settings/userSettings';
import { getThemes } from 'scripts/settings/webSettings';
import { SETTING_KEY as LAYOUT_SETTING_KEY } from 'components/layoutManager';
import { pluginManager } from 'components/pluginManager';
import { PluginType } from 'constants/pluginType';
import { useLocalizationOptions, useLocalizationCountries } from 'apps/wizard/api/useLocalizationOptions';

interface Theme { id: string; name: string; }
interface Screensaver { id: string; name: string; }

const menuPaper = {
    background: 'rgba(8,10,22,0.96)',
    backdropFilter: 'blur(24px) saturate(1.5)',
    border: '1px solid rgba(0,164,220,0.2)',
    borderRadius: '14px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    '& .MuiMenuItem-root': {
        color: 'rgba(255,255,255,0.75)', borderRadius: '8px', mx: 0.5, my: 0.15, fontSize: '0.88rem',
        '&:hover': { background: 'rgba(0,164,220,0.12)', color: '#00a4dc' },
        '&.Mui-selected': { background: 'rgba(0,164,220,0.2)', color: '#00a4dc' }
    }
};

const fieldSx = {
    mb: 1.5,
    '& .MuiFilledInput-root': {
        background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
        border: '1px solid rgba(0,164,220,0.18)', transition: 'all 0.2s',
        '&:before, &:after': { display: 'none' },
        '&:hover': { background: 'rgba(0,164,220,0.07)', borderColor: 'rgba(0,164,220,0.35)' },
        '&.Mui-focused': { background: 'rgba(0,164,220,0.08)', borderColor: '#00a4dc', boxShadow: '0 0 0 3px rgba(0,164,220,0.12)' }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', letterSpacing: '0.6px', textTransform: 'uppercase' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#00a4dc' },
    '& .MuiSelect-select, & .MuiInputBase-input': { color: 'rgba(255,255,255,0.9)' },
    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' },
    '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', lineHeight: 1.4 }
};

const selectProps = { MenuProps: { PaperProps: { sx: menuPaper } } };

interface CardProps {
    id: string;
    title: string;
    icon: React.ReactNode;
    accentColor?: string;
    open: boolean;
    onToggle: (id: string) => void;
    children: React.ReactNode;
}

/** Custom collapsible card — uses onClick directly on the header, no MUI Accordion. */
const Card: FC<CardProps> = ({ id, title, icon, accentColor = '#00a4dc', open, onToggle, children }) => (
    <Paper elevation={0} sx={{
        background: 'rgba(10,12,22,0.78)', backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)', border: `1px solid ${open ? `${accentColor}40` : 'rgba(0,164,220,0.18)'}`,
        borderRadius: '18px', mb: 2, overflow: 'hidden', position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: open ? `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${accentColor}15` : 'none'
    }}>
        {/* Accent line */}
        <Box sx={{ position: 'absolute', top: 0, left: '1.5rem', right: '1.5rem', height: '2px', pointerEvents: 'none', background: `linear-gradient(90deg, transparent, ${accentColor} 40%, ${accentColor === '#00a4dc' ? '#aa5cc3' : '#00a4dc'} 60%, transparent)`, borderRadius: '0 0 4px 4px' }} />

        {/* Header — clickable */}
        <Box
            onClick={() => onToggle(id)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5, cursor: 'pointer', userSelect: 'none', '&:hover': { background: 'rgba(255,255,255,0.03)' } }}
        >
            <Box sx={{ color: accentColor, display: 'flex', '& svg': { fontSize: '1rem' } }}>{icon}</Box>
            <Typography variant='overline' sx={{ flex: 1, fontSize: '0.7rem', letterSpacing: '1.5px', color: accentColor, fontWeight: 700 }}>{title}</Typography>
            <ExpandMoreIcon sx={{ color: accentColor, fontSize: '1.2rem', transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </Box>

        {/* Content */}
        <Box sx={{ overflow: 'hidden', maxHeight: open ? '2000px' : 0, transition: 'max-height 0.35s ease', px: 2.5, pb: open ? 2.5 : 0 }}>
            {children}
        </Box>
    </Paper>
);

const Sel: FC<{ label: string; value: string; onChange: (v: string) => void; helper?: string; children: React.ReactNode }> =
    ({ label, value, onChange, helper, children }) => (
        <TextField select label={label} value={value} onChange={e => onChange(e.target.value)} fullWidth variant='filled' helperText={helper} SelectProps={selectProps} sx={fieldSx}>{children}</TextField>
    );

const Num: FC<{ label: string; value: string; onChange: (v: string) => void; helper?: string; min?: number; max?: number }> =
    ({ label, value, onChange, helper, min = 0, max = 9999 }) => (
        <TextField label={label} type='number' value={value} onChange={e => onChange(e.target.value)} fullWidth variant='filled' helperText={helper} inputProps={{ min, max, step: 1 }} sx={fieldSx} />
    );

const Check: FC<{ label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; color?: string }> =
    ({ label, desc, checked, onChange, color = '#00a4dc' }) => (
        <Box sx={{ py: 0.4 }}>
            <FormControlLabel
                control={<Checkbox checked={checked} onChange={e => onChange(e.target.checked)} sx={{ color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color } }} />}
                label={<Box><Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.82)' }}>{label}</Typography>{desc && <Typography sx={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{desc}</Typography>}</Box>}
            />
        </Box>
    );

const DisplayPreferencesPage: FC = () => {
    const [ searchParams ] = useSearchParams();
    const userId = searchParams.get('userId') || undefined;
    const { data: languages } = useLocalizationOptions();
    const { data: countries } = useLocalizationCountries();

    const [ expanded, setExpanded ] = useState({ loc: true, display: true, css: false, lib: true, nextup: true, details: true });
    const toggle = useCallback((id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id as keyof typeof prev] })), []);

    const [ themes, setThemes ] = useState<Theme[]>([]);
    const [ screensavers, setScreensavers ] = useState<Screensaver[]>([]);
    const [ saving, setSaving ] = useState(false);
    const [ saved, setSaved ] = useState(false);

    const [ lang, setLang ] = useState('');
    const [ dateLocale, setDateLocale ] = useState('');
    const [ layout, setLayout ] = useState('');
    const [ theme, setTheme ] = useState('dark');
    const [ dashboardTheme, setDashboardTheme ] = useState('dark');
    const [ screensaver, setScreensaver ] = useState('');
    const [ screensaverTime, setScreensaverTime ] = useState('5');
    const [ backdropInterval, setBackdropInterval ] = useState('5');
    const [ slideshowInterval, setSlideshowInterval ] = useState('5');
    const [ customCss, setCustomCss ] = useState('');
    const [ disableCss, setDisableCss ] = useState(false);
    const [ pageSize, setPageSize ] = useState('100');
    const [ backdrops, setBackdrops ] = useState(true);
    const [ fastFade, setFastFade ] = useState(false);
    const [ blurhash, setBlurhash ] = useState(true);
    const [ themeSongs, setThemeSongs ] = useState(true);
    const [ themeVideos, setThemeVideos ] = useState(true);
    const [ missingEpisodes, setMissingEpisodes ] = useState(false);
    const [ maxNextUpDays, setMaxNextUpDays ] = useState('30');
    const [ rewatchNextUp, setRewatchNextUp ] = useState(false);
    const [ episodeImages, setEpisodeImages ] = useState(false);
    const [ detailsBanner, setDetailsBanner ] = useState(true);

    useEffect(() => {
        getThemes().then(t => setThemes(t ?? [])).catch(() => {});
        const ss = pluginManager.ofType(PluginType.Screensaver) as Screensaver[];
        setScreensavers(ss ?? []);
        setLang(userSettings.language() ?? '');
        setDateLocale(userSettings.dateTimeLocale() ?? '');
        setLayout(localStorage.getItem(LAYOUT_SETTING_KEY) ?? '');
        setTheme(userSettings.theme() ?? 'dark');
        setDashboardTheme(userSettings.dashboardTheme() ?? 'dark');
        setScreensaver(userSettings.screensaver() ?? '');
        setScreensaverTime(String(userSettings.screensaverTime() ?? 5));
        setBackdropInterval(String(userSettings.backdropScreensaverInterval() ?? 5));
        setSlideshowInterval(String(userSettings.slideshowInterval() ?? 5));
        setCustomCss(userSettings.customCss() ?? '');
        setDisableCss(Boolean(userSettings.disableCustomCss()));
        setPageSize(String(userSettings.libraryPageSize() ?? 100));
        setBackdrops(Boolean(userSettings.enableBackdrops()));
        setFastFade(Boolean(userSettings.enableFastFadein()));
        setBlurhash(Boolean(userSettings.enableBlurhash()));
        setThemeSongs(Boolean(userSettings.enableThemeSongs()));
        setThemeVideos(Boolean(userSettings.enableThemeVideos()));
        setMaxNextUpDays(String(userSettings.maxDaysForNextUp() ?? 30));
        setRewatchNextUp(Boolean(userSettings.enableRewatchingInNextUp()));
        setEpisodeImages(Boolean(userSettings.useEpisodeImagesInNextUpAndResume()));
        setDetailsBanner(Boolean(userSettings.detailsBanner()));
    }, [ userId ]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            userSettings.language(lang);
            userSettings.dateTimeLocale(dateLocale);
            if (layout) localStorage.setItem(LAYOUT_SETTING_KEY, layout);
            else localStorage.removeItem(LAYOUT_SETTING_KEY);
            userSettings.theme(theme);
            userSettings.dashboardTheme(dashboardTheme);
            userSettings.screensaver(screensaver);
            userSettings.screensaverTime(Number(screensaverTime));
            userSettings.backdropScreensaverInterval(Number(backdropInterval));
            userSettings.slideshowInterval(Number(slideshowInterval));
            userSettings.customCss(customCss);
            userSettings.disableCustomCss(disableCss);
            userSettings.libraryPageSize(Number(pageSize));
            userSettings.enableBackdrops(backdrops);
            userSettings.enableFastFadein(fastFade);
            userSettings.enableBlurhash(blurhash);
            userSettings.enableThemeSongs(themeSongs);
            userSettings.enableThemeVideos(themeVideos);
            userSettings.maxDaysForNextUp(Number(maxNextUpDays));
            userSettings.enableRewatchingInNextUp(rewatchNextUp);
            userSettings.useEpisodeImagesInNextUpAndResume(episodeImages);
            userSettings.detailsBanner(detailsBanner);
            setSaved(true);
        } finally {
            setSaving(false);
        }
    }, [ lang, dateLocale, layout, theme, dashboardTheme, screensaver, screensaverTime, backdropInterval, slideshowInterval, customCss, disableCss, pageSize, backdrops, fastFade, blurhash, themeSongs, themeVideos, maxNextUpDays, rewatchNextUp, episodeImages, detailsBanner ]);

    return (
        <Page id='displayPreferencesPage' className='libraryPage userPreferencesPage noSecondaryNavPage mainAnimatedPage' title={globalize.translate('Display')}>
            <Box sx={{ maxWidth: 1300, mx: 'auto', px: 2, pt: 3, pb: 14 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>

                    {/* ── Columna izquierda ── */}
                    <Box>
                        <Card id='loc' title={globalize.translate('Localization')} icon={<LanguageIcon />} open={expanded.loc} onToggle={toggle}>
                            <Sel label={globalize.translate('LabelDisplayLanguage')} value={lang} onChange={setLang} helper={globalize.translate('LabelDisplayLanguageHelp')}>
                                {(languages ?? []).map(l => <MenuItem key={l.Value} value={l.Value}>{l.Name}</MenuItem>)}
                            </Sel>
                            <Sel label={globalize.translate('LabelDateTimeLocale')} value={dateLocale} onChange={setDateLocale}>
                                <MenuItem value=''>{globalize.translate('Auto')}</MenuItem>
                                {(countries ?? []).map(c => <MenuItem key={c.TwoLetterISORegionName} value={c.TwoLetterISORegionName}>{c.DisplayName}</MenuItem>)}
                            </Sel>
                        </Card>

                        <Card id='display' title={globalize.translate('Display')} icon={<PaletteIcon />} accentColor='#aa5cc3' open={expanded.display} onToggle={toggle}>
                            <Sel label={globalize.translate('LabelDisplayMode')} value={layout} onChange={setLayout} helper={globalize.translate('DisplayModeHelp')}>
                                <MenuItem value=''>{globalize.translate('Auto')}</MenuItem>
                                <MenuItem value='desktop'>{globalize.translate('Desktop')}</MenuItem>
                                <MenuItem value='mobile'>{globalize.translate('Mobile')}</MenuItem>
                                <MenuItem value='tv'>{globalize.translate('TV')}</MenuItem>
                            </Sel>
                            <Sel label={globalize.translate('LabelTheme')} value={theme} onChange={setTheme}>
                                {themes.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                            </Sel>
                            <Sel label={globalize.translate('LabelDashboardTheme')} value={dashboardTheme} onChange={setDashboardTheme}>
                                {themes.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                            </Sel>
                            {screensavers.length > 0 && (
                                <Sel label={globalize.translate('LabelScreensaver')} value={screensaver} onChange={setScreensaver}>
                                    {screensavers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                                </Sel>
                            )}
                            <Num label={globalize.translate('LabelScreensaverTime')} value={screensaverTime} onChange={setScreensaverTime} helper={globalize.translate('LabelScreensaverTimeHelp')} min={5} max={86400} />
                            <Num label={globalize.translate('LabelBackdropScreensaverInterval')} value={backdropInterval} onChange={setBackdropInterval} helper={globalize.translate('LabelBackdropScreensaverIntervalHelp')} min={1} max={3600} />
                            <Num label={globalize.translate('LabelSlideshowInterval')} value={slideshowInterval} onChange={setSlideshowInterval} helper={globalize.translate('LabelSlideshowIntervalHelp')} min={1} max={3600} />
                            <Divider sx={{ borderColor: 'rgba(170,92,195,0.15)', my: 1 }} />
                            <Check label={globalize.translate('EnableFasterAnimations')} desc={globalize.translate('EnableFasterAnimationsHelp')} checked={fastFade} onChange={setFastFade} color='#aa5cc3' />
                            <Check label={globalize.translate('EnableBlurHash')} desc={globalize.translate('EnableBlurHashHelp')} checked={blurhash} onChange={setBlurhash} color='#aa5cc3' />
                        </Card>

                        <Card id='css' title={globalize.translate('LabelCustomCss')} icon={<CodeIcon />} accentColor='#607d8b' open={expanded.css} onToggle={toggle}>
                            <Check label={globalize.translate('DisableCustomCss')} desc={globalize.translate('LabelDisableCustomCss')} checked={disableCss} onChange={setDisableCss} color='#607d8b' />
                            <TextField label={globalize.translate('LabelLocalCustomCss')} value={customCss} onChange={e => setCustomCss(e.target.value)} fullWidth multiline rows={5} variant='filled'
                                inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.82rem' } }} sx={fieldSx} />
                        </Card>
                    </Box>

                    {/* ── Columna derecha ── */}
                    <Box>
                        <Card id='lib' title={globalize.translate('HeaderLibraries')} icon={<VideoLibraryIcon />} open={expanded.lib} onToggle={toggle}>
                            <Num label={globalize.translate('LabelLibraryPageSize')} value={pageSize} onChange={setPageSize} helper={globalize.translate('LabelLibraryPageSizeHelp')} min={0} max={1000} />
                            <Divider sx={{ borderColor: 'rgba(0,164,220,0.12)', my: 1 }} />
                            <Check label={globalize.translate('Backdrops')} desc={globalize.translate('EnableBackdropsHelp')} checked={backdrops} onChange={setBackdrops} />
                            <Check label={globalize.translate('ThemeSongs')} desc={globalize.translate('EnableThemeSongsHelp')} checked={themeSongs} onChange={setThemeSongs} />
                            <Check label={globalize.translate('ThemeVideos')} desc={globalize.translate('EnableThemeVideosHelp')} checked={themeVideos} onChange={setThemeVideos} />
                            <Check label={globalize.translate('DisplayMissingEpisodesWithinSeasons')} desc={globalize.translate('DisplayMissingEpisodesWithinSeasonsHelp')} checked={missingEpisodes} onChange={setMissingEpisodes} />
                        </Card>

                        <Card id='nextup' title={globalize.translate('NextUp')} icon={<PhotoLibraryIcon />} accentColor='#4caf50' open={expanded.nextup} onToggle={toggle}>
                            <Num label={globalize.translate('LabelMaxDaysForNextUp')} value={maxNextUpDays} onChange={setMaxNextUpDays} helper={globalize.translate('LabelMaxDaysForNextUpHelp')} min={1} max={365} />
                            <Divider sx={{ borderColor: 'rgba(76,175,80,0.15)', my: 1 }} />
                            <Check label={globalize.translate('EnableRewatchingNextUp')} desc={globalize.translate('EnableRewatchingNextUpHelp')} checked={rewatchNextUp} onChange={setRewatchNextUp} color='#4caf50' />
                            <Check label={globalize.translate('UseEpisodeImagesInNextUp')} desc={globalize.translate('UseEpisodeImagesInNextUpHelp')} checked={episodeImages} onChange={setEpisodeImages} color='#4caf50' />
                        </Card>

                        <Card id='details' title={globalize.translate('ItemDetails')} icon={<InfoIcon />} accentColor='#ff9800' open={expanded.details} onToggle={toggle}>
                            <Check label={globalize.translate('EnableDetailsBanner')} desc={globalize.translate('EnableDetailsBannerHelp')} checked={detailsBanner} onChange={setDetailsBanner} color='#ff9800' />
                        </Card>
                    </Box>
                </Box>

                <Button onClick={handleSave} variant='contained' disabled={saving}
                    startIcon={saving ? <CircularProgress size={16} color='inherit' /> : <SaveIcon />}
                    sx={{ mt: 1, background: 'linear-gradient(135deg, #00a4dc, #0077b6)', borderRadius: 2, py: 1.4, px: 8, fontWeight: 600, fontSize: '0.95rem', display: 'block', mx: 'auto', '&:hover': { background: 'linear-gradient(135deg, #00b8f0, #0090d0)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,164,220,0.45)' } }}>
                    {globalize.translate('Save')}
                </Button>
            </Box>

            <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                message={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CheckCircleIcon sx={{ color: '#4caf50', fontSize: '1.1rem' }} /><Typography sx={{ fontSize: '0.88rem' }}>{globalize.translate('SettingsSaved')}</Typography></Box>}
                ContentProps={{ sx: { background: 'rgba(8,10,22,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,164,220,0.2)', borderRadius: 2 } }} />
        </Page>
    );
};

export default DisplayPreferencesPage;
