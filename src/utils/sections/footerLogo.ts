/**
 * Footer logo — apparition en fade in + translation verticale pilotée au scroll.
 *
 * `.footer_link_logo-wrapper` part de `y: 100, opacity: 0` et rejoint son état
 * naturel (`y: 0, opacity: 1`) lorsque le wrapper entre dans le viewport.
 *
 * Les dropdowns de la page modifient la hauteur du document : les positions
 * calculées par ScrollTrigger au montage deviennent fausses. Un ResizeObserver
 * branché sur `documentElement` déclenche un `ScrollTrigger.refresh()` à chaque
 * variation de hauteur pour recaler les triggers.
 *
 * Markup attendu (Webflow) :
 *   .footer_link_logo-wrapper
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const LOGO_WRAPPER = '.footer_link_logo-wrapper';

const DISTANCE = 200;
const DURATION = 1;
const EASE = 'power3.out';
const START = 'top 90%';

const cleanups: Array<() => void> = [];

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setupLogo(logo: HTMLElement): void {
  const tween = gsap.from(logo, {
    y: DISTANCE,
    autoAlpha: 0,
    duration: reducedMotion() ? 0 : DURATION,
    ease: EASE,
    scrollTrigger: {
      // markers: true,
      trigger: logo,
      start: START,
      toggleActions: 'restart none none playbackward',
    },
  });

  cleanups.push(() => {
    tween.scrollTrigger?.kill();
    tween.kill();
  });
}

/**
 * Recale les triggers quand la hauteur du document change (dropdowns qui
 * s'ouvrent/se ferment et redimensionnent la page).
 */
function watchHeightChanges(): void {
  let lastHeight = document.documentElement.scrollHeight;

  const observer = new ResizeObserver(() => {
    const height = document.documentElement.scrollHeight;
    if (height === lastHeight) return;
    lastHeight = height;
    ScrollTrigger.refresh();
  });

  observer.observe(document.documentElement);
  cleanups.push(() => observer.disconnect());
}

export function initFooterLogo(): void {
  const logos = document.querySelectorAll<HTMLElement>(LOGO_WRAPPER);
  if (!logos.length) return;

  logos.forEach(setupLogo);
  watchHeightChanges();
}

export function destroyFooterLogo(): void {
  cleanups.forEach((fn) => fn());
  cleanups.length = 0;
}
