const dc = require('diagnostics_channel');

function createTracingChannel(nameOrObj) {
  const name = typeof nameOrObj === 'string' ? nameOrObj : (nameOrObj && nameOrObj.name) || 'unknown';
  const start = dc.channel ? dc.channel(`tracing:${name}:start`) : channel();
  const end = dc.channel ? dc.channel(`tracing:${name}:end`) : channel();
  const asyncStart = dc.channel ? dc.channel(`tracing:${name}:asyncStart`) : channel();
  const asyncEnd = dc.channel ? dc.channel(`tracing:${name}:asyncEnd`) : channel();
  const error = dc.channel ? dc.channel(`tracing:${name}:error`) : channel();

  return {
    name,
    start,
    end,
    asyncStart,
    asyncEnd,
    error,
    traceSync: (fn, context, ...args) => fn(...args),
    tracePromise: (fn, context, ...args) => fn(...args),
    traceCallback: (fn, position, context, ...args) => fn(...args),
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
  tracingChannel: createTracingChannel,
  channel: dc.channel || channel,
  subscribe: dc.subscribe || (() => {}),
  unsubscribe: dc.unsubscribe || (() => {}),
  hasSubscribers: dc.hasSubscribers || hasSubscribers,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = mock;
  module.exports.default = mock;
  module.exports.tracingChannel = createTracingChannel;
  module.exports.channel = mock.channel;
  module.exports.hasSubscribers = mock.hasSubscribers;
}
