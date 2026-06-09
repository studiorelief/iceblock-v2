const MULTI_STEP_SRC = 'https://cdn.jsdelivr.net/gh/videsigns/webflow-tools@latest/multi-step.js';

let multiStepScript: HTMLScriptElement | null = null;

export function initMultiStep() {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');

    script.src = MULTI_STEP_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${MULTI_STEP_SRC}`));

    document.head.appendChild(script);
    multiStepScript = script;
  });
}

export function destroyMultiStep(): void {
  if (multiStepScript?.parentNode) {
    multiStepScript.parentNode.removeChild(multiStepScript);
  }
  multiStepScript = null;
}
