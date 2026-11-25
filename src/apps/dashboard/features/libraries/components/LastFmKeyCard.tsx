import KeyIcon from '@mui/icons-material/Key';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import React, { type ChangeEvent, type FC, useCallback, useEffect, useState } from 'react';

import { SectionCard } from 'apps/dashboard/components/cosmic';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

const ACCENT = '#d51007';
const KEY_PAGE = 'https://www.last.fm/api/account/create';

type Notice = { severity: 'success' | 'error', text: string } | null;

const errorKey = (status: number) => (status === 400 ? 'MhLastFmInvalid' : 'MhLastFmUnreachable');

/** The optional Last.fm key of the music data. The server never sends it back, it only says whether it has one. */
const LastFmKeyCard: FC = () => {
    const { api } = useApi();
    const [ hasKey, setHasKey ] = useState(false);
    const [ value, setValue ] = useState('');
    const [ busy, setBusy ] = useState(false);
    const [ notice, setNotice ] = useState<Notice>(null);

    useEffect(() => {
        if (!api) return;
        let isCurrent = true;
        fetch(`${api.basePath}/MusicHub/Metadata/LastFm`, {
            headers: { Authorization: api.authorizationHeader }
        })
            .then(response => (response.ok ? response.json() as Promise<{ HasKey: boolean }> : null))
            .then(state => {
                if (isCurrent) setHasKey(!!state?.HasKey);
            })
            .catch(() => { /* the card stays as without a key */ });
        return () => {
            isCurrent = false;
        };
    }, [ api ]);

    const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value), []);

    const send = useCallback(async (method: 'POST' | 'DELETE', key?: string) => {
        if (!api) return;
        setBusy(true);
        setNotice(null);
        try {
            const response = await fetch(`${api.basePath}/MusicHub/Metadata/LastFm`, {
                method,
                headers: { Authorization: api.authorizationHeader, 'Content-Type': 'application/json' },
                body: key ? JSON.stringify({ Key: key }) : undefined
            });
            if (!response.ok) {
                setNotice({ severity: 'error', text: globalize.translate(errorKey(response.status)) });
                return;
            }
            setHasKey(method === 'POST');
            setValue('');
            setNotice({ severity: 'success', text: globalize.translate(method === 'POST' ? 'MhLastFmSaved' : 'MhLastFmRemoved') });
        } catch {
            setNotice({ severity: 'error', text: globalize.translate('MhLastFmUnreachable') });
        } finally {
            setBusy(false);
        }
    }, [ api ]);

    const onSave = useCallback(() => {
        void send('POST', value.trim());
    }, [ send, value ]);

    const onRemove = useCallback(() => {
        void send('DELETE');
    }, [ send ]);

    return (
        <SectionCard
            title='Last.fm'
            icon={<KeyIcon />}
            accentColor={ACCENT}
            description={globalize.translate('MhLastFmHelp')}
        >
            <Stack spacing={2}>
                <Box>
                    <Chip
                        size='small'
                        color={hasKey ? 'success' : 'default'}
                        label={globalize.translate(hasKey ? 'MhLastFmActive' : 'MhLastFmPending')}
                    />
                </Box>
                <TextField
                    type='password'
                    autoComplete='off'
                    fullWidth
                    value={value}
                    onChange={onChange}
                    label={globalize.translate(hasKey ? 'MhLastFmReplace' : 'MhLastFmKey')}
                />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    <Button
                        variant='contained'
                        disabled={busy || !value.trim()}
                        onClick={onSave}
                        startIcon={busy ? <CircularProgress size={16} color='inherit' /> : undefined}
                    >
                        {globalize.translate('Save')}
                    </Button>
                    {hasKey && (
                        <Button color='error' disabled={busy} onClick={onRemove}>
                            {globalize.translate('MhLastFmRemove')}
                        </Button>
                    )}
                    <Link href={KEY_PAGE} target='_blank' rel='noopener noreferrer' sx={{ ml: { sm: 'auto' }, fontSize: '0.85rem' }}>
                        {globalize.translate('MhLastFmGetKey')}
                    </Link>
                </Box>
                {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}
            </Stack>
        </SectionCard>
    );
};

export default LastFmKeyCard;
