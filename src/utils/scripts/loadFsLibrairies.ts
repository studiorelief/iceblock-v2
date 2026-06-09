const loadedScripts: HTMLScriptElement[] = [];

const FS_LIBRAIRIES_SRCS = [
  'https://cdn.jsdelivr.net/npm/@finsweet/attributes-accordion@1/accordion.js',
  //   'https://cdn.jsdelivr.net/npm/@finsweet/attributes-inputactive@1/inputactive.js',
  //   'https://cdn.jsdelivr.net/npm/@finsweet/attributes-selectcustom@1/selectcustom.js',
  // 'https://cdn.jsdelivr.net/npm/@finsweet/attributes-cmsselect@1/cmsselect.js',
];

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');

    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

    document.head.appendChild(script);
    loadedScripts.push(script);
  });
}

export function initFsLibrairiesScripts() {
  return Promise.all(FS_LIBRAIRIES_SRCS.map(loadScript));
}

export function destroyFsLibrairiesScripts(): void {
  loadedScripts.forEach((script) => {
    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }
  });
  loadedScripts.length = 0;
}
