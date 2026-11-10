import React, { FC, useCallback } from 'react';
import IconButton from '@mui/material/IconButton';
import TheatersIcon from '@mui/icons-material/Theaters';

import { playbackManager } from 'components/playback/playbackmanager';
import showTrailerDialog from 'apps/modern/components/Trailer/showTrailerDialog';
import globalize from 'lib/globalize';
import type { ItemDto } from 'types/base/models/item-dto';

interface PlayTrailerButtonProps {
    item?: ItemDto;
}

const PlayTrailerButton: FC<PlayTrailerButtonProps> = ({ item }) => {
    const onPlayTrailerClick = useCallback(async () => {
        if (item?.LocalTrailerCount || !item?.Id) {
            await playbackManager.playTrailers(item);
            return;
        }

        // Online trailers: downloaded by the server in the library language, played inside the app
        showTrailerDialog(item.Id);
    }, [item]);

    return (
        <IconButton
            className='button-flat btnPlayTrailer'
            title={globalize.translate('ButtonTrailer')}
            onClick={onPlayTrailerClick}
        >
            <TheatersIcon />
        </IconButton>
    );
};

export default PlayTrailerButton;
