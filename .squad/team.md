# Squad Team

> card-crew

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Lead | Lead / Architecture | .squad/agents/lead-charter.md | 🏗️ Active |
| Frontend | Frontend Dev | .squad/agents/frontend-charter.md | ⚛️ Active |
| UX | UX Designer | .squad/agents/ux-charter.md | 🎨 Active |
| Backend | Backend Dev | .squad/agents/backend-charter.md | 🔧 Active |
| Tester | Tester | .squad/agents/tester-charter.md | 🧪 Active |


## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — auto-route when enabled:**
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Boilerplate/scaffolding generation
- Documentation fixes and README updates

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- API endpoint additions following established patterns
- Migration scripts with well-defined schemas

**🔴 Not suitable — route to squad member instead:**
- Architecture decisions and system design
- Multi-system integration requiring coordination
- Ambiguous requirements needing clarification
- Security-critical changes (auth, encryption, access control)
- Performance-critical paths requiring benchmarking
- Changes requiring cross-team discussion

## Project Context

- **Project:** card-crew — Trusted Personal Resource Network (find/share cards, offers, coupons, benefits through a trusted social graph). See `docs/trusted_personal_resource_network_prd.md`.
- **Initial platform:** Lightweight web/mobile-responsive app, India-first, global-ready data model.
- **Created:** 2026-09-15
