# Known limitations

## Financial model
- Cash-based daily projection only. It does not model accruals, inventory, or profit, and a cash surplus is not described as profit.
- Same-day inflows and outflows are netted at day end. Intraday liquidity is not estimated.
- The only supported financing structure is simple annual interest, an optional upfront fee (percentage plus fixed amount), and one bullet repayment. Reducing-balance, compounding, variable-fee, and insurance-bundled products are marked unsupported.
- The funding target is zero cash (the largest cumulative shortfall). The buffer shortfall is reported but is not financed automatically.
- If the forecast ends before a loan's maturity, the result is "Repayment assessment incomplete" rather than a pass.
- "Fits" means the option fits the stated sandbox rules. It is not a lender approval or a creditworthiness assessment. No default probabilities, crop-yield forecasts, or price forecasts are produced.
- Currencies are BDT, USD, EUR and CNY. Amounts are never converted inside calculations, and the "≈" equivalents use static, user-editable reference rates rather than live market data. The interface is in English; Bengali is future work.
- Stress scenarios are fixed presets or user sliders. They are assumptions, not forecasts of harvest timing or prices.

## Product scope
- Lenders are simulated. SANDBOX_SUBMITTED means only that the internal simulator received the application.
- There is no identity verification, KYC, NID/Farmer Card integration, credit bureau, government API, payment, or disbursement.
- The original FarmLink roadmap items (Hyperledger, DIDs/VCs, ZKPs, marketplace) are not implemented.
- Supporting evidence can only be marked as available. Files are never uploaded.

## Platform
- Guided mode stores data in browser IndexedDB, and the user can edit or clear it.
- Live mode depends on free hosting (Render cold starts of about 50 s) and on the Gemini quota available to the team's account.
- Sessions are anonymous bearer capabilities that expire after 2 hours by default. They are not user accounts.
- Live-model behavior is not tested in CI, which avoids paid calls. Mocked tests do not prove real-model quality.
- Quotas use fixed time windows, so bursts at a window edge can briefly reach up to twice a limit.
