import './index.css';

import { initFormSubmit } from '$utils/component/formSubmit';
import { initNavbar } from '$utils/component/navbar';
import { initPopupContact } from '$utils/component/popupContact';
import { initPopupNews } from '$utils/component/popupNews';
import { initFsAttributesScripts } from '$utils/scripts/loadFsAttributes';
import { initFsLibrairiesScripts } from '$utils/scripts/loadFsLibrairies';
import { initMarker } from '$utils/scripts/marker';
import { initMultiStep } from '$utils/scripts/multiStep';
import { initResponsiveFeatures } from '$utils/scripts/responsiveFeatures';
import { initBlogSlider } from '$utils/sections/blogSlider';
import { initFooterLogo } from '$utils/sections/footerLogo';
import { initGlassEffect } from '$utils/sections/glassEffect';

window.Webflow ||= [];
window.Webflow.push(() => {
  initFsAttributesScripts();
  initFsLibrairiesScripts();
  initMarker();
  initMultiStep();

  initGlassEffect();

  initBlogSlider();
  initFooterLogo();

  initNavbar();

  // Desktop-only features (cards profils, actifs cards, glass mouse-follow and
  // the hero glass) — gated on the 991px breakpoint, with a resize listener.
  initResponsiveFeatures();

  initPopupContact();
  initPopupNews();
  initFormSubmit();
});
