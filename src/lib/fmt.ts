/** Convert a raw address to a human-readable label for the UI. */
export function agentLabel(address: string): string {
  if (!address || address === '') return '(mint)';
  if (address.startsWith('MAGIC_EDEN')) return 'Magic Eden';
  const m = address.match(/WALLET_(\d+)_/);
  if (m) return `Agent_${String(m[1]).padStart(2, '0')}`;
  return address.slice(0, 10);
}

/** Seconds since a Unix-ms timestamp, e.g. "42s" */
export function sinceMs(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h`;
}

/** Compact token display: 1_234_567 → "1.23M" */
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
