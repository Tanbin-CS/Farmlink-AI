# Execution evidence

Each file is an unedited export from **Activity → Export evidence bundle**.

| File | Mode | How it was produced | Notes |
| --- | --- | --- | --- |
| `2026-10-19-guided-local-run.json` | `guided_local` (Guided sandbox — no live AI) | Automated Playwright run against a production build of commit `ea43b5b` (preview server): load demo → draft from financing → prepare → human-style confirm → export | Local logs can be edited by the browser user. No model was involved. |
| *(pending)* `YYYY-MM-DD-live-cloud-run.json` | `live_cloud` (Live AI + sandbox tools) | Record after deploying the API with a real Gemini key ([DEPLOYMENT.md](../DEPLOYMENT.md) step "Safe enablement") | Must include real run IDs, model ID, tool events, receipt. Do not backfill. |

The `contentHash` in each bundle is a SHA-256 of the canonical JSON body: an integrity aid for the export, not an independent attestation.
