import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { ListingsProviderInfo } from '@jellyfin/sdk/lib/generated-client/models/listings-provider-info';
import type { LiveTvOptions } from '@jellyfin/sdk/lib/generated-client/models/live-tv-options';
import type { NameIdPair } from '@jellyfin/sdk/lib/generated-client/models/name-id-pair';
import type { TunerHostInfo } from '@jellyfin/sdk/lib/generated-client/models/tuner-host-info';
import { getLiveTvApi } from '@jellyfin/sdk/lib/utils/api/live-tv-api';
import { useMutation, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LabelIcon from '@mui/icons-material/Label';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import LoginIcon from '@mui/icons-material/Login';
import PlaceIcon from '@mui/icons-material/Place';
import SearchIcon from '@mui/icons-material/Search';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import SourceIcon from '@mui/icons-material/Source';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { BrowseField, CategoryInput, FormActions, StepBadge, TunerSelector } from 'apps/dashboard/features/livetv/components/LiveTvForms';
import { Column, TwoColumns } from 'apps/dashboard/features/playback/components/PlaybackCards';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY, useNamedConfiguration } from 'hooks/useNamedConfiguration';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { PageHeader, SectionCard } from '../../components/cosmic';

const XMLTV_COLOR = '#aa5cc3';
const SD_COLOR = '#26c6da';

const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [ QUERY_KEY, 'livetv' ] });
    void queryClient.invalidateQueries({ queryKey: [ 'LiveTvOverview' ] });
};

const fieldSlot = { inputLabel: { shrink: true } };

/** Hook that saves a guide provider, validating the listings on the server. */
const useSaveProvider = () => {
    const { api } = useApi();
    const navigate = useNavigate();
    return useMutation({
        mutationFn: async (info: ListingsProviderInfo) => (await getLiveTvApi(api!).addListingProvider({ validateListings: true, listingsProviderInfo: info })).data,
        onSuccess: () => {
            invalidate();
            navigate('/dashboard/livetv');
        }
    });
};

const TunersCard: FC<{ tuners: TunerHostInfo[]; info: ListingsProviderInfo; update: (p: Partial<ListingsProviderInfo>) => void }> = ({ tuners, info, update }) => (
    <SectionCard title={globalize.translate('HeaderTuners')} icon={<SettingsInputAntennaIcon />} accentColor='#26c6da' description={globalize.translate('LtfTunersHelp')}>
        <TunerSelector
            tuners={tuners}
            all={!!info.EnableAllTuners}
            selected={info.EnabledTuners || []}
            onAllChange={v => update({ EnableAllTuners: v })}
            onSelectedChange={v => update({ EnabledTuners: v })}
        />
    </SectionCard>
);

const XmltvPage: FC<{ id: string | null; config: LiveTvOptions }> = ({ id, config }) => {
    const { api } = useApi();
    const save = useSaveProvider();
    const [ info, setInfo ] = useState<ListingsProviderInfo | null>(null);

    const existing = id ? config.ListingProviders?.find(p => p.Id === id) : undefined;
    const { data: defaults } = useQuery({
        queryKey: [ 'LiveTvDefaultListingProvider' ],
        queryFn: async ({ signal }) => (await getLiveTvApi(api!).getDefaultListingProvider({ signal })).data,
        enabled: !!api && !existing
    });

    useEffect(() => {
        if (info) return;
        if (existing) setInfo(existing);
        else if (defaults) setInfo({ ...defaults, Id: undefined });
    }, [ info, existing, defaults ]);

    const update = useCallback((patch: Partial<ListingsProviderInfo>) => setInfo(i => ({ ...i, ...patch })), []);

    const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!info) return;
        save.mutate({
            ...info,
            Type: 'xmltv',
            MoviePrefix: info.MoviePrefix || null,
            UserAgent: info.UserAgent || null,
            EnabledTuners: info.EnableAllTuners ? [] : info.EnabledTuners || []
        });
    }, [ info, save ]);

    if (!info) return <Loading />;

    return (
        <form onSubmit={onSubmit} style={{ maxWidth: 'none' }}>
            {save.isError && <Alert severity='error' sx={{ mb: 2 }}>{globalize.translate('ErrorAddingXmlTvFile')}</Alert>}
            <TwoColumns>
                <Column>
                    <SectionCard title={globalize.translate('LtfSource')} icon={<SourceIcon />} accentColor={XMLTV_COLOR}>
                        <Stack spacing={2.5}>
                            <BrowseField
                                label={globalize.translate('LabelFileOrUrl')}
                                helperText={globalize.translate('XmlTvPathHelp')}
                                value={info.Path || ''}
                                onChange={v => update({ Path: v })}
                                placeholder='http://.../epg.xml'
                                required
                            />
                            <TextField
                                label={globalize.translate('LabelUserAgent')}
                                helperText={globalize.translate('UserAgentHelp')}
                                value={info.UserAgent || ''}
                                onChange={e => update({ UserAgent: e.target.value })}
                                fullWidth
                                slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }, ...fieldSlot }}
                            />
                        </Stack>
                    </SectionCard>

                    <TunersCard tuners={config.TunerHosts || []} info={info} update={update} />

                    <SectionCard title={globalize.translate('LtfTips')} icon={<LightbulbIcon />} accentColor='#ffca28'>
                        <Stack component='ul' spacing={1} sx={{ m: 0, pl: 2.5 }}>
                            {[ 'LtfTipXml1', 'LtfTipXml2', 'LtfTipXml3' ].map(k => (
                                <Typography key={k} component='li' sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{globalize.translate(k)}</Typography>
                            ))}
                        </Stack>
                    </SectionCard>
                </Column>

                <Column>
                    <SectionCard title={globalize.translate('LtfCategories')} icon={<LabelIcon />} accentColor='#ff9800' description={globalize.translate('LtfCategoriesHelp')}>
                        <Stack spacing={2.5}>
                            <CategoryInput label={globalize.translate('LabelMovieCategories')} helperText={globalize.translate('XmlTvMovieCategoriesHelp')} value={info.MovieCategories || []} onChange={v => update({ MovieCategories: v })} color='#00a4dc' />
                            <TextField
                                label={globalize.translate('LabelMoviePrefix')}
                                helperText={globalize.translate('LabelMoviePrefixHelp')}
                                value={info.MoviePrefix || ''}
                                onChange={e => update({ MoviePrefix: e.target.value })}
                                fullWidth
                                slotProps={fieldSlot}
                            />
                            <CategoryInput label={globalize.translate('LabelSportsCategories')} helperText={globalize.translate('XmlTvSportsCategoriesHelp')} value={info.SportsCategories || []} onChange={v => update({ SportsCategories: v })} color='#66bb6a' />
                            <CategoryInput label={globalize.translate('LabelNewsCategories')} helperText={globalize.translate('XmlTvNewsCategoriesHelp')} value={info.NewsCategories || []} onChange={v => update({ NewsCategories: v })} color='#ef5350' />
                            <CategoryInput label={globalize.translate('LabelKidsCategories')} helperText={globalize.translate('XmlTvKidsCategoriesHelp')} value={info.KidsCategories || []} onChange={v => update({ KidsCategories: v })} color='#ffca28' />
                        </Stack>
                    </SectionCard>
                </Column>
            </TwoColumns>

            <FormActions saving={save.isPending} disabled={!info.Path} />
        </form>
    );
};

interface SdCountry { fullName?: string; shortName?: string }

const SchedulesDirectPage: FC<{ id: string | null; config: LiveTvOptions }> = ({ id, config }) => {
    const { api } = useApi();
    const save = useSaveProvider();
    const [ info, setInfo ] = useState<ListingsProviderInfo>(() => (id && config.ListingProviders?.find(p => p.Id === id)) || { Type: 'SchedulesDirect', EnableAllTuners: true });
    const [ username, setUsername ] = useState(info.Username || '');
    const [ password, setPassword ] = useState('');
    const [ lineups, setLineups ] = useState<NameIdPair[] | null>(null);
    const [ formError, setFormError ] = useState<string | null>(null);

    const loggedIn = !!(info.Id && info.Username && info.Password);
    const update = useCallback((patch: Partial<ListingsProviderInfo>) => setInfo(i => ({ ...i, ...patch })), []);

    const { data: countries, isError: countriesError } = useQuery({
        queryKey: [ 'SchedulesDirectCountries' ],
        queryFn: async ({ signal }) => {
            const data = (await getLiveTvApi(api!).getSchedulesDirectCountries({ signal })).data as unknown as Record<string, SdCountry[]>;
            return Object.entries(data || {})
                .filter(([ region ]) => region !== 'ZZZ')
                .flatMap(([ , list ]) => list || [])
                .map(c => ({ name: c.fullName || c.shortName || '', value: c.shortName || '' }))
                .sort((a, b) => a.name.localeCompare(b.name));
        },
        enabled: !!api && loggedIn,
        staleTime: Infinity
    });

    const login = useMutation({
        mutationFn: async () => (await getLiveTvApi(api!).addListingProvider({
            validateLogin: true,
            listingsProviderInfo: { ...info, Type: 'SchedulesDirect', Username: username, Password: password, Id: info.Id || undefined }
        })).data,
        onSuccess: data => {
            setInfo(i => ({ ...i, ...data }));
            setPassword('');
            invalidate();
        }
    });

    const findLineups = useMutation({
        mutationFn: async () => (await getLiveTvApi(api!).getLineups({ id: info.Id || undefined, location: info.ZipCode || '', country: info.Country || '' })).data,
        onSuccess: data => setLineups(data)
    });

    // Load the lineups once for an already configured account.
    const { mutate: loadLineups } = findLineups;
    useEffect(() => {
        if (loggedIn && info.ZipCode && info.Country && lineups == null) loadLineups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ loggedIn ]);

    const lineupOptions = useMemo(() => {
        const list = lineups || [];
        if (info.ListingsId && !list.some(l => l.Id === info.ListingsId)) return [ { Id: info.ListingsId, Name: info.ListingsId }, ...list ];
        return list;
    }, [ lineups, info.ListingsId ]);

    const onLogin = useCallback(() => {
        if (username && password) login.mutate();
    }, [ login, password, username ]);

    const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!info.ListingsId) {
            setFormError(globalize.translate('ErrorPleaseSelectLineup'));
            return;
        }
        setFormError(null);
        save.mutate({ ...info, EnabledTuners: info.EnableAllTuners ? [] : info.EnabledTuners || [] });
    }, [ info, save ]);

    const runFind = useCallback(() => findLineups.mutate(), [ findLineups ]);

    return (
        <form onSubmit={onSubmit} style={{ maxWidth: 'none' }}>
            {save.isError && <Alert severity='error' sx={{ mb: 2 }}>{globalize.translate('ErrorAddingListingsToSchedulesDirect')}</Alert>}
            {formError && <Alert severity='warning' sx={{ mb: 2 }}>{formError}</Alert>}

            <TwoColumns>
                <Column>
                    <SectionCard title={globalize.translate('GuideProviderLogin')} icon={<StepBadge n={1} done={loggedIn} />} accentColor={SD_COLOR}>
                        <Stack spacing={2.5}>
                            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>
                                {globalize.translate('LtfSdAccountHelp')}{' '}
                                <Link href='https://www.schedulesdirect.org' target='_blank' rel='noopener noreferrer'>schedulesdirect.org</Link>
                            </Typography>
                            <TextField label={globalize.translate('LabelUsername')} value={username} onChange={e => setUsername(e.target.value)} autoComplete='off' fullWidth slotProps={fieldSlot} />
                            <TextField
                                type='password'
                                label={globalize.translate('LabelPassword')}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete='new-password'
                                placeholder={loggedIn ? '••••••••' : ''}
                                helperText={loggedIn ? globalize.translate('LtfSdPasswordSaved') : undefined}
                                fullWidth
                                slotProps={fieldSlot}
                            />
                            {login.isError && <Alert severity='error'>{globalize.translate('ErrorSavingTvProvider')}</Alert>}
                            {login.isSuccess && <Alert severity='success'>{globalize.translate('LtfSdLoggedIn')}</Alert>}
                            <Box>
                                <Button variant={loggedIn ? 'outlined' : 'contained'} onClick={onLogin} disabled={!username || !password || login.isPending}
                                    startIcon={login.isPending ? <CircularProgress size={16} color='inherit' /> : <LoginIcon />}>
                                    {globalize.translate(loggedIn ? 'LtfSdRelogin' : 'LtfSdLogin')}
                                </Button>
                            </Box>
                        </Stack>
                    </SectionCard>

                    {loggedIn && <TunersCard tuners={config.TunerHosts || []} info={info} update={update} />}
                </Column>

                <Column>
                    <SectionCard title={globalize.translate('GuideProviderSelectListings')} icon={<StepBadge n={2} done={!!info.ListingsId} />} accentColor='#00a4dc'>
                        {!loggedIn ? (
                            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{globalize.translate('LtfSdLoginFirst')}</Typography>
                        ) : (
                            <Stack spacing={2.5}>
                                {countriesError && <Alert severity='error'>{globalize.translate('ErrorGettingTvLineups')}</Alert>}
                                <TextField
                                    select
                                    label={globalize.translate('LabelCountry')}
                                    value={info.Country || ''}
                                    onChange={e => { update({ Country: e.target.value }); setLineups(null); }}
                                    fullWidth
                                    slotProps={{ input: { startAdornment: <PlaceIcon sx={{ mr: 1, color: 'rgba(255,255,255,0.4)' }} /> }, ...fieldSlot }}
                                >
                                    {(countries || []).map(c => <MenuItem key={c.value} value={c.value}>{c.name}</MenuItem>)}
                                </TextField>
                                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                    <TextField
                                        label={globalize.translate('LabelZipCode')}
                                        value={info.ZipCode || ''}
                                        onChange={e => update({ ZipCode: e.target.value })}
                                        sx={{ flex: 1 }}
                                        slotProps={fieldSlot}
                                    />
                                    <Button variant='outlined' onClick={runFind} disabled={!info.ZipCode || !info.Country || findLineups.isPending} sx={{ height: 56 }}
                                        startIcon={findLineups.isPending ? <CircularProgress size={16} /> : <SearchIcon />}>
                                        {globalize.translate('LtfFindLineups')}
                                    </Button>
                                </Box>
                                {findLineups.isError && <Alert severity='error'>{globalize.translate('ErrorGettingTvLineups')}</Alert>}
                                <TextField
                                    select
                                    label={globalize.translate('LabelLineup')}
                                    value={info.ListingsId || ''}
                                    onChange={e => update({ ListingsId: e.target.value })}
                                    disabled={!lineupOptions.length}
                                    helperText={lineups && !lineups.length ? globalize.translate('LtfNoLineups') : undefined}
                                    fullWidth
                                    slotProps={{ input: { startAdornment: <CalendarMonthIcon sx={{ mr: 1, color: 'rgba(255,255,255,0.4)' }} /> }, ...fieldSlot }}
                                >
                                    {lineupOptions.map(l => <MenuItem key={l.Id} value={l.Id || ''}>{l.Name}</MenuItem>)}
                                </TextField>
                            </Stack>
                        )}
                    </SectionCard>
                </Column>
            </TwoColumns>

            {loggedIn && <FormActions saving={save.isPending} disabled={!info.ListingsId} />}
        </form>
    );
};

export const Component = () => {
    const [ params ] = useSearchParams();
    const type = (params.get('type') || '').toLowerCase();
    const id = params.get('id');
    const { data: config, isPending } = useNamedConfiguration<LiveTvOptions>('livetv');
    const isSd = type === 'schedulesdirect';
    const name = isSd ? 'Schedules Direct' : 'XMLTV';
    const subtitle = globalize.translate(isSd ? 'LtfSdSubtitle' : 'LtfXmlSubtitle');

    return (
        <Page id='liveTvGuideProviderPage' title={name} className='mainAnimatedPage type-interior fullWidthContent'>
            <Box className='content-primary' sx={{ pb: 6 }}>
                <PageHeader title={id ? name : globalize.translate('LtfAddGuide', name)} subtitle={subtitle} />
                {isPending || !config ? <Loading /> : (
                    isSd ? <SchedulesDirectPage key={id || 'new'} id={id} config={config} /> : <XmltvPage key={id || 'new'} id={id} config={config} />
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'LiveTvGuideProviderPage';
