function tracingChannel() {
  return {
    traceSync: (fn) => fn(),
    tracePromise: (fn) => fn(),
    traceCallback: (fn) => fn(),
    hasSubscribers: false,
  };
}

function channel() {
  return {
    subscribe: () => {},
    unsubscribe: () => {},
    hasSubscribers: false,
    publish: () => {},
  };
}

function hasSubscribers() {
  return false;
}

const mock = {
  tracingChannel,
  channel,
  hasSubscribers,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = mock;
  module.exports.default = mock;
  module.exports.tracingChannel = tracingChannel;
  module.exports.channel = channel;
  module.exports.hasSubscribers = hasSubscribers;
}
