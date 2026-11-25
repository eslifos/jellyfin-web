import { describe, expect, it, vi } from 'vitest';

import { getQueryPagingHtml } from './libraryBrowser';

// The real module loads the whole app: only the texts are needed
vi.mock('lib/globalize', () => ({
    default: {
        translate: (key: string, ...args: unknown[]) => ({
            Previous: 'Anterior',
            Next: 'Siguiente "más"'
        }[key] ?? [ key, ...args ].join(' '))
    }
}));

const paging = (startIndex: number, totalRecordCount: number) => {
    const root = document.createElement('div');
    root.innerHTML = getQueryPagingHtml({ startIndex, limit: 100, totalRecordCount });
    return {
        previous: root.querySelector<HTMLButtonElement>('.btnPreviousPage'),
        next: root.querySelector<HTMLButtonElement>('.btnNextPage')
    };
};

describe('Scripts: libraryBrowser', () => {
    describe('Function: getQueryPagingHtml', () => {
        it('Should name the previous and next page buttons for screen readers and on hover', () => {
            const { previous, next } = paging(100, 500);
            expect(previous?.getAttribute('aria-label')).toBe('Anterior');
            expect(previous?.title).toBe('Anterior');
            expect(next?.getAttribute('aria-label')).toBe('Siguiente "más"');
            expect(next?.title).toBe('Siguiente "más"');
        });

        it('Should keep the first and last page limits', () => {
            expect(paging(0, 500).previous?.disabled).toBe(true);
            expect(paging(0, 500).next?.disabled).toBe(false);
            expect(paging(400, 500).next?.disabled).toBe(true);
        });

        it('Should not draw the buttons when everything fits in one page', () => {
            expect(paging(0, 50).previous).toBeNull();
        });
    });
});
