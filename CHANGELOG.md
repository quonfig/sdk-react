Changelog

## 1.4.0 - 2026-10-09

- Requires `@quonfig/javascript` `^1.4.0`: the peer + dev dependency floor moves from `^1.3.0`, so
  the provider is guaranteed the 1.4.0 client fixes at runtime: context-switch race fixes, poll and
  `init()` hardening, and a bounded last-known-good cache.
- Docs: the README install commands now include the `@quonfig/javascript` peer, which Yarn does not
  auto-install (npm 7+ does), so a Yarn user no longer hits
  `Unable to resolve module @quonfig/javascript` (qfg-goi1.2.24). A test keeps it there.

- **Fix: server rendering no longer uses the process-wide `quonfig` singleton (qfg-goi1.2.1).** A
  `QuonfigProvider` rendered on the server (including a `"use client"` component's first HTML)
  claimed the `@quonfig/javascript` module singleton and `hydrate()`d its `initialFlags` into it.
  Every request in the process shares that object, so one user's flag values could render in another
  user's HTML: with sequential renders whose `initialFlags` have different keys, and with
  streaming/Suspense renders even when the keys match. On the server
  (`typeof window === "undefined"`), every provider now gets its own `Quonfig()` client seeded only
  from its `initialFlags`; the server render no longer reads or writes the module singleton. Browser
  and React Native behavior is unchanged (the top-level provider still claims the singleton). The
  README's claim that the provider "does not run during SSR" is corrected, and the docs now build
  `initialFlags` with a per-request `new Quonfig()` instead of `init()` + `extract()` on the shared
  singleton.

- **Fix: the reported `clientVersion` now matches the package version (qfg-goi1.1.7).**
  `src/version.ts` is generated from `package.json`, but the generator ran from a `prebuild` hook,
  and Yarn 4 does not run `pre*` scripts. So 1.3.0 and 1.3.1 both shipped stamped `"1.3.0"`, and
  telemetry from 1.3.1 was misattributed to 1.3.0. `yarn build` now runs
  `scripts/generate-version.mjs` itself, and a test asserts `src/version.ts` equals the
  `package.json` version.
- CI: the release workflow installs with `yarn install --immutable`. `test.yml` keeps
  `--no-immutable` (with a comment) because its React 18/19 matrix step rewrites `package.json`.

- **Fix: `useQuonfig().getDuration` no longer crashes the render on a non-duration value
  (qfg-goi1.2.8).** The provider passed `@quonfig/javascript`'s `getDuration` through unwrapped, and
  it throws `Value for key "<key>" is not a duration` when the stored value is a bool, number or
  string. Because the hook runs during render, one config edit could unmount the whole React tree.
  The provider now returns `undefined` (the default) and warns once per key through its logger,
  matching `QuonfigTestProvider`. The raw client (`useQuonfig().quonfig.getDuration`) still throws.
- **Fix: unmounting a provider while `init()` is in flight no longer leaks a poller
  (qfg-goi1.2.8).** With `pollInterval` set, an `init()` that resolved after the provider unmounted
  still called `poll()` on the client the unmount had already closed, and nothing ever stopped that
  loop. The provider now skips `poll()` and its state updates once it has unmounted.
- Docs: the README says to mount one top-level `QuonfigProvider` per page, because sibling top-level
  providers (including separate React roots) share the module singleton (qfg-goi1.2.8).
- **Fix: `useFlag(key)` returns the `initialFlags` value in the server render and during hydration
  (qfg-goi1.2.9).** `useFlag`'s server snapshot was always `undefined`, and React uses that snapshot
  on the server and in the client's hydration pass. So with `initialFlags` set, `useFlag` rendered
  the default into the SSR HTML and the first paint, then switched to the real value after
  hydration: the flicker `initialFlags` exists to prevent. `useFlag` now serves the value from the
  nearest provider's `initialFlags` there (a key not in `initialFlags` still gives `undefined`). The
  server and the client read the same `initialFlags`, so there is no hydration mismatch. Behavior
  change on a common path, approved as a minor (Jeff, 2026-10-07).

## 1.3.1 - 2026-10-03

- **Fix: changing `contextAttributes` after SSR hydration now loads flags (qfg-sdr4).** A
  `QuonfigProvider` rendered with `initialFlags` seeds the client via `hydrate()` without calling
  `init()`, so a later `contextAttributes` change went to `updateContext()`, which threw
  `Quonfig not initialized. Call init() first.` into `onError` and never refetched. The provider now
  runs a full `init()` for the new context when the client was only hydrated.
- **Fix: `QuonfigTestProvider`'s `getDuration` validates like the real client (qfg-2agi.14).** It
  returned `config[key]` unchanged, so a test passing `"PT30S"` got a string back and tests never
  exercised the duration parser. An ISO 8601 string is now parsed by `@quonfig/javascript`'s own
  parser, a `{ms, seconds}` Duration passes through, and any other value returns `undefined` with a
  `console.warn`. The grammar fixes in `@quonfig/javascript` (day components, rejecting
  out-of-grammar strings) reach this provider once its `@quonfig/javascript` dependency is bumped.

## 1.3.0 - 2026-09-25

- **Inherits the telemetry transport policy from `@quonfig/javascript` 1.3.0 (qfg-y8je.11).**
  `QuonfigProvider` is a pure wrapper over the `@quonfig/javascript` client, so this is a
  no-code-change inheritance: telemetry POSTs get their own 10s deadline, failed batches are kept in
  memory (5 batches / 512KB / 5 min) and resent unchanged no sooner than 30s later, one POST is in
  flight at a time, 401/403/404 disable telemetry for the page, logging is quiet unless data is
  actually dropped, and the final flush moves from `beforeunload` to a `pagehide` keepalive POST
  with a 2s deadline. Also fixes a telemetry network error surfacing as an unhandled promise
  rejection, and `close()` (called on provider unmount) leaving a timer armed. The new `telemetry*`
  options are available on the underlying client's `init()`; no new provider props and no API change
  in this package.
- Requires `@quonfig/javascript` `^1.3.0`: the peer + dev dependency is bumped to `^1.3.0` (from
  `^1.2.0`) so the inherited telemetry transport changes above are guaranteed at runtime.

## 1.2.0 - 2026-07-08

- **`hedgeDelay` is now a `QuonfigProvider` prop.** React consumers can tune the parallel hedge
  (spec 5e) against their primary's p99 without dropping to the explicit-`apiUrls` escape hatch. The
  prop is forwarded to the underlying `@quonfig/javascript` client's `init()` and reaches its
  Loader. `@quonfig/react-native` inherits it via `export *`. Documented the `timeout > hedgeDelay`
  invariant in the README (a `timeout` at or below `hedgeDelay` degrades the hedge to error-only
  failover; the SDK warns).
- Bumped the `@quonfig/javascript` peer + dev dependency to `^1.2.0` (from the `>=1.0.0` range
  shipped in 1.1.0). `hedgeDelay` and the hedged loader require `@quonfig/javascript` 1.1.0+ at
  runtime, so the old loose floor could resolve to an incompatible 1.0.x; this release pins to the
  current 1.2.0 as part of the coordinated frontend release train.

## 1.1.0 - 2026-06-21

- **Inherits secondary-delivery failover from `@quonfig/javascript` 1.1.0** — the reject-older
  install guard (§5f), the parallel hedged loader (§5e), and the last-known-good localStorage cache
  (§5h). `QuonfigProvider` is a pure wrapper over the `@quonfig/javascript` client, so this is a
  no-code-change inheritance; the contract is pinned by a failover test in `@quonfig/javascript`. No
  API changes to this package.
- The `@quonfig/javascript` peer-dependency range is deliberately kept at `>=1.0.0` (not tightened
  to `>=1.1.0`): the failover behavior is additive, the existing range already admits 1.1.0, and
  tightening the floor before `@quonfig/javascript` 1.1.0 is published would break `yarn install`
  during the publish window. Consumers automatically pick up 1.1.0 once it is published.

## 1.0.0 - 2026-06-06

- **Stable 1.0.0 release.** The Quonfig React SDK is now declared stable. No API or behavior changes
  from 0.0.15 — this is a coordinated 1.0.0 version stamp across the entire Quonfig SDK family.
  Tracks `@quonfig/javascript` >= 1.0.0.

## 0.0.15 - 2026-06-05

- Bumped the `@quonfig/javascript` floor to `>=0.0.18` to pick up ETag/304 conditional polling
  (qfg-iikt) and the `poll()` bootstrap self-heal (qfg-8uw5). Without the bump the provider's
  polling could not benefit from the 304 fast-path or the startup-blip recovery.
- Fix: `<QuonfigProvider>` now catches the rejection from its initial `poll()` call. The provider
  fired `poll()` fire-and-forget inside `init()`'s `.then` (not awaited or returned), so a
  first-fetch rejection became an unhandled promise rejection while the app showed loaded=true. It
  is now logged as a non-fatal warning (not routed through `onError`) since the underlying polling
  loop self-heals on the next tick (qfg-8uw5).

## 0.0.14 - 2026-05-21

- **Breaking (typing-level):** removed the `collectLoggerNames` prop from `<QuonfigProvider>`
  (qfg-owyw). The underlying `@quonfig/javascript` option was removed in 0.0.17 (qfg-o2fk) — there
  is no consumer for the per-logger telemetry on the server. TypeScript callers passing
  `collectLoggerNames` to the provider will get a type error; drop the prop.
- **chore: replace the `@quonfig/javascript` `portal:` devDependency with a published npm range
  (qfg-zu8o).** The dev entry was `portal:../sdk-javascript`, which only resolves inside the
  monorepo; Dependabot's isolated single-repo npm updater could not resolve it and every npm update
  job failed. The devDependency is now a plain npm range (`>=0.0.14`) matching the
  `peerDependencies` floor. No runtime or published-package change — local development against an
  unpublished sibling `../sdk-javascript` now uses `yarn link` (see `CONTRIBUTING.md`).

## 0.0.13 - 2026-05-10

- **chore: declare `engines.node` >=20.9.0 + pin CI floor (qfg-y7xh).** Adds an explicit
  `engines.node` field to `package.json` so npm warns consumers on unsupported Node, and pins the CI
  matrix floor to 20.9.0 to match. No runtime behavior change.

## 0.0.12 - 2026-05-03

- **chore!: narrow `react` peer dep to `^18 || ^19` (qfg-bsji).** The advertised range
  (`^16 || ^17 || ^18 || ^19`) was inaccurate since 0.0.10 — `QuonfigProvider` calls
  `React.useSyncExternalStore`, which only exists in React 18+. Install-time signal now matches
  runtime reality. Consumers on React 16/17 were already broken at runtime.
- **feat: `useFlag(key)` per-key selector hook (qfg-lkpm.6).** Subscribes to a single flag's value
  via `useSyncExternalStore` against the underlying client's notify list. Components using
  `useFlag('foo')` no longer re-render when an unrelated flag changes — `useQuonfig()` continues to
  re-render on every `dataVersion` bump as before.
- **fix: replace module-level `globalQuonfigIsTaken` flag with `QuonfigClientContext`
  (qfg-lkpm.6).** The flag never reset on unmount, so a Provider that mounted, unmounted, and
  remounted at the top of the tree received a fresh `Quonfig()` instead of the module singleton. The
  new context-based ownership keys off React tree position: a top-level provider claims the
  singleton, nested providers mint fresh clients.
- **docs: Next.js / RSC integration guide.** Documents `initialFlags`, App Router and Pages Router
  patterns, and hydration-mismatch caveats.

## 0.0.10 - 2026-05-02

- **Fix (provider): re-render on poll updates + close client on unmount (qfg-daxq, qfg-2acr).**
  Previously, poll-driven config mutations were invisible to React because the provider's value
  `useMemo` only depended on `contextKey`/`loading`/`instanceHash`/`settings`. Now wires the
  `@quonfig/javascript@>=0.0.14` `subscribe()`/`dataVersion` API through
  `React.useSyncExternalStore` so every config mutation (poll fetch, `setConfig`, hydrate) triggers
  a re-render. Also adds a mount-only `useEffect` cleanup that calls `quonfigClient.close()` when
  `QuonfigProvider` unmounts (drains telemetry, stops polling, stops telemetry timers) and resets
  the StrictMode init guard so a remount cleanly re-inits — previously an SPA route swap that
  unmounted the provider left the underlying singleton polling forever and held undrained telemetry.
- **Peer dep:** `@quonfig/javascript` peer floor bumped to `>=0.0.14`.

## 0.0.2 - 2025-10-12

- Support re-hydration of flags via QuonfigProvider

## 0.0.1 - 2025-10-01

- Official patch release

## 0.0.0-pre.12 - 2025-10-01

- fix: reference Contexts as a type, not a runtime value

## 0.0.0-pre.11 - 2025-09-30

- feat: use type gen / types from sdk-javscript

## 0.0.0-pre.10 - 2025-09-29

- chore: remove old typesafe implementation + tighten typesafe class interface requirements

## 0.0.0-pre.9 - 2025-09-26

- fix: Hook up `createQuonfigHook` to actually use the typesafe class instance and provide access to
  it's getter methods

## 0.0.0-pre.8 - 2025-09-24

- feat: Upgrade sdk-javascript dependency to use new quonfig.com endpoints

## 0.0.0-pre.6 - 2025-09-23

- feat: Properly type other key inputs to the reforge hooks

## 0.0.0-pre.5 - 2025-09-05

- feat: Stop using private javascript sdk apis

## 0.0.0-pre.4 - 2025-09-05

- chore: Pin to pre-release of javascript sdk for now

## 0.0.0-pre.3 - 2025-09-05

- fix: javascript sdk dependency definition

## 0.0.0-pre.2 - 2025-09-05

- fix: Resolve issues with TypeScript module merging of types

## 0.0.0-pre.1 - 2025-08-20

- feat: Simplify type definitions and expose as overridable interfaces

## 0.0.0-pre.0 - 2025-08-04

- chore: Quonfig rebrand

# @prefab-cloud/prefab-cloud-react

All releases below were released as part of the
[@prefab-cloud/prefab-cloud-react](https://github.com/prefab-cloud/prefab-cloud-react) package.

## @prefab-cloud/prefab-cloud-react 0.4.6 - 2025-05-22

- Extra error handling for loader and telemetry uploader

## @prefab-cloud/prefab-cloud-react 0.4.5 - 2025-04-10

- Silently handle Telemetry AbortErrors

## @prefab-cloud/prefab-cloud-react 0.4.4 - 2025-03-12

- Use tsup for better ESM/CJS compatibility

## @prefab-cloud/prefab-cloud-react 0.4.2 - 2025-03-11

- Add ESM support (#59)

## @prefab-cloud/prefab-cloud-react 0.4.1 - 2024-09-12

- Update Reforge JS client to 0.4.2 (for bootstrapping)

## @prefab-cloud/prefab-cloud-react 0.4.0 - 2024-08-21

- Update Reforge JS client to 0.4.0 / global delivery

## @prefab-cloud/prefab-cloud-react 0.3.7 - 2024-08-20

- More robust error handling (#56)

## @prefab-cloud/prefab-cloud-react 0.3.6 - 2024-07-18

- Fixes error when uploading eval telemetry for stringList values

## @prefab-cloud/prefab-cloud-react 0.3.5 - 2024-07-17

- Reduces volume of internal logging done by telemetry uploader

## @prefab-cloud/prefab-cloud-react 0.3.4 - 2024-07-16

- Adds validation console errors for Context object

## @prefab-cloud/prefab-cloud-react 0.3.3 - 2024-7-10

- Adds collectContextMode option to control context telemetry
- Tries to flush telemetry when browser window closes
- Improves prefix for internal logger names

## @prefab-cloud/prefab-cloud-react 0.3.2 - 2024-06-20

- Allow nesting a QuonfigProvider in a ReforgeTestProvider (#48)

## @prefab-cloud/prefab-cloud-react 0.3.1 - 2024-06-13

- Support for nested QuonfigProviders

## @prefab-cloud/prefab-cloud-react 0.3.0 - 2024-06-04

- collectEvaluationSummaries is now opt-out (#42)

## @prefab-cloud/prefab-cloud-react 0.2.7 - 2024-05-31

- Support durations

## @prefab-cloud/prefab-cloud-react 0.2.6 - 2024-05-10

- Export types for ConfigValue and ContextAttributes

## @prefab-cloud/prefab-cloud-react 0.2.5 - 2024-05-07

- Remove `react-dom` from peerDependencies

## @prefab-cloud/prefab-cloud-react 0.2.4 - 2024-05-03

- Support for JSON config values

## @prefab-cloud/prefab-cloud-react 0.2.3 - 2024-04-12

- Expose known keys (#36)

## @prefab-cloud/prefab-cloud-react 0.2.2 - 2024-01-17

- Updates to errors and warnings

## @prefab-cloud/prefab-cloud-react 0.2.1 - 2024-01-11

- Fix default endpoint for telemetry

## @prefab-cloud/prefab-cloud-react 0.2.0 - 2023-12-12

- Remove identity support. Use Context instead. (#30)
- Re-fetch when context attributes change. (#31)

## @prefab-cloud/prefab-cloud-react 0.1.21 - 2023-12-11

- Use correct client version string

## @prefab-cloud/prefab-cloud-react 0.1.20 - 2023-10-31

- Opt-in param for logger telemetry

## @prefab-cloud/prefab-cloud-react 0.1.19 - 2023-10-24

- Start reporting evaluation telemetry when keys are actually used

## @prefab-cloud/prefab-cloud-react 0.1.18 - 2023-10-13

- Warn instead of erroring when no context is provided

## @prefab-cloud/prefab-cloud-react 0.1.17 - 2023-09-20

- Add support for a `afterEvaluationCallback` callback for forwarding evaluation events to analytics
  tools, etc.

## @prefab-cloud/prefab-cloud-react 0.1.16 - 2023-08-10

- Fix race condition (#21)

## @prefab-cloud/prefab-cloud-react 0.1.15 - 2023-07-11

- Update javascript package dependency to v0.1.14

## @prefab-cloud/prefab-cloud-react 0.1.14 - 2023-07-11

- Update javascript package dependency to v0.1.13

## @prefab-cloud/prefab-cloud-react 0.1.13 - 2023-07-10

- Update javascript package dependency to v0.1.12

## @prefab-cloud/prefab-cloud-react 0.1.12 - 2023-07-10

- Update eslint and resolve all existing errors/warnings
- Add and configure prettier
- Add support for passing a pollInterval to the `QuonfigProvider`

## @prefab-cloud/prefab-cloud-react [0.1.11] - 2023-07-06

- Update javascript package dependency to v0.1.11

## @prefab-cloud/prefab-cloud-react [0.1.10] - 2023-06-27

- Update javascript package dependency to v0.1.10

## @prefab-cloud/prefab-cloud-react [0.1.9] - 2023-06-27

- Update javascript package dependency to v0.1.9

## @prefab-cloud/prefab-cloud-react [0.1.8] - 2023-06-27

- Initial CHANGELOG (with backdated content)
- Formatting cleanup

## @prefab-cloud/prefab-cloud-react [0.1.7] - 2023-05-01

- Add Context and deprecate `identityAttributes` (#4)

## @prefab-cloud/prefab-cloud-react [0.1.6] - 2023-04-04

- Fix emitted types (#2)

## @prefab-cloud/prefab-cloud-react [0.1.5] - 2023-03-16

- Allow passing endpoints

## @prefab-cloud/prefab-cloud-react [0.1.4] - 2023-03-16

- Update dependencies and use named exports

## @prefab-cloud/prefab-cloud-react [0.1.3] - 2022-09-29

- Bump javascript package dependency to 0.1.3

## @prefab-cloud/prefab-cloud-react [0.1.2] - 2022-08-18

- Bump javascript package dependency to 0.1.2

## @prefab-cloud/prefab-cloud-react [0.0.1] - 2022-08-15

- Initial release
