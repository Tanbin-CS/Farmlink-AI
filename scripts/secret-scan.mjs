// Minimal committed-secret and built-bundle scan. Fails on likely provider keys or private keys.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['.'];
const skip = new Set(['node_modules', '.git', 'test-results', 'playwright-report']);
const patterns = [
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/sk-ant-[0-9A-Za-z_-]{20,}/, 'Anthropic API key'],
  [/sk-[A-Za-z0-9]{32,}/, 'OpenAI-style API key'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'Private key'],
  [/ghp_[0-9A-Za-z]{36}/, 'GitHub token'],
  [/postgres(ql)?:\/\/[^\s'"]+:[^\s'"@]+@/, 'Database URL with password'],
  [/"type":\s*"service_account"/, 'GCP service account JSON'],
];
let findings = 0;
function walk(p) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const f of readdirSync(p)) if (!skip.has(f)) walk(join(p, f));
    return;
  }
  if (st.size > 5_000_000 || /\.(png|jpg|pdf|ico|woff2?)$/i.test(p)) return;
  const text = readFileSync(p, 'utf8');
  for (const [re, label] of patterns) {
    if (re.test(text)) {
      console.error(`Possible ${label}: ${p}`);
      findings++;
    }
  }
}
for (const r of roots) walk(r);
if (findings) {
  console.error(`${findings} possible secret(s) found.`);
  process.exit(1);
}
console.log(`Secret scan passed (${roots.join(', ')}).`);
