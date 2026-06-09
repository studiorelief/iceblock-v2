/**
 * Glass effect — Webflow integration of reactbits.dev's GlassSurface,
 * styled after the nods project for a cleaner "liquid glass" look.
 *
 * Usage in Webflow: add the `glass-effect` custom attribute to any element.
 * Tune the look with optional sibling attributes: `glass-effect-blur`,
 * `glass-effect-distortion-scale`, etc. (see README/comments).
 */

import './glassEffect.css';

const ATTR = 'glass-effect';
const SVG_NS = 'http://www.w3.org/2000/svg';

type ChannelSelector = 'R' | 'G' | 'B' | 'A';

interface GlassConfig {
  borderRadius: number | null;
  borderWidth: number;
  brightness: number;
  opacity: number;
  blur: number;
  displace: number;
  backgroundOpacity: number;
  saturation: number;
  distortionScale: number;
  redOffset: number;
  greenOffset: number;
  blueOffset: number;
  xChannel: ChannelSelector;
  yChannel: ChannelSelector;
  mixBlendMode: string;
  // CSS `backdrop-filter: blur(Npx)` applied on top of the SVG chain.
  // This is what users typically mean by "make the glass blurrier".
  // The internal `blur` field above only affects the displacement map
  // and does NOT visibly blur the backdrop.
  backdropBlur: number;
}

// Reactbits faithful defaults (kept for reference):
// distortionScale: -180, backgroundOpacity: 0
// The values below are tuned to match the nods rendering.
const DEFAULTS: GlassConfig = {
  borderRadius: null,
  borderWidth: 0.05,
  brightness: 50,
  opacity: 0.93,
  blur: 5,
  displace: 0,
  backgroundOpacity: 0.0,
  saturation: 1,
  distortionScale: -45,
  redOffset: 0,
  greenOffset: 5,
  blueOffset: 5,
  xChannel: 'R',
  yChannel: 'G',
  mixBlendMode: 'difference',
  backdropBlur: 2,
};

interface InstanceRefs {
  svg: SVGSVGElement;
  feImage: SVGFEImageElement;
  filterId: string;
  redGradId: string;
  blueGradId: string;
  resizeObserver: ResizeObserver;
  config: GlassConfig;
}

const instances = new Map<HTMLElement, InstanceRefs>();
let uniqueCounter = 0;

function generateFilterId(): string {
  uniqueCounter += 1;
  return `glass-filter-${uniqueCounter}-${Date.now()}`;
}

function supportsBackdropSVGFilters(): boolean {
  const ua = navigator.userAgent;
  const isWebkit = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  if (isWebkit || isFirefox) return false;

  // SVG-in-backdrop-filter only renders reliably on desktop Chromium. Mobile
  // Chromium (Android Chrome) parses the `url()` syntax — so the probe below
  // passes — yet the displacement filter renders blank or janky on mobile GPUs.
  // Force the fallback on touch/coarse-pointer devices so every phone gets the
  // same deterministic look instead of a broken SVG.
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (isTouch) return false;

  const probe = document.createElement('div');
  probe.style.backdropFilter = 'url(#__glass_probe__)';
  return probe.style.backdropFilter !== '';
}

function readNumber(el: HTMLElement, key: string, fallback: number): number {
  const raw = el.getAttribute(`${ATTR}-${key}`);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readChannel(el: HTMLElement, key: string, fallback: ChannelSelector): ChannelSelector {
  const raw = el.getAttribute(`${ATTR}-${key}`)?.toUpperCase();
  if (raw === 'R' || raw === 'G' || raw === 'B' || raw === 'A') return raw;
  return fallback;
}

function readConfig(el: HTMLElement): GlassConfig {
  const borderRadiusRaw = el.getAttribute(`${ATTR}-border-radius`);
  return {
    borderRadius: borderRadiusRaw !== null ? Number(borderRadiusRaw) : DEFAULTS.borderRadius,
    borderWidth: readNumber(el, 'border-width', DEFAULTS.borderWidth),
    brightness: readNumber(el, 'brightness', DEFAULTS.brightness),
    opacity: readNumber(el, 'opacity', DEFAULTS.opacity),
    blur: readNumber(el, 'blur', DEFAULTS.blur),
    displace: readNumber(el, 'displace', DEFAULTS.displace),
    backgroundOpacity: readNumber(el, 'background-opacity', DEFAULTS.backgroundOpacity),
    saturation: readNumber(el, 'saturation', DEFAULTS.saturation),
    distortionScale: readNumber(el, 'distortion-scale', DEFAULTS.distortionScale),
    redOffset: readNumber(el, 'red-offset', DEFAULTS.redOffset),
    greenOffset: readNumber(el, 'green-offset', DEFAULTS.greenOffset),
    blueOffset: readNumber(el, 'blue-offset', DEFAULTS.blueOffset),
    xChannel: readChannel(el, 'x-channel', DEFAULTS.xChannel),
    yChannel: readChannel(el, 'y-channel', DEFAULTS.yChannel),
    mixBlendMode: el.getAttribute(`${ATTR}-mix-blend-mode`) ?? DEFAULTS.mixBlendMode,
    backdropBlur: readNumber(el, 'backdrop-blur', DEFAULTS.backdropBlur),
  };
}

function resolveRadius(el: HTMLElement, config: GlassConfig): number {
  if (config.borderRadius !== null && Number.isFinite(config.borderRadius)) {
    return config.borderRadius;
  }
  const computed = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(computed) ? computed : 20;
}

function buildDisplacementMap(
  el: HTMLElement,
  config: GlassConfig,
  ids: { red: string; blue: string }
): string {
  const rect = el.getBoundingClientRect();
  const w = rect.width || 400;
  const h = rect.height || 200;
  const radius = resolveRadius(el, config);
  const edgeSize = Math.min(w, h) * (config.borderWidth * 0.5);

  const inner = `
    <svg viewBox="0 0 ${w} ${h}" xmlns="${SVG_NS}">
      <defs>
        <linearGradient id="${ids.red}" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="red"/>
        </linearGradient>
        <linearGradient id="${ids.blue}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="blue"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${w}" height="${h}" fill="black"></rect>
      <rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" fill="url(#${ids.red})" />
      <rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" fill="url(#${ids.blue})" style="mix-blend-mode: ${config.mixBlendMode}" />
      <rect x="${edgeSize}" y="${edgeSize}" width="${w - edgeSize * 2}" height="${h - edgeSize * 2}" rx="${radius}" fill="hsl(0 0% ${config.brightness}% / ${config.opacity})" style="filter:blur(${config.blur}px)" />
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(inner)}`;
}

function createFilterSvg(
  filterId: string,
  config: GlassConfig
): { svg: SVGSVGElement; feImage: SVGFEImageElement } {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'glass-surface__filter');
  svg.setAttribute('xmlns', SVG_NS);

  const defs = document.createElementNS(SVG_NS, 'defs');
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', filterId);
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.setAttribute('x', '0%');
  filter.setAttribute('y', '0%');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');

  const feImage = document.createElementNS(SVG_NS, 'feImage');
  feImage.setAttribute('x', '0');
  feImage.setAttribute('y', '0');
  feImage.setAttribute('width', '100%');
  feImage.setAttribute('height', '100%');
  feImage.setAttribute('preserveAspectRatio', 'none');
  feImage.setAttribute('result', 'map');

  const makeChannel = (offset: number, matrix: string, dispResult: string, colorResult: string) => {
    const disp = document.createElementNS(SVG_NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'map');
    disp.setAttribute('scale', String(config.distortionScale + offset));
    disp.setAttribute('xChannelSelector', config.xChannel);
    disp.setAttribute('yChannelSelector', config.yChannel);
    disp.setAttribute('result', dispResult);

    const cm = document.createElementNS(SVG_NS, 'feColorMatrix');
    cm.setAttribute('in', dispResult);
    cm.setAttribute('type', 'matrix');
    cm.setAttribute('values', matrix);
    cm.setAttribute('result', colorResult);

    return [disp, cm];
  };

  const redNodes = makeChannel(
    config.redOffset,
    '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
    'dispRed',
    'red'
  );
  const greenNodes = makeChannel(
    config.greenOffset,
    '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
    'dispGreen',
    'green'
  );
  const blueNodes = makeChannel(
    config.blueOffset,
    '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
    'dispBlue',
    'blue'
  );

  const blendRG = document.createElementNS(SVG_NS, 'feBlend');
  blendRG.setAttribute('in', 'red');
  blendRG.setAttribute('in2', 'green');
  blendRG.setAttribute('mode', 'screen');
  blendRG.setAttribute('result', 'rg');

  const blendOut = document.createElementNS(SVG_NS, 'feBlend');
  blendOut.setAttribute('in', 'rg');
  blendOut.setAttribute('in2', 'blue');
  blendOut.setAttribute('mode', 'screen');
  blendOut.setAttribute('result', 'output');

  const gauss = document.createElementNS(SVG_NS, 'feGaussianBlur');
  gauss.setAttribute('in', 'output');
  gauss.setAttribute('stdDeviation', String(config.displace));

  filter.append(feImage, ...redNodes, ...greenNodes, ...blueNodes, blendRG, blendOut, gauss);
  defs.appendChild(filter);
  svg.appendChild(defs);

  return { svg, feImage };
}

function setupGlassElement(el: HTMLElement, useSvg: boolean): void {
  if (instances.has(el)) return;
  const config = readConfig(el);

  if (!useSvg) {
    el.classList.add('glass-surface--fallback');
    el.style.setProperty('--glass-backdrop-blur', `${config.backdropBlur}px`);
    return;
  }

  const filterId = generateFilterId();
  const redGradId = `red-grad-${filterId}`;
  const blueGradId = `blue-grad-${filterId}`;

  const { svg, feImage } = createFilterSvg(filterId, config);
  el.insertBefore(svg, el.firstChild);

  el.classList.add('glass-surface--svg');
  el.style.setProperty('--glass-frost', String(config.backgroundOpacity));
  el.style.setProperty('--glass-saturation', String(config.saturation));
  el.style.setProperty('--glass-backdrop-blur', `${config.backdropBlur}px`);
  el.style.setProperty('--filter-id', `url(#${filterId})`);

  const update = () => {
    feImage.setAttribute(
      'href',
      buildDisplacementMap(el, config, { red: redGradId, blue: blueGradId })
    );
  };

  update();
  const resizeObserver = new ResizeObserver(() => {
    setTimeout(update, 0);
  });
  resizeObserver.observe(el);

  instances.set(el, {
    svg,
    feImage,
    filterId,
    redGradId,
    blueGradId,
    resizeObserver,
    config,
  });
}

export function initGlassEffect(): void {
  const elements = document.querySelectorAll<HTMLElement>(`[${ATTR}]`);
  if (!elements.length) return;
  const useSvg = supportsBackdropSVGFilters();
  elements.forEach((el) => setupGlassElement(el, useSvg));
}

/**
 * Toggle the glass rendering on a single element without destroying it.
 *
 * When deactivated, the backdrop-filter is removed (via CSS) AND the
 * ResizeObserver is disconnected — crucial for SVG mode, otherwise the
 * displacement map keeps rebuilding every frame while a sibling animates,
 * even though nothing is visible. Re-activating rebuilds the map once.
 */
export function setGlassEffectActive(el: HTMLElement, active: boolean): void {
  el.classList.toggle('glass-surface--disabled', !active);

  const data = instances.get(el);
  if (!data) return; // Fallback (non-SVG) elements: the CSS toggle is enough.

  if (active) {
    data.feImage.setAttribute(
      'href',
      buildDisplacementMap(el, data.config, { red: data.redGradId, blue: data.blueGradId })
    );
    data.resizeObserver.observe(el);
  } else {
    data.resizeObserver.disconnect();
  }
}

export function destroyGlassEffect(): void {
  instances.forEach((data, el) => {
    data.resizeObserver.disconnect();
    data.svg.remove();
    el.classList.remove('glass-surface--svg', 'glass-surface--fallback');
    el.style.removeProperty('--glass-frost');
    el.style.removeProperty('--glass-saturation');
    el.style.removeProperty('--glass-backdrop-blur');
    el.style.removeProperty('--filter-id');
  });
  instances.clear();
}
