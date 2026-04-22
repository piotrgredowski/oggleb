# Architecture

How the redesigned app should work at a high level.

**What belongs here:** product structure, main components, data flows, invariants, and mode boundaries.
**What does NOT belong here:** detailed implementation tasks or per-feature acceptance criteria.

---

## Planned Application Shape

- Static web app with a lightweight SPA shell
- Relative asset paths so the built app can run on localhost and via `file://`
- No backend, database, websocket service, or third-party runtime dependency
- Local dictionary assets remain bundled/tracked in the repo and are loaded only for the active language

## Core Layers

### 1. App Shell
Responsible for:
- bootstrapping the app
- rendering the three first-class home modes: `Solo`, `TV Display`, `Multiplayer`
- routing between home/setup/play/results states
- syncing safe URL state (`lang`, duration, shared code, mode context)

### 2. Game Descriptor
A serializable description of a round used across solo, TV, and multiplayer contexts.

Expected fields:
- language / board variant
- duration
- deterministic seed
- any versioning needed for shared-code compatibility

The descriptor is the canonical source for reconstructing a round from a URL or shared code. Presentation mode (`Solo`, `TV Display`, pass-and-play, joined phone view) is a view/controller concern layered on top of the same round identity, not part of the round definition itself.

### 3. Game Engine
Pure gameplay logic shared across all modes:
- board generation from deterministic seed
- trie-backed solve / validation
- scoring rules
- board-path lookup / inspection metadata

The engine should not know about UI layout or browser-specific concerns.

### 4. Mode Session Controllers
Thin state controllers wrapping the shared engine for each experience:

- **Solo session**
  - one player
  - live entry, reveal, results, scoring feedback
- **Pass-and-play session**
  - shared board across turns
  - player roster
  - private handoff flow before each turn
  - fresh full timer for each player's turn
  - per-player summaries and winner resolution
- **Shared-code multiplayer session**
  - same deterministic round on many phones
  - no live shared room state
  - local entry/results per participant
- **TV display session**
  - read-only presentation of the same round definition
  - board + timer only

## Shared-Code Model

Same-room many-phone play is backend-free.

That means:
- the shared code or URL fully defines the round
- any device can reconstruct the same round independently
- host presence is not required after code generation
- local answers, reveal state, and scoring remain device-local unless explicitly encoded otherwise

This model must never imply realtime sync that does not actually exist.

### Shared start semantics
- Shared-code multiplayer is **seed-synced, not clock-synced**
- Each device starts its own local timer when that device explicitly starts the round
- TV display may be opened from the same shared round definition, but it still runs as a local presentation session unless the product explicitly adds a coordination affordance
- Late joiners reconstruct the same round definition; they do not inherit elapsed time from another device

### URL authority rules
- When a shared code is present, the decoded shared round definition is authoritative over standalone `lang` or duration params
- Non-shared setup params may persist on home/setup for convenience
- Leaving shared flow for solo, pass-and-play, or plain home must clear shared round identity from the URL and session state

## UI State Boundaries

The redesign should keep these surfaces clearly separated:
- home / setup
- active play
- reveal / results
- shared preflight / lobby
- TV display
- pass-and-play handoff

Mode-specific chrome must not leak across boundaries. Example: TV mode must not show player-entry or scoring controls; solo must not foreground join/share UI.

## File and Localhost Support

The product must work in two validation modes:
- localhost dev/preview for routine browser automation
- built static output opened directly via `file://` where feasible

Relative paths and asset loading decisions must preserve both modes. If browser security prevents a specific capability under `file://`, the app must fail explicitly and gracefully.

## Invariants

- identical shared code => identical board definition across contexts
- pass-and-play uses one board definition across all local turns
- pass-and-play private state never appears in the URL
- TV mode remains presentation-only during play
- solver output remains hidden during active play until reveal/timeout
- responsive changes do not reset round identity
- replay/reset always starts from a clean state unless persistence is explicitly designed
