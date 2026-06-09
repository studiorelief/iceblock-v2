/*
 *============================================================================
 * SCRIPT RECETTAGE
 *============================================================================
 */

export async function initMarker() {
  // Only load marker if URL contains 'webflow' (staging only).
  // L'import dynamique exclut le SDK du bundle prod.
  if (!window.location.href.includes('webflow')) {
    return;
  }

  const { default: markerSDK } = await import('@marker.io/browser');
  await markerSDK.loadWidget({
    project: '6a19c7b430d2f9f155924f0e',
  });
}
