/**
 * Meeting popup.
 *
 * Markup is driven by the `popup-meeting` attribute:
 *  - `component`  : the popup root. Starts `display:none`, switched to
 *                   `display:flex` while open.
 *  - `background` : the backdrop, fades in first.
 *  - `card`       : (optional) the panel that slides up (y: 4rem → 0) + fades
 *                   in. Falls back to the component when absent.
 *  - `open`       : triggers (can be many on a page).
 *  - `close`      : close trigger(s).
 *
 * Open animation: background fade-in, then card slide + fade.
 * Page scroll is locked while open. Closes on Escape or a `close` trigger,
 * playing the open animation in reverse before hiding the root.
 *
 * The popup also opens automatically on page load when the URL carries a
 * `meeting` query param (e.g. `/?meeting`).
 */

import './popupMeeting.css';

import gsap from 'gsap';

const SCROLL_LOCK_CLASS = 'u-popup-open';

interface PopupState {
  component: HTMLElement;
  background: HTMLElement;
  card: HTMLElement;
  isOpen: boolean;
  timeline: gsap.core.Timeline | null;
}

function lockScroll(): void {
  document.documentElement.classList.add(SCROLL_LOCK_CLASS);
}

function unlockScroll(): void {
  document.documentElement.classList.remove(SCROLL_LOCK_CLASS);
}

function openPopup(state: PopupState): void {
  if (state.isOpen) return;
  state.isOpen = true;

  state.component.style.display = 'flex';
  lockScroll();

  state.timeline?.kill();

  state.timeline = gsap.timeline();
  state.timeline
    .fromTo(state.background, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' })
    .fromTo(
      state.card,
      { opacity: 0, y: '4rem' },
      { opacity: 1, y: '0rem', duration: 0.4, ease: 'power2.out' },
      '>-0.1'
    );
}

function closePopup(state: PopupState): void {
  if (!state.isOpen) return;
  state.isOpen = false;

  unlockScroll();

  state.timeline?.kill();

  const hide = () => {
    state.component.style.display = 'none';
  };

  state.timeline = gsap.timeline({ onComplete: hide });
  state.timeline
    .to(state.card, { opacity: 0, y: '4rem', duration: 0.25, ease: 'power2.in' })
    .to(state.background, { opacity: 0, duration: 0.25, ease: 'power2.in' }, '>-0.1');
}

export function initPopupMeeting(): void {
  const component = document.querySelector<HTMLElement>('[popup-meeting="component"]');
  const background = document.querySelector<HTMLElement>('[popup-meeting="background"]');
  if (!component || !background) return;

  // The sliding panel is optional — fall back to the component itself.
  const card = document.querySelector<HTMLElement>('[popup-meeting="card"]') ?? component;

  const state: PopupState = { component, background, card, isOpen: false, timeline: null };

  document.querySelectorAll<HTMLElement>('[popup-meeting="open"]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openPopup(state);
    });
  });

  // The meeting close trigger closes every popup on the page, not just this one.
  document.querySelectorAll<HTMLElement>('[popup-meeting="close"]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('popup:close-all'));
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePopup(state);
  });

  window.addEventListener('popup:close-all', () => closePopup(state));

  // Open on load when the URL carries a `meeting` query param (e.g. `/?meeting`).
  if (new URLSearchParams(window.location.search).has('meeting')) {
    openPopup(state);
  }
}
