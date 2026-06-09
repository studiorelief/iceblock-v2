import './index.css';

import { initCardsProfils } from '$utils/component/cards-profils';
import { initFormSubmit } from '$utils/component/formSubmit';
import { initNavbar } from '$utils/component/navbar';
import { initPopupContact } from '$utils/component/popupContact';
import { initPopupNews } from '$utils/component/popupNews';
import { initFsAttributesScripts } from '$utils/scripts/loadFsAttributes';
import { initFsLibrairiesScripts } from '$utils/scripts/loadFsLibrairies';
import { initMarker } from '$utils/scripts/marker';
import { initMultiStep } from '$utils/scripts/multiStep';
import { initActifsCards } from '$utils/sections/actifsCards';
import { initBlogSlider } from '$utils/sections/blogSlider';
import { initFooterLogo } from '$utils/sections/footerLogo';
import { initGlassEffect } from '$utils/sections/glassEffect';
import { initGlassMouseFollow } from '$utils/sections/glassMouseFollow';

window.Webflow ||= [];
window.Webflow.push(() => {
  initFsAttributesScripts();
  initFsLibrairiesScripts();
  initMarker();
  initMultiStep();

  initGlassEffect();
  initGlassMouseFollow();

  initBlogSlider();
  initCardsProfils();
  initFooterLogo();
  initActifsCards();

  initNavbar();

  initPopupContact();
  initPopupNews();
  initFormSubmit();
});
