/**
 * SubtitlePreferencesPage — React migration of the legacy subtitle settings
 * (components/subtitlesettings), split into colored glassmorphism cards.
 * Reads and writes exactly the same settings as the legacy form.
 */
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import React, { type CSSProperties, type FC, useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ClosedCaptionIcon from '@mui/icons-material/ClosedCaption';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter';
import { useSearchParams } from 'react-router-dom';

import { appHost } from 'components/apphost';
import layoutManager from 'components/layoutManager';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { getStyles } from 'components/subtitlesettings/subtitleappearancehelper';
import { AppFeature } from 'constants/appFeature';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import rawAppSettings from 'scripts/settings/appSettings';
import * as userSettings from 'scripts/settings/userSettings';
import { queryClient } from 'utils/query/queryClient';

import { type Accessors, Card, Check, SaveButton, SavedSnackbar, Sel, fieldSx } from '../components/PreferencesUi';

const appSettings = rawAppSettings as unknown as Accessors;

const C = {
    subtitles: '#00a4dc',
    burnIn: '#ff9800',
    appearance: '#aa5cc3',
    position: '#26c6da'
};

const MODES: { value: string; label: string; help: string }[] = [
    { value: 'Default', label: 'Default', help: 'DefaultSubtitlesHelp' },
    { value: 'Smart', label: 'Smart', help: 'SmartSubtitlesHelp' },
    { value: 'OnlyForced', label: 'OnlyForcedSubtitles', help: 'OnlyForcedSubtitlesHelp' },
    { value: 'Always', label: 'AlwaysPlaySubtitles', help: 'AlwaysPlaySubtitlesHelp' },
    { value: 'None', label: 'None', help: 'NoSubtitlesHelp' }
];

const STYLINGS: { value: string; label: string; help: string }[] = [
    { value: 'Auto', label: 'Auto', help: 'AutoSubtitleStylingHelp' },
    { value: 'Custom', label: 'Custom', help: 'CustomSubtitleStylingHelp' },
    { value: 'Native', label: 'Native', help: 'NativeSubtitleStylingHelp' }
];

type Option = [ value: string, labelKey: string ];

const BURN_IN: Option[] = [ [ '', 'Auto' ], [ 'onlyimageformats', 'OnlyImageFormats' ], [ 'allcomplexformats', 'AllComplexFormats' ], [ 'all', 'All' ] ];
const ASPECT_MODES: Option[] = [ [ 'stretch', 'BitmapSubtitleAspectModeStretch' ], [ 'contain', 'BitmapSubtitleAspectModeContain' ], [ 'cover', 'BitmapSubtitleAspectModeCover' ] ];
const TEXT_SIZES: Option[] = [ [ 'smaller', 'Smaller' ], [ 'small', 'Small' ], [ '', 'Normal' ], [ 'large', 'Large' ], [ 'larger', 'Larger' ], [ 'extralarge', 'ExtraLarge' ] ];
const TEXT_WEIGHTS: Option[] = [ [ 'normal', 'Normal' ], [ 'bold', 'Bold' ] ];
const FONTS: Option[] = [ [ '', 'Default' ], [ 'typewriter', 'Typewriter' ], [ 'print', 'Print' ], [ 'console', 'Console' ], [ 'cursive', 'Cursive' ], [ 'casual', 'Casual' ], [ 'smallcaps', 'SmallCaps' ] ];
const DROP_SHADOWS: Option[] = [ [ 'none', 'None' ], [ 'raised', 'Raised' ], [ 'depressed', 'Depressed' ], [ 'uniform', 'Uniform' ], [ '', 'DropShadow' ] ];
const TV_COLORS: Option[] = [
    [ '#ffffff', 'SubtitleWhite' ], [ '#d3d3d3', 'SubtitleLightGray' ], [ '#808080', 'SubtitleGray' ], [ '#ffff00', 'SubtitleYellow' ],
    [ '#008000', 'SubtitleGreen' ], [ '#00ffff', 'SubtitleCyan' ], [ '#0000ff', 'SubtitleBlue' ], [ '#ff00ff', 'SubtitleMagenta' ],
    [ '#ff0000', 'SubtitleRed' ], [ '#000000', 'SubtitleBlack' ]
];

interface Culture { ThreeLetterISOLanguageName: string; DisplayName: string }

interface Appearance {
    aspectMode: string;
    subtitleStyling: string;
    textSize: string;
    textWeight: string;
    dropShadow: string;
    font: string;
    textBackground: string;
    textColor: string;
    verticalPosition: number;
}

/** Convert the helper's [{ name: 'font-size', value }] list into a React style object. */
const toStyle = (list: { name: string; value: string }[]): CSSProperties => (
    Object.fromEntries(list.filter(s => s.value !== '').map(s => [ s.name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), s.value ]))
);

const helpSx = { fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4, mt: -0.75, mb: 1.5, px: 0.5 };

const SubtitlePreferencesPage: FC = () => {
    const { user: currentUser, __legacyApiClient__: apiClient } = useApi();
    const [ searchParams ] = useSearchParams();
    const userId = searchParams.get('userId') || currentUser?.Id;

    const settings = useMemo(() => (
        userId && userId !== currentUser?.Id ? new userSettings.UserSettings() : userSettings.currentSettings
    ), [ userId, currentUser ]) as unknown as Accessors;

    const [ loaded, setLoaded ] = useState(false);
    const [ saving, setSaving ] = useState(false);
    const [ saved, setSaved ] = useState(false);
    const [ expanded, setExpanded ] = useState<Record<string, boolean>>({ subtitles: true, burnIn: true, appearance: true, position: true });
    const toggle = useCallback((id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] })), []);

    const [ user, setUser ] = useState<UserDto>();
    const [ cultures, setCultures ] = useState<Culture[]>([]);

    const [ language, setLanguage ] = useState('');
    const [ mode, setMode ] = useState('Default');
    const [ burnIn, setBurnIn ] = useState('');
    const [ renderPgs, setRenderPgs ] = useState(false);
    const [ alwaysBurnIn, setAlwaysBurnIn ] = useState(false);
    const [ appearance, setAppearance ] = useState<Appearance>({
        aspectMode: 'stretch', subtitleStyling: 'Auto', textSize: '', textWeight: 'normal', dropShadow: '',
        font: '', textBackground: 'transparent', textColor: '#ffffff', verticalPosition: -3
    });
    const [ showFullPreview, setShowFullPreview ] = useState(false);
    const [ sliderActive, setSliderActive ] = useState(false);

    const setApp = useCallback(<K extends keyof Appearance>(key: K, value: Appearance[K]) => {
        setAppearance(prev => ({ ...prev, [key]: value }));
    }, []);

    useEffect(() => {
        if (!apiClient || !userId) return;
        let cancelled = false;

        const load = async () => {
            const [ u, allCultures ] = await Promise.all([
                apiClient.getUser(userId) as Promise<UserDto>,
                apiClient.getCultures() as Promise<Culture[]>
            ]);
            await settings.setUserInfo(userId, apiClient);
            if (cancelled) return;

            const a = settings.getSubtitleAppearanceSettings() as Partial<Appearance>;
            setAppearance({
                aspectMode: a.aspectMode || 'stretch',
                subtitleStyling: a.subtitleStyling || 'Auto',
                textSize: a.textSize || '',
                textWeight: a.textWeight || 'normal',
                dropShadow: a.dropShadow || '',
                font: a.font || '',
                textBackground: a.textBackground || 'transparent',
                textColor: a.textColor || '#ffffff',
                verticalPosition: Number(a.verticalPosition ?? -3)
            });

            setLanguage(u.Configuration?.SubtitleLanguagePreference || '');
            setMode(u.Configuration?.SubtitleMode || 'Default');
            setBurnIn(appSettings.get('subtitleburnin') || '');
            setRenderPgs(appSettings.get('subtitlerenderpgs') === 'true');
            setAlwaysBurnIn(Boolean(appSettings.alwaysBurnInSubtitleWhenTranscoding()));

            setUser(u);
            setCultures(allCultures ?? []);
            setLoaded(true);
        };

        load().catch(err => console.error('[SubtitlePreferences] failed to load settings', err));
        return () => { cancelled = true; };
    }, [ apiClient, userId, settings ]);

    const handleSave = useCallback(async () => {
        if (!apiClient || !userId) return;
        setSaving(true);
        try {
            appSettings.set('subtitleburnin', burnIn);
            appSettings.set('subtitlerenderpgs', renderPgs);
            appSettings.alwaysBurnInSubtitleWhenTranscoding(alwaysBurnIn);

            const u: UserDto = await apiClient.getUser(userId);
            await settings.setUserInfo(userId, apiClient);
            if (!u.Configuration) throw new Error('Missing user configuration');

            const current = settings.getSubtitleAppearanceSettings();
            settings.setSubtitleAppearanceSettings({ ...current, ...appearance, verticalPosition: String(appearance.verticalPosition) });

            u.Configuration.SubtitleLanguagePreference = language;
            u.Configuration.SubtitleMode = mode as NonNullable<UserDto['Configuration']>['SubtitleMode'];

            await apiClient.updateUserConfiguration(userId, u.Configuration);
            void queryClient.invalidateQueries({ queryKey: [ 'User', userId ] });
            setSaved(true);
        } catch (err) {
            console.error('[SubtitlePreferences] failed to save settings', err);
        } finally {
            setSaving(false);
        }
    }, [ apiClient, userId, settings, burnIn, renderPgs, alwaysBurnIn, appearance, language, mode ]);

    const previewStyles = useMemo(() => getStyles(appearance, true), [ appearance ]);
    const fullStyles = useMemo(() => getStyles(appearance, false), [ appearance ]);

    if (!loaded || !user) return <Loading />;

    const showBurnIn = appHost.supports(AppFeature.SubtitleBurnIn) && Boolean(user.Policy?.EnableVideoPlaybackTranscoding);
    const showRenderPgs = burnIn === '';
    const showAspectMode = showRenderPgs && renderPgs;
    const showAppearance = appHost.supports(AppFeature.SubtitleAppearance);
    const modeHelp = MODES.find(m => m.value === mode)?.help;
    const stylingHelp = STYLINGS.find(s => s.value === appearance.subtitleStyling)?.help;

    const options = (list: Option[]) => list.map(([ value, label ]) => <MenuItem key={value} value={value}>{globalize.translate(label)}</MenuItem>);

    return (
        <Page id='subtitlesPreferencesPage' className='libraryPage userPreferencesPage noSecondaryNavPage mainAnimatedPage' title={globalize.translate('Subtitles')}>
            <Box sx={{ maxWidth: 1300, mx: 'auto', px: 2, pt: 3, pb: 14 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>

                    {/* ── Columna izquierda ── */}
                    <Box>
                        <Card id='subtitles' title={globalize.translate('Subtitles')} icon={<ClosedCaptionIcon />} accentColor={C.subtitles} open={expanded.subtitles} onToggle={toggle}>
                            <Sel label={globalize.translate('LabelPreferredSubtitleLanguage')} value={language} onChange={setLanguage}>
                                <MenuItem value=''>{globalize.translate('AnyLanguage')}</MenuItem>
                                {cultures.map(c => <MenuItem key={c.ThreeLetterISOLanguageName} value={c.ThreeLetterISOLanguageName}>{c.DisplayName}</MenuItem>)}
                            </Sel>
                            <Sel label={globalize.translate('LabelSubtitlePlaybackMode')} value={mode} onChange={setMode}>
                                {MODES.map(m => <MenuItem key={m.value} value={m.value}>{globalize.translate(m.label)}</MenuItem>)}
                            </Sel>
                            {modeHelp && <Typography sx={helpSx}>{globalize.translate(modeHelp)}</Typography>}
                        </Card>

                        <Card id='burnIn' title={globalize.translate('LabelBurnSubtitles')} icon={<LocalFireDepartmentIcon />} accentColor={C.burnIn} open={expanded.burnIn} onToggle={toggle}>
                            {showBurnIn && (
                                <Sel label={globalize.translate('LabelBurnSubtitles')} value={burnIn} onChange={setBurnIn} helper={globalize.translate('BurnSubtitlesHelp')}>
                                    {options(BURN_IN)}
                                </Sel>
                            )}
                            {showRenderPgs && (
                                <Check label={globalize.translate('RenderPgsSubtitle')} desc={globalize.translate('RenderPgsSubtitleHelp')}
                                    checked={renderPgs} onChange={setRenderPgs} color={C.burnIn} />
                            )}
                            {showAspectMode && (
                                <Box sx={{ mt: 1.5 }}>
                                    <Sel label={globalize.translate('LabelBitmapSubtitleAspectMode')} value={appearance.aspectMode}
                                        onChange={v => setApp('aspectMode', v)} helper={globalize.translate('BitmapSubtitleAspectModeHelp')}>
                                        {options(ASPECT_MODES)}
                                    </Sel>
                                </Box>
                            )}
                            <Check label={globalize.translate('AlwaysBurnInSubtitleWhenTranscoding')} desc={globalize.translate('AlwaysBurnInSubtitleWhenTranscodingHelp')}
                                checked={alwaysBurnIn} onChange={setAlwaysBurnIn} color={C.burnIn} />
                        </Card>

                        {showAppearance && (
                            <Card id='position' title={globalize.translate('LabelSubtitleVerticalPosition')} icon={<VerticalAlignCenterIcon />} accentColor={C.position} open={expanded.position} onToggle={toggle}>
                                <Box sx={{ px: 1, pt: 1 }}>
                                    <Slider
                                        value={appearance.verticalPosition} min={-16} max={16} step={1} valueLabelDisplay='auto'
                                        onChange={(_, v) => { setApp('verticalPosition', v as number); setSliderActive(true); }}
                                        onChangeCommitted={() => setSliderActive(false)}
                                        onMouseEnter={() => setSliderActive(true)} onMouseLeave={() => setSliderActive(false)}
                                        sx={{ color: C.position }}
                                    />
                                </Box>
                                <Typography sx={{ ...helpSx, mt: 0 }}>{globalize.translate('SubtitleVerticalPositionHelp')}</Typography>
                                <Check label={globalize.translate('Preview')} checked={showFullPreview} onChange={setShowFullPreview} color={C.position} />
                            </Card>
                        )}
                    </Box>

                    {/* ── Columna derecha ── */}
                    {showAppearance && (
                        <Box>
                            <Card id='appearance' title={globalize.translate('HeaderSubtitleAppearance')} icon={<FormatColorTextIcon />} accentColor={C.appearance} open={expanded.appearance} onToggle={toggle}>
                                {/* Inline preview */}
                                <Box sx={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', my: 1.5, p: 3, borderRadius: '14px', color: 'black',
                                    background: 'linear-gradient(140deg, #aa5cc3, #00a4dc)'
                                }}>
                                    <Box sx={{ width: '90%', p: 0.5, display: 'flex', justifyContent: 'center' }} style={toStyle(previewStyles.window)}>
                                        <Box sx={{ textAlign: 'center' }} style={toStyle(previewStyles.text)}>
                                            {globalize.translate('TheseSettingsAffectSubtitlesOnThisDevice')}
                                        </Box>
                                    </Box>
                                </Box>
                                <Typography sx={{ ...helpSx, mt: 0, mb: 0.5 }}>{globalize.translate('SubtitleAppearanceSettingsDisclaimer')}</Typography>
                                <Typography sx={{ ...helpSx, mt: 0, mb: 2 }}>{globalize.translate('SubtitleAppearanceSettingsAlsoPassedToCastDevices')}</Typography>

                                <Sel label={globalize.translate('LabelSubtitleStyling')} value={appearance.subtitleStyling} onChange={v => setApp('subtitleStyling', v)}>
                                    {STYLINGS.map(s => <MenuItem key={s.value} value={s.value}>{globalize.translate(s.label)}</MenuItem>)}
                                </Sel>
                                {stylingHelp && <Typography sx={helpSx}>{globalize.translate(stylingHelp)}</Typography>}

                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 1.5 }}>
                                    <Sel label={globalize.translate('LabelTextSize')} value={appearance.textSize} onChange={v => setApp('textSize', v)}>{options(TEXT_SIZES)}</Sel>
                                    <Sel label={globalize.translate('LabelTextWeight')} value={appearance.textWeight} onChange={v => setApp('textWeight', v)}>{options(TEXT_WEIGHTS)}</Sel>
                                    <Sel label={globalize.translate('LabelFont')} value={appearance.font} onChange={v => setApp('font', v)}>{options(FONTS)}</Sel>
                                    <Sel label={globalize.translate('LabelDropShadow')} value={appearance.dropShadow} onChange={v => setApp('dropShadow', v)}>{options(DROP_SHADOWS)}</Sel>
                                </Box>

                                {layoutManager.tv ? (
                                    <Sel label={globalize.translate('LabelTextColor')} value={appearance.textColor} onChange={v => setApp('textColor', v)}>
                                        {options(TV_COLORS.some(([ v ]) => v === appearance.textColor) ? TV_COLORS : [ ...TV_COLORS, [ appearance.textColor, appearance.textColor ] ])}
                                    </Sel>
                                ) : (
                                    <TextField label={globalize.translate('LabelTextColor')} type='color' value={appearance.textColor} variant='filled' fullWidth
                                        onChange={e => setApp('textColor', e.target.value)} InputLabelProps={{ shrink: true }}
                                        sx={{ ...fieldSx, '& input[type=color]': { height: 32, p: '20px 12px 6px', cursor: 'pointer' } }} />
                                )}
                            </Card>
                        </Box>
                    )}
                </Box>

                <SaveButton saving={saving} onClick={handleSave} />
            </Box>

            {/* Full-screen preview (vertical position) */}
            {showAppearance && (
                <Box sx={{
                    position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none', transition: 'opacity 0.2s',
                    opacity: (showFullPreview || sliderActive) ? 1 : 0
                }}>
                    <Box sx={{ position: 'absolute', width: '100%', fontSize: '170%', textAlign: 'center' }} style={toStyle(fullStyles.window)}>
                        <Box sx={{ display: 'inline-block', maxWidth: '70%' }} style={toStyle(fullStyles.text)}>
                            {globalize.translate('HeaderSubtitleAppearance')}
                            <br />
                            {globalize.translate('TheseSettingsAffectSubtitlesOnThisDevice')}
                        </Box>
                    </Box>
                </Box>
            )}

            <SavedSnackbar open={saved} onClose={() => setSaved(false)} />
        </Page>
    );
};

export default SubtitlePreferencesPage;
