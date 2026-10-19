# Execution evidence

Each file is an unedited export from **Activity → Export evidence bundle**.

| File | Mode | How it was produced | Notes |
| --- | --- | --- | --- |
| `2026-10-19-guided-local-run.json` | `guided_local` (Guided sandbox — no live AI) | Automated Playwright run against a production build (preview server) of `ea43b5b` plus the financing-table layout change later committed as `b7d23b1` (UI layout only; engine and workflow code identical): load demo → draft from financing → prepare → confirm → export | Local logs can be edited by the browser user. No model was involved. |
| `2026-10-19-live-cloud-gemini-run.json` | `live_cloud` (Live AI + sandbox tools) | A real run by the team on the public site (GitHub Pages) against the Render API, backend commit `6eb18c4`, model `gemini-3.8-flash`, 19 Oct 2026 22:10–22:13 UTC. It is the unedited export. | Three chat turns: (1) when cash runs short; (2) compare financing and stress-test the cheapest option; (3) prepare an application. The model called `calculate_cashflow`, `match_financing_options`, `run_stress_test`, `create_application_draft`, and `prepare_sandbox_submission`, then **stopped** at `awaiting_confirmation`. The human confirmed in the review dialog, producing receipt `rcpt_dlFmbi2JgE7l`. The model's reply figures match the tool outputs. The API used in-memory storage for this run (no `DATABASE_URL`). |

The `contentHash` in each bundle is a SHA-256 of the canonical JSON body: an integrity aid for the export, not an independent attestation.
