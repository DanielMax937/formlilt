import { Agent } from 'undici';

// Try the endpoint's available addresses instead of waiting on one unreachable
// address. Keep the SDK's request-level abort signal and retry budget intact.
const dispatcher = new Agent({
  autoSelectFamily: true,
  autoSelectFamilyAttemptTimeout: 250,
  connect: { timeout: 20_000 },
});

export const fetchArk: typeof fetch = (input, init) => {
  const options = { ...init, dispatcher };
  return globalThis.fetch(input, options);
};
