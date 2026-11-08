import React, { type FC, useCallback, useEffect, useState } from 'react';
import type { LiveTvOptions } from '@jellyfin/sdk/lib/generated-client/models/live-tv-options';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CodeIcon from '@mui/icons-material/Code';
import EventIcon from '@mui/icons-material/Event';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ImageIcon from '@mui/icons-material/Image';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import TimerIcon from '@mui/icons-material/Timer';
import { type ActionFunctionArgs, Form, useActionData, useNavigation, useSubmit } from 'react-router-dom';

import { useLiveTvOverview } from 'apps/dashboard/features/livetv/api/useLiveTvOverview';
import { Column, InfoTile, SaveBar, TwoColumns } from 'apps/dashboard/features/playback/components/PlaybackCards';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import DirectoryBrowser from 'components/directorybrowser/directorybrowser';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { QUERY_KEY, useNamedConfiguration } from 'hooks/useNamedConfiguration';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import type { ActionData } from 'types/actionData';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard, ToggleRow } from '../../components/cosmic';

const CONFIG_KEY = 'livetv';
const GUIDE_DAYS = Array.from({ length: 14 }, (_, i) => i + 1);
/** Example program length for the padding preview, in minutes. */
const EXAMPLE_PROGRAM = 60;

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const data = await request.json() as LiveTvOptions;
    await getSystemApi(api).updateNamedConfiguration({ key: CONFIG_KEY, body: data });
    void queryClient.invalidateQueries({ queryKey: [ QUERY_KEY, CONFIG_KEY ] });

    return { isSaved: true };
};

type PathField = 'RecordingPath' | 'MovieRecordingPath' | 'SeriesRecordingPath' | 'RecordingPostProcessor';

const PathInput: FC<{ name: PathField; label: string; helperText?: string; value?: string | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onBrowse: (field: PathField) => void; placeholder?: string }> = ({ name, label, helperText, value, onChange, onBrowse, placeholder }) => (
    <TextField
        name={name}
        label={label}
        helperText={helperText}
        value={value || ''}
        placeholder={placeholder}
        onChange={onChange}
        fullWidth
        slotProps={{
            input: {
                sx: { fontFamily: value ? 'monospace' : undefined, fontSize: '0.88rem' },
                endAdornment: (
                    <InputAdornment position='end'>
                        <IconButton edge='end' onClick={() => onBrowse(name)} title={globalize.translate('ButtonSelectDirectory')}>
                            <FolderOpenIcon />
                        </IconButton>
                    </InputAdornment>
                )
            },
            inputLabel: { shrink: true }
        }}
    />
);

/** Bar that shows how much earlier / later a recording starts and stops. */
const PaddingPreview: FC<{ pre: number; post: number }> = ({ pre, post }) => {
    const total = pre + EXAMPLE_PROGRAM + post || 1;
    const pct = (v: number) => `${(v / total) * 100}%`;
    const seg = (width: string, color: string, label: string) => (
        <Box sx={{ width, minWidth: label ? 36 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color, fontSize: '0.66rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {label}
        </Box>
    );

    return (
        <Box>
            <Box sx={{ display: 'flex', height: 30, borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                {pre > 0 && seg(pct(pre), 'rgba(255,152,0,0.55)', `-${pre}′`)}
                {seg(pct(EXAMPLE_PROGRAM), 'rgba(0,164,220,0.55)', globalize.translate('LtvProgram'))}
                {post > 0 && seg(pct(post), 'rgba(170,92,195,0.6)', `+${post}′`)}
            </Box>
            <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', mt: 1 }}>
                {globalize.translate('LtvPaddingExample', EXAMPLE_PROGRAM, pre + EXAMPLE_PROGRAM + post)}
            </Typography>
        </Box>
    );
};

const toMinutes = (seconds?: number | null) => (seconds ? String(Math.round(seconds / 60)) : '0');

export const Component = () => {
    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const submit = useSubmit();
    const { data: initialConfig, isPending, isError } = useNamedConfiguration<LiveTvOptions>(CONFIG_KEY);
    const { data: overview } = useLiveTvOverview();
    const [ config, setConfig ] = useState<LiveTvOptions | null>(null);
    const [ pre, setPre ] = useState('0');
    const [ post, setPost ] = useState('0');
    const [ saved, setSaved ] = useState(false);
    const isSubmitting = navigation.state === 'submitting';

    useEffect(() => {
        if (initialConfig && config == null) {
            setConfig(initialConfig);
            setPre(toMinutes(initialConfig.PrePaddingSeconds));
            setPost(toMinutes(initialConfig.PostPaddingSeconds));
        }
    }, [ initialConfig, config ]);

    useEffect(() => {
        if (actionData?.isSaved) setSaved(true);
    }, [ actionData ]);

    const update = useCallback((patch: Partial<LiveTvOptions>) => setConfig(c => ({ ...c, ...patch })), []);

    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        update({ [e.target.name]: e.target.value });
    }, [ update ]);

    const onBrowse = useCallback((field: PathField) => {
        const picker = new DirectoryBrowser();
        picker.show({
            callback: (path: string) => {
                if (path) update({ [field]: path });
                picker.close();
            },
            includeFiles: field === 'RecordingPostProcessor',
            validateWriteable: field !== 'RecordingPostProcessor'
        });
    }, [ update ]);

    const preMinutes = Math.max(0, parseInt(pre, 10) || 0);
    const postMinutes = Math.max(0, parseInt(post, 10) || 0);

    const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!config) return;
        submit(JSON.stringify({ ...config, PrePaddingSeconds: preMinutes * 60, PostPaddingSeconds: postMinutes * 60 }), { method: 'post', encType: 'application/json' });
    }, [ config, preMinutes, postMinutes, submit ]);

    const closeSaved = useCallback(() => setSaved(false), []);

    if (isPending || !config) return <Loading />;

    const base = config.RecordingPath || '';
    const sep = base.includes('\\') ? '\\' : '/';
    const defaultSub = (name: string) => (base ? `${base.replace(/[\\/]+$/, '')}${sep}${name}` : '');

    return (
        <Page id='liveTvSettingsPage' title={globalize.translate('HeaderDVR')} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={globalize.translate('HeaderDVR')} subtitle={globalize.translate('LtvDvrSubtitle')} />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('LiveTVPageLoadError')}</Alert>
                ) : (
                    <Form method='POST' onSubmit={onSubmit} style={{ maxWidth: 'none' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, mb: 2.5 }}>
                            <InfoTile icon={<OndemandVideoIcon />} label={globalize.translate('LtvRecordings')} value={overview?.recordingCount ?? '—'} color='#00a4dc' />
                            <InfoTile icon={<FiberManualRecordIcon />} label={globalize.translate('LtvRecordingNow')} value={overview?.recordingNow ?? '—'} color='#ef5350' />
                            <InfoTile icon={<EventIcon />} label={globalize.translate('LtvScheduled')} value={overview?.scheduled ?? '—'} color='#ff9800' />
                            <InfoTile icon={<EventRepeatIcon />} label={globalize.translate('LtvSeriesRules')} value={overview?.seriesCount ?? '—'} color='#66bb6a' />
                        </Box>

                        <TwoColumns>
                            <Column>
                                <SectionCard title={globalize.translate('LtvGuideCard')} icon={<CalendarMonthIcon />} accentColor='#26c6da' description={globalize.translate('LabelNumberOfGuideDaysHelp')}>
                                    <TextField
                                        select
                                        name='GuideDays'
                                        label={globalize.translate('LabelNumberOfGuideDays')}
                                        value={config.GuideDays ? String(config.GuideDays) : ''}
                                        onChange={e => update({ GuideDays: e.target.value ? parseInt(e.target.value, 10) : null })}
                                        fullWidth
                                        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                                    >
                                        <MenuItem value=''>{globalize.translate('Auto')}</MenuItem>
                                        {GUIDE_DAYS.map(d => <MenuItem key={d} value={String(d)}>{globalize.translate('LtvDays', d)}</MenuItem>)}
                                    </TextField>
                                </SectionCard>

                                <SectionCard title={globalize.translate('LtvFolders')} icon={<FolderIcon />} accentColor='#00a4dc' description={globalize.translate('LtvFoldersHelp')}>
                                    <Stack spacing={2.5}>
                                        <PathInput name='RecordingPath' label={globalize.translate('LabelRecordingPath')} helperText={globalize.translate('LabelRecordingPathHelp')} value={config.RecordingPath} onChange={onChange} onBrowse={onBrowse} />
                                        <PathInput name='MovieRecordingPath' label={globalize.translate('LabelMovieRecordingPath')} value={config.MovieRecordingPath} onChange={onChange} onBrowse={onBrowse}
                                            placeholder={defaultSub('Movies')} helperText={globalize.translate('LtvEmptyUsesDefault')} />
                                        <PathInput name='SeriesRecordingPath' label={globalize.translate('LabelSeriesRecordingPath')} value={config.SeriesRecordingPath} onChange={onChange} onBrowse={onBrowse}
                                            placeholder={defaultSub('Series')} helperText={globalize.translate('LtvEmptyUsesDefault')} />
                                    </Stack>
                                </SectionCard>

                                <SectionCard title={globalize.translate('HeaderRecordingMetadataSaving')} icon={<ImageIcon />} accentColor='#66bb6a'>
                                    <Stack spacing={1.25}>
                                        <ToggleRow label={globalize.translate('SaveRecordingNFO')} description={globalize.translate('SaveRecordingNFOHelp')} checked={!!config.SaveRecordingNFO} onChange={v => update({ SaveRecordingNFO: v })} color='#66bb6a' />
                                        <ToggleRow label={globalize.translate('SaveRecordingImages')} description={globalize.translate('SaveRecordingImagesHelp')} checked={!!config.SaveRecordingImages} onChange={v => update({ SaveRecordingImages: v })} color='#66bb6a' />
                                    </Stack>
                                </SectionCard>
                            </Column>

                            <Column>
                                <SectionCard title={globalize.translate('HeaderDefaultRecordingSettings')} icon={<TimerIcon />} accentColor='#ff9800' description={globalize.translate('LtvPaddingHelp')}>
                                    <Stack spacing={2.5}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                            <TextField
                                                type='number'
                                                label={globalize.translate('LabelStartWhenPossible')}
                                                value={pre}
                                                onChange={e => setPre(e.target.value)}
                                                slotProps={{ htmlInput: { min: 0, max: 120 }, input: { endAdornment: <InputAdornment position='end'>{globalize.translate('MinutesBefore')}</InputAdornment> } }}
                                            />
                                            <TextField
                                                type='number'
                                                label={globalize.translate('LabelStopWhenPossible')}
                                                value={post}
                                                onChange={e => setPost(e.target.value)}
                                                slotProps={{ htmlInput: { min: 0, max: 240 }, input: { endAdornment: <InputAdornment position='end'>{globalize.translate('MinutesAfter')}</InputAdornment> } }}
                                            />
                                        </Box>
                                        <PaddingPreview pre={preMinutes} post={postMinutes} />
                                    </Stack>
                                </SectionCard>

                                <SectionCard title={globalize.translate('HeaderRecordingPostProcessing')} icon={<CodeIcon />} accentColor='#aa5cc3' description={globalize.translate('LtvPostProcessHelp')}>
                                    <Stack spacing={2.5}>
                                        <PathInput name='RecordingPostProcessor' label={globalize.translate('LabelPostProcessor')} value={config.RecordingPostProcessor} onChange={onChange} onBrowse={onBrowse} />
                                        <TextField
                                            name='RecordingPostProcessorArguments'
                                            label={globalize.translate('LabelPostProcessorArguments')}
                                            helperText={globalize.translate('LabelPostProcessorArgumentsHelp')}
                                            value={config.RecordingPostProcessorArguments || ''}
                                            onChange={onChange}
                                            fullWidth
                                            slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.88rem' } }, inputLabel: { shrink: true } }}
                                        />
                                    </Stack>
                                </SectionCard>
                            </Column>
                        </TwoColumns>

                        <SaveBar isSubmitting={isSubmitting} />
                    </Form>
                )}
            </Box>

            <SavedSnackbar open={saved} onClose={closeSaved} />
        </Page>
    );
};

Component.displayName = 'LiveTvRecordingsPage';
