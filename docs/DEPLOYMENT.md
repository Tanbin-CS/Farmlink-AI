# Deployment

There are two independent layers:

1. **Guided sandbox (static):** GitHub Pages. No backend and no keys. It works on its own.
2. **Live AI sandbox (optional):** the Node API on Render, plus Postgres (Neon free tier recommended) and a Gemini API key.

The frontend falls back cleanly: if `VITE_API_BASE_URL` is empty or the API is down, the site stays fully usable in guided mode.

---

## 1. GitHub Pages (guided sandbox)

One-time setup (repository owner):

1. Go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
2. Push to `main`, or run **Actions → Deploy GitHub Pages → Run workflow**.
3. The site is published at `https://tanbin-cs.github.io/Farmlink-AI/`. The base path comes from the repository name automatically.

The workflow (`.github/workflows/pages.yml`):

1. Installs dependencies with `npm ci`.
2. Typechecks and runs the engine tests.
3. Builds `frontend/` with `VITE_BASE_PATH=/<repo>/` and `VITE_BUILD_SHA=<commit>`.
4. Secret-scans `frontend/dist`.
5. Uploads the Pages artifact and deploys it.

Acceptance checks (after deploy):

- [ ] Root page loads over HTTPS at the Pages URL.
- [ ] Assets load under `/Farmlink-AI/`.
- [ ] Refreshing `/#/cashflow` and `/#/applications` works.
- [ ] Guided mode works without any backend.
- [ ] The About page shows the deployed commit SHA.

---

## 2. Postgres (Neon free tier)

1. Create a project at neon.tech. Pick a region near Singapore if one is offered.
2. Copy the **pooled** connection string. It looks like `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`.
3. Keep it secret: it goes only into Render's environment settings, never into the repo.

The API creates its tables on startup (`create table if not exists …`).

Render's own free Postgres also works, but it expires after a limited period. Check the current Render terms before relying on it for the finals.

---

## 3. Gemini API key

1. Create a key in Google AI Studio.
2. Choose a model your account can access and that supports function calling. Set it as `MODEL_ID`. The code deliberately does not hardcode a model, so check AI Studio for the current IDs.
3. Review the free-tier quotas and data-use terms for your account and region.

---

## 4. Render (API)

Option A, Blueprint (uses `render.yaml`):

1. Render dashboard → **New → Blueprint**, then connect `Tanbin-CS/Farmlink-AI`.
2. When prompted, fill in the `sync: false` values:
   - `DATABASE_URL`: the Neon connection string.
   - `GEMINI_API_KEY`: from AI Studio.
   - `MODEL_ID`: for example, the model ID you confirmed in AI Studio.
3. Deploy. Health check: `https://<service>.onrender.com/v1/health`.

Option B, manual web service: use runtime **Node**, build command `npm ci && npm run build -w backend`, start command `node backend/dist/server.js`, health check path `/v1/health`, and the same environment variables as `render.yaml`.

### Environment variables

| Variable | Example | Secret? | Notes |
| --- | --- | --- | --- |
| `ALLOWED_ORIGINS` | `https://tanbin-cs.github.io` | no | Exact origins only, with no path. Add `http://localhost:5173` for local development. |
| `DATABASE_URL` | `postgresql://…` | **yes** | If empty, the API uses an in-memory store, which is **not durable** (health shows `durableStorage:false`). |
| `LIVE_AI_ENABLED` | `false` → `true` | no | Kill switch. Keep it `false` until the checks below pass. |
| `MODEL_PROVIDER` | `gemini` | no | |
| `MODEL_ID` | (from AI Studio) | no | |
| `GEMINI_API_KEY` | | **yes** | Never put this in a `VITE_*` variable. |
| `SESSION_TTL_MINUTES` | `120` | no | |
| `SESSIONS_PER_HOUR_GLOBAL` | `200` | no | |
| `AGENT_RUNS_PER_SESSION_PER_HOUR` | `10` | no | |
| `PROVIDER_CALLS_PER_DAY_GLOBAL` | `300` | no | Global daily cap on model calls. |
| `MAX_ROUND_TRIPS` / `MAX_TOOL_CALLS` | `3` / `6` | no | |

### Safe enablement sequence

1. Deploy with `LIVE_AI_ENABLED=false`.
2. Open `/v1/health`. Expect `status: ok`, `storage: postgres` and `durableStorage: true`.
3. Connect the frontend (step 5), start a live session, load the demo, and draft → prepare → confirm. Expect a **Server sandbox receipt**.
4. Restart the Render service and reload the page. The receipt must still be there, which proves storage is durable.
5. Set `LIVE_AI_ENABLED=true` and redeploy. Health shows `aiAvailable: true` and the model ID.
6. Run one real end-to-end chat:
   - "When will we run short of cash?"
   - "Compare the financing options."
   - "Prepare a sandbox application with the best option."
   Then confirm it in the dialog yourself.
7. Export the evidence bundle from the **Activity** page and save it to `docs/evidence/`.

Shutdown: set `LIVE_AI_ENABLED=false` (this stops model calls immediately on redeploy) or suspend the service.

Free Render instances sleep when idle. The first request can take about 50 seconds, and the UI says so.

---

## 5. Connect the frontend to the API

In GitHub, go to **Settings → Secrets and variables → Actions → Variables → New repository variable**:

- Name: `VITE_API_BASE_URL`
- Value: `https://<service>.onrender.com` (origin only, no trailing slash)

This value is public. It is **not** a secret and must not contain a key. Then re-run the **Deploy GitHub Pages** workflow.

---

## 6. Local development

```bash
npm ci
# guided frontend only
npm run dev:web                      # http://localhost:5173
# API (in-memory store, AI disabled unless configured)
cp backend/.env.example backend/.env # edit values; never commit .env
set -a && . backend/.env && set +a && npm run dev:api
# frontend against local API
VITE_API_BASE_URL=http://localhost:8080 npm run dev:web
```

Run the opt-in Postgres integration tests with:

```bash
TEST_DATABASE_URL=postgres://user@localhost:5432/farmlink_test npm test -w backend
```
