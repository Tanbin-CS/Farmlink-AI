# Submission checklist (deadline: 20 Oct 2026, 23:59 Beijing = 15:59 UTC = 21:59 Dhaka)

Follow the stricter combined package. Upload early, because updates are allowed until the deadline.

| # | Item | Status | Where / notes |
| --- | --- | --- | --- |
| 1 | Technical documentation (architecture, core algorithm, security design) | Done, fill in team name | `docs/submission/FarmLink-AI-Technical-Document.docx` (the official template, filled in) and `.pdf`; sources: `docs/ARCHITECTURE.md`, `docs/SECURITY_ASSESSMENT.md` |
| 2 | Presentation deck (≤ 10 min, English) | To do | Problem → Topic E fit → demo flow → architecture → agent guardrails → tests → limits/roadmap |
| 3 | Demo video (≤ 5 min, English) | To record | `docs/DEMO_SCRIPT.md`. Must show a real end-to-end run and one blocked unsafe action |
| 4 | Source code with README, GitHub link, deployment instructions, test cases | Done | https://github.com/Tanbin-CS/Farmlink-AI. Fill in the official README template if required |
| 5 | Security self-assessment (permission tiers, known risks) | Done | `docs/SECURITY_ASSESSMENT.md` |
| 6 | Execution evidence (sandbox logs + video) | Logs done; video to record | `docs/evidence/2026-10-19-live-cloud-gemini-run.json` (live Gemini) and `docs/evidence/2026-10-19-guided-local-run.json` (guided). The video is still needed |
| 7 | Registration form + student/identity proof | Owner | Submit privately to the organizer. Never commit it to the repo |
| 8 | Team eligibility (2–5 students; ≥ 60% non-Chinese nationals; overseas institutions) | Owner to verify | |
| 9 | Prior-work disclosure | Done | `PRIOR_WORK.md`. Confirm with coauthors and organizers |
| 10 | License decision | Pending owner | `LICENSE-DECISION.md` |
| 11 | GitHub Pages enabled + URL verified | Done | https://tanbin-cs.github.io/Farmlink-AI/ |
| 12 | Live API deployed (optional but recommended) | Done: Render free plan + Neon Postgres (durable), `gemini-3.8-flash`. Health confirmed on backend `99a5fea` | https://farmlink-api-kfvi.onrender.com/v1/health |
| 13 | Release tag recorded | After final checks | `v0.2.0-prototype`; record the SHA in the evidence |
