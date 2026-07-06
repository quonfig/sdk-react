import * as crypto from "crypto";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- We don't expect this to be compatible we just need it for the uuid library
if (!global.crypto) global.crypto = crypto;

// qfg-41nh.28: @quonfig/javascript 1.1.0 added a last-known-good localStorage
// cache (spec 5h). jsdom's localStorage persists across tests within a file, so
// a successful fetch in one test seeds an LKG entry that would make a later
// "all URLs fail" test serve the stale cached config instead of surfacing the
// error. Clear it before each test to keep tests independent.
beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    // No localStorage in this environment — nothing to clear.
  }
});
