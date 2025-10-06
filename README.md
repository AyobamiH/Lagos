# Ride Hailing Frontend

React + Vite TypeScript SPA for rider & (simulated) driver journeys: authentication, feedback, ride request, quote-based request, realtime ride status, diagnostics overlay (gated), and performance budget enforcement.

## Current Feature Set
- Auth: signup/login/logout, profile fetch, token persisted in localStorage.
- Feedback: optimistic create, edit, delete with rate-limit cooldown awareness.
- Ride Flows: direct request, quote retrieval + signed request, ride list with pagination, ride detail + cancel.
- Realtime: Socket.IO ride status updates with polling fallback (8s) if socket unavailable.
- Driver Panel: Simulated offers & accept/decline (role gated, hidden unless `profile.role === 'driver'`).
- Diagnostics Overlay: Latency + event loop + p95 metrics (only fetches if `VITE_ENABLE_DIAGNOSTICS=true`).
- Toasts: Global notification system (errors, offline, session expiry, actions).
- Performance Budget: Build script checks main bundle gzip size (`perfBudget.maxMainGzipBytes`).

## Environment Variables (.env)
```
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_ENABLE_DIAGNOSTICS=false
```
Set diagnostics flag to `true` only for trusted operator sessions; otherwise overlay does not fetch to reduce load & leak risk.

## Install / Run
```
npm install
npm run dev
```
App runs at http://localhost:5173 by default.

## Scripts
| Script | Purpose |
|--------|---------|
| `dev` | Start Vite dev server |
| `build` | Production build (code splitting) |
| `test` | Run Vitest tests once |
| `test:watch` | Watch mode tests |
| `ci:perf` | Build + performance budget check |

## Unified API Layer
Located in `src/api/client.ts`:
- Central retry for idempotent GET (network + 502/503/504 backoff).
- Offline detection throws `{ status:0, error:'offline' }` and surfaces toast.
- Hooks for 401 -> logout + session expired toast, generic errors -> toasts.

## Role-Based Access
`profile.role` (expected: `rider` or `driver`). Driver navigation link hidden unless driver. Driver route still guard-checks role for defense in depth.

## Realtime Fallback Logic
1. Attempt Socket.IO connection.
2. If socket missing/disconnected, poll `/rides?limit=10` every 8s (throttled by last connection attempt) to update statuses.

## Testing Coverage (current)
- Auth flows (signup, login).
- Feedback submission (optimistic path).
- Rides pagination + realtime status merge.

Planned: quote flow, map click toggling, offline mode, diagnostics gating, toast TTL.

## Performance Budget
Configured in `package.json` under `perfBudget.maxMainGzipBytes` (currently 130 KB). Script: `npm run ci:perf`.
Extensible to aggregate critical path bundles in future iteration.

## Accessibility (in progress)
- Needs formal labels (`htmlFor`) & aria-label for toast close button.
- MapPicker keyboard fallback (currently manual coordinate inputs only).
- Overlay focus management pending.

## Security Considerations
- Diagnostics fetching fully disabled unless flag enabled.
- Role gating for driver features.
- Future: move to refresh + httpOnly cookie tokens.

## Known Gaps / Roadmap (Phase 2+)
See internal gap analysis: additional tests, RUM metrics, improved a11y, lazy MapPicker import, event sequencing guard, expanded perf budget, offline banner, consolidated state reset on logout.

---
Updated under Phase 1 hardening implementation.
# Lagos
