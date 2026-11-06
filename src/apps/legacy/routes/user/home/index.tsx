/**
 * HomePreferencesPage — React migration of the legacy home screen settings
 * (components/homeScreenSettings), using the same glassmorphism cards as the
 * display preferences page.
 */
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import FolderCopyIcon from '@mui/icons-material/FolderCopy';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import { useSearchParams } from 'react-router-dom';

import layoutManager from 'components/layoutManager';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { DEFAULT_SECTIONS } from 'constants/homeSectionType';
import { getUserViewsQuery } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import * as userSettings from 'scripts/settings/userSettings';
import { LibraryTab } from 'types/libraryTab';
import { queryClient } from 'utils/query/queryClient';

import { Card, Check, SaveButton, SavedSnackbar, Sel } from '../components/PreferencesUi';

const NUM_SECTIONS = 10;

const SECTION_OPTIONS: { value: string; label: string }[] = [
    { value: 'smalllibrarytiles', label: 'HeaderMyMedia' },
    { value: 'librarybuttons', label: 'HeaderMyMediaSmall' },
    { value: 'activerecordings', label: 'HeaderActiveRecordings' },
    { value: 'resume', label: 'HeaderContinueWatching' },
    { value: 'resumeaudio', label: 'HeaderContinueListening' },
    { value: 'resumebook', label: 'HeaderContinueReading' },
    { value: 'latestmedia', label: 'HeaderLatestMedia' },
    { value: 'nextup', label: 'NextUp' },
    { value: 'livetv', label: 'LiveTV' },
    { value: 'none', label: 'None' }
];

/** Default landing tab is always the first entry. */
const LANDING_OPTIONS: Record<string, { value: string; label: string }[]> = {
    movies: [
        { value: LibraryTab.Movies, label: 'Movies' },
        { value: LibraryTab.Suggestions, label: 'Suggestions' },
        { value: LibraryTab.Favorites, label: 'Favorites' },
        { value: LibraryTab.Collections, label: 'Collections' },
        { value: LibraryTab.Genres, label: 'Genres' },
        { value: LibraryTab.Studios, label: 'Studios' },
        { value: LibraryTab.Playlists, label: 'Playlists' }
    ],
    tvshows: [
        { value: LibraryTab.Series, label: 'Shows' },
        { value: LibraryTab.Suggestions, label: 'Suggestions' },
        { value: LibraryTab.Upcoming, label: 'TabUpcoming' },
        { value: LibraryTab.Genres, label: 'Genres' },
        { value: LibraryTab.Studios, label: 'Studios' },
        { value: LibraryTab.Episodes, label: 'Episodes' },
        { value: LibraryTab.Collections, label: 'Collections' },
        { value: LibraryTab.Playlists, label: 'Playlists' }
    ],
    music: [
        { value: LibraryTab.Albums, label: 'Albums' },
        { value: LibraryTab.Suggestions, label: 'Suggestions' },
        { value: LibraryTab.AlbumArtists, label: 'HeaderAlbumArtists' },
        { value: LibraryTab.Artists, label: 'Artists' },
        { value: LibraryTab.Playlists, label: 'Playlists' },
        { value: LibraryTab.Songs, label: 'Songs' },
        { value: LibraryTab.Genres, label: 'Genres' },
        { value: LibraryTab.Collections, label: 'Collections' }
    ],
    livetv: [
        { value: LibraryTab.Programs, label: 'Programs' },
        { value: LibraryTab.Guide, label: 'Guide' },
        { value: LibraryTab.Channels, label: 'Channels' },
        { value: LibraryTab.Recordings, label: 'Recordings' },
        { value: LibraryTab.Schedule, label: 'Schedule' },
        { value: LibraryTab.SeriesTimers, label: 'Series' }
    ],
    homevideos: [
        { value: LibraryTab.Folders, label: 'Folders' },
        { value: LibraryTab.Photos, label: 'Photos' },
        { value: LibraryTab.PhotoAlbums, label: 'HeaderPhotoAlbums' },
        { value: LibraryTab.Videos, label: 'HeaderVideos' }
    ],
    musicvideos: [
        { value: LibraryTab.Folders, label: 'Folders' },
        { value: LibraryTab.Suggestions, label: 'Suggestions' },
        { value: LibraryTab.MusicVideos, label: 'HeaderVideos' },
        { value: LibraryTab.Playlists, label: 'Playlists' }
    ],
    mixed: [
        { value: LibraryTab.Folders, label: 'Folders' },
        { value: LibraryTab.Suggestions, label: 'Suggestions' },
        { value: LibraryTab.Mixed, label: 'HeaderMedia' },
        { value: LibraryTab.Collections, label: 'Collections' },
        { value: LibraryTab.Playlists, label: 'Playlists' }
    ],
    books: [
        { value: LibraryTab.Folders, label: 'Folders' },
        { value: LibraryTab.Books, label: 'Books' },
        { value: LibraryTab.Authors, label: 'Authors' },
        { value: LibraryTab.Suggestions, label: 'Suggestions' },
        { value: LibraryTab.Genres, label: 'Genres' },
        { value: LibraryTab.Collections, label: 'Collections' },
        { value: LibraryTab.Favorites, label: 'Favorites' }
    ]
};

const EXCLUDE_FROM_LATEST = [ 'playlists', 'livetv', 'boxsets', 'channels' ];

const getCollectionType = (item: BaseItemDto) => (
    (item.Type === 'CollectionFolder' && item.CollectionType == null) ? 'mixed' : (item.CollectionType ?? '')
);

/** Settings key suffix for the landing screen (live TV uses a shared key). */
const getLandingId = (item: BaseItemDto) => (getCollectionType(item) === 'livetv' ? 'livetv' : item.Id ?? '');

const hasMyMediaOption = (item: BaseItemDto) => {
    const type = getCollectionType(item);
    return item.Type === 'Channel' || type === 'boxsets' || type === 'playlists';
};

/** Normalize a stored landing value: the default tab is stored as ''. */
const normalizeLanding = (type: string, value: string | null | undefined) => {
    const options = LANDING_OPTIONS[type];
    if (!options || !value || value === options[0].value) return '';
    return value;
};

/** Per-library accent colors (blue, purple and grey are used by the other cards). */
const ACCENTS = [ '#4caf50', '#ff9800', '#e91e63', '#26c6da', '#ffca28', '#8d6e63' ];

interface GroupingOption { Id: string; Name: string }

const HomePreferencesPage: FC = () => {
    const { api, user: currentUser, __legacyApiClient__: apiClient } = useApi();
    const [ searchParams ] = useSearchParams();
    const userId = searchParams.get('userId') || currentUser?.Id;

    /** Use the global settings for the logged-in user, a separate instance for other users. */
    const settings = useMemo(() => (
        userId && userId !== currentUser?.Id ? new userSettings.UserSettings() : userSettings.currentSettings
    ), [ userId, currentUser ]);

    const [ loaded, setLoaded ] = useState(false);
    const [ saving, setSaving ] = useState(false);
    const [ saved, setSaved ] = useState(false);
    const [ expanded, setExpanded ] = useState<Record<string, boolean>>({ sections: true, order: true, folders: true, libs: true });
    const toggle = useCallback((id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] })), []);

    const [ views, setViews ] = useState<BaseItemDto[]>([]);
    const [ groupingOptions, setGroupingOptions ] = useState<GroupingOption[]>([]);

    const [ tvHome, setTvHome ] = useState('');
    const [ hidePlayed, setHidePlayed ] = useState(false);
    const [ sections, setSections ] = useState<string[]>([]);
    const [ latestExcludes, setLatestExcludes ] = useState<string[]>([]);
    const [ myMediaExcludes, setMyMediaExcludes ] = useState<string[]>([]);
    const [ groupedFolders, setGroupedFolders ] = useState<string[]>([]);
    const [ landings, setLandings ] = useState<Record<string, string>>({});

    // Load user config, views and grouping options
    useEffect(() => {
        if (!api || !apiClient || !userId) return;
        let cancelled = false;

        const load = async () => {
            const user: UserDto = await apiClient.getUser(userId);
            await settings.setUserInfo(userId, apiClient);

            const [ viewsResult, grouping ] = await Promise.all([
                queryClient.fetchQuery(getUserViewsQuery(api, { userId, includeHidden: true })).then(r => r.Items ?? []),
                apiClient.getJSON(apiClient.getUrl(`Users/${userId}/GroupingOptions`)) as Promise<GroupingOption[]>
            ]);
            if (cancelled) return;

            const config = user.Configuration;
            setHidePlayed(Boolean(config?.HidePlayedInLatest));
            setLatestExcludes(config?.LatestItemsExcludes ?? []);
            setMyMediaExcludes(config?.MyMediaExcludes ?? []);
            setGroupedFolders(config?.GroupedFolders ?? []);
            setTvHome(settings.get('tvhome') || '');
            setSections(Array.from({ length: NUM_SECTIONS }, (_, i) => (
                settings.get(`homesection${i}`) || DEFAULT_SECTIONS[i] || 'none'
            )));

            const landingValues: Record<string, string> = {};
            viewsResult.forEach(item => {
                const type = getCollectionType(item);
                if (LANDING_OPTIONS[type]) {
                    const id = getLandingId(item);
                    landingValues[id] = normalizeLanding(type, settings.get(`landing-${id}`));
                }
            });
            setLandings(landingValues);

            setViews(viewsResult);
            setGroupingOptions(grouping ?? []);
            setLoaded(true);
        };

        load().catch(err => console.error('[HomePreferences] failed to load settings', err));
        return () => { cancelled = true; };
    }, [ api, apiClient, userId, settings ]);

    const setSection = useCallback((index: number, value: string) => {
        setSections(prev => prev.map((v, i) => (i === index ? value : v)));
    }, []);

    const moveView = useCallback((index: number, delta: number) => {
        setViews(prev => {
            const target = index + delta;
            if (target < 0 || target >= prev.length) return prev;
            const next = [ ...prev ];
            [ next[index], next[target] ] = [ next[target], next[index] ];
            return next;
        });
    }, []);

    const toggleInList = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string, include: boolean) => {
        setter(prev => (include ? [ ...prev.filter(x => x !== id), id ] : prev.filter(x => x !== id)));
    };

    const handleSave = useCallback(async () => {
        if (!apiClient || !userId) return;
        setSaving(true);
        try {
            const user: UserDto = await apiClient.getUser(userId);
            await settings.setUserInfo(userId, apiClient);
            if (!user.Configuration) throw new Error('Missing user configuration');

            user.Configuration.HidePlayedInLatest = hidePlayed;
            user.Configuration.LatestItemsExcludes = latestExcludes;
            user.Configuration.MyMediaExcludes = myMediaExcludes;
            user.Configuration.GroupedFolders = groupedFolders;
            user.Configuration.OrderedViews = views.map(v => v.Id ?? '').filter(Boolean);

            settings.set('tvhome', tvHome);
            sections.forEach((value, i) => {
                // The default section is stored as an empty value
                settings.set(`homesection${i}`, value === DEFAULT_SECTIONS[i] ? '' : value);
            });
            Object.entries(landings).forEach(([ id, value ]) => {
                settings.set(`landing-${id}`, value);
            });

            await apiClient.updateUserConfiguration(userId, user.Configuration);
            void queryClient.invalidateQueries({ queryKey: [ 'User', userId ] });
            setSaved(true);
        } catch (err) {
            console.error('[HomePreferences] failed to save settings', err);
        } finally {
            setSaving(false);
        }
    }, [ apiClient, userId, settings, hidePlayed, latestExcludes, myMediaExcludes, groupedFolders, views, tvHome, sections, landings ]);

    // Libraries that have at least one per-library option
    const perLibraryViews = views.filter(item => (
        hasMyMediaOption(item)
        || !EXCLUDE_FROM_LATEST.includes(getCollectionType(item))
        || Boolean(LANDING_OPTIONS[getCollectionType(item)])
    ));

    if (!loaded) return <Loading />;

    return (
        <Page id='homeScreenPreferencesPage' className='libraryPage userPreferencesPage noSecondaryNavPage mainAnimatedPage' title={globalize.translate('Home')}>
            <Box sx={{ maxWidth: 1300, mx: 'auto', px: 2, pt: 3, pb: 14 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>

                    {/* ── Columna izquierda ── */}
                    <Box>
                        <Card id='sections' title={globalize.translate('Home')} icon={<DashboardCustomizeIcon />} open={expanded.sections} onToggle={toggle}>
                            {layoutManager.tv && (
                                <Sel label={globalize.translate('LabelTVHomeScreen')} value={tvHome || 'horizontal'} onChange={setTvHome} helper={globalize.translate('LabelPleaseRestart')}>
                                    <MenuItem value='horizontal'>{globalize.translate('Horizontal')}</MenuItem>
                                    <MenuItem value='vertical'>{globalize.translate('Vertical')}</MenuItem>
                                </Sel>
                            )}
                            <Check label={globalize.translate('HideWatchedContentFromLatestMedia')} checked={hidePlayed} onChange={setHidePlayed} />
                            <Divider sx={{ borderColor: 'rgba(0,164,220,0.12)', my: 1.5 }} />
                            {sections.map((value, i) => (
                                <Sel
                                    key={`section${i}`}
                                    label={globalize.translate('LabelHomeScreenSectionValue', i + 1)}
                                    value={value}
                                    onChange={v => setSection(i, v)}
                                >
                                    {SECTION_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{globalize.translate(o.label)}</MenuItem>)}
                                </Sel>
                            ))}
                        </Card>
                    </Box>

                    {/* ── Columna derecha ── */}
                    <Box>
                        <Card id='order' title={globalize.translate('HeaderLibraryOrder')} icon={<SwapVertIcon />} accentColor='#aa5cc3' open={expanded.order} onToggle={toggle}>
                            {views.map((view, i) => (
                                <Box key={view.Id} sx={{
                                    display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 0.75, mb: 0.75, borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,92,195,0.15)'
                                }}>
                                    <FolderOpenIcon sx={{ color: '#aa5cc3', fontSize: '1.1rem' }} />
                                    <Typography sx={{ flex: 1, fontSize: '0.88rem', color: 'rgba(255,255,255,0.82)' }}>{view.Name}</Typography>
                                    <IconButton size='small' title={globalize.translate('Up')} disabled={i === 0} onClick={() => moveView(i, -1)}
                                        sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#aa5cc3' } }}>
                                        <KeyboardArrowUpIcon fontSize='small' />
                                    </IconButton>
                                    <IconButton size='small' title={globalize.translate('Down')} disabled={i === views.length - 1} onClick={() => moveView(i, 1)}
                                        sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#aa5cc3' } }}>
                                        <KeyboardArrowDownIcon fontSize='small' />
                                    </IconButton>
                                </Box>
                            ))}
                        </Card>

                        {perLibraryViews.map((item, idx) => {
                            const id = item.Id ?? '';
                            const type = getCollectionType(item);
                            const accent = ACCENTS[idx % ACCENTS.length];
                            const showMyMedia = hasMyMediaOption(item);
                            const inMyMedia = !myMediaExcludes.includes(id);
                            const showLatest = !EXCLUDE_FROM_LATEST.includes(type) && (!showMyMedia || inMyMedia);
                            const landingOptions = LANDING_OPTIONS[type];
                            const landingId = getLandingId(item);
                            const cardId = `lib-${id}`;

                            return (
                                <Card key={cardId} id={cardId} title={item.Name ?? ''} icon={<VideoLibraryIcon />} accentColor={accent}
                                    open={expanded[cardId] ?? true} onToggle={toggle}>
                                    {showMyMedia && (
                                        <Check label={globalize.translate('DisplayInMyMedia')} checked={inMyMedia} color={accent}
                                            onChange={v => toggleInList(setMyMediaExcludes, id, !v)} />
                                    )}
                                    {showLatest && (
                                        <Check label={globalize.translate('DisplayInOtherHomeScreenSections')} checked={!latestExcludes.includes(id)} color={accent}
                                            onChange={v => toggleInList(setLatestExcludes, id, !v)} />
                                    )}
                                    {landingOptions && (
                                        <Box sx={{ mt: (showMyMedia || showLatest) ? 1.5 : 0 }}>
                                            <Sel label={globalize.translate('LabelDefaultScreen')} value={landings[landingId] ?? ''}
                                                onChange={v => setLandings(prev => ({ ...prev, [landingId]: v }))}>
                                                {landingOptions.map((o, i) => (
                                                    <MenuItem key={o.value} value={i === 0 ? '' : o.value}>{globalize.translate(o.label)}</MenuItem>
                                                ))}
                                            </Sel>
                                        </Box>
                                    )}
                                </Card>
                            );
                        })}

                        <Card id='folders' title={globalize.translate('HeaderLibraryFolders')} icon={<FolderCopyIcon />} accentColor='#607d8b' open={expanded.folders} onToggle={toggle}>
                            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                                {globalize.translate('LabelSelectFolderGroups')}
                            </Typography>
                            {groupingOptions.map(folder => (
                                <Check key={folder.Id} label={folder.Name} checked={groupedFolders.includes(folder.Id)} color='#607d8b'
                                    onChange={v => toggleInList(setGroupedFolders, folder.Id, v)} />
                            ))}
                            <Typography sx={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4, mt: 1 }}>
                                {globalize.translate('LabelSelectFolderGroupsHelp')}
                            </Typography>
                        </Card>
                    </Box>
                </Box>

                <SaveButton saving={saving} onClick={handleSave} />
            </Box>

            <SavedSnackbar open={saved} onClose={() => setSaved(false)} />
        </Page>
    );
};

export default HomePreferencesPage;
