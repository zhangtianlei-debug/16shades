declare global {
  interface Window {
    shadow16OnPopState?: (event: PopStateEvent) => void;
  }
}

// Window-level popstate listeners run in registration order, even with capture.
// Install before the framework, then delegate only while Prototype is mounted.
export const prototypeHistoryBootstrap = `
if (/^\\/(?:en\\/)?prototype\\/?$/.test(location.pathname) && /[?&](?:view|type)=/.test(location.search)) {
  document.documentElement.setAttribute('data-prototype-pending', '');
}
window.addEventListener('popstate', function (event) {
  window.shadow16OnPopState?.(event);
});
`;

export function subscribePrototypeHistory(handler: (event: PopStateEvent) => void) {
  window.shadow16OnPopState = handler;
  return () => {
    if (window.shadow16OnPopState === handler)
      delete window.shadow16OnPopState;
  };
}
