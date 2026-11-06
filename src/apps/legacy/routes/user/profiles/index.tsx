/**
 * Full-screen "Who's watching?" page, shown after login when the account has
 * more than one profile (see utils/profiles getPostLoginUrl).
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import ProfilePicker from 'components/profiles/ProfilePicker';
import { useProfiles } from 'components/profiles/useProfiles';
import globalize from 'lib/globalize';
import { useCustomLogo } from 'utils/customLogo';

const getSafeTarget = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/home');

const ProfilesPage: FC = () => {
    const navigate = useNavigate();
    const [ searchParams ] = useSearchParams();
    const target = getSafeTarget(searchParams.get('next'));
    const { list, isLoading, isError, busyId, refresh, select } = useProfiles();
    const { bannerUrl } = useCustomLogo();

    const goTarget = useCallback(() => navigate(target, { replace: true }), [ navigate, target ]);

    if (isLoading) return <Loading />;

    return (
        <Page id='profilesPage' className='mainAnimatedPage standalonePage' title={globalize.translate('ProfilesWhoIsWatching')} isBackButtonEnabled={false}>
            <Box sx={{
                position: 'fixed', inset: 0, zIndex: 1, overflowY: 'auto',
                background: 'radial-gradient(ellipse at 18% 40%, rgba(0,55,90,0.6) 0%, transparent 55%), radial-gradient(ellipse at 82% 20%, rgba(80,0,110,0.5) 0%, transparent 55%), #080810',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 2, py: 6, gap: 5
            }}>
                <Box component='img' src={bannerUrl} alt='' sx={{ height: 52, maxWidth: '70vw', objectFit: 'contain', filter: 'drop-shadow(0 0 18px rgba(0,164,220,0.35))' }} />

                <Typography component='h1' sx={{
                    fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 800, letterSpacing: '-1px', textAlign: 'center',
                    background: 'linear-gradient(135deg, #fff 25%, #00a4dc 65%, #aa5cc3 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                }}>
                    {globalize.translate('ProfilesWhoIsWatching')}
                </Typography>

                {list ? (
                    <ProfilePicker
                        list={list}
                        onSelect={profile => void select(profile, target, goTarget)}
                        onChanged={() => void refresh()}
                        busyId={busyId}
                    />
                ) : null}

                {isError && (
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ color: '#ef5350', mb: 1.5 }}>{globalize.translate('ProfilesLoadError')}</Typography>
                        <Button variant='outlined' onClick={goTarget}>{globalize.translate('ButtonContinue')}</Button>
                    </Box>
                )}
            </Box>
        </Page>
    );
};

export default ProfilesPage;
