import { describe, expect, test } from 'vitest';

import { parseLimitedHtml } from './limitedHtml';

describe('parseLimitedHtml', () => {
    test('plain text stays as it is', () => {
        expect(parseLimitedHtml('Port number')).toEqual([ 'Port number' ]);
    });

    test('code and bold, with escaped brackets inside (like es-MX LabelBaseUrlHelp)', () => {
        expect(parseLimitedHtml('Por ejemplo: <code>https://ejemplo.com/<b>&lt;urlbase&gt;</b></code>')).toEqual([
            'Por ejemplo: ',
            { tag: 'code', children: [ 'https://ejemplo.com/', { tag: 'b', children: [ '<urlbase>' ] } ] }
        ]);
    });

    test('an unknown tag is a placeholder shown as text (en-US LabelBaseUrlHelp)', () => {
        expect(parseLimitedHtml('For example: https://example.com/<baseurl>')).toEqual([ 'For example: https://example.com/<baseurl>' ]);
    });

    test('line breaks', () => {
        expect(parseLimitedHtml('One<br>two<br/>three<BR />')).toEqual([ 'One', { tag: 'br' }, 'two', { tag: 'br' }, 'three', { tag: 'br' } ]);
    });

    test('scripts, attributes and other tags never become elements', () => {
        expect(parseLimitedHtml('<script>alert(1)</script><b onclick="x">y</b><img src=x onerror=alert(1)>')).toEqual([
            '<script>alert(1)</script><b onclick="x">y</b><img src=x onerror=alert(1)>'
        ]);
    });

    test('a closing tag alone is text; an unclosed tag ends with the text', () => {
        expect(parseLimitedHtml('a</b>c')).toEqual([ 'a</b>c' ]);
        expect(parseLimitedHtml('<b>open')).toEqual([ { tag: 'b', children: [ 'open' ] } ]);
    });

    test('closing an outer tag closes the ones left open inside it', () => {
        expect(parseLimitedHtml('<code>a<b>b</code>c')).toEqual([
            { tag: 'code', children: [ 'a', { tag: 'b', children: [ 'b' ] } ] },
            'c'
        ]);
    });

    test('entities', () => {
        expect(parseLimitedHtml('&lt;x&gt; &amp; &quot;y&quot; &#39;z&apos;')).toEqual([ '<x> & "y" \'z\'' ]);
    });
});
