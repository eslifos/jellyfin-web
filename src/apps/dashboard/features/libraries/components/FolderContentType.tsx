/**
 * What a folder of a mixed library holds (movies or series), so the scan reads it right instead of guessing
 * (custom /Library/VirtualFolders/ContentTypes endpoint). Used when creating a library and in "Manage".
 */
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LocalMoviesRoundedIcon from '@mui/icons-material/LocalMoviesRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import AutoModeRoundedIcon from '@mui/icons-material/AutoModeRounded';
import type { Api } from '@jellyfin/sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { type FC, useCallback } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

/** '' = automatic (Jellyfin guesses), 'movies' or 'tvshows'. */
export type FolderType = '' | 'movies' | 'tvshows';

export interface FolderContentTypeInfo {
    Path: string;
    ContentType?: string | null;
}

/** First guess from the folder name ("series-kids", "peliculas-anime"…). */
export const guessFolderType = (path: string): FolderType => {
    const name = path.toLowerCase();
    if (/(serie|show|tv\b|televisi|temporad|episod)/.test(name)) return 'tvshows';
    if (/(pel[ií]cul|movie|film|cine)/.test(name)) return 'movies';
    return '';
};

export const getFolderContentTypes = async (api: Api, name: string) =>
    (await api.axiosInstance.get<FolderContentTypeInfo[]>(`${api.basePath}/Library/VirtualFolders/ContentTypes`, {
        headers: { Authorization: api.authorizationHeader }, params: { name }
    })).data ?? [];

/** Saves the types; the server reads those folders again right away unless refresh is false. */
export const setFolderContentTypes = async (api: Api, name: string, folders: FolderContentTypeInfo[], refresh = true) => {
    await api.axiosInstance.post(`${api.basePath}/Library/VirtualFolders/ContentTypes`, { Name: name, Folders: folders }, {
        headers: { Authorization: api.authorizationHeader },
        params: { refresh }
    });
};

const buttonSx = { px: 1.25, py: 0.4, gap: 0.5, textTransform: 'none', fontWeight: 700, fontSize: '0.75rem' };

export const FolderTypeToggle: FC<{ value: FolderType, disabled?: boolean, onChange: (value: FolderType) => void }> = ({ value, disabled, onChange }) => {
    const onToggle = useCallback((_: React.MouseEvent, v: FolderType | null) => {
        if (v !== null) onChange(v);
    }, [ onChange ]);

    return (
        <ToggleButtonGroup exclusive size='small' value={value} onChange={onToggle} disabled={disabled}>
            <ToggleButton value='' sx={buttonSx}><AutoModeRoundedIcon sx={{ fontSize: 16 }} />{globalize.translate('FctAuto')}</ToggleButton>
            <ToggleButton value='movies' sx={buttonSx}><LocalMoviesRoundedIcon sx={{ fontSize: 16 }} />{globalize.translate('Movies')}</ToggleButton>
            <ToggleButton value='tvshows' sx={buttonSx}><TvRoundedIcon sx={{ fontSize: 16 }} />{globalize.translate('Shows')}</ToggleButton>
        </ToggleButtonGroup>
    );
};

/**
 * Selector of one folder in "Manage": saves the type right away and the server reads that folder again, so its
 * items become movies or series.
 */
export const ManagedFolderType: FC<{ libraryName: string, path: string, onSaved?: () => void, onError?: () => void }> = ({ libraryName, path, onSaved, onError }) => {
    const { api } = useApi();
    const { data, refetch } = useQuery({
        queryKey: [ 'FolderContentTypes', libraryName ],
        queryFn: () => getFolderContentTypes(api!, libraryName),
        enabled: !!api && !!libraryName
    });
    const save = useMutation({
        mutationFn: async (value: FolderType) => {
            await setFolderContentTypes(api!, libraryName, [ { Path: path, ContentType: value || null } ]);
        },
        onSuccess: () => {
            void refetch();
            onSaved?.();
        },
        onError: () => onError?.()
    });
    const onChange = useCallback((value: FolderType) => save.mutate(value), [ save ]);
    const current = (data?.find(f => f.Path === path)?.ContentType ?? '') as FolderType;
    const value = save.isPending ? save.variables : current;

    return <FolderTypeToggle value={value} disabled={!data || save.isPending} onChange={onChange} />;
};
