import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import BrandingWatermarkIcon from '@mui/icons-material/BrandingWatermark';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Upload from '@mui/icons-material/Upload';
import React, { type FC, useCallback, useState } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { type CustomLogoType, refreshCustomLogo, useCustomLogo } from 'utils/customLogo';

import { SectionCard } from '../../../components/cosmic';

const ACCENT = '#ff9800';
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const MAX_BYTES = 10 * 1024 * 1024;

const outlinedSx = (color: string) => ({
    fontWeight: 600,
    color,
    borderColor: `${color}55`,
    background: `${color}10`,
    '&:hover': { borderColor: color, background: `${color}22` }
});

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.onabort = () => reject(new Error('aborted'));
    reader.readAsDataURL(file);
});

interface LogoSlotProps {
    type: CustomLogoType;
    title: string;
    help: string;
    url: string;
    isCustom: boolean;
    aspect: string;
    previewWidth: number;
    onError: (key: string) => void;
}

const LogoSlot: FC<LogoSlotProps> = ({ type, title, help, url, isCustom, aspect, previewWidth, onError }) => {
    const { api } = useApi();
    const [ busy, setBusy ] = useState(false);

    const onUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!api || !file) return;
        if (file.size > MAX_BYTES) {
            onError('BrandingLogoTooLarge');
            return;
        }

        setBusy(true);
        try {
            const dataUrl = await readAsDataUrl(file);
            await api.axiosInstance.post(`${api.basePath}/Branding/Logo?type=${type}`, dataUrl.split(',')[1], {
                headers: { Authorization: api.authorizationHeader, 'Content-Type': file.type }
            });
            await refreshCustomLogo();
        } catch (err) {
            console.error('[LogoCard] upload failed', err);
            onError('ImageUploadFailed');
        } finally {
            setBusy(false);
        }
    }, [ api, type, onError ]);

    const onRestore = useCallback(async () => {
        if (!api) return;
        setBusy(true);
        try {
            await api.axiosInstance.delete(`${api.basePath}/Branding/Logo?type=${type}`, {
                headers: { Authorization: api.authorizationHeader }
            });
            await refreshCustomLogo();
        } catch (err) {
            console.error('[LogoCard] delete failed', err);
            onError('ImageDeleteFailed');
        } finally {
            setBusy(false);
        }
    }, [ api, type, onError ]);
    return (
        <Box sx={{
            p: 2, borderRadius: '14px', minWidth: 0,
            display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
        }}>
            {/* Preview on a subtle checkerboard so transparent logos are visible */}
            <Box sx={{
                position: 'relative', aspectRatio: aspect, flex: `0 1 ${previewWidth}px`, minWidth: 120, borderRadius: '12px', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, boxSizing: 'border-box',
                border: `1px solid ${ACCENT}30`,
                backgroundColor: '#0b0c18',
                backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.04) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.04) 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0'
            }}>
                <Box component='img' src={url} alt={title} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: busy ? 0.4 : 1 }} />
                {busy && <CircularProgress size={28} sx={{ position: 'absolute', color: ACCENT }} />}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, flex: '1 1 220px', minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{title}</Typography>
                    <Box sx={{
                        px: 1, py: 0.2, borderRadius: '8px', fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap',
                        color: isCustom ? ACCENT : 'rgba(255,255,255,0.45)',
                        background: isCustom ? `${ACCENT}1f` : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isCustom ? `${ACCENT}55` : 'rgba(255,255,255,0.1)'}`
                    }}>
                        {globalize.translate(isCustom ? 'BrandingLogoCustom' : 'BrandingLogoDefault')}
                    </Box>
                </Box>

                <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{help}</Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 280 }}>
                    <Button component='label' variant='outlined' size='small' startIcon={<Upload />} disabled={busy}
                        sx={{ ...outlinedSx(ACCENT), justifyContent: 'flex-start', whiteSpace: 'nowrap', py: 0.75 }}>
                        <input type='file' accept={ACCEPT} hidden onChange={onUpload} />
                        {globalize.translate('UploadCustomImage')}
                    </Button>
                    <Button variant='outlined' size='small' startIcon={<RestartAltIcon />} disabled={busy || !isCustom} onClick={onRestore}
                        sx={{ ...outlinedSx('#90a4ae'), justifyContent: 'flex-start', whiteSpace: 'nowrap', py: 0.75 }}>
                        {globalize.translate('BrandingLogoRestore')}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

const LogoCard: FC<{ onError: (key: string) => void }> = ({ onError }) => {
    const logo = useCustomLogo();

    return (
        <SectionCard
            title={globalize.translate('BrandingLogo')}
            icon={<BrandingWatermarkIcon />}
            accentColor={ACCENT}
            description={globalize.translate('BrandingLogoHelp')}
        >
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: 2 }}>
                <LogoSlot
                    type='Icon'
                    title={globalize.translate('BrandingLogoIcon')}
                    help={globalize.translate('BrandingLogoIconHelp')}
                    url={logo.iconUrl}
                    isCustom={logo.hasCustomIcon}
                    aspect='1 / 1'
                    previewWidth={150}
                    onError={onError}
                />
                <LogoSlot
                    type='Banner'
                    title={globalize.translate('BrandingLogoBanner')}
                    help={globalize.translate('BrandingLogoBannerHelp')}
                    url={logo.bannerUrl}
                    isCustom={logo.hasCustomBanner}
                    aspect='16 / 7'
                    previewWidth={300}
                    onError={onError}
                />
            </Box>
        </SectionCard>
    );
};

export default LogoCard;
