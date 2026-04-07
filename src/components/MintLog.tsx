import type { NFTEvent } from '../types';
import { agentLabel } from '../lib/fmt';

interface Props {
  events: NFTEvent[];
}

export function MintLog({ events }: Props) {
  return (
    <Panel title="Mint Log" count={events.length}>
      {events.length === 0 ? (
        <Empty text="Waiting for mints…" />
      ) : (
        events.map((e, i) => (
          <div
            key={`${e.nftId}-${e.slot}-${i}`}
            className="flex items-start gap-2 py-1.5 border-b border-zinc-800/50 last:border-0"
          >
            <span className="text-emerald-400 text-xs mt-0.5 shrink-0">✦</span>
            <div className="min-w-0">
              <p className="text-xs text-zinc-100 truncate">
                <span className="text-emerald-400">{agentLabel(e.to)}</span>
                {' '}minted{' '}
                <span className="text-zinc-300">{e.nftName}</span>
              </p>
              <p className="text-[10px] text-zinc-600">slot {e.slot}</p>
            </div>
          </div>
        ))
      )}
    </Panel>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────

interface PanelProps {
  title: string;
  count?: number;
  children: React.ReactNode;
}

export function Panel({ title, count, children }: PanelProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-800/40 flex items-center justify-between shrink-0">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{title}</h2>
        {count !== undefined && (
          <span className="text-[10px] text-zinc-600 tabular-nums">{count}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0 min-h-0">
        {children}
      </div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-zinc-600 text-xs">{text}</p>
    </div>
  );
}
