/**
 * Referals marquee — défilement horizontal infini et linéaire des logos.
 *
 * La liste `.referals_collection-list` défile en continu (ease `none`, boucle
 * infinie) à vitesse constante, quel que soit le nombre de logos.
 *
 * Pour obtenir une boucle sans couture, on duplique d'abord les items jusqu'à
 * remplir au moins la largeur du wrapper (utile quand il n'y a que quelques
 * logos), puis on clone l'ensemble une seconde fois : l'animation translate la
 * liste de -50 % et reboucle exactement sur elle-même. Les clones sont marqués
 * `aria-hidden` pour ne pas polluer l'accessibilité.
 *
 * Markup attendu (Webflow) :
 *   .referals_collection-list-wrapper
 *     > .referals_collection-list
 *       > .referals_collection-item (un par logo)
 */

import './referalsMarquee.css';

import { gsap } from 'gsap';

const WRAPPER = '.referals_collection-list-wrapper';
const LIST = '.referals_collection-list';
const ITEM = '.referals_collection-item';

// Vitesse de défilement en pixels par seconde (constante quel que soit le
// nombre de logos).
const SPEED = 50;

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const cleanups: Array<() => void> = [];

/**
 * Duplique le set d'origine ENTIER (tous les items) autant de fois que
 * nécessaire pour que la largeur cumulée atteigne au moins celle du wrapper.
 *
 * On recopie toujours le set complet — jamais quelques items isolés — pour
 * conserver un rythme régulier entre les logos et éviter des doublons collés.
 */
function fillToWidth(list: HTMLElement, wrapperWidth: number): void {
  const originals = Array.from(list.querySelectorAll<HTMLElement>(ITEM));
  if (!originals.length) return;

  // Garde-fou pour éviter une boucle infinie si la largeur reste à 0.
  let guard = 0;
  while (list.scrollWidth < wrapperWidth && guard < 50) {
    originals.forEach((item) => {
      const clone = item.cloneNode(true) as HTMLElement;
      clone.setAttribute('aria-hidden', 'true');
      list.appendChild(clone);
    });
    guard += 1;
  }
}

function setupMarquee(wrapper: HTMLElement): void {
  const list = wrapper.querySelector<HTMLElement>(LIST);
  if (!list || !list.querySelector(ITEM)) return;

  // 1. Remplir si pas assez de logos pour couvrir le wrapper.
  fillToWidth(list, wrapper.clientWidth);

  // 2. Cloner l'ensemble une fois pour une boucle sans couture.
  const half = Array.from(list.children) as HTMLElement[];
  half.forEach((child) => {
    const clone = child.cloneNode(true) as HTMLElement;
    clone.setAttribute('aria-hidden', 'true');
    list.appendChild(clone);
  });

  if (reducedMotion()) return;

  // 3. Animer : -50 % translate exactement la première moitié hors champ et
  // reboucle. Durée proportionnelle à la largeur pour une vitesse constante.
  const halfWidth = list.scrollWidth / 2;
  const tween = gsap.to(list, {
    xPercent: -50,
    duration: halfWidth / SPEED,
    ease: 'none',
    repeat: -1,
  });

  cleanups.push(() => tween.kill());
}

export function initReferalsMarquee(): void {
  const wrappers = document.querySelectorAll<HTMLElement>(WRAPPER);
  if (!wrappers.length) return;

  wrappers.forEach(setupMarquee);
}

export function destroyReferalsMarquee(): void {
  cleanups.forEach((fn) => fn());
  cleanups.length = 0;
}
