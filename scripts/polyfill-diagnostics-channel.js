const diagnostics_channel = require('diagnostics_channel');

if (!diagnostics_channel.tracingChannel) {
  diagnostics_channel.tracingChannel = function(name) {
    return {
      name,
      subscribe: () => {},
      unsubscribe: () => {},
      tracePromise: (fn, context, ...args) => fn(...args),
      traceSync: (fn, context, ...args) => fn(...args),
      traceCallback: (fn, position, context, ...args) => fn(...args),
      hasSubscribers: false,
    };
  };
}
