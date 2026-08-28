export const AJOLOTE_SPLASH_EVENT = "ajolote:splash";

export function triggerAjoloteSplash() {
  window.dispatchEvent(new Event(AJOLOTE_SPLASH_EVENT));
}
