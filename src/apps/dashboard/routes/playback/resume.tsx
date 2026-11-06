import React, { useCallback, useEffect, useState } from 'react';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import MovieIcon from '@mui/icons-material/Movie';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import TimerIcon from '@mui/icons-material/Timer';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';

import { Column, SaveBar, TwoColumns } from 'apps/dashboard/features/playback/components/PlaybackCards';
import { SavedSnackbar } from 'apps/legacy/routes/user/components/PreferencesUi';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { QUERY_KEY, useConfiguration } from 'hooks/useConfiguration';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { ActionData } from 'types/actionData';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard } from '../../components/cosmic';

const COLORS = {
    video: '#00a4dc',
    audiobook: '#ff9800',
    duration: '#aa5cc3',
    example: '#4caf50'
};

const DEFAULTS = { minPct: 5, maxPct: 90, minDuration: 300, minAudiobook: 5, maxAudiobook: 5 };

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const { data: config } = await getSystemApi(api).getConfiguration();
    const formData = await request.formData();

    const minResumePercentage = formData.get('MinResumePercentage')?.toString();
    const maxResumePercentage = formData.get('MaxResumePercentage')?.toString();
    const minAudiobookResume = formData.get('MinAudiobookResume')?.toString();
    const maxAudiobookResume = formData.get('MaxAudiobookResume')?.toString();
    const minResumeDuration = formData.get('MinResumeDuration')?.toString();

    if (minResumePercentage) config.MinResumePct = parseInt(minResumePercentage, 10);
    if (maxResumePercentage) config.MaxResumePct = parseInt(maxResumePercentage, 10);
    if (minAudiobookResume) config.MinAudiobookResume = parseInt(minAudiobookResume, 10);
    if (maxAudiobookResume) config.MaxAudiobookResume = parseInt(maxAudiobookResume, 10);
    if (minResumeDuration) config.MinResumeDurationSeconds = parseInt(minResumeDuration, 10);

    await getSystemApi(api)
        .updateConfiguration({ serverConfiguration: config });

    void queryClient.invalidateQueries({
        queryKey: [ QUERY_KEY ]
    });

    return {
        isSaved: true
    };
};

const ZONE_COLORS = { none: 'rgba(255,255,255,0.14)', resume: '#00a4dc', played: '#4caf50' };

/** Visual explanation of the resume window: not saved / continue watching / played. */
const ResumeBar = ({ min, max }: { min: number; max: number }) => {
    const lo = Math.max(0, Math.min(100, min));
    const hi = Math.max(lo, Math.min(100, max));
    const zones = [
        { width: lo, color: ZONE_COLORS.none, label: globalize.translate('PbZoneNotSaved') },
        { width: hi - lo, color: ZONE_COLORS.resume, label: globalize.translate('PbZoneResume') },
        { width: 100 - hi, color: ZONE_COLORS.played, label: globalize.translate('PbZonePlayed') }
    ];

    return (
        <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', height: 14, borderRadius: '7px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                {zones.map(z => (
                    <Box key={z.label} sx={{ width: `${z.width}%`, background: z.color, transition: 'width 0.25s' }} />
                ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)' }}>
                <span>0%</span><span>{lo}%</span><span>{hi}%</span><span>100%</span>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
                {zones.map(z => (
                    <Box key={z.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '3px', background: z.color }} />
                        <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)' }}>{z.label}</Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

const toInt = (v: string) => {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
};

const minutes = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = Math.round(m % 60);
    return h > 0 ? `${h} h ${mm} min` : `${mm} min`;
};

export const Component = () => {
    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const isSubmitting = navigation.state === 'submitting';
    const { isPending: isConfigurationPending, isError: isConfigurationError, data: config } = useConfiguration();

    const [ values, setValues ] = useState<Record<string, string> | null>(null);
    const [ saved, setSaved ] = useState(false);

    useEffect(() => {
        if (config && !values) {
            setValues({
                MinResumePercentage: String(config.MinResumePct ?? DEFAULTS.minPct),
                MaxResumePercentage: String(config.MaxResumePct ?? DEFAULTS.maxPct),
                MinResumeDuration: String(config.MinResumeDurationSeconds ?? DEFAULTS.minDuration),
                MinAudiobookResume: String(config.MinAudiobookResume ?? DEFAULTS.minAudiobook),
                MaxAudiobookResume: String(config.MaxAudiobookResume ?? DEFAULTS.maxAudiobook)
            });
        }
    }, [ config, values ]);

    useEffect(() => {
        if (actionData?.isSaved) setSaved(true);
    }, [ actionData ]);

    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setValues(v => ({ ...v, [name]: value }));
    }, []);

    const resetDefaults = useCallback(() => {
        setValues({
            MinResumePercentage: String(DEFAULTS.minPct),
            MaxResumePercentage: String(DEFAULTS.maxPct),
            MinResumeDuration: String(DEFAULTS.minDuration),
            MinAudiobookResume: String(DEFAULTS.minAudiobook),
            MaxAudiobookResume: String(DEFAULTS.maxAudiobook)
        });
    }, []);

    const closeSaved = useCallback(() => setSaved(false), []);

    if (isConfigurationPending || !values) {
        return <Loading />;
    }

    const minPct = toInt(values.MinResumePercentage);
    const maxPct = toInt(values.MaxResumePercentage);
    const minDuration = toInt(values.MinResumeDuration);
    const minBook = toInt(values.MinAudiobookResume);
    const maxBook = toInt(values.MaxAudiobookResume);
    const invalid = minPct >= maxPct;

    // Worked example for a 2 h movie and a 10 h audiobook
    const movieMinutes = 120;
    const bookMinutes = 600;

    return (
        <Page
            id='playbackConfigurationPage'
            title={globalize.translate('ButtonResume')}
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader
                    title={globalize.translate('ButtonResume')}
                    subtitle={globalize.translate('PbResumeSubtitle')}
                    actions={(
                        <Button variant='outlined' startIcon={<RestartAltIcon />} onClick={resetDefaults} sx={{ borderRadius: '12px' }}>
                            {globalize.translate('PbResetDefaults')}
                        </Button>
                    )}
                />

                {isConfigurationError ? (
                    <Alert severity='error'>{globalize.translate('ResumeLoadError')}</Alert>
                ) : (
                    <Form method='POST' style={{ maxWidth: 'none' }}>
                        <TwoColumns>
                            <Column>
                                <SectionCard title={globalize.translate('PbResumeVideo')} icon={<MovieIcon />} accentColor={COLORS.video} description={globalize.translate('PbResumeVideoHelp')}>
                                    <Stack spacing={2.5}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                            <TextField
                                                label={globalize.translate('LabelMinResumePercentage')}
                                                name='MinResumePercentage'
                                                type='number'
                                                value={values.MinResumePercentage}
                                                onChange={onChange}
                                                helperText={globalize.translate('LabelMinResumePercentageHelp')}
                                                slotProps={{ htmlInput: { min: 0, max: 100, required: true } }}
                                            />
                                            <TextField
                                                label={globalize.translate('LabelMaxResumePercentage')}
                                                name='MaxResumePercentage'
                                                type='number'
                                                value={values.MaxResumePercentage}
                                                onChange={onChange}
                                                error={invalid}
                                                helperText={invalid ? globalize.translate('PbResumeInvalid') : globalize.translate('LabelMaxResumePercentageHelp')}
                                                slotProps={{ htmlInput: { min: 1, max: 100, required: true } }}
                                            />
                                        </Box>
                                        <ResumeBar min={minPct} max={maxPct} />
                                    </Stack>
                                </SectionCard>

                                <SectionCard title={globalize.translate('PbResumeShort')} icon={<TimerIcon />} accentColor={COLORS.duration}>
                                    <TextField
                                        fullWidth
                                        label={globalize.translate('LabelMinResumeDuration')}
                                        name='MinResumeDuration'
                                        type='number'
                                        value={values.MinResumeDuration}
                                        onChange={onChange}
                                        helperText={globalize.translate('LabelMinResumeDurationHelp')}
                                        slotProps={{ htmlInput: { min: 0, required: true } }}
                                    />
                                    <Typography sx={{ mt: 1.5, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                                        {globalize.translate('PbResumeShortExample', minutes(minDuration / 60))}
                                    </Typography>
                                </SectionCard>
                            </Column>

                            <Column>
                                <SectionCard title={globalize.translate('PbResumeAudiobooks')} icon={<HeadphonesIcon />} accentColor={COLORS.audiobook} description={globalize.translate('PbResumeAudiobooksHelp')}>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                        <TextField
                                            label={globalize.translate('LabelMinAudiobookResume')}
                                            name='MinAudiobookResume'
                                            type='number'
                                            value={values.MinAudiobookResume}
                                            onChange={onChange}
                                            helperText={globalize.translate('LabelMinAudiobookResumeHelp')}
                                            slotProps={{ htmlInput: { min: 0, max: 100, required: true } }}
                                        />
                                        <TextField
                                            label={globalize.translate('LabelMaxAudiobookResume')}
                                            name='MaxAudiobookResume'
                                            type='number'
                                            value={values.MaxAudiobookResume}
                                            onChange={onChange}
                                            helperText={globalize.translate('LabelMaxAudiobookResumeHelp')}
                                            slotProps={{ htmlInput: { min: 1, max: 100, required: true } }}
                                        />
                                    </Box>
                                </SectionCard>

                                <SectionCard title={globalize.translate('PbExample')} icon={<LightbulbIcon />} accentColor={COLORS.example}>
                                    <Stack spacing={1.25}>
                                        {[
                                            { color: ZONE_COLORS.none, text: globalize.translate('PbExampleMovieNone', minutes(movieMinutes * minPct / 100)) },
                                            { color: ZONE_COLORS.resume, text: globalize.translate('PbExampleMovieResume', minutes(movieMinutes * minPct / 100), minutes(movieMinutes * maxPct / 100)) },
                                            { color: ZONE_COLORS.played, text: globalize.translate('PbExampleMoviePlayed', minutes(movieMinutes * maxPct / 100)) },
                                            { color: COLORS.audiobook, text: globalize.translate('PbExampleBook', minutes(minBook), minutes(bookMinutes - maxBook)) }
                                        ].map(row => (
                                            <Box key={row.text} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                                                <Box sx={{ width: 10, height: 10, mt: 0.6, borderRadius: '3px', background: row.color, flexShrink: 0 }} />
                                                <Typography sx={{ fontSize: '0.84rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' }}>{row.text}</Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                </SectionCard>
                            </Column>
                        </TwoColumns>

                        <SaveBar isSubmitting={isSubmitting} disabled={invalid} />
                    </Form>
                )}
            </Box>

            <SavedSnackbar open={saved} onClose={closeSaved} />
        </Page>
    );
};

Component.displayName = 'ResumePage';
