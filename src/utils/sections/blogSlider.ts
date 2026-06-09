/**
 * Blog slider — Swiper integration for the `.swiper.is-blog` element.
 *
 * Slides per view: 3 on desktop, 2 on tablet, 1.5 on mobile.
 *
 * Markup expected in Webflow (standard Swiper structure):
 *   .swiper.is-blog > .swiper-wrapper > .swiper-slide (one per card)
 */

import 'swiper/css';
import './blogSlider.css';

import Swiper from 'swiper';
import { Mousewheel } from 'swiper/modules';

const SELECTOR = '.swiper.is-blog';

const instances: Swiper[] = [];

export function initBlogSlider(): void {
  const elements = document.querySelectorAll<HTMLElement>(SELECTOR);
  if (!elements.length) return;

  elements.forEach((el) => {
    const swiper = new Swiper(el, {
      modules: [Mousewheel],
      slidesPerView: 1.25,
      spaceBetween: 16 * 1.5,
      grabCursor: true,
      // centeredSlides: true,
      mousewheel: {
        forceToAxis: true,
      },
      breakpoints: {
        // Webflow tablet breakpoint
        768: {
          slidesPerView: 2,
        },
        // Webflow desktop breakpoint
        992: {
          slidesPerView: 3,
          spaceBetween: 16 * 1.5,
        },
      },
    });
    instances.push(swiper);
  });
}

export function destroyBlogSlider(): void {
  instances.forEach((swiper) => swiper.destroy(true, true));
  instances.length = 0;
}
