/**
 * Actifs cards — apparition des `.actifs_cards_content` en stagger au scroll.
 *
 * Reproduit l'effet du hover CSS (`opacity 0 → 1`, `translateY(100%) → 0`) mais
 * déclenché une seule fois lorsque la `.section_actifs` entre dans le viewport.
 * Les contenus apparaissent en cascade dans l'ordre du DOM.
 *
 * Markup attendu (Webflow) :
 *   .section_actifs
 *     └ … .actifs_cards > .actifs_cards_content (un par card)
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const SECTION = '.actifs_content';
const CONTENT = '.actifs_cards_content';

const DURATION = 0.4;
const STAGGER = 0.15;
const EASE = 'power2.out';
const START = 'top 70%';

const cleanups: Array<() => void> = [];

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setupSection(section: HTMLElement): void {
  const contents = section.querySelectorAll<HTMLElement>(CONTENT);
  if (!contents.length) return;

  const tween = gsap.fromTo(
    contents,
    { yPercent: 100, autoAlpha: 0 },
    {
      yPercent: 0,
      autoAlpha: 1,
      duration: reducedMotion() ? 0 : DURATION,
      ease: EASE,
      stagger: reducedMotion() ? 0 : STAGGER,
      scrollTrigger: {
        // markers: true,
        trigger: section,
        start: START,
        toggleActions: 'restart none none playbackward',
      },
    }
  );

  cleanups.push(() => {
    tween.scrollTrigger?.kill();
    tween.kill();
  });
}

/**
 * Recale les triggers quand la hauteur du document change (FAQ dont les
 * dropdowns s'ouvrent/se ferment et redimensionnent la page).
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

export function initActifsCards(): void {
  const sections = document.querySelectorAll<HTMLElement>(SECTION);
  if (!sections.length) return;

  sections.forEach(setupSection);
  watchHeightChanges();
}

export function destroyActifsCards(): void {
  cleanups.forEach((fn) => fn());
  cleanups.length = 0;
}
