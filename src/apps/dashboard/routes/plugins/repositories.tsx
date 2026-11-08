import React, { type FC, useCallback, useMemo, useState } from 'react';
import type { RepositoryInfo } from '@jellyfin/sdk/lib/generated-client/models/repository-info';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import ExtensionIcon from '@mui/icons-material/Extension';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PublicIcon from '@mui/icons-material/Public';
import StorageIcon from '@mui/icons-material/Storage';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Link } from 'react-router-dom';

import { SectionCard } from 'apps/dashboard/components/cosmic';
import { usePackages } from 'apps/dashboard/features/plugins/api/usePackages';
import { useRepositories } from 'apps/dashboard/features/plugins/api/useRepositories';
import { useSetRepositories } from 'apps/dashboard/features/plugins/api/useSetRepositories';
import NewRepositoryForm from 'apps/dashboard/features/plugins/components/NewRepositoryForm';
import { Badge, StatTile, TRUSTED_REPO_URL } from 'apps/dashboard/features/plugins/components/PluginCosmic';
import ConfirmDialog from 'components/ConfirmDialog';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import globalize from 'lib/globalize';

import { PageHeader } from '../../components/cosmic';

const OFFICIAL_REPO: RepositoryInfo = { Name: 'Jellyfin Stable', Url: 'https://repo.jellyfin.org/files/plugin/manifest.json', Enabled: true };

const isOfficial = (url?: string | null) => !!url?.startsWith(TRUSTED_REPO_URL);

const RepositoryCard: FC<{ repository: RepositoryInfo; pluginCount: number; busy: boolean; onToggle: (r: RepositoryInfo, enabled: boolean) => void; onDelete: (r: RepositoryInfo) => void }> = ({ repository, pluginCount, busy, onToggle, onDelete }) => {
    const [ confirmOpen, setConfirmOpen ] = useState(false);
    const [ copied, setCopied ] = useState(false);
    const official = isOfficial(repository.Url);
    const enabled = repository.Enabled !== false;
    const accent = official ? '#00a4dc' : '#aa5cc3';

    const openConfirm = useCallback(() => setConfirmOpen(true), []);
    const closeConfirm = useCallback(() => setConfirmOpen(false), []);
    const confirmDelete = useCallback(() => {
        setConfirmOpen(false);
        onDelete(repository);
    }, [ onDelete, repository ]);
    const toggle = useCallback((_: unknown, v: boolean) => onToggle(repository, v), [ onToggle, repository ]);
    const copy = useCallback(() => {
        if (!repository.Url) return;
        void navigator.clipboard?.writeText(repository.Url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }, [ repository.Url ]);

    return (
        <Paper elevation={0} sx={{
            position: 'relative', overflow: 'hidden', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderRadius: '16px',
            border: `1px solid ${accent}33`, opacity: enabled ? 1 : 0.6, transition: 'opacity 0.2s, border-color 0.2s', '&:hover': { borderColor: `${accent}77` }
        }}>
            <Box sx={{ position: 'absolute', top: 0, left: '1.25rem', right: '1.25rem', height: '2px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                    width: 44, height: 44, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${accent}1f`, border: `1px solid ${accent}44`, '& svg': { color: accent }
                }}>
                    {official ? <VerifiedIcon /> : <PublicIcon />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700, color: '#fff' }}>{repository.Name || repository.Url}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                        <Badge label={globalize.translate(official ? 'PlgOfficial' : 'PlgThirdParty')} color={accent} />
                        <Badge label={globalize.translate(enabled ? 'PlgEnabled' : 'PlgStatusDisabled')} color={enabled ? '#4caf50' : '#90a4ae'} dot />
                    </Box>
                </Box>
                <Tooltip title={globalize.translate(enabled ? 'PlgDisableRepo' : 'PlgEnableRepo')}>
                    <span><Switch checked={enabled} onChange={toggle} disabled={busy} /></span>
                </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 1, pl: 1.25, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography sx={{ flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {repository.Url}
                </Typography>
                <Tooltip title={globalize.translate(copied ? 'LtvCopied' : 'LtvCopyUrl')}>
                    <IconButton size='small' onClick={copy}><ContentCopyIcon sx={{ fontSize: '0.95rem' }} /></IconButton>
                </Tooltip>
                <Tooltip title={globalize.translate('PlgOpenManifest')}>
                    <IconButton size='small' component='a' href={repository.Url || '#'} target='_blank' rel='noopener noreferrer'><OpenInNewIcon sx={{ fontSize: '0.95rem' }} /></IconButton>
                </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ExtensionIcon sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)' }} />
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', flex: 1 }}>
                    {enabled ? globalize.translate('PlgRepoPlugins', pluginCount) : globalize.translate('PlgRepoDisabledHelp')}
                </Typography>
                {enabled && pluginCount > 0 && (
                    <Button size='small' component={Link} to='/dashboard/plugins?status=Available'>{globalize.translate('PlgBrowse')}</Button>
                )}
                <Tooltip title={globalize.translate('ButtonRemove')}>
                    <IconButton size='small' onClick={openConfirm} disabled={busy} sx={{ color: '#ef5350' }}><DeleteIcon fontSize='small' /></IconButton>
                </Tooltip>
            </Box>

            <ConfirmDialog
                open={confirmOpen}
                title={globalize.translate('ConfirmDeleteRepository')}
                text={globalize.translate('DeleteRepositoryConfirmation')}
                onConfirm={confirmDelete}
                onCancel={closeConfirm}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('Delete')}
            />
        </Paper>
    );
};

export const Component = () => {
    const { data: repositories, isPending, isError } = useRepositories();
    const { data: packages } = usePackages();
    const [ isRepositoryFormOpen, setIsRepositoryFormOpen ] = useState(false);
    const setRepositories = useSetRepositories();

    /** Number of plugins each repository provides (by manifest URL). */
    const counts = useMemo(() => {
        const map = new Map<string, number>();
        (packages || []).forEach(p => {
            const urls = new Set((p.versions || []).map(v => v.repositoryUrl).filter(Boolean) as string[]);
            urls.forEach(u => map.set(u, (map.get(u) || 0) + 1));
        });
        return map;
    }, [ packages ]);

    const save = useCallback((list: RepositoryInfo[], onSettled?: () => void) => {
        setRepositories.mutate({ repositoryInfo: list }, { onSettled });
    }, [ setRepositories ]);

    const onDelete = useCallback((repository: RepositoryInfo) => {
        if (repositories) save(repositories.filter(r => r.Url !== repository.Url));
    }, [ repositories, save ]);

    const onToggle = useCallback((repository: RepositoryInfo, enabled: boolean) => {
        if (repositories) save(repositories.map(r => (r.Url === repository.Url ? { ...r, Enabled: enabled } : r)));
    }, [ repositories, save ]);

    const onRepositoryAdd = useCallback((repository: RepositoryInfo) => {
        if (repositories) save([ ...repositories, repository ], () => setIsRepositoryFormOpen(false));
    }, [ repositories, save ]);

    const restoreOfficial = useCallback(() => {
        if (repositories) save([ OFFICIAL_REPO, ...repositories ]);
    }, [ repositories, save ]);

    const openRepositoryForm = useCallback(() => setIsRepositoryFormOpen(true), []);
    const onRepositoryFormClose = useCallback(() => setIsRepositoryFormOpen(false), []);

    if (isPending) return <Loading />;

    const list = repositories || [];
    const enabledCount = list.filter(r => r.Enabled !== false).length;
    const thirdParty = list.filter(r => !isOfficial(r.Url)).length;
    const hasOfficial = list.some(r => isOfficial(r.Url));

    return (
        <Page id='repositories' title={globalize.translate('TabRepositories')} className='type-interior mainAnimatedPage fullWidthContent'>
            <NewRepositoryForm open={isRepositoryFormOpen} onClose={onRepositoryFormClose} onAdd={onRepositoryAdd} />
            <Box className='content-primary' sx={{ pb: 6 }}>
                <Button component={Link} to='/dashboard/plugins' startIcon={<ArrowBackIcon />} size='small' sx={{ mt: 1 }}>
                    {globalize.translate('TabPlugins')}
                </Button>
                <PageHeader
                    title={globalize.translate('TabRepositories')}
                    subtitle={globalize.translate('PlgReposSubtitle')}
                    actions={(
                        <Button variant='contained' size='small' startIcon={<AddIcon />} onClick={openRepositoryForm}>
                            {globalize.translate('HeaderNewRepository')}
                        </Button>
                    )}
                />

                {isError ? (
                    <Alert severity='error'>{globalize.translate('RepositoriesPageLoadError')}</Alert>
                ) : (
                    <>
                        {setRepositories.isError && <Alert severity='error' sx={{ mb: 2 }}>{globalize.translate('PlgReposSaveError')}</Alert>}

                        {!hasOfficial && (
                            <Alert severity='warning' sx={{ mb: 2, alignItems: 'center' }} action={(
                                <Button color='inherit' size='small' onClick={restoreOfficial} disabled={setRepositories.isPending}>{globalize.translate('PlgRestoreOfficial')}</Button>
                            )}>
                                {globalize.translate('PlgNoOfficialRepo')}
                            </Alert>
                        )}

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 1.5, mb: 2.5 }}>
                            <StatTile icon={<StorageIcon />} label={globalize.translate('TabRepositories')} value={list.length} color='#00a4dc' />
                            <StatTile icon={<ToggleOnIcon />} label={globalize.translate('PlgEnabled')} value={enabledCount} color='#4caf50' />
                            <StatTile icon={<PublicIcon />} label={globalize.translate('PlgThirdParty')} value={thirdParty} color='#aa5cc3' />
                            <StatTile icon={<ExtensionIcon />} label={globalize.translate('PlgCatalog')} value={packages?.length ?? '—'} color='#ffca28' />
                        </Box>

                        {list.length > 0 ? (
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: 2, mb: 2.5 }}>
                                {list.map(r => (
                                    <RepositoryCard key={r.Url} repository={r} pluginCount={counts.get(r.Url || '') || 0} busy={setRepositories.isPending} onToggle={onToggle} onDelete={onDelete} />
                                ))}
                            </Box>
                        ) : (
                            <Paper elevation={0} sx={{ p: 4, mb: 2.5, textAlign: 'center', borderRadius: '16px' }}>
                                <StorageIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.25)' }} />
                                <Typography sx={{ fontWeight: 700, mt: 1 }}>{globalize.translate('MessageNoRepositories')}</Typography>
                                <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', mt: 0.5 }}>{globalize.translate('MessageAddRepository')}</Typography>
                            </Paper>
                        )}

                        <SectionCard title={globalize.translate('PlgSecurity')} icon={<GppMaybeIcon />} accentColor='#ff9800'>
                            <Stack component='ul' spacing={1} sx={{ m: 0, pl: 2.5 }}>
                                {[ 'PlgSecurity1', 'PlgSecurity2', 'PlgSecurity3' ].map(k => (
                                    <Typography key={k} component='li' sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{globalize.translate(k)}</Typography>
                                ))}
                            </Stack>
                        </SectionCard>
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'PluginRepositoriesPage';
