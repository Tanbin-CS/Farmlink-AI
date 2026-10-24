// Exports the demo cooperative's real daily cash projection for the explainer chart.
import { writeFileSync } from 'node:fs';
import { demoEvents, demoWorkspace, projectCashflow } from '../../packages/engine/src/index';

const asOf = '2026-10-20';
const r = projectCashflow(demoWorkspace(asOf), demoEvents(asOf));
const days = r.days.map((d) => ({ date: d.date, closing: Number(d.closingMinor) / 100 }));
writeFileSync(process.argv[2], JSON.stringify({ earliestNegativeDate: r.earliestNegativeDate, fundingGap: Number(r.fundingGapMinor) / 100, minDate: r.minClosingDate, days }, null, 1));
console.log(r.earliestNegativeDate, r.fundingGapMinor, r.minClosingDate, days.length);
