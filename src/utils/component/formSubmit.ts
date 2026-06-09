/**
 * Submit button "sending" state for Webflow forms.
 *
 * Targets `[data-form="submit-btn"]`. While the form is submitting
 * (between the click and Webflow revealing the success/error message)
 * the `is-sending` class adds the larger right padding (see CSS).
 *
 * The label text is left to Webflow's native `data-wait` mechanism
 * (set below) — we never touch the button's content in JS, so its inner
 * markup (icon, text span…) stays intact and we don't risk re-triggering
 * the observer below.
 *
 * The end of the sending state is detected by watching the surrounding
 * `.w-form` wrapper for Webflow showing `.w-form-done` / `.w-form-fail`.
 * The observer only toggles the button's class — it never mutates the
 * observed subtree — so it cannot retrigger itself.
 */

import './formSubmit.css';

const SUBMIT_SELECTOR = '[data-form="submit-btn"]';
const WAIT_TEXT = 'Envoi en cours...';
const SENDING_CLASS = 'is-sending';

function isVisible(el: Element | null): boolean {
  return !!el && getComputedStyle(el).display !== 'none';
}

function setupButton(btn: HTMLElement): void {
  const form = btn.closest('form');
  const wrapper = form?.closest('.w-form');
  if (!form || !wrapper) return;

  // Native Webflow "waiting" text — Webflow swaps it in/out on its own.
  btn.setAttribute('data-wait', WAIT_TEXT);

  // Hook the button click (capture phase) rather than the form's `submit`
  // event: multi-step libraries (Formly) can stopImmediatePropagation on
  // `submit`, which would prevent our listener from ever running.
  btn.addEventListener(
    'click',
    () => {
      btn.classList.add(SENDING_CLASS);
    },
    true
  );

  const observer = new MutationObserver(() => {
    if (
      isVisible(wrapper.querySelector('.w-form-done')) ||
      isVisible(wrapper.querySelector('.w-form-fail'))
    ) {
      btn.classList.remove(SENDING_CLASS);
    }
  });
  observer.observe(wrapper, {
    attributes: true,
    attributeFilter: ['style'],
    childList: true,
    subtree: true,
  });
}

export function initFormSubmit(): void {
  document.querySelectorAll<HTMLElement>(SUBMIT_SELECTOR).forEach(setupButton);
}
