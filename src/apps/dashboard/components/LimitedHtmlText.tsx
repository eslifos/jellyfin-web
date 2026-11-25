/**
 * Shows a translated help text that may carry <code>, <b> or <br> (see utils/limitedHtml): those become real
 * elements, everything else is shown as text. No HTML is ever injected.
 */
import Box from '@mui/material/Box';
import React, { type FC, type ReactNode, useMemo } from 'react';

import { type LimitedHtmlNode, parseLimitedHtml } from '../utils/limitedHtml';

const codeSx = {
    fontFamily: 'monospace',
    fontSize: '0.95em',
    px: 0.5,
    py: 0.1,
    borderRadius: '4px',
    background: 'rgba(127,127,127,0.18)',
    overflowWrap: 'anywhere'
};

const draw = (nodes: LimitedHtmlNode[]): ReactNode[] => nodes.map((node, i) => {
    // The order of the pieces of a text never changes: their position is their key
    const key = `n${i}`;
    if (typeof node === 'string') return <React.Fragment key={key}>{node}</React.Fragment>;
    if (node.tag === 'br') return <br key={key} />;
    if (node.tag === 'code') return <Box key={key} component='code' sx={codeSx}>{draw(node.children)}</Box>;
    return <b key={key}>{draw(node.children)}</b>;
});

const LimitedHtmlText: FC<{ text: string }> = ({ text }) => {
    const nodes = useMemo(() => parseLimitedHtml(text), [ text ]);
    return <>{draw(nodes)}</>;
};

export default LimitedHtmlText;
