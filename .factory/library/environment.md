# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** required env vars, external services, setup caveats, platform-specific notes.
**What does NOT belong here:** service ports and commands (use `.factory/services.yaml`).

---

## Dependencies

- No external API keys or accounts are required for this mission
- Final product must remain static/local-first
- Dictionary assets are local tracked files already present in the repo

## Setup Notes

- The current repo has no package manager setup yet; workers are expected to add one
- The intended runtime is a local web app on localhost during development plus static build output for `file://` checks
- Avoid regenerating the large trie assets unless a feature explicitly needs dictionary format changes
