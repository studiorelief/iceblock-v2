/**
 * Responsive navbar.
 *
 * Markup is driven by the `navbar` attribute:
 *  - `container-pc`     : desktop nav. Shown (flex) ≥ BREAKPOINT, hidden below.
 *  - `container-mobile` : mobile nav. Hidden ≥ BREAKPOINT, shown (flex) below.
 *  - `trigger-state`    : button that toggles the mobile nav open/closed.
 *  - `open-icon`        : burger icon, shown while the nav is closed.
 *  - `close-icon`       : cross icon, shown while the nav is open.
 *  - `menu-wrapper`     : the menu panel, opens as a height dropdown.
 *  - `background`       : the backdrop, fades in.
 *
 * Below BREAKPOINT the desktop DOM is hidden and the mobile DOM takes over.
 * Opening drops the menu down (height 0 → calc(100svh - 7.5rem)) while the
 * backdrop fades in;
 * closing plays it in reverse. Clicking outside the mobile container, or
 * resizing back to desktop, closes an open nav.
 */

import './navbar.css';

import gsap from 'gsap';

import { setGlassEffectActive } from '$utils/sections/glassEffect';

const BREAKPOINT = 1340;
const MENU_OPEN_HEIGHT = 'calc(100svh - 7.5rem)';
// Past this scroll offset the navbar leaves the top of the page and the
// horizontal gradient fades in.
const SCROLL_THRESHOLD = 10;

interface NavbarState {
  containerPc: HTMLElement;
  containerMobile: HTMLElement;
  trigger: HTMLElement;
  iconOpen: HTMLElement;
  iconClose: HTMLElement;
  menuWrapper: HTMLElement;
  background: HTMLElement;
  isOpen: boolean;
  timeline: gsap.core.Timeline | null;
}

function setIcons(state: NavbarState, open: boolean): void {
  state.iconOpen.style.display = open ? 'none' : 'flex';
  state.iconClose.style.display = open ? 'flex' : 'none';
}

function openNav(state: NavbarState): void {
  if (state.isOpen) return;
  state.isOpen = true;

  state.trigger.setAttribute('aria-expanded', 'true');
  setIcons(state, true);

  // Drop the container's glass while open — the SVG backdrop-filter rebuilding
  // on every height frame is what makes the dropdown lag.
  setGlassEffectActive(state.containerMobile, false);
  state.containerMobile.classList.add('is-nav-open');

  state.menuWrapper.style.display = 'flex';
  state.background.style.display = 'block';

  // Measure the target height in px (GSAP can't interpolate a calc() string),
  // then settle back to the calc value so it stays responsive to viewport changes.
  state.menuWrapper.style.height = MENU_OPEN_HEIGHT;
  const targetHeight = state.menuWrapper.offsetHeight;

  state.timeline?.kill();
  state.timeline = gsap.timeline({
    onComplete: () => gsap.set(state.menuWrapper, { height: MENU_OPEN_HEIGHT, overflowY: 'auto' }),
  });
  state.timeline
    .fromTo(state.background, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' })
    .fromTo(
      state.menuWrapper,
      { height: 0, opacity: 0 },
      { height: targetHeight, opacity: 1, duration: 0.5, ease: 'power3.out' },
      '<'
    );
}

function closeNav(state: NavbarState): void {
  if (!state.isOpen) return;
  state.isOpen = false;

  state.trigger.setAttribute('aria-expanded', 'false');
  setIcons(state, false);

  state.timeline?.kill();

  // Clip again during the collapse so the scrollbar doesn't flash.
  gsap.set(state.menuWrapper, { overflowY: 'hidden' });

  const hide = () => {
    state.menuWrapper.style.display = 'none';
    state.background.style.display = 'none';
    gsap.set(state.menuWrapper, { clearProps: 'height,opacity,overflowY' });
    // Restore the glass once the menu is fully collapsed (closed bar = glass).
    setGlassEffectActive(state.containerMobile, true);
    state.containerMobile.classList.remove('is-nav-open');
  };

  state.timeline = gsap.timeline({ onComplete: hide });
  state.timeline
    .to(state.menuWrapper, { height: 0, opacity: 0, duration: 0.4, ease: 'power3.in' })
    .to(state.background, { opacity: 0, duration: 0.3, ease: 'power2.in' }, '<');
}

/** Swap between the desktop and mobile DOM based on the viewport width. */
function applyLayout(state: NavbarState, isMobile: boolean): void {
  if (isMobile) {
    state.containerPc.style.display = 'none';
    state.containerMobile.style.display = 'flex';
  } else {
    // Restore the Webflow defaults (PC: flex, mobile: none).
    state.containerPc.style.display = '';
    state.containerMobile.style.display = '';
    closeNav(state);
  }
}

export function initNavbar(): void {
  const containerPc = document.querySelector<HTMLElement>('[navbar="container-pc"]');
  const containerMobile = document.querySelector<HTMLElement>('[navbar="container-mobile"]');
  const trigger = document.querySelector<HTMLElement>('[navbar="trigger-state"]');
  const iconOpen = document.querySelector<HTMLElement>('[navbar="open-icon"]');
  const iconClose = document.querySelector<HTMLElement>('[navbar="close-icon"]');
  const menuWrapper = document.querySelector<HTMLElement>('[navbar="menu-wrapper"]');
  const background = document.querySelector<HTMLElement>('[navbar="background"]');

  if (
    !containerPc ||
    !containerMobile ||
    !trigger ||
    !iconOpen ||
    !iconClose ||
    !menuWrapper ||
    !background
  ) {
    return;
  }

  const state: NavbarState = {
    containerPc,
    containerMobile,
    trigger,
    iconOpen,
    iconClose,
    menuWrapper,
    background,
    isOpen: false,
    timeline: null,
  };

  setIcons(state, false);

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    if (state.isOpen) closeNav(state);
    else openNav(state);
  });

  // Click outside the mobile container closes an open nav.
  document.addEventListener('click', (event) => {
    if (!state.isOpen) return;
    if (!state.containerMobile.contains(event.target as Node)) closeNav(state);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNav(state);
  });

  // Fade the gradient in once the page is scrolled away from the top.
  const containers = [containerPc, containerMobile];
  const syncScrolled = () => {
    const scrolled = window.scrollY > SCROLL_THRESHOLD;
    containers.forEach((el) => el.classList.toggle('is-scrolled', scrolled));
  };
  syncScrolled();
  window.addEventListener('scroll', syncScrolled, { passive: true });

  // Switch DOM on every resize, only re-applying when the breakpoint is crossed.
  let isMobile = window.innerWidth < BREAKPOINT;
  applyLayout(state, isMobile);

  window.addEventListener('resize', () => {
    const next = window.innerWidth < BREAKPOINT;
    if (next === isMobile) return;
    isMobile = next;
    applyLayout(state, isMobile);
  });
}
