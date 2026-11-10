/**
 * Opens the trailer player (downloaded by the server, in the library language) from legacy pages
 * such as the item details page, instead of the YouTube player.
 */
import React, { type FC, useState } from 'react';

import { renderComponent } from 'utils/reactUtils';

import { TrailerDialog } from '.';

const Host: FC<{ itemId: string; onClosed: () => void }> = ({ itemId, onClosed }) => {
    const [ open, setOpen ] = useState(true);
    const close = () => {
        setOpen(false);
        // Let the dialog animate out before removing it
        window.setTimeout(onClosed, 300);
    };

    return <TrailerDialog open={open} onClose={close} source={{ itemId }} />;
};

export const showTrailerDialog = (itemId: string) => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    let unmount: (() => void) | null = null;
    const onClosed = () => {
        unmount?.();
        window.setTimeout(() => element.remove(), 0);
    };
    unmount = renderComponent(Host, { itemId, onClosed }, element);
};

export default showTrailerDialog;
