/**
 * Some translations of help texts carry a little markup ("<code>http://example.com/<b>&lt;baseurl&gt;</b></code>").
 * Only <code>, <b> and <br> and the common entities are understood; anything else (an unknown tag like the
 * "<baseurl>" placeholder, attributes, scripts) stays plain text. The result is drawn by React, which escapes text,
 * so a translation can never inject HTML.
 */
export type LimitedHtmlNode =
    | string
    | { tag: 'br' }
    | { tag: 'code' | 'b'; children: LimitedHtmlNode[] };

type Container = { tag: 'code' | 'b'; children: LimitedHtmlNode[] };

const TOKEN = /<(\/?)(code|b|br)\s*\/?>|&(lt|gt|amp|quot|apos|#39|nbsp);/gi;

const ENTITIES: Record<string, string> = {
    lt: '<',
    gt: '>',
    amp: '&',
    quot: '"',
    apos: '\'',
    nbsp: ' '
};

/** "&#39;" is the same apostrophe as "&apos;". */
const entityText = (name: string) => ENTITIES[name === '#39' ? 'apos' : name.toLowerCase()];

/** Splits a text into plain text and the few allowed elements. */
export const parseLimitedHtml = (text: string): LimitedHtmlNode[] => {
    const root: LimitedHtmlNode[] = [];
    const open: Container[] = [];
    const current = () => (open.length ? open[open.length - 1].children : root);
    const addText = (value: string) => {
        if (!value) return;
        const list = current();
        const last = list[list.length - 1];
        if (typeof last === 'string') list[list.length - 1] = last + value;
        else list.push(value);
    };

    let index = 0;
    for (const match of text.matchAll(TOKEN)) {
        addText(text.slice(index, match.index));
        index = (match.index ?? 0) + match[0].length;
        const [ token, closing, tagName, entity ] = match;

        if (entity) {
            addText(entityText(entity));
            continue;
        }

        const tag = tagName.toLowerCase();
        if (tag === 'br') {
            current().push({ tag: 'br' });
        } else if (!closing) {
            const element: Container = { tag: tag as Container['tag'], children: [] };
            current().push(element);
            open.push(element);
        } else {
            // Closes its own opening tag (and any left open inside it); a closing tag alone is shown as it is
            const at = open.map(e => e.tag).lastIndexOf(tag as Container['tag']);
            if (at === -1) addText(token);
            else open.length = at;
        }
    }
    addText(text.slice(index));
    return root;
};
