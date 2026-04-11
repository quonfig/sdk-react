Changelog

## 0.0.2 - 2025-10-12

- Support re-hydration of flags via ReforgeProvider

## 0.0.1 - 2025-10-01

- Official patch release

## 0.0.0-pre.12 - 2025-10-01

- fix: reference Contexts as a type, not a runtime value

## 0.0.0-pre.11 - 2025-09-30

- feat: use type gen / types from sdk-javscript

## 0.0.0-pre.10 - 2025-09-29

- chore: remove old typesafe implementation + tighten typesafe class interface requirements

## 0.0.0-pre.9 - 2025-09-26

- fix: Hook up `createReforgeHook` to actually use the typesafe class instance and provide access to
  it's getter methods

## 0.0.0-pre.8 - 2025-09-24

- feat: Upgrade sdk-javascript dependency to use new reforge.com endpoints

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

- chore: Reforge rebrand

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

- Allow nesting a ReforgeProvider in a ReforgeTestProvider (#48)

## @prefab-cloud/prefab-cloud-react 0.3.1 - 2024-06-13

- Support for nested ReforgeProviders

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
- Add support for passing a pollInterval to the `ReforgeProvider`

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
