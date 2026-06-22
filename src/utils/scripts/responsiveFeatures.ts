/**
 * Responsive feature gating.
 *
 * Some behaviours are desktop-only — below the Webflow tablet breakpoint
 * (991px) they're pointless (mouse-follow, hover accordions, scroll stagger).
 * This controller wires them on/off as the viewport crosses 991px instead of
 * running them unconditionally at load.
 *
 * Killed at/below 991px (re-enabled above):
 *  - cards profils (hover accordion)
 *  - actifs cards (scroll stagger)
 *  - glass mouse-follow
 *
 * Only the breakpoint *crossing* triggers work, so plain resizes within a
 * range are no-ops.
 */

import { destroyCardsProfils, initCardsProfils } from '$utils/component/cards-profils';
// import { destroyActifsCards, initActifsCards } from '$utils/sections/actifsCards';
import { destroyGlassMouseFollow, initGlassMouseFollow } from '$utils/sections/glassMouseFollow';

const BREAKPOINT = 991;

type Mode = 'desktop' | 'mobile';

let currentMode: Mode | null = null;
let resizeFrame = 0;

function isMobile(): boolean {
  return window.innerWidth <= BREAKPOINT;
}

function enableDesktop(): void {
  initCardsProfils();
  // initActifsCards();
  initGlassMouseFollow();
}

function disableForMobile(): void {
  destroyCardsProfils();
  // destroyActifsCards();
  destroyGlassMouseFollow();
}

function apply(): void {
  const mode: Mode = isMobile() ? 'mobile' : 'desktop';
  if (mode === currentMode) return;
  currentMode = mode;
  if (mode === 'desktop') enableDesktop();
  else disableForMobile();
}

function onResize(): void {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(apply);
}

export function initResponsiveFeatures(): void {
  apply();
  window.addEventListener('resize', onResize, { passive: true });
}
