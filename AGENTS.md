# Guidance for coding agents

- Monorepo with npm workspaces: `packages/engine` (shared deterministic finance engine), `frontend` (Vite + React + TS + Tailwind, GitHub Pages), `backend` (Express + TS live API for Render).
- All money is an integer minor-unit **string** at boundaries and `bigint` inside the engine. Never use floating point for money. Dates are civil `YYYY-MM-DD` strings.
- Financial results must come from `@farmlink/engine`, never from model text. The browser and API import the same engine.
- The model may only call allowlisted tools in `backend/src/agent/tools.ts`. There is no model-callable confirm/approve/transfer tool. Confirmation goes through `POST /v1/actions/:id/confirm` only.
- Never add secrets to `VITE_*` variables, the repo, or logs. Provider keys live only in the backend environment.
- Keep truth labels intact: guided mode must say "Guided sandbox — no live AI"; do not describe canned output as AI.
- Before committing: `npm run typecheck && npm run lint && npm test && npm run build`. Do not mark tests as passed unless they ran.
- Do not fabricate commit dates, test results, user counts, partnerships, or lender terms.
