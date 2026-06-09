/**
 * Cards profils — animation d'accordéon horizontal pilotée par GSAP.
 *
 * Une carte est « active » (ouverte) à la fois : elle s'élargit, son titre passe
 * de 2 lignes (replié) à 1 ligne (ouvert) via un crossfade, sa description se
 * révèle (hauteur 0 → auto) et son loader apparaît. Au survol d'une carte elle
 * devient active ; en quittant le wrapper, on revient à la carte par défaut
 * (`#start-active`, ou la première à défaut).
 *
 * Largeur animée via `flex-grow` (pas `width: %`) : le flex répartit l'espace et
 * gère les gaps → aucun reflow de la rangée, une seule courbe d'easing.
 *
 * Titre : le reflow 2 lignes ↔ 1 ligne ne peut pas être fluide en continu. On
 * superpose donc deux calques figés dans un wrapper créé à la volée — un calque
 * « ouvert » (clone `nowrap`, toujours 1 ligne) et un calque « fermé » (le h3
 * d'origine dont la largeur est figée à celle d'une carte repliée, donc toujours
 * 2 lignes) — et on crossfade entre les deux + on anime la hauteur du wrapper.
 * Comme aucun des deux calques ne reflow, le swap est propre dans les deux sens.
 *
 * Markup attendu (Webflow) :
 *   .profils_cards-wrapper > .profils_cards (#start-active sur l'une d'elles)
 *     .profils_cards > .profils_loader-wrapper
 *                    > .profils_cards_content > h3 + .profils_cards-description
 */

import { gsap } from 'gsap';

const WRAPPER = '.profils_cards-wrapper';
const CARD = '.profils_cards';
const HEADING = '.profils_cards_content h3';
const DESCRIPTION = '.profils_cards-description';
const LOADER = '.profils_loader-wrapper';
const DEFAULT_ACTIVE = '#start-active';

const HEADING_BOX_CLASS = 'profils_cards_heading';
const HEADING_NOWRAP_CLASS = 'is-nowrap';

const GROW_ACTIVE = 2;
const GROW_INACTIVE = 1;

const DURATION = 0.55;
const EASE = 'power3.out';

interface CardRefs {
  card: HTMLElement;
  headingBox: HTMLElement | null;
  headingWrap: HTMLElement | null; // calque qui wrap (replié = 2 lignes)
  headingLine: HTMLElement | null; // calque nowrap (ouvert = 1 ligne)
  description: HTMLElement | null;
  loader: HTMLElement | null;
}

interface WrapperState {
  refs: CardRefs[];
  current: CardRefs;
}

const states: WrapperState[] = [];
const cleanups: Array<() => void> = [];
let resizeBound = false;
let resizeFrame = 0;

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Transforme le h3 en deux calques superposés pour le crossfade.
 * Idempotent : ne reconstruit pas si le wrapper existe déjà.
 */
function buildHeading(
  card: HTMLElement
): Pick<CardRefs, 'headingBox' | 'headingWrap' | 'headingLine'> {
  const original = card.querySelector<HTMLElement>(HEADING);
  if (!original) return { headingBox: null, headingWrap: null, headingLine: null };

  const existing = original.closest(`.${HEADING_BOX_CLASS}`);
  if (existing) {
    return {
      headingBox: existing as HTMLElement,
      headingWrap: original,
      headingLine: existing.querySelector<HTMLElement>(`.${HEADING_NOWRAP_CLASS}`),
    };
  }

  const box = document.createElement('div');
  box.className = HEADING_BOX_CLASS;
  original.parentNode?.insertBefore(box, original);
  box.appendChild(original);

  const clone = original.cloneNode(true) as HTMLElement;
  clone.classList.add(HEADING_NOWRAP_CLASS);
  clone.removeAttribute('id');
  clone.setAttribute('aria-hidden', 'true');
  box.appendChild(clone);

  return { headingBox: box, headingWrap: original, headingLine: clone };
}

function restoreHeading({ headingBox, headingWrap, headingLine }: CardRefs): void {
  if (!headingBox || !headingWrap) return;
  gsap.set([headingBox, headingWrap, headingLine].filter(Boolean) as HTMLElement[], {
    clearProps: 'all',
  });
  headingBox.parentNode?.insertBefore(headingWrap, headingBox);
  headingBox.remove();
}

function getRefs(card: HTMLElement): CardRefs {
  return {
    card,
    description: card.querySelector<HTMLElement>(DESCRIPTION),
    loader: card.querySelector<HTMLElement>(LOADER),
    ...buildHeading(card),
  };
}

/**
 * Fige la largeur du calque « fermé » à celle d'une carte repliée (mesurée sur
 * une carte non active), pour qu'il reste toujours sur 2 lignes — donc qu'il
 * apparaisse/disparaisse en fondu sans jamais reflow. À ré-appeler au resize
 * (la largeur dépend de la police en `1vw`).
 */
function syncCloseLayerWidth(state: WrapperState): void {
  const reference = state.refs.find((r) => r !== state.current) ?? state.current;
  const width = reference.headingBox?.offsetWidth ?? 0;
  if (!width) return;
  state.refs.forEach((r) => {
    if (r.headingWrap) gsap.set(r.headingWrap, { width });
  });
}

/** Anime une carte vers son état actif ou replié. `instant` saute l'animation. */
function setCardState(refs: CardRefs, active: boolean, instant = false): void {
  const { card, headingBox, headingWrap, headingLine, description, loader } = refs;
  const duration = instant || reducedMotion() ? 0 : DURATION;

  gsap.to(card, {
    flexGrow: active ? GROW_ACTIVE : GROW_INACTIVE,
    duration,
    ease: EASE,
    overwrite: 'auto',
  });

  // Titre : hauteur du wrapper (1 ligne ↔ 2 lignes) + crossfade des calques.
  if (headingBox && headingLine) {
    const lineHeight = headingLine.offsetHeight || 0;
    gsap.to(headingBox, {
      height: active ? lineHeight : lineHeight * 2,
      duration,
      ease: EASE,
      overwrite: 'auto',
    });
    gsap.to(headingLine, { autoAlpha: active ? 1 : 0, duration, ease: EASE, overwrite: 'auto' });
    if (headingWrap) {
      gsap.to(headingWrap, { autoAlpha: active ? 0 : 1, duration, ease: EASE, overwrite: 'auto' });
    }
  }

  if (description) {
    gsap.to(description, {
      height: active ? 'auto' : 0,
      autoAlpha: active ? 1 : 0,
      duration,
      ease: EASE,
      overwrite: 'auto',
    });
  }

  if (loader) {
    gsap.to(loader, {
      autoAlpha: active ? 1 : 0,
      duration: duration ? duration * 0.7 : 0,
      ease: EASE,
      overwrite: 'auto',
    });
  }
}

function setupWrapper(wrapper: HTMLElement): void {
  const refs = Array.from(wrapper.querySelectorAll<HTMLElement>(CARD)).map(getRefs);
  if (!refs.length) return;

  const defaultRefs = refs.find((r) => r.card.matches(DEFAULT_ACTIVE)) ?? refs[0];
  const state: WrapperState = { refs, current: defaultRefs };
  states.push(state);

  // Largeur figée du calque « fermé » + état initial aligné sur le CSS de
  // premier paint (sans animation au load).
  syncCloseLayerWidth(state);
  refs.forEach((r) => setCardState(r, r === defaultRefs, true));

  const activate = (target: CardRefs): void => {
    state.current = target;
    refs.forEach((r) => setCardState(r, r === target));
  };

  const enterHandlers = refs.map((r) => {
    const onEnter = (): void => activate(r);
    r.card.addEventListener('mouseenter', onEnter);
    return { card: r.card, onEnter };
  });

  const onLeave = (): void => activate(defaultRefs);
  wrapper.addEventListener('mouseleave', onLeave);

  cleanups.push(() => {
    enterHandlers.forEach(({ card, onEnter }) => card.removeEventListener('mouseenter', onEnter));
    wrapper.removeEventListener('mouseleave', onLeave);
    refs.forEach(restoreHeading);
    const index = states.indexOf(state);
    if (index !== -1) states.splice(index, 1);
  });
}

/** Re-applique l'état courant (sans animation) : utile après un resize car la
 *  hauteur de ligne suit `font-size: 1vw`. */
function refreshAll(): void {
  states.forEach((state) => {
    syncCloseLayerWidth(state);
    state.refs.forEach((r) => setCardState(r, r === state.current, true));
  });
}

function onResize(): void {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(refreshAll);
}

export function initCardsProfils(): void {
  const wrappers = document.querySelectorAll<HTMLElement>(WRAPPER);
  if (!wrappers.length) return;

  wrappers.forEach(setupWrapper);

  if (!resizeBound) {
    window.addEventListener('resize', onResize);
    resizeBound = true;
  }
}

export function destroyCardsProfils(): void {
  cleanups.forEach((fn) => fn());
  cleanups.length = 0;
  if (resizeBound) {
    window.removeEventListener('resize', onResize);
    cancelAnimationFrame(resizeFrame);
    resizeBound = false;
  }
}
