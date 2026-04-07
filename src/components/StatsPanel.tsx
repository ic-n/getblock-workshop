import type { StateSnapshot } from '../../shared/types';
import type { Stats } from '../hooks/useStats';
import { fmtTokens } from '../lib/fmt';
import { Panel } from './MintLog';

interface Props {
  stats: Stats;
  snapshot: StateSnapshot | null;
}

export function StatsPanel({ stats, snapshot }: Props) {
  const total = stats.totalEvents || 1; // avoid div/0 for progress bars
  const soldOut = snapshot && snapshot.nftsMinted >= snapshot.collectionSize;

  return (
    <Panel title="Stats">
      {/* ── Event counts ──────────────────────────────── */}
      <Section label="Events">
        <BigStat label="Total" value={stats.totalEvents} />
        <EventRow icon="✦" label="Mints"     count={stats.byType.MINT}     total={total} color="text-emerald-400" />
        <EventRow icon="↑"  label="Lists"    count={stats.byType.LIST}     total={total} color="text-amber-400"   />
        <EventRow icon="↓"  label="Unlists"  count={stats.byType.UNLIST}   total={total} color="text-zinc-400"    />
        <EventRow icon="⚡" label="Sales"    count={stats.byType.PURCHASE} total={total} color="text-violet-400"  />
      </Section>

      {/* ── Averages ──────────────────────────────────── */}
      <Section label="Averages">
        <MetricRow
          label="Hold time"
          value={stats.avgHoldTimeSec !== null ? `${stats.avgHoldTimeSec.toFixed(1)}s` : '—'}
        />
        <MetricRow
          label="NFTs / holder"
          value={stats.avgNftsPerHolder > 0 ? stats.avgNftsPerHolder.toFixed(2) : '—'}
        />
        <MetricRow
          label="Tokens / holder"
          value={stats.avgTokensPerHolder > 0 ? fmtTokens(Math.floor(stats.avgTokensPerHolder)) : '—'}
        />
      </Section>

      {/* ── Market status ─────────────────────────────── */}
      {snapshot && (
        <Section label="Market">
          <MetricRow
            label="Listed now"
            value={String(snapshot.marketplace.length)}
          />
          <MetricRow
            label="Mint progress"
            value={`${snapshot.nftsMinted} / ${snapshot.collectionSize}`}
          />
          <MetricRow
            label="Phase"
            value={soldOut ? 'Secondary' : 'Primary'}
            highlight={soldOut ? 'text-violet-400' : 'text-emerald-400'}
          />
        </Section>
      )}
    </Panel>
  );
}

// ── Primitives ─────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">{label}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-2xl font-bold tabular-nums text-zinc-100">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function EventRow({
  icon, label, count, total, color,
}: {
  icon: string; label: string; count: number; total: number; color: string;
}) {
  const pct = Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className={`${color} w-3 text-center text-[11px] shrink-0`}>{icon}</span>
      <span className="text-zinc-400 text-xs w-14 shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-1 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(color)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-zinc-300 text-xs tabular-nums w-8 text-right shrink-0">{count}</span>
    </div>
  );
}

function MetricRow({
  label, value, highlight,
}: {
  label: string; value: string; highlight?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500 text-xs">{label}</span>
      <span className={`text-xs font-bold tabular-nums ${highlight ?? 'text-zinc-200'}`}>
        {value}
      </span>
    </div>
  );
}

// Map Tailwind text color → bg color for progress bars
function barColor(textColor: string) {
  if (textColor.includes('emerald')) return 'bg-emerald-500';
  if (textColor.includes('amber'))   return 'bg-amber-500';
  if (textColor.includes('violet'))  return 'bg-violet-500';
  return 'bg-zinc-500';
}
