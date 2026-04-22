---
name: web-game-worker
description: Build and verify static web game features for the Oggleb redesign.
---

# Web Game Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the work procedure.

## When to Use This Skill

Use this skill for any feature that implements or refines the static web app: app shell, mode routing, gameplay UI, pass-and-play, TV display, shared-code flows, browser validation, and file-compatibility work.

## Required Skills

- `collaborative-tdd-typescript` — invoke when implementing TypeScript feature work so tests are designed before code changes.
- `agent-browser` — invoke for browser verification of the feature’s contract slice before handoff.

## Work Procedure

1. Read the assigned feature, `mission.md`, `AGENTS.md`, `.factory/library/architecture.md`, `.factory/library/user-testing.md`, and `.factory/services.yaml` before touching code.
2. Inspect the existing implementation and identify the exact files and user flows affected.
3. If the feature will use TypeScript app code, invoke `collaborative-tdd-typescript` and write failing tests first. Keep tests focused on the contract slice completed by the feature.
4. Implement the smallest end-to-end slice that satisfies the feature while preserving local-first constraints, URL behavior, and mode boundaries.
5. Run the narrowest useful validation during iteration, then run the required project validators from `.factory/services.yaml` before handoff.
6. Use `agent-browser` to manually verify the fulfilled behaviors on the real browser surface. For responsive or shared-code work, verify the relevant desktop/mobile/multi-context states explicitly.
7. Ensure no watcher or server you started is left running. If a service manifest entry is wrong, stop and return to orchestrator instead of guessing.
8. Write a thorough handoff with exact commands, browser checks, test files, and any discovered issues.

## Example Handoff

```json
{
  "salientSummary": "Built the new solo play shell and active-round flow in the Vite app, preserving URL-backed setup and hiding results until reveal. Added Playwright coverage for starting a solo round on desktop and mobile, then ran lint, typecheck, and the targeted e2e spec.",
  "whatWasImplemented": "Implemented the solo mode route, setup panel, active board screen, timer lifecycle, word-entry state, and responsive mobile controls. Migrated deterministic board bootstrapping into shared engine helpers and wired the solo surface so it can start from home selections without leaking multiplayer UI.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "npm run test:e2e -- --grep 'solo mode start' --workers=1",
        "exitCode": 0,
        "observation": "2 specs passed covering desktop and mobile solo start flows."
      },
      {
        "command": "npm run typecheck",
        "exitCode": 0,
        "observation": "No TypeScript errors."
      },
      {
        "command": "npm run lint",
        "exitCode": 0,
        "observation": "No lint violations."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Desktop: opened home, selected Solo, changed timer, started round, entered a word, and confirmed results stayed hidden during live play.",
        "observed": "Home transitioned cleanly into solo play, timer started after board render, and no multiplayer chrome remained visible."
      },
      {
        "action": "Mobile: repeated solo start flow at phone viewport with software keyboard open.",
        "observed": "Input and submit remained reachable with no horizontal overflow."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/e2e/solo-mode.spec.ts",
        "cases": [
          {
            "name": "desktop solo start keeps results hidden until reveal",
            "verifies": "VAL-HOME-006, VAL-SOLO-003, VAL-SOLO-016"
          },
          {
            "name": "mobile solo input remains usable with keyboard open",
            "verifies": "VAL-SOLO-011"
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The feature requires changing mission boundaries, adding a backend, or using ports outside `8136-8139`
- `file://` compatibility cannot be preserved or explicitly degraded within the current feature scope
- Shared-code behavior cannot remain backend-free without a user-visible contract change
- The service manifest or validation setup is broken in a way that blocks trustworthy verification
- You uncover an ambiguity about mode structure, privacy rules, or shared-round semantics that materially changes the product contract
