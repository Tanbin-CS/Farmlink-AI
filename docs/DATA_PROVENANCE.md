# Data provenance

| Dataset | Location | Classification | Origin | License |
| --- | --- | --- | --- | --- |
| Demo cooperative profile and 16 cash records | `packages/engine/src/demo.ts` | `sandbox_fixture` | Written by the team as **fictional software test input**. Dates are relative to the as-of date. | Same as repository code |
| Demo financing catalog (8 products, "Sandbox Lender Alpha … Theta (fictional)") | `packages/engine/src/demo.ts` | `sandbox_product` | **Invented** terms designed to exercise each engine outcome (fits, delayed disbursement, funding cap, missing terms, incomplete horizon, unsupported structure, shortage after repayment). | Same as repository code |
| Unit-test fixtures | `packages/engine/test`, `backend/test` | software fixtures | Invented | Same as repository code |

| Default display reference rates | `packages/engine/src/fx.ts` | display-only assumption | USD: Bangladesh Bank USD/BDT reference rate, 19 Oct 2026 (123.7054), from bb.org.bd. EUR: derived with EUR/USD ≈ 1.1221 (approximate). Users can edit both. | Public data |
| USD and EUR demo variants | `packages/engine/src/demo.ts` | `sandbox_fixture` | The BDT story with every amount divided by a fixed round factor (125 or 140). These factors are scenario-authoring choices, not exchange rates. | Same as repository code |

## What is **not** in this project

- No real farm balances, sales, yields, or market statistics.
- No real lender names, logos, rates, or offers. No product is presented as currently available in Bangladesh.
- No personal data, identity documents, or bank details.

## Rules for adding data

- Real public products may be added only as `classification: "public_reference"` with `sourceUrl` and `retrievedAt`. Missing fees or rates must be `null` (the engine then reports `needs_information` and never ranks them as cheapest).
- Owner-supplied records must be redacted and approved before use in public demos; mark the workspace `provenance` accordingly.
