# Development guide

This document is the technical entry point for developers and maintainers of
`ioBroker.mihome-vacuum`. It describes the current architecture, the contracts that must remain
compatible, the development workflow, and the checks required before a change is submitted.

User-facing configuration and operating instructions belong in [README.md](README.md) and
[README_de.md](README_de.md). The changelog records user-visible changes. This file is the source
of truth for implementation and maintenance details.

## 1. Project scope

The adapter controls Xiaomi ecosystem vacuum cleaners over the local Miio UDP protocol. Depending
on the configured model, commands and status polling are handled by one of three manager
implementations:

- the generic Roborock/rockrobo manager;
- the Viomi manager;
- the Dreame/Xiaomi MIOT manager.

Xiaomi Cloud is optional. Local control requires only the robot's local IP address and device token.
Cloud authentication is used for device discovery and, when enabled, for resolving Xiaomi map
files. A failure or missing cloud login must never disable local control.

The repository also contains:

- a React/Vite/TypeScript configuration UI;
- complete VIS 1 and VIS 2 vacuum widgets with map display;
- protocol, manager, lifecycle, security, package, and integration tests.

## 2. Supported development baseline

| Component      | Required baseline                                 |
| -------------- | ------------------------------------------------- |
| Node.js        | `>=22.13.0`                                       |
| js-controller  | `>=7.2.2`                                         |
| ioBroker Admin | `>=7.8.23`                                        |
| Backend        | TypeScript, compiled to CommonJS, target ES2022   |
| Admin UI       | React 18, MUI 6, `@iobroker/gui-components`, Vite |
| VIS 2 widget   | React 18, MUI 6, Vite Module Federation           |

Use an active Node.js LTS version covered by the CI matrix. Do not introduce APIs that are newer
than the minimum declared in `package.json`.

Install an exact dependency tree with:

```sh
npm ci
npm run build
```

Dependency installation does not build the adapter. Always build explicitly before starting or
packaging a source checkout. Published npm packages already contain the generated runtime and UI.
The full type check also checks JavaScript tests that import compiled modules, so it needs at least
`npm run build:backend` first. CI runs `test:js` (which builds the backend) before `npm run check`.

Native `canvas` installation may require the operating-system libraries listed in
`io-package.json`. Canvas is optional at package level, but map rendering needs a working canvas
implementation.

## 3. Repository layout

| Path                                                 | Purpose                                                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/main.ts`                                        | Adapter lifecycle, startup, manager selection, state and message routing, protected configuration, shutdown |
| `src/lib/miio.ts`                                    | Local UDP transport, Xiaomi packet encoding, encryption, request IDs, timeouts, socket lifecycle            |
| `src/lib/vacuum.ts`                                  | Generic Roborock/rockrobo manager and shared vacuum behavior                                                |
| `src/lib/viomi.ts`                                   | Viomi properties, polling, mappings, and commands                                                           |
| `src/lib/dreame.ts`                                  | Dreame/Xiaomi MIOT properties, actions, mappings, and commands                                              |
| `src/lib/XiaomiCloudConnector.ts`                    | Xiaomi login-link authentication, sessions, discovery, and encrypted API boundary                           |
| `src/lib/XiaomiCloudCrypto.ts`                       | Nonce, signature, and RC4 cryptography helpers                                                              |
| `src/lib/XiaomiCloudProtocol.ts`                     | Cookie and Xiaomi response protocol helpers                                                                 |
| `src/lib/XiaomiCloudSession.ts`                      | Persisted cloud-session validation and decoding                                                             |
| `src/lib/maphelper.ts`                               | Local map pointer handling, cloud/Valetudo map retrieval, URL caching                                       |
| `src/lib/mapCreator.ts` and `src/lib/RRMapParser.ts` | Roborock map parsing and PNG rendering                                                                      |
| `src/lib/roomManager.ts`                             | Room channels, room mappings, enums, and room-cleaning routing                                              |
| `src/lib/timerManager.ts`                            | Runtime timer scheduling and cleanup                                                                        |
| `src/lib/objects.ts`                                 | Runtime object definitions and stable state contracts                                                       |
| `src/lib/*Protocol.ts`                               | Small protocol parsers, catalogues, mappings, and payload builders                                          |
| `src/lib/protectedConfig.ts`                         | Validation and merge boundary for protected native configuration                                            |
| `src/lib/diagnostics.ts`                             | Opt-in, redacted advanced diagnostic output                                                                 |
| `src/types/`                                         | Backend domain and compatibility types                                                                      |
| `src-admin/`                                         | React configuration source and Vite configuration                                                           |
| `admin/`                                             | Generated React admin assets, translations, icons, and user documentation media                            |
| `src-widgets/`                                       | VIS 2 React/TypeScript widget source and Module Federation build                                            |
| `widgets/`                                           | VIS 1 source and generated VIS 2 runtime assets                                                             |
| `test/`                                              | Protocol, manager, migration, security, and package tests                                                   |
| `lib/XiaomiCloudConnector.test.js`                   | Focused cloud authentication regression suite                                                               |
| `scripts/package-smoke.cjs`                          | Real npm archive and clean-install smoke test                                                               |
| `scripts/copy-widgets.cjs`                           | Copies only the required VIS 2 build output into `widgets/`                                                 |
| `io-package.json`                                    | Adapter metadata, native defaults, dependencies, protected fields, VIS registration                         |

Generated backend code is written to `build/`. The package entry point is directly `build/main.js`,
which supports compact-mode and direct starts. There is no root-level `main.js` bootstrap. All
runtime behavior remains implemented in TypeScript under `src/`; do not reintroduce runtime logic
under `main.js` or `lib/`. `common.nogit: true` disables unsupported GitHub installations in Admin.

## 4. Runtime architecture

### 4.1 Startup sequence

The central lifecycle is implemented by `MihomeVacuum` in `src/main.ts`:

1. js-controller loads and decrypts all fields listed in `encryptedNative`.
2. `onReady()` resets `info.connection`, creates authentication states, and initializes the cloud
   connector without starting a login.
3. `main()` normalizes ports and polling intervals and validates the already decrypted device
   token.
4. Base objects and optional control objects are created with supported object APIs.
5. A per-instance `Miio` UDP client is created.
6. On the first connection, `miIO.info` is requested to identify the model.
7. If `miIO.info` is unavailable, a configured or previously stored model may be used as a
   non-fatal fallback.
8. The selected device manager is constructed and its `ready` promise is awaited.
9. State subscriptions are enabled only after the manager is ready.

`Miio` must set its internal `connected` flag before emitting the first `connect` event. The connect
listener immediately sends `miIO.info`; reversing this order silently drops the first request and
can make model detection fail after a restart.

### 4.2 Manager selection

`MihomeVacuum.getManager()` maps a manually configured manager or the model prefix as follows:

| Manager key/model prefix | Implementation  |
| ------------------------ | --------------- |
| `roborock`               | `VacuumManager` |
| `rockrobo`               | `VacuumManager` |
| `viomi`                  | `ViomiManager`  |
| `dreame`                 | `DreameManager` |
| `xiaomi`                 | `DreameManager` |

The generic manager is not an S5-specific implementation. The S5 is a known physical test device,
but names, types, and behavior must continue to support the wider Roborock/rockrobo model family.

When adding a model:

1. determine which wire protocol it uses;
2. extend an existing manager where possible;
3. add model-specific property or action mappings without narrowing generic behavior;
4. update feature detection and object definitions only where required;
5. add synthetic protocol fixtures and manager tests;
6. document whether the model was tested with real hardware.

Do not select a manager from cloud availability. Manager selection is based on local configuration
and model information.

### 4.3 State routing

ioBroker writes with `ack: false` reach `MihomeVacuum.onStateChange()`. Custom commands are handled
at the adapter boundary; normal device states are forwarded to the active manager. Managers are
responsible for validating state IDs, mapping values, sending the correct device command, and
acknowledging successful writes.

Important rules:

- Ignore missing states and states with `ack: true`.
- Await asynchronous manager handlers and contain rejections.
- Do not send commands after manager shutdown.
- Never log complete custom command parameters or complete device responses.
- Preserve existing object IDs and value semantics unless a documented migration is supplied.

### 4.4 Shutdown and Compact Mode

`onUnload()` is idempotent and always invokes the supplied callback exactly once. It shuts down, in
order:

1. cloud login polling and authentication timers;
2. the active manager and its polling, map, room, and timer resources;
3. pending UDP requests and the UDP socket.

All runtime state belongs to an adapter instance. Module-level mutable managers, sockets, caches,
timeouts, or request maps can make Compact Mode instances interfere with each other and are not
allowed.

After shutdown begins:

- no new timer may be scheduled;
- no request may be sent;
- no state may be written by an old asynchronous response;
- repeated `close()` calls must be safe;
- an expected UDP `close` event is logged at debug level, not warning level.

Never terminate the process from a UDP error handler. In Compact Mode this could terminate other
adapter instances in the same process.

## 5. Local Miio protocol

`src/lib/miio.ts` owns the local UDP boundary. It is responsible for:

- hello packet synchronization;
- token-based packet encryption and decryption;
- request sequence IDs;
- matching responses to pending requests;
- request timeouts and late-response handling;
- socket errors, close handling, and shutdown settlement.

The local device token is sensitive. It may be 31, 32, or 96 hexadecimal characters according to
the compatibility behavior validated in `src/main.ts`; the Miio layer converts the accepted format
to the protocol-specific binary token. A value that still begins with ioBroker's encrypted marker,
or any malformed token, must be rejected before the UDP client starts.

When changing packet handling, add byte-level tests. A successful request test alone is insufficient;
also test timeout, late response, mismatched request ID, malformed payload, send failure, socket
error, and shutdown during a pending request.

## 6. Xiaomi Cloud authentication

### 6.1 Authentication flow

Username/password login endpoints are obsolete for new logins. The adapter uses Xiaomi's
long-polling login-link flow in `XiaomiCloudConnector`:

1. the admin UI sends `startCloudLogin`;
2. the adapter publishes the generated URL and authentication status;
3. the user opens the link and confirms the login in Xiaomi's browser flow;
4. the connector polls until confirmation, expiry, failure, or shutdown;
5. a valid session is encrypted and persisted;
6. authenticated discovery can then request the device list.

Internal compatibility names may still contain `qr`, but the UI must call this an **Xiaomi login
link** because the adapter displays a URL and does not render a QR code.

Public authentication states are:

| State            | Meaning                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `auth.status`    | `not_authenticated`, `waiting_for_scan`, `waiting_for_confirmation`, `authenticated`, `expired`, or `error` |
| `auth.loginUrl`  | Temporary Xiaomi URL; cleared after success, expiry, error, or shutdown                                     |
| `auth.lastError` | Redacted user-facing error                                                                                  |
| `auth.expiresAt` | Expiration timestamp if Xiaomi provides one                                                                 |

The `discovery` message requires an already authenticated session. It must not silently initiate a
new login. HTTP 401 or 403 invalidates the stored session and requires an explicit new login.

### 6.2 Persisted session contract

`cloudSession` must contain valid session security, user ID, service token, and complete cookies.
`XiaomiCloudSession.ts` validates this contract. Damaged, incomplete, or expired data is discarded
without creating an automatic login loop.

Always persist `cloudSession` through `adapter.encrypt()`. Writing plain JSON to an
`encryptedNative` property causes js-controller to decrypt invalid data on the next start.

An encrypted session update changes the instance native object and can cause one controlled adapter
restart. Repeated restart or login loops are defects.

### 6.3 Cloud cryptography boundary

Region selection, nonce construction, request signatures, RC4-drop-1024 behavior, cookies, and
redirect handling are isolated in the cloud modules. Do not change this boundary as part of an
unrelated cleanup. Every protocol change requires deterministic cryptographic fixtures and mocked
HTTP tests. Tests must never contact real Xiaomi services.

## 7. Protected configuration and security

`io-package.json` lists `password`, `token`, and `cloudSession` in both `protectedNative` and
`encryptedNative`.

js-controller decrypts these fields before the adapter `ready` event. The backend validates the
result and is the only component allowed to persist replacement secrets. The React UI does not
implement its own AES or XOR scheme.

### 7.1 Admin token contract

The React UI obtains a validated, already decrypted local device token only from the running adapter
using `getProtectedConfigStatus`. The message is accepted only from a sender matching
`system.adapter.admin.<instance>`. Password and cloud session values are never returned.

Saving uses one explicit token action:

| Action    | Behavior                                                       |
| --------- | -------------------------------------------------------------- |
| `keep`    | Preserve the exact stored native value                         |
| `replace` | Validate the new token and persist `adapter.encrypt(newValue)` |
| `delete`  | Persist an encrypted empty value after explicit confirmation   |

`src/lib/protectedConfig.ts` rejects placeholders, malformed tokens, protected browser fields, and
prototype-pollution keys. Ordinary configuration changes must preserve every protected field.

The eye button only changes local input visibility. The token remains masked by default and must
never be printed to the browser console.

### 7.2 Data that must never be logged or committed

- device tokens;
- passwords;
- `cloudSession` values;
- cookies and service tokens;
- complete `ssecurity` values;
- Xiaomi login or map URLs;
- private device addresses from real installations;
- full Xiaomi API responses;
- complete local device responses when they may contain identifying data.

Advanced diagnostics are opt-in through the admin setting. They still pass through the redaction
boundary in `src/lib/diagnostics.ts`. The option is not permission to log credentials or raw API
payloads.

Use synthetic values in tests and documentation. Before sharing a live log, remove credentials,
URLs, addresses, IDs, and complete cloud responses.

## 8. Maps

Map handling deliberately separates the local protocol from cloud file retrieval:

1. the vacuum supplies a map pointer locally;
2. `MapHelper` resolves the map source;
3. Xiaomi Cloud or Valetudo provides map bytes where configured;
4. `RRMapParser` parses Roborock map data;
5. `MapCreator` renders the PNG;
6. map states are updated.

Important states include:

- `cleanmap.map64`: data-URI PNG used by VIS 1 and VIS 2 widgets;
- `cleanmap.mapURL`: ioBroker file URL;
- `cleanmap.mapStatus`: map processing status;
- `cleanmap.actualMap`: selected map number where supported.

Cloud maps require both `enableMiMap` and a valid Xiaomi session. Local control, manager creation,
status polling, and the local pointer request must continue without cloud authentication.

Map URLs and cache entries are sensitive. Log only safe status summaries. Map URL caches must be
per adapter instance and must be cleared or made inert on shutdown.

Canvas dimensions are part of the rendering contract. Always create canvases with explicit width
and height and cover crop/transform changes with deterministic rendering tests.

## 9. Rooms, timers, features, and objects

### 9.1 Object definitions

Stable object definitions live in `src/lib/objects.ts`. Major public namespaces include:

- `auth.*`;
- `cleanmap.*`;
- `consumable.*`;
- `control.*`;
- `deviceInfo.*`;
- `history.*`;
- `info.*`;
- `rooms.*`;
- `timer.*`.

Create or extend channels and states with supported `setObjectNotExists`/`extendObject` APIs. Do not
use deprecated `createChannel` helpers. A state object must exist before its first state write. The
declared `common.def` type must match `common.type`.

`control.clean_home` is shared behavior and is created for all supported robots. Only additional
Alexa/IoT states depend on the optional IoT configuration.

### 9.2 Rooms

`RoomManager` combines robot segment IDs, adapter room channels, and `enum.rooms` membership. It
normalizes persisted full IDs and supports room cleaning by map index, native channel, or enum.

When changing room behavior, test:

- missing room state creation;
- segment and zone routing;
- full and relative room IDs;
- enum membership;
- multiple adapter instances;
- unsupported or malformed robot mappings.

### 9.3 Timers

The React UI communicates through `getTimers` and `saveTimers`. The backend is the authoritative
validation boundary for weekdays, hour/minute ranges, duplicate start times, channels, and room
memberships. Do not let the UI write timer objects directly.

Runtime timers must cancel initialization and scheduled callbacks on close. No delayed callback may
write after shutdown.

Use `adapter.setTimeout` and `adapter.clearTimeout` for runtime work so ioBroker can track timers.
Do not introduce global `setTimeout` calls in productive sources.

### 9.4 Feature detection

Unsupported features are stored in `deviceInfo.unsupported` using the existing delimiter contract.
Feature detection must remain per manager instance. A failed optional probe should normally disable
only that feature, not abort the adapter.

## 10. Admin UI

The production configuration UI is under `src-admin/`:

- `src/main.tsx` loads the ioBroker socket client and mounts React;
- `src/App.tsx` owns configuration, authentication, discovery, protected-token handling, validation,
  tabs, saving, and dialogs;
- `src/TimerTab.tsx` owns timer editing;
- `src/types.ts` defines UI and message contracts;
- `src/translations.ts` loads the central ioBroker short-format language files from `admin/i18n/`;
- `vite.config.ts` builds into `admin/`.

`common.adminUI.config` is `html`, so ioBroker loads `admin/index.html`. React parity and the required
live tests were confirmed during migration; the former Materialize file `admin/index_m.html` is no
longer shipped. Do not reintroduce a second configuration implementation without a concrete migration
or recovery requirement.

Admin implementation rules:

- Use backend messages for protected configuration and timer writes.
- Treat all cloud and device data as untrusted input.
- Never construct device options with unescaped HTML.
- Clean up polling timers and event handlers on unmount.
- Keep controls keyboard accessible and provide `aria-label`/tooltips for icon-only buttons.
- Keep responsive layout behavior for narrow dialogs.
- Add every user-facing label to all translation files and `admin/words.js` where applicable.
- Maintain translations in ioBroker's short `admin/i18n/<language>.json` format. Run
  `npm run translate -- convert` after changing `admin/words.js` or translation content.
- Rebuild generated `admin/index.html` and assets after source changes.

The current admin bundle may report Vite's chunk-size optimization warning. It is not a build
failure, but substantial new functionality should use code splitting where practical.

## 11. VIS 1 and VIS 2 widgets

### 11.1 VIS 1

The classic EJS widget is `widgets/mihome-vacuum.html`; its styles are in
`widgets/mihome-vacuum/css/mihome-vacuum.css`. It provides a responsive dashboard with map, live
values, cleaning controls, consumable maintenance, protected reset actions, and cleaning history.

VIS 1 attributes can auto-fill related object IDs after the user selects a state from an adapter
instance. Keep write commands disabled in edit mode.

### 11.2 VIS 2

The React widget is `src-widgets/src/VacuumControlWidget.tsx`. It extends the VIS 2 `visRxWidget`
base class, which collects configured state IDs and owns subscriptions. Do not add duplicate manual
subscriptions. It deliberately provides the same overview, maintenance, history, and reset features
as VIS 1.

Both variants keep map, rooms, controls, and maintenance together on the dashboard. Cleaning history
has a separate tab so large record lists do not overload the main view. Up to six room cards can be
configured with a user-facing name, `rooms.<id>.roomClean` start state, and optional
`rooms.<id>.roomFanPower` state. A room card deliberately exposes only its start action and suction
level. Numeric `info.state` values are converted to readable robot-state labels inside the widgets.
The map sidebar contains the primary suction selector, readable current status, robot health, and the
four quick actions (start, pause, dock, and find). Do not duplicate these actions in a bottom toolbar;
the sidebar is intentionally used to avoid empty space beside tall map images.

The map frame uses a wide 16:10 desktop ratio, falls back to a square mobile ratio, and renders
`cleanmap.map64` as an absolutely centered image with automatic dimensions, bounded by `max-width`
and `max-height`, plus `object-fit: contain`. This preserves the PNG's original aspect ratio and prevents
cropping in wide frames. VIS 1 uses an equivalent centered CSS background with `background-size:
contain`, because global VIS 1 image rules can otherwise override normal `<img>` sizing. Rooms and
maintenance share a responsive two-column row
when enough width is available. If the configured widget height is too small, the dashboard content scrolls instead of
cropping the map to the controls. Dashboard sections use a non-shrinking vertical flex flow so the
map cannot overlap the rooms or maintenance cards. Both widget variants translate numeric `info.error` values through
the complete adapter error catalogue and keep unknown codes visible as `Unknown error (code)`.

All visible widget controls, headings, empty states, maintenance messages, and confirmation prompts
must use the widget language. Following the standard ioBroker/Weblate layout, `admin/i18n/<language>.json`
is the single translation source for the React admin, VIS 2, and VIS 1. VIS 2 imports these files through
`src-widgets/src/translations.ts`; `scripts/copy-widgets.cjs` validates key parity and generates the VIS 1
`systemDictionary` bridge at `widgets/mihome-vacuum/js/translations.js`. Do not maintain separate inline
widget dictionaries or add hard-coded user-facing labels to either renderer.

The maintenance view consumes available `consumable.*` states and hides unsupported entries, so the
same widget can represent different Roborock, Viomi, and Dreame feature sets. Every reset requires
confirmation before writing `true` to its `*_reset` state. The history view reads the total counters
and parses `history.allTableJSON`; malformed or absent history must produce an empty state instead of
breaking widget rendering.

`src-widgets/vite.config.ts` exposes the component and translations through Module Federation.
`io-package.json` registers `mihomeVacuumWidgets` with `bundlerType: "module"`.

The widget build first writes to `src-widgets/build/`. `scripts/copy-widgets.cjs` then replaces only
generated `customWidgets.js` and `assets/` while preserving shared VIS 1 images and CSS.

Both widget variants default to instance `mihome-vacuum.0` and `cleanmap.map64`. Fan values are
configurable because model families use different numeric scales.

When changing either widget:

1. preserve functional parity between VIS 1 and VIS 2 where possible;
2. verify empty-map, offline, and missing-value states;
3. keep buttons accessible and inert in editor mode;
4. check narrow and wide sizes;
5. run the widget typecheck and production build;
6. ensure the npm archive includes the EJS, CSS, Module Federation entry, and all generated chunks.
7. verify every maintenance reset asks for confirmation and writes only to its configured reset ID.

## 12. Adapter message API

The admin UI and external callers use `sendTo` messages routed by `src/main.ts`. Important commands
include:

| Command                    | Purpose                                                    | Security/validation boundary                      |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `startCloudLogin`          | Explicitly starts Xiaomi login-link authentication         | No credentials in payload or logs                 |
| `discovery`                | Retrieves devices from an authenticated session            | Must not start a login automatically              |
| `getProtectedConfigStatus` | Returns protected-field presence and validated local token | Admin sender only; never returns password/session |
| `saveConfig`               | Saves ordinary configuration and explicit token action     | Admin sender only; backend merge and encryption   |
| `getTimers`                | Returns normalized timers, room enums, and channels        | Backend object normalization                      |
| `saveTimers`               | Validates and persists timer definitions                   | Backend validation is authoritative               |

Unrecognized commands are forwarded to the active manager when appropriate. If the manager is not
ready, return a typed `NOT_INITIALIZED` response rather than throwing.

Any new admin message should have:

- a typed request and response contract;
- sender authorization where sensitive;
- backend validation;
- a stable, non-sensitive error shape;
- success, rejection, and lifecycle tests.

## 13. Build workflow

### 13.1 Commands

```sh
# Compile backend, admin, and widgets
npm run build

# Compile only one subsystem
npm run build:backend
npm run build:admin
npm run build:widgets

# Type-check all source sets
npm run check

# Lint and format-check
npm run lint
```

`npm run build` produces:

- `build/main.js` and `build/lib/**/*.js`;
- `admin/index.html` and `admin/assets/*`;
- `widgets/mihome-vacuum/customWidgets.js` and its Module Federation chunks.

Do not edit generated JavaScript manually. Change the TypeScript/React source and rebuild. Do not
commit `build/`, `admin/index.html`, `admin/assets/`, `src-widgets/build/`, the generated VIS 2
`widgets/mihome-vacuum/assets/` and `customWidgets.js`, or the generated VIS 1 translation bridge
`widgets/mihome-vacuum/js/translations.js`. Keep sources, `admin/i18n/`, hand-written VIS 1 HTML/CSS,
images and other static assets tracked. Also exclude `node_modules`, TypeScript declaration output,
source maps, local dev server state, and agent workspace files.

### 13.2 Packaging

The package allowlist in `package.json` is intentional. It includes runtime build output, generated
admin files, widgets, metadata, user-facing documentation, and the license. It excludes TypeScript
sources, tests, legacy runtime files, and declaration artifacts.

There are deliberately no install, `prepare`, `prepublish`, `prepublishOnly` or `prepack` hooks.
`npm ci`, `npm pack` and `npm publish` do not build automatically. Build before manually creating
an archive (and before any authorized manual publication):

```sh
npm run build
npm pack
```

For an end-to-end archive test use:

```sh
npm run test:package-smoke
```

The smoke test creates a temporary archive without lifecycle scripts, checks required and forbidden
paths, installs only production dependencies into a clean temporary project with scripts disabled,
and loads the productive CommonJS entry. The optional canvas dependency is omitted in this test.

Install user-facing versions through ioBroker Admin from published npm packages. For prerelease
testing, use a published beta version or a locally built archive; an unbuilt GitHub checkout is not
an installable package. Do not add lifecycle hooks or commit generated bundles to restore that path.

### 13.3 ioBroker dev-server

A typical local workflow is:

```sh
dev-server watch --noStart
```

The dev-server executes the regular build and installs the local package. During installation,
browser-sync and Admin WebSockets may reconnect and briefly report `NO READY flag`,
`CLOSE_ABNORMAL`, or connection failures. Evaluate the UI only after installation has completed and
the page has been reloaded.

For a manual package test:

```sh
npm run build
npm pack
```

Install the resulting archive in the dev-server environment, restart the adapter, and inspect both
the adapter log and browser console.

## 14. Test strategy

Run the narrowest relevant suite first, then the complete checks.

### 14.1 Standard gate

```sh
npm run lint
npm run check
npm test
npm run test:package-smoke
```

`npm test` runs backend regression tests and package validation. The smoke test is separate because
it performs a real archive installation.

### 14.2 Focused commands

```sh
npm run test:js
npm run test:package
npm run test:integration
npm run build:backend
node node_modules/mocha/bin/mocha.js lib/XiaomiCloudConnector.test.js
```

### 14.3 Test locations

| Area                               | Representative tests                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Adapter lifecycle and Compact Mode | `main.lifecycle.test.js`, `test/testMainMigration.js`                                      |
| Protected configuration            | `main.protectedConfig.test.js`, `test/testProtectedConfig.js`, `test/testAdminSecurity.js` |
| Cloud login and session            | `lib/XiaomiCloudConnector.test.js`, cloud crypto/protocol/session tests                    |
| Miio UDP and packet protocol       | `test/testMiio.js`                                                                         |
| Roborock manager                   | `test/testVacuumManager.js`, vacuum protocol tests                                         |
| Viomi manager                      | `test/testViomiManager.js`                                                                 |
| Dreame manager                     | `test/testDreameManager.js`                                                                |
| Maps                               | map helper, parser, creator, pointer, and state protocol tests                             |
| Rooms and timers                   | room manager/mapping and timer manager tests                                               |
| Packaging and metadata             | `test/package.js`, `scripts/package-smoke.cjs`                                             |
| Admin UI security                  | `test/testAdminSecurity.js`                                                                |

Mock Xiaomi HTTP endpoints and robot responses. Tests must be deterministic, offline-capable, and
free of real identifiers or credentials.

### 14.4 Live-test matrix

Automated tests cannot fully replace real robot and ioBroker tests. Before a significant release,
verify at least:

- clean installation from the npm archive;
- upgrade from the previous supported adapter version;
- Node.js and Admin versions at the declared minimum where practical;
- normal and Compact Mode startup;
- adapter restart with an existing encrypted token and cloud session;
- local connection, model detection/fallback, and status polling;
- start, pause, dock, find, fan, room, zone, and supported model-specific commands;
- map generation and map refresh;
- room object creation and timer execution;
- React admin save, token keep/replace/delete, login link, discovery, and timer editing;
- VIS 1 and VIS 2 widget rendering and commands;
- unload during an active request with no later state writes.

Roborock behavior has physical S5 coverage. Viomi and Dreame are extensively protected by mocks and
fixtures, but real hardware tests should be recorded when devices are available.

## 15. Debugging guide

### Adapter does not start after installation

1. Confirm that `build/main.js` exists in the installed package.
2. Run `npm run build` and `npm run test:package-smoke` locally.
3. Check Node.js, js-controller, and Admin minimum versions.
4. Confirm that production dependencies, not only repository sources, were installed.
5. Confirm that `package.json` points directly to `build/main.js` and that the installed package was built before distribution.

### Token is reported as invalid or not decrypted

1. Confirm `token` remains in both native protection lists.
2. Inspect only whether the stored value has the official encrypted prefix; do not copy its content
   into an issue.
3. Confirm js-controller decrypted the configuration before `ready`.
4. Use the admin UI to explicitly replace the token if an old damaged value exists.
5. Never add browser-side custom decryption.

### Robot is reachable but model detection fails

1. Check UDP reachability and configured IP/ports.
2. Confirm the Miio client sets `connected` before its first `connect` event.
3. Inspect retry summaries without logging the complete `miIO.info` response.
4. Set a known model manually to test the supported fallback.
5. Verify that the selected manager matches the protocol family.

### A command works only after the second attempt

1. Check whether manager initialization was fully awaited.
2. Check request listener registration and request-ID ordering.
3. Look for an early request discarded while `connected` was still false.
4. Test timeout cleanup and late replies.
5. Ensure a delayed callback retains the correct manager `this` context.

### Adapter crashes from a timer callback

1. Find unbound methods passed directly to `setTimeout`.
2. Use an arrow callback or bind the instance explicitly.
3. Catch asynchronous callback rejections.
4. Cancel the timer in `close()`.
5. Add a regression test that waits for the delayed callback.

### Map is missing while local control works

1. This is a valid partial state; do not treat it as a local-control failure.
2. Check the configured map source and `enableMiMap`/Valetudo settings.
3. Check `auth.status` without exposing `auth.loginUrl`.
4. Verify the local pointer result and safe `mapStatus` summary.
5. Check canvas/native library availability.

### Cloud discovery returns 401 or 403

The connector must invalidate the stored session and return to an unauthenticated state. The user
must explicitly create a new login link. Do not implement background reauthentication loops.

### VIS 2 widget is missing

1. Check `common.visWidgets` in the installed `io-package.json`.
2. Confirm `widgets/mihome-vacuum/customWidgets.js` and all referenced chunks exist.
3. Rebuild with `npm run build:widgets`.
4. Reload VIS 2 after uploading the adapter files.
5. Inspect the browser console for Module Federation loading errors.

## 16. Adding or changing functionality

### New state or command

1. Define the object in `src/lib/objects.ts` or the responsible manager catalogue.
2. Preserve existing IDs and roles.
3. Ensure the object exists before writing its state.
4. Implement manager routing and acknowledgement.
5. Add unit and manager tests.
6. Update README documentation for user-visible behavior.
7. Update Admin/VIS translations and configuration where applicable.

### New cloud endpoint or protocol field

1. Keep the HTTP boundary in `XiaomiCloudConnector`.
2. Put cryptographic/cookie parsing in the dedicated utility module.
3. Redact URLs, headers, cookies, identifiers, and bodies.
4. Mock every response; never use a live account in tests.
5. Cover success, malformed data, network failure, authorization failure, and shutdown.

### New admin setting

1. Add a native default to `io-package.json` if needed.
2. Extend TypeScript configuration types.
3. Add the React control and validation.
4. Preserve protected values in the backend save path.
5. Add all translations and update `admin/words.js` where required.
6. Update admin security/package tests.
7. Rebuild generated admin assets.

### New VIS feature

1. Decide whether both VIS generations can support it.
2. Extend configurable object IDs rather than hard-coding a single instance.
3. Keep editor mode free of real writes.
4. Cover missing/offline values and map absence.
5. Rebuild VIS 2 and check package contents.

## 17. Dependency, CI, and release policy

- Keep runtime dependencies minimal.
- Keep ioBroker core, testing, lint, release, React, Vite, and VIS packages on compatible maintained
  versions.
- Review major dependency updates for their Node.js and Admin requirements before merging.
- Do not change the adapter version or release metadata as part of unrelated implementation work.
- Keep GitHub workflows compatible with the declared Node.js matrix.
- Use the official `ioBroker/testing-action-check@v1`, `ioBroker/testing-action-adapter@v1`, and
  `ioBroker/testing-action-deploy@v1` actions. Runtime and checks start with Node 22.x, the matrix
  also covers Node 24.x, and trusted publishing runs on Node 24.x as required by the release action.
- Integration and deploy actions must explicitly set `build: true` and `build-command: "npm run build"`.
  Their default is to skip the build. The check action runs `test:package`, which explicitly builds;
  the regression job builds through `test:js` and `test:package-smoke`. Never rely on install hooks
  or files left over from a previous job. The deploy action builds before invoking `npm publish`.
- Never publish from an unreviewed development fork.

### Intentional repository-checker exceptions

Some generic repository-checker suggestions conflict with requirements of this adapter:

- `mocha`, `chai`, `sinon`, and their type packages remain direct development dependencies
  (W0063). The npm scripts invoke Mocha, and the JavaScript regression tests directly import
  Chai and Sinon and are checked with TypeScript (`checkJs`). Transitive dependencies of
  `@iobroker/testing` are not a stable public dependency contract and are not guaranteed to be
  hoisted to the adapter's module-resolution scope. In particular, this adapter uses Chai 5
  while `@iobroker/testing` 5.3.0 uses Chai 4. The unused `chai-as-promised` and `sinon-chai`
  plugins and their type packages are no longer declared or registered by this adapter.
- `canvas` remains an optional dependency. It enables map rendering where a compatible native
  binary is available, but an unavailable binary must not prevent installation or local vacuum
  control. `mapCreator.ts` explicitly annotates this with the checker's supported
  `@repochecker: optional dependency 'canvas'` comment. `MapHelper` loads the renderer only when
  maps are enabled and handles a failed load; the package smoke test also installs without
  optional dependencies. The checker may still suggest checking availability (S5066); do not
  make Canvas mandatory just to suppress that suggestion.

`.vscode/settings.json` maps `io-package.json` to the official js-controller JSON schema (S4036).
No jsonConfig schema is needed for the current HTML/React Admin UI.

Before opening a community pull request:

1. synchronize with the current community repository;
2. review the complete diff for unrelated or local-only files;
3. run the standard test gate and package smoke test;
4. perform the relevant live-test matrix;
5. verify that generated admin and widget assets match their sources;
6. inspect the archive for secrets and excluded source files;
7. update the changelog and version only according to maintainer/release policy;
8. describe hardware-tested and mock-tested model families accurately.

## 18. Pull-request checklist

- [ ] The change is focused and preserves unrelated work.
- [ ] Existing object IDs and configuration keys remain compatible or have a migration.
- [ ] Local control remains independent of Xiaomi Cloud.
- [ ] No secret, private address, raw URL, or complete device/cloud response is logged or committed.
- [ ] New asynchronous work is awaited, cancelled, and safe during unload.
- [ ] Compact Mode instances do not share mutable runtime state.
- [ ] Backend, Admin, VIS 1, and VIS 2 contracts are updated where applicable.
- [ ] User-facing text is translated and documented.
- [ ] Focused tests cover success, failure, malformed input, and shutdown.
- [ ] `npm run check` passes.
- [ ] `npm run lint` passes.
- [ ] `npm test` passes.
- [ ] `npm run test:package-smoke` passes.
- [ ] Relevant real-device and UI tests were completed or explicitly documented as outstanding.

## 19. Maintenance principles

When in doubt, preserve these invariants:

1. Local robot control must work without Xiaomi Cloud.
2. Secrets are decrypted and encrypted only through supported ioBroker backend mechanisms.
3. Every instance owns its socket, manager, cache, timers, and shutdown state.
4. Public object IDs and meanings are stable API contracts.
5. Optional feature failures should not terminate otherwise supported control.
6. No asynchronous work survives adapter unload.
7. Generated artifacts come from reviewed TypeScript/React sources.
8. Tests use synthetic data and run without real Xiaomi services.

Following these rules keeps the adapter recoverable for a future maintainer even without access to
the original development environment or physical devices.
