# User Testing

Testing surface, tooling guidance, and runtime validation notes.

**What belongs here:** browser-testing surfaces, setup steps, isolation notes, concurrency guidance, and validation gotchas.
**What does NOT belong here:** feature-by-feature acceptance criteria (use the validation contract).

---

## Validation Surface

### Primary surface
- Browser UI via `http://127.0.0.1:8136`

### Required flows
- home and mode selection
- solo setup, play, reveal, results
- pass-and-play setup, handoff, turn flow, summary
- TV display rendering during active round and round end
- shared-code host/join flow across multiple browser contexts
- many-phone same-round behavior without backend room state
- responsive transitions between desktop/mobile/TV sizes
- targeted `file://` checks for home/setup, solo, and shared-code journeys once build output exists

### Tooling
- Use browser automation (`agent-browser` / Playwright-based browser checks)
- Prefer isolated browser contexts or tabs per participant/device role
- Always capture console errors
- For shared-code checks, also capture URLs and network activity to prove the round is backend-free

## Validation Concurrency

### Browser validators
- Conservative max concurrency: **2**
- Rationale:
  - machine has 12 CPU cores and ~38.7 GB RAM
  - validation dry run showed browser checks are executable locally
  - environment already contains noisy shared browser processes, so concurrency should stay conservative until isolated browser setup is stable

### Isolation guidance
- Prefer localhost for most validation because it avoids `file://` origin quirks during routine automation
- Use separate contexts/tabs for host phone, joined phone, and TV display checks
- For assertions about identical round identity, capture the visible board text or shared code in each context

## Known Constraints

- `file://` support remains required where feasible, but browser clipboard behavior may vary by environment
- Shared-code multiplayer must not rely on backend room presence, so validators should treat any websocket/session dependency as a failure
