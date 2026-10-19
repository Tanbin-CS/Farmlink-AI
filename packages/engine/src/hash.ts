/** Canonical JSON: object keys sorted recursively, no whitespace. Used for payload binding hashes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite number in canonical payload');
    if (typeof value === 'bigint') throw new Error('Serialize bigint as string before hashing');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/** SHA-256 hex using Web Crypto (available in browsers and Node 20+). */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function payloadHash(payload: unknown): Promise<string> {
  return sha256Hex(canonicalJson(payload));
}

export function randomId(prefix: string, bytes = 9): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  const b64 = btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${prefix}_${b64}`;
}
