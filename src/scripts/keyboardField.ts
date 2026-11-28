/**
 * The field being typed in stays in view when the on-screen keyboard comes up. The apps make the page shorter above
 * the keyboard (the Android one does it for its web view); then the field, if it was in the part now covered, is
 * scrolled up to the middle of what is left. Only when the page gets shorter, with a text field focused.
 */
const isTextField = (el: Element | null): el is HTMLElement =>
    Boolean(el?.matches('input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"]'));

let lastHeight = 0;

const onResize = () => {
    const height = window.innerHeight;
    const shorter = height < lastHeight;
    lastHeight = height;
    const field = document.activeElement;
    if (!shorter || !isTextField(field)) return;
    const box = field.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= height) return;
    field.scrollIntoView({ block: 'center' });
};

let installed = false;

export const installKeyboardField = () => {
    if (installed) return;
    installed = true;
    lastHeight = window.innerHeight;
    window.addEventListener('resize', onResize);
};
