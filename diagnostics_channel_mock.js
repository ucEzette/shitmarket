export function tracingChannel() {
  return {
    traceSync: (fn) => fn(),
    tracePromise: (fn) => fn(),
    traceCallback: (fn) => fn(),
    hasSubscribers: false,
  };
}
export function channel() {
  return {
    subscribe: () => {},
    unsubscribe: () => {},
    hasSubscribers: false,
    publish: () => {},
  };
}
export function hasSubscribers() {
  return false;
}
export default {
  tracingChannel,
  channel,
  hasSubscribers,
};
