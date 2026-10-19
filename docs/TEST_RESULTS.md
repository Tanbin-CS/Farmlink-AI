# Test results

These are the actual results of commands run on 2026-10-19/20 (UTC). The first rows reflect the redesign commit; the CI link below is for the earlier commit. Re-run them with the commands below. A test is listed as passed only if it actually ran.

| Suite | Command | Result |
| --- | --- | --- |
| Engine unit tests | `npm test -w packages/engine` | **31 passed** (adds currencies, display FX, scenarios, stress test) |
| Frontend unit tests (guided client) | `npm test -w frontend` | **5 passed** |
| API safety tests (in-memory store, mock model provider) | `npm test -w backend` | **25 passed**, 2 skipped (Postgres tests need `TEST_DATABASE_URL`) |
| Postgres integration (real PostgreSQL 16, local) | `TEST_DATABASE_URL=… npm test -w backend` | **25 passed** (23 API + 2 Postgres) on the earlier commit `e715f2a`; the 2 new currency/stress API tests run in memory |
| Browser e2e (Playwright, Chromium, desktop + Pixel 7) | `npm run e2e -w frontend` | **10 passed** (guided flow, copilot, what-if, welcome tour + command palette, chart drill-down) |
| Typecheck / lint / build | `npm run typecheck && npm run lint && npm run build` | pass |
| Secret scan | `node scripts/secret-scan.mjs . frontend/dist` | pass |
| GitHub Actions CI (all of the above except Postgres) | `.github/workflows/ci.yml` | **success** on `e715f2a` ([run 39318293600](https://github.com/Tanbin-CS/Farmlink-AI/actions/runs/39318293600)) |
| Live-mode UI against the local API + Postgres (manual Playwright script) | see below | pass: live session, demo, draft, human confirm, "Server sandbox receipt" shown; chat showed an honest error because model calls were disabled |
| **Live Gemini end-to-end** | needs `GEMINI_API_KEY` + `MODEL_ID` | **NOT RUN.** No key was available to the build agent. Run this with the deployment steps and record the result here. |

## Engine (23)

- Money: exact major→minor parsing, rejection of invalid or oversized input, integer half-up rounding, lakh grouping.
- Dates: leap years, invalid dates, calendar arithmetic with no time-zone dependence.
- Cash flow:
  - empty workspace;
  - no negative forecast gives a zero gap;
  - a known shortfall gives the exact earliest date and gap;
  - cancelled, past, overdue and after-window events are handled exactly once;
  - opening cash is never double-counted;
  - same-day netting;
  - duplicate IDs are rejected.
- Financing:
  - exact fee and interest;
  - minimum principal search, including proof that P−1 is insufficient;
  - fees push the principal above the gap;
  - all eight demo products reach their documented outcome (fits ×2, delayed disbursement, shortage after repayment, incomplete horizon, missing terms, funding cap, unsupported structure);
  - a delayed disbursement cannot cover an earlier deficit;
  - with no gap, nothing is recommended;
  - missing evidence gives `needs_information`;
  - output is deterministic.
- CSV and validation: batch validation with row errors and duplicates; formula-injection neutralization on export; bundle duplicate detection.

## API safety tests (23 + 2 Postgres)

These map one-to-one to the specification's "Safety and state integrity" table:

| Spec test | Test name | Observed |
| --- | --- | --- |
| Malicious instruction inside record text | `prompt injection inside record text does not cause unauthorized actions` | `approve_loan` rejected; out-of-schema args rejected; no application created |
| User requests another session's records | `another session cannot read or confirm a different session's action` | 404 with no ID echoed; empty workspace for the other session |
| Model proposes an unknown tool | `rejects unknown tools (including an attempted confirm) and never submits` | both rejected and logged; nothing submitted |
| Submit without pending action/confirmation | `requires an idempotency key and ignores forged approval flags` | 400; status stays AWAITING_CONFIRMATION |
| Change after review | `a change after review makes the action stale` | 409 STALE_DRAFT; rejection logged |
| Expired action or session | `expired actions are denied`; `expired sessions are denied…` | 409 ACTION_EXPIRED; 401 SESSION_EXPIRED |
| Double-click / lost-response retry | `concurrent double-click with the same key…` | one submission, same receipt ×3; different key gets 409 |
| Parallel idempotency requests (durable DB) | `commits one submission under parallel confirmation and survives a restart` (Postgres) | 3 parallel confirms give 1 receipt |
| Forged role / workspace ID / approved flag | `ignores client-supplied workspace ownership fields`; forged flag test | ignored |
| Model/API outage | `model outage returns an error without inventing a response` | 503 PROVIDER_ERROR; run stored as failed |
| Exhausted quota | `exhausted quota sends no further provider request`; `global provider budget…`; `kill switch…` | 429 / limit_reached / 503; provider call count verified |
| Cloud instance restart | Postgres restart test | the receipt is read back through a new pool |
| HTML/script in description | `stores HTML in descriptions as inert text` | stored verbatim as JSON; the UI renders text only |
| CSV formula payload | engine CSV test | `'=` prefix |
| Local-to-cloud switch | manual live-mode check | a fresh session is created; copying needs an explicit checkbox (default off) |
| Secret scan and bundle review | CI step | pass |

Also tested: CORS exact origin, oversized and non-JSON bodies, invalid tool arguments, API vs engine parity (canonical JSON equality).

## Browser e2e (4)

- `guided sandbox: demo → cash flow → financing → draft → confirm → receipt → evidence` (desktop and mobile): checks the truth banner, a hash-route refresh, that confirm is disabled until the review checkbox is ticked, the "Local sandbox receipt — browser only" label, the evidence download and the About page SHA.
- `guided copilot buttons run deterministic tools and log events` (desktop and mobile).

These are smoke tests, not proof that every security threat is solved.
