# FarmLink AI

**A sandbox SME finance copilot for agricultural cooperatives and small agribusinesses in Bangladesh.**
Built for the **2026 Shenzhen International FinTech Competition (FinTechathon), International Track, Topic E: SME Finance Copilot.** Theme: *AI as a Financial Participant*.

> **Competition prototype. Sandbox only. No real loan, payment, or lender submission.**

- **Live site (guided sandbox):** https://tanbin-cs.github.io/Farmlink-AI/ (after GitHub Pages is enabled; see [Deployment](docs/DEPLOYMENT.md))
- **Live AI API:** optional, deployed separately on Render (see [Deployment](docs/DEPLOYMENT.md))

## The problem

Cooperatives buy seed, fertilizer, and labour weeks before harvest receipts arrive. That leaves a predictable but rarely quantified cash gap. Financing decisions are made without a dated forecast, and options are compared by headline rate instead of what they cost to cover *this* gap, *on time*, and *repay from this season's cash*.

## What FarmLink AI does

1. **Records → forecast.** You enter or import dated cash records, and the copilot projects daily closing cash. It flags low-cash and negative-cash days, the first shortfall date, and the funding gap.
2. **Gap → financing match.** For each option it finds the smallest principal whose net proceeds cover the gap. It checks that funds arrive in time and re-projects cash with the repayment included. Each option is classed as **fits stated sandbox rules**, **does not fit**, or **needs information**, with explicit reason codes.
3. **Match → consented sandbox application.** The copilot drafts an application and freezes the exact payload (SHA-256, 5-minute expiry). It then **stops**. Only a human pressing *Confirm* after reviewing the shared fields can submit to the internal lender simulator. Every step is logged and can be exported as evidence.

### Two honest modes

| Mode | Header | What runs |
| --- | --- | --- |
| Guided sandbox | **"Guided sandbox — no live AI"** | Deterministic tools in your browser (IndexedDB). No model and no backend. Receipts say "Local sandbox receipt — browser only". |
| Live AI | **"Live AI + sandbox tools"** | A Gemini function-calling agent on a separate API proposes allowlisted tools. Server code validates and executes them, enforces sessions, quotas, and confirmation, and writes durable receipts in Postgres. |

## Scoring alignment

| Criterion | How it is addressed |
| --- | --- |
| **Task completion (40%)** | End-to-end financial task: records → cash-flow alerts → financing comparison → draft → human-confirmed sandbox submission → receipt → evidence export. Deterministic, tested engine. |
| **Security & compliance (30%)** | Permission tiers; no model-callable confirm; allowlist and schema validation; payload binding, expiry, idempotency; session isolation; quotas and kill switch; prompt-injection tests; secret scanning; truth labels. See [SECURITY_ASSESSMENT](docs/SECURITY_ASSESSMENT.md). |
| **Innovation & interaction (30%)** | One shared integer-money engine powers both the browser and the agent. The run timeline shows every tool proposal and policy decision. Reason-coded financing explanations. Mobile-friendly, with an accessible chart and table. |

## Quick start

```bash
npm ci
npm run dev:web          # guided mode at http://localhost:5173
npm test                 # engine + frontend + API tests
npm run e2e -w frontend  # Playwright (needs Chromium)
```

To run the live API locally:

```bash
cp backend/.env.example backend/.env   # set ALLOWED_ORIGINS, optionally DATABASE_URL / GEMINI_API_KEY / MODEL_ID / LIVE_AI_ENABLED=true
set -a && . backend/.env && set +a && npm run dev:api
VITE_API_BASE_URL=http://localhost:8080 npm run dev:web
```

**Environment variables:**

- Frontend (public): `VITE_BASE_PATH`, `VITE_API_BASE_URL`, `VITE_BUILD_SHA`, `VITE_REPO_URL`.
- Backend: see [`backend/.env.example`](backend/.env.example). **No secret ever goes in a `VITE_*` variable.**

## Repository

```
packages/engine   shared deterministic finance engine (money, dates, cash flow, financing, applications, CSV)
frontend          React + Vite + TS + Tailwind + shadcn-style UI, HashRouter, GitHub Pages
backend           Express API: sessions, Postgres store, quotas, agent loop, Gemini adapter
docs              architecture, deployment, security, tests, provenance, limitations, demo script, checklist
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): components, algorithms, agent sequence, trust boundaries
- [Deployment](docs/DEPLOYMENT.md): GitHub Pages, Render, Neon, Gemini, safe enablement
- [Security self-assessment](docs/SECURITY_ASSESSMENT.md): permission tiers, controls, known risks
- [Test results](docs/TEST_RESULTS.md): actual commands and outcomes
- [Data provenance](docs/DATA_PROVENANCE.md) · [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Demo script](docs/DEMO_SCRIPT.md) · [Submission checklist](docs/SUBMISSION_CHECKLIST.md)
- [Prior work](PRIOR_WORK.md) · [License decision](LICENSE-DECISION.md)

## Not included

There are no real loans, payments, lender integrations, approvals, identity or KYC checks, credit bureau or government APIs, blockchain, credentials, or crop and price predictions. Nothing here implies endorsement by any bank, lender, agency, or the organizers.
