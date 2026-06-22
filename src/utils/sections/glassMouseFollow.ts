/**
 * Autonomous "DVD bounce" drift for glass elements.
 *
 * Each instance is defined by 2 selectors:
 *  - `bounds` : the container the glass bounces inside. Its rect defines
 *               the coordinate frame and the walls the glass rebounds on.
 *  - `glass`  : the element that drifts and bounces (typically also
 *               carrying the `glass-effect` custom attribute).
 *
 * Strategy: we don't override the element's positioning. Webflow's
 * layout decides where the glass "lives" statically. We read that
 * static center once (via the `offsetParent` chain — transform-agnostic)
 * and apply translate3d as a DELTA from there. A velocity vector moves
 * the glass each frame; when its edge reaches a wall of `bounds`, the
 * matching velocity component flips sign — old-school screensaver style.
 *
 * Perf: geometry is cached and refreshed on scroll / resize. The rAF
 * tick does zero layout reads.
 */

import './glassMouseFollow.css';

interface FollowConfig {
  bounds: string;
  glass: string;
}

// Add new bounce zones here. Each entry is independent.
const INSTANCES: FollowConfig[] = [
  {
    bounds: '.home-hero_glass-wrapper',
    glass: '.home-hero_glass-mouse',
  },
  {
    bounds: '.footer_glass-wrapper',
    glass: '.footer_glass-mouse',
  },
];

const FOLLOW_CLASS = 'glass-follow';

// Drift speed in pixels per frame (~60fps). Lower = slower, dreamier.
const SPEED = 1;

interface FollowState {
  bounds: HTMLElement;
  glass: HTMLElement;
  boundsWidth: number;
  boundsHeight: number;
  staticCenterX: number;
  staticCenterY: number;
  glassHalfW: number;
  glassHalfH: number;
  // Glass center position within `bounds`, in bounds-relative px.
  centerX: number;
  centerY: number;
  velocityX: number;
  velocityY: number;
  initialized: boolean;
  rafId: number;
  resizeObserver: ResizeObserver;
}

const states = new Set<FollowState>();

/**
 * Compute the glass element's static center in coordinates relative to
 * the bounds element's border-edge. Uses `offsetLeft`/`offsetParent` so
 * the result is independent of any currently-applied `transform`.
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
  x += bounds.clientLeft + glass.offsetWidth / 2;
  y += bounds.clientTop + glass.offsetHeight / 2;
  return { x, y };
}

function refreshGeometry(s: FollowState): void {
  const r = s.bounds.getBoundingClientRect();
  s.boundsWidth = r.width;
  s.boundsHeight = r.height;
  const c = staticCenterWithinBounds(s.glass, s.bounds);
  s.staticCenterX = c.x;
  s.staticCenterY = c.y;
  s.glassHalfW = s.glass.offsetWidth / 2;
  s.glassHalfH = s.glass.offsetHeight / 2;

  // Start the glass at its static center the first time geometry is ready.
  if (!s.initialized && s.boundsWidth > 0 && s.boundsHeight > 0) {
    s.centerX = s.staticCenterX;
    s.centerY = s.staticCenterY;
    s.initialized = true;
  }

  // Keep the glass inside the box if the container shrank under it.
  const minX = s.glassHalfW;
  const maxX = s.boundsWidth - s.glassHalfW;
  const minY = s.glassHalfH;
  const maxY = s.boundsHeight - s.glassHalfH;
  if (maxX > minX) s.centerX = Math.max(minX, Math.min(maxX, s.centerX));
  if (maxY > minY) s.centerY = Math.max(minY, Math.min(maxY, s.centerY));
}

function setupInstance(config: FollowConfig): FollowState | null {
  const bounds = document.querySelector<HTMLElement>(config.bounds);
  const glass = document.querySelector<HTMLElement>(config.glass);
  if (!bounds || !glass) return null;

  // Ensure bounds is a positioning context for the offsetParent walk.
  if (getComputedStyle(bounds).position === 'static') {
    bounds.style.position = 'relative';
  }

  glass.classList.add(FOLLOW_CLASS);

  // Départ vers le haut-gauche (X et Y négatifs). Le rebond fait diverger les
  // instances ensuite, pas besoin de les désynchroniser au départ.
  const local: FollowState = {
    bounds,
    glass,
    boundsWidth: 0,
    boundsHeight: 0,
    staticCenterX: 0,
    staticCenterY: 0,
    glassHalfW: 0,
    glassHalfH: 0,
    centerX: 0,
    centerY: 0,
    velocityX: -SPEED,
    velocityY: -SPEED,
    initialized: false,
    rafId: 0,
    resizeObserver: new ResizeObserver(() => refreshGeometry(local)),
  };

  refreshGeometry(local);
  glass.style.transform = 'translate3d(0, 0, 0)';

  const tick = () => {
    if (local.initialized) {
      const minX = local.glassHalfW;
      const maxX = local.boundsWidth - local.glassHalfW;
      const minY = local.glassHalfH;
      const maxY = local.boundsHeight - local.glassHalfH;

      local.centerX += local.velocityX;
      local.centerY += local.velocityY;

      // Bounce off the vertical walls.
      if (maxX > minX) {
        if (local.centerX <= minX) {
          local.centerX = minX;
          local.velocityX = Math.abs(local.velocityX);
        } else if (local.centerX >= maxX) {
          local.centerX = maxX;
          local.velocityX = -Math.abs(local.velocityX);
        }
      }
      // Bounce off the horizontal walls.
      if (maxY > minY) {
        if (local.centerY <= minY) {
          local.centerY = minY;
          local.velocityY = Math.abs(local.velocityY);
        } else if (local.centerY >= maxY) {
          local.centerY = maxY;
          local.velocityY = -Math.abs(local.velocityY);
        }
      }

      // Translate is the delta from the static center.
      const dx = local.centerX - local.staticCenterX;
      const dy = local.centerY - local.staticCenterY;
      glass.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }
    local.rafId = requestAnimationFrame(tick);
  };

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
    s.resizeObserver.disconnect();
    s.glass.classList.remove(FOLLOW_CLASS);
    s.glass.style.transform = '';
  });
  states.clear();
}
