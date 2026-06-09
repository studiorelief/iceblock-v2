/**
 * Newsletter popup.
 *
 * Markup is driven by the `popup-news` attribute:
 *  - `component`  : the popup root. Starts `display:none`, switched to
 *                   `display:flex` while open.
 *  - `background` : the backdrop, fades in first.
 *  - `form`       : the newsletter form, slides up (y: 4rem → 0) + fades in.
 *  - `open`       : triggers (can be many on a page).
 *  - `close`      : close trigger(s).
 *
 * Open animation: background fade-in, then form slide + fade.
 * Page scroll is locked while open. Closes on Escape or a `close` trigger,
 * playing the open animation in reverse before hiding the root.
 */

import './popupNews.css';

import gsap from 'gsap';

const SCROLL_LOCK_CLASS = 'u-popup-open';

interface PopupState {
  component: HTMLElement;
  background: HTMLElement;
  form: HTMLElement;
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
      state.form,
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
    .to(state.form, { opacity: 0, y: '4rem', duration: 0.25, ease: 'power2.in' })
    .to(state.background, { opacity: 0, duration: 0.25, ease: 'power2.in' }, '>-0.1');
}

export function initPopupNews(): void {
  const component = document.querySelector<HTMLElement>('[popup-news="component"]');
  const background = document.querySelector<HTMLElement>('[popup-news="background"]');
  const form = document.querySelector<HTMLElement>('[popup-news="form"]');
  if (!component || !background || !form) return;

  const state: PopupState = { component, background, form, isOpen: false, timeline: null };

  document.querySelectorAll<HTMLElement>('[popup-news="open"]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openPopup(state);
    });
  });

  document.querySelectorAll<HTMLElement>('[popup-news="close"]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      closePopup(state);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePopup(state);
  });
}
