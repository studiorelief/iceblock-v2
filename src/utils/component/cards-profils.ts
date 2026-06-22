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
 * Deux variantes (attribut Webflow `data-wf--cards-profils--variant`) :
 *  - `accordion` : comportement décrit ci-dessus ; la bar du loader
 *    (`.profils_loader-bar`) se remplit (0 → pleine) quand la carte devient active.
 *  - `full` : pas d'accordéon (cartes à largeur fixe, conteneur en grille
 *    `.profils-full_cards-wrapper`). Chaque carte est indépendante — au survol
 *    elle révèle son loader et remplit sa bar.
 *
 * Markup attendu (Webflow), accordion :
 *   .profils_cards-wrapper > .profils_cards (#start-active sur l'une d'elles)
 *     .profils_cards > .profils_loader-wrapper > .profils_loader-bar
 *                    > .profils_cards_content > h3 + .profils_cards-description
 */

import { gsap } from 'gsap';

// Conteneurs : l'accordion vit dans `.profils_cards-wrapper`, la variante full
// dans `.profils-full_cards-wrapper` (grille). On gère les deux.
const WRAPPER = '.profils_cards-wrapper, .profils-full_cards-wrapper';
const CARD = '.profils_cards';
const HEADING = '.profils_cards_content h3';
const DESCRIPTION = '.profils_cards-description';
const LOADER = '.profils_loader-wrapper';
const LOADER_BAR = '.profils_loader-bar';
const DEFAULT_ACTIVE = '#start-active';

const VARIANT_ATTR = 'data-wf--cards-profils--variant';
const VARIANT_FULL = 'full';
// Classe générée par Webflow pour la variante « full » (posée sur .profils_cards
// et .profils_loader-wrapper). Sert de signal de détection fiable, en plus de
// l'attribut de variante.
const VARIANT_FULL_CLASS = 'w-variant-70381d8e-2b00-9605-00f0-11e11ebf224b';

const HEADING_BOX_CLASS = 'profils_cards_heading';
const HEADING_NOWRAP_CLASS = 'is-nowrap';

const GROW_ACTIVE = 2;
const GROW_INACTIVE = 1;

const DURATION = 0.55;
const EASE = 'power3.out';

// Remplissage de la bar de chargement : plus lent et plus appuyé que le reste
// de l'accordéon, pour qu'on voie bien le passage 0 → pleine.
const BAR_DURATION = 1.2;
const BAR_EASE = 'power2.out';

interface CardRefs {
  card: HTMLElement;
  headingBox: HTMLElement | null;
  headingWrap: HTMLElement | null; // calque qui wrap (replié = 2 lignes)
  headingLine: HTMLElement | null; // calque nowrap (ouvert = 1 ligne)
  description: HTMLElement | null;
  loader: HTMLElement | null;
  loaderBars: HTMLElement[];
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
    loaderBars: Array.from(card.querySelectorAll<HTMLElement>(LOADER_BAR)),
    ...buildHeading(card),
  };
}

/**
 * Remplit les bars (0 → pleine) ou les vide, via `scaleX`. Utilisé par l'accordéon :
 * la carte active s'élargit en continu, donc scaleX suit la largeur live sans
 * mesure (insensible au reflow). Origine gauche fixée en CSS.
 */
function setLoaderBars(bars: HTMLElement[], active: boolean, instant = false): void {
  if (!bars.length) return;
  const duration = instant || reducedMotion() ? 0 : BAR_DURATION;
  gsap.to(bars, { scaleX: active ? 1 : 0, duration, ease: BAR_EASE, overwrite: 'auto' });
}

/**
 * Remplit les bars (0 → largeur renseignée) ou les vide, en animant `width`.
 * Réservé à la variante `full` (cartes à largeur fixe) : on mesure la largeur
 * native déclarée de chaque bar puis on anime de 0 jusqu'à elle. Mesure faite à
 * chaque ouverture → insensible au resize. Toutes les bars sont remises à leur
 * largeur native d'un coup avant de mesurer, pour une mesure cohérente (le
 * wrapper est un flex `space-between`).
 */
function setLoaderBarsWidth(bars: HTMLElement[], active: boolean): void {
  if (!bars.length) return;
  const duration = reducedMotion() ? 0 : BAR_DURATION;
  if (!active) {
    gsap.to(bars, { width: 0, duration, ease: BAR_EASE, overwrite: 'auto' });
    return;
  }
  // clearProps (et non width: '') pour vraiment retirer le width inline et
  // retomber sur la largeur CSS (#id .profils_loader-bar { width: x% }) à mesurer.
  gsap.set(bars, { clearProps: 'width' });
  const targets = bars.map((bar) => bar.offsetWidth);
  gsap.set(bars, { width: 0 }); // point de départ synchrone (pas de flash)
  bars.forEach((bar, i) => {
    gsap.to(bar, { width: targets[i], duration, ease: BAR_EASE, overwrite: 'auto' });
  });
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
  const { card, headingBox, headingWrap, headingLine, description, loader, loaderBars } = refs;
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

  setLoaderBars(loaderBars, active, instant);
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

/**
 * Détecte la variante « full ». Webflow l'expose de deux façons, toutes deux
 * portées par la carte `.profils_cards` (descendant du wrapper) : l'attribut de
 * variante et une classe générée. On teste les deux dans les descendants.
 */
function isFullVariant(wrapper: HTMLElement): boolean {
  return !!wrapper.querySelector(
    `[${VARIANT_ATTR}="${VARIANT_FULL}"], .${CSS.escape(VARIANT_FULL_CLASS)}`
  );
}

/**
 * Variante « full » : pas d'accordéon (cartes à largeur fixe, ni crossfade du
 * titre ni révélation de description). Chaque carte est indépendante — au survol
 * elle révèle son loader (opacité 0 → 1) et remplit ses bars (0 → largeur native) ;
 * au repos tout est masqué (on écrase l'`opacity: 1` que Webflow pose en full).
 */
function setupFull(wrapper: HTMLElement): void {
  const cards = Array.from(wrapper.querySelectorAll<HTMLElement>(CARD));
  if (!cards.length) return;

  cards.forEach((card) => {
    const loader = card.querySelector<HTMLElement>(LOADER);
    const bars = Array.from(card.querySelectorAll<HTMLElement>(LOADER_BAR));

    if (loader) gsap.set(loader, { autoAlpha: 0 });
    if (bars.length) gsap.set(bars, { width: 0 });

    const reveal = (active: boolean): void => {
      const duration = reducedMotion() ? 0 : DURATION;
      if (loader) {
        gsap.to(loader, {
          autoAlpha: active ? 1 : 0,
          duration: duration ? duration * 0.7 : 0,
          ease: EASE,
          overwrite: 'auto',
        });
      }
      setLoaderBarsWidth(bars, active);
    };

    const onEnter = (): void => reveal(true);
    const onLeave = (): void => reveal(false);
    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseleave', onLeave);

    cleanups.push(() => {
      card.removeEventListener('mouseenter', onEnter);
      card.removeEventListener('mouseleave', onLeave);
      const targets = [loader, ...bars].filter(Boolean) as HTMLElement[];
      if (targets.length) gsap.set(targets, { clearProps: 'all' });
    });
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

  wrappers.forEach((wrapper) => {
    if (isFullVariant(wrapper)) setupFull(wrapper);
    else setupWrapper(wrapper);
  });

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
