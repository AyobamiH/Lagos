export function focusRouteHeading() {
  const el = document.querySelector('[data-route-heading], main h1, main h2');
  if (el instanceof HTMLElement) {
    el.setAttribute('tabIndex','-1');
    el.focus({ preventScroll:false });
  }
}