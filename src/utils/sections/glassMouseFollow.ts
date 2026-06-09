/**
 * Mouse-follow behavior for glass elements.
 *
 * Each instance is defined by 3 selectors:
 *  - `track`  : where pointer events are listened. Should be a large
 *               area so moving over links/buttons doesn't trigger leave.
 *               Falls back to `bounds` if it can't be found.
 *  - `bounds` : the positioning anchor for the glass. Its rect defines
 *               the coordinate frame for the translate, and the glass
 *               is clamped so it never leaves this box.
 *  - `glass`  : the element that visually follows the cursor (typically
 *               also carrying the `glass-effect` custom attribute).
 *
 * Strategy: we don't override the element's positioning. Webflow's
 * layout decides where the glass "lives" statically. We read that
 * static center once (via the `offsetParent` chain — transform-agnostic)
 * and apply translate3d as a DELTA from there to the cursor. The
 * delta is clamped so the glass stays fully inside `bounds`.
 *
 * Perf: pointermove writes only raw coords. Geometry is cached and
 * refreshed on scroll / resize. The rAF tick does zero layout reads.
 */

import './glassMouseFollow.css';

interface FollowConfig {
  track: string;
  bounds: string;
  glass: string;
}

// Add new follow zones here. Each entry is independent.
const INSTANCES: FollowConfig[] = [
  {
    track: '.section_home-hero',
    bounds: '.home-hero_glass-wrapper',
    glass: '.home-hero_glass-mouse',
  },
  {
    track: '.footer_cta-wrapper',
    bounds: '.footer_glass-wrapper',
    glass: '.footer_glass-mouse',
  },
];

const FOLLOW_CLASS = 'glass-follow';

// 0 → frozen, 1 → instant.
// Follow: snappy with a touch of trail while the cursor is inside.
// Return: slow drift back to rest when the cursor leaves.
const FOLLOW_SMOOTHING = 0.04;
const RETURN_SMOOTHING = 0.04;

interface FollowState {
  track: HTMLElement;
  bounds: HTMLElement;
  glass: HTMLElement;
  rectLeft: number;
  rectTop: number;
  boundsWidth: number;
  boundsHeight: number;
  staticCenterX: number;
  staticCenterY: number;
  glassHalfW: number;
  glassHalfH: number;
  pointerX: number;
  pointerY: number;
  hasPointer: boolean;
  currentX: number;
  currentY: number;
  rafId: number;
  onPointerMove: (event: PointerEvent) => void;
  onPointerLeave: () => void;
  onScroll: () => void;
  resizeObserver: ResizeObserver;
}

const states = new Set<FollowState>();

/**
 * Compute the glass element's static center in coordinates relative to
 * the bounds element's border-edge (= `bounds.getBoundingClientRect().left`
 * reference frame). Uses `offsetLeft`/`offsetParent` so the result is
 * independent of any currently-applied `transform`.
 */
function staticCenterWithinBounds(
  glass: HTMLElement,
  bounds: HTMLElement
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let cur: HTMLElement | null = glass;
  let safety = 64;
  while (cur && cur !== bounds && safety > 0) {
    x += cur.offsetLeft;
    y += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
    safety -= 1;
  }
  // offsetLeft is relative to the offsetParent's padding-edge.
  // boundsRect.left is the border-edge — shift by bounds' border widths.
  x += bounds.clientLeft + glass.offsetWidth / 2;
  y += bounds.clientTop + glass.offsetHeight / 2;
  return { x, y };
}

function refreshGeometry(s: FollowState): void {
  const r = s.bounds.getBoundingClientRect();
  s.rectLeft = r.left;
  s.rectTop = r.top;
  s.boundsWidth = r.width;
  s.boundsHeight = r.height;
  const c = staticCenterWithinBounds(s.glass, s.bounds);
  s.staticCenterX = c.x;
  s.staticCenterY = c.y;
  s.glassHalfW = s.glass.offsetWidth / 2;
  s.glassHalfH = s.glass.offsetHeight / 2;
}

function setupInstance(config: FollowConfig): FollowState | null {
  const bounds = document.querySelector<HTMLElement>(config.bounds);
  const glass = document.querySelector<HTMLElement>(config.glass);
  if (!bounds || !glass) return null;

  const track = document.querySelector<HTMLElement>(config.track) ?? bounds;

  // Ensure bounds is a positioning context for the offsetParent walk.
  if (getComputedStyle(bounds).position === 'static') {
    bounds.style.position = 'relative';
  }

  glass.classList.add(FOLLOW_CLASS);

  const local: FollowState = {
    track,
    bounds,
    glass,
    rectLeft: 0,
    rectTop: 0,
    boundsWidth: 0,
    boundsHeight: 0,
    staticCenterX: 0,
    staticCenterY: 0,
    glassHalfW: 0,
    glassHalfH: 0,
    pointerX: 0,
    pointerY: 0,
    hasPointer: false,
    currentX: 0,
    currentY: 0,
    rafId: 0,
    onPointerMove: (event) => {
      local.pointerX = event.clientX;
      local.pointerY = event.clientY;
      local.hasPointer = true;
    },
    onPointerLeave: () => {
      local.hasPointer = false;
    },
    onScroll: () => {
      const r = bounds.getBoundingClientRect();
      local.rectLeft = r.left;
      local.rectTop = r.top;
    },
    resizeObserver: new ResizeObserver(() => refreshGeometry(local)),
  };

  refreshGeometry(local);
  glass.style.transform = 'translate3d(0, 0, 0)';

  const tick = () => {
    let targetX = local.hasPointer ? local.pointerX - local.rectLeft - local.staticCenterX : 0;
    let targetY = local.hasPointer ? local.pointerY - local.rectTop - local.staticCenterY : 0;

    // Clamp so the glass stays fully inside the bounds element, even when
    // the cursor wanders over neighboring content (cards, etc.).
    const minX = local.glassHalfW - local.staticCenterX;
    const maxX = local.boundsWidth - local.glassHalfW - local.staticCenterX;
    const minY = local.glassHalfH - local.staticCenterY;
    const maxY = local.boundsHeight - local.glassHalfH - local.staticCenterY;
    if (maxX > minX) targetX = Math.max(minX, Math.min(maxX, targetX));
    if (maxY > minY) targetY = Math.max(minY, Math.min(maxY, targetY));

    const smoothing = local.hasPointer ? FOLLOW_SMOOTHING : RETURN_SMOOTHING;
    local.currentX += (targetX - local.currentX) * smoothing;
    local.currentY += (targetY - local.currentY) * smoothing;
    glass.style.transform = `translate3d(${local.currentX}px, ${local.currentY}px, 0)`;
    local.rafId = requestAnimationFrame(tick);
  };

  track.addEventListener('pointermove', local.onPointerMove, { passive: true });
  track.addEventListener('pointerleave', local.onPointerLeave, { passive: true });
  window.addEventListener('scroll', local.onScroll, { passive: true });
  local.resizeObserver.observe(bounds);
  local.resizeObserver.observe(glass);

  local.rafId = requestAnimationFrame(tick);
  return local;
}

export function initGlassMouseFollow(): void {
  if (states.size > 0) return;
  INSTANCES.forEach((cfg) => {
    const instance = setupInstance(cfg);
    if (instance) states.add(instance);
  });
}

export function destroyGlassMouseFollow(): void {
  states.forEach((s) => {
    cancelAnimationFrame(s.rafId);
    s.track.removeEventListener('pointermove', s.onPointerMove);
    s.track.removeEventListener('pointerleave', s.onPointerLeave);
    window.removeEventListener('scroll', s.onScroll);
    s.resizeObserver.disconnect();
    s.glass.classList.remove(FOLLOW_CLASS);
    s.glass.style.transform = '';
  });
  states.clear();
}
