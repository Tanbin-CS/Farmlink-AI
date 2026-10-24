# FarmLink AI

**A sandbox SME finance copilot for agricultural cooperatives and small agribusinesses in Bangladesh.**
Built for the **2026 Shenzhen International FinTech Competition (FinTechathon), International Track, Topic E: SME Finance Copilot.** Theme: *AI as a Financial Participant*.

> **Competition prototype. Sandbox only. No real loan, payment, or lender submission.**

- **Live site (guided sandbox):** https://tanbin-cs.github.io/Farmlink-AI/
- **Explainer video (1 min 51 s):** https://youtu.be/In0M4g6hLow
- **Live AI API:** https://farmlink-api-kfvi.onrender.com/v1/health (Render; see [Deployment](docs/DEPLOYMENT.md))
- **Technical document:** [docs/submission/](docs/submission/) (official template, DOCX and PDF)

**Team FarmLink**, American International University-Bangladesh (AIUB): Md. Tanbin Islam (leader) and Md. Rifat Ul Islam.

## The problem

Cooperatives buy seed, fertilizer, and labour weeks before harvest receipts arrive. That leaves a predictable but rarely quantified cash gap. Financing decisions are made without a dated forecast, and options are compared by headline rate instead of what they cost to cover *this* gap, *on time*, and *repay from this season's cash*.

## What FarmLink AI does

1. **Records → forecast.** You enter or import dated cash records, and the copilot projects daily closing cash. It flags low-cash and negative-cash days, the first shortfall date, and the funding gap.
2. **Gap → financing match.** For each option it finds the smallest principal whose net proceeds cover the gap. It checks that funds arrive in time and re-projects cash with the repayment included. Each option is classed as **fits stated sandbox rules**, **does not fit**, or **needs information**, with explicit reason codes.
3. **Stress test → resilient choice.** For each fitting option the drafted loan is held fixed and checked against a harvest delay, lower sales, higher costs, and a combined shock. A what-if panel lets users test their own scenarios, and they can choose to borrow enough to keep their minimum cash buffer.
4. **Match → consented sandbox application.** The copilot drafts an application and freezes the exact payload (SHA-256, 5-minute expiry). It then **stops**. Only a human pressing *Confirm* after reviewing the shared fields can submit to the internal lender simulator. Every step is logged and can be exported as evidence.

### International by design

- Workspaces can be in **BDT, USD, EUR, or CNY (Chinese yuan)**. A fictional demo is available in each currency.
- Products in another currency are never compared silently; they get a `CURRENCY_MISMATCH` reason instead.
- Every amount can also show an **approximate equivalent** in another currency, at an editable reference rate. The default is the Bangladesh Bank USD/BDT reference rate for 19 Oct 2026. This is for display only and never feeds a calculation.
- Numbers use international grouping (1,234,567) by default, with lakh grouping (12,34,567) as an option.

### Designed to be easy to use

- **A guided five-step journey**: profile → records → forecast → financing → apply. The sidebar shows progress, and on mobile the steps become an app-style bottom tab bar.
- **A welcome tour** the first time the demo loads. It tells the cooperative's story with live numbers and can be skipped.
- **Command palette (Ctrl/⌘ K)** to jump to any page or run quick actions such as loading a demo or switching currency.
- **Interactive forecast**: click any day on the chart to see the money moving that day. What-if sliders and presets overlay a scenario line.
- **Plain-language glossary tooltips** on finance terms (funding gap, net cash, stress test, payload hash…).
- **Motion that respects users:** Lenis smooth scrolling, page transitions, count-up figures, scroll reveals, and a small celebration when a sandbox submission is confirmed. All of it is disabled for users who prefer reduced motion.

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
| **Innovation & interaction (30%)** | One shared integer-money engine powers both the browser and the agent. Repayment stress tests and an interactive what-if panel. A guided five-step journey with a progress sidebar. The run timeline shows every tool proposal and policy decision. Reason-coded explanations. Multi-currency display. Mobile app layout with a bottom tab bar; accessible chart plus table. |

## Quick start

Needs Node.js 22.

```bash
git clone https://github.com/Tanbin-CS/Farmlink-AI.git
cd Farmlink-AI
npm install              # on Windows/macOS use npm install, not npm ci (see note below)
npm run dev:web          # guided mode at http://localhost:5173
npm test                 # engine + frontend + API tests
npm run e2e -w frontend  # Playwright (needs Chromium)
```

The lock file is generated on Linux, where CI runs `npm ci`. On Windows or macOS, some npm versions reject it with `EUSAGE … @emnapi/* … Missing from lock file`. Those packages are optional WebAssembly fallbacks of Tailwind. `npm install` resolves them for your platform; do not commit the resulting lock-file changes.

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
