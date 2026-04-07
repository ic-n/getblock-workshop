import type { StateSnapshot } from '../../shared/types';
import { fmtTokens } from '../lib/fmt';

interface Props {
  snapshot: StateSnapshot | null;
  connected: boolean;
}

interface StatProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function Stat({ label, value, highlight }: StatProps) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${highlight ? 'text-emerald-400' : 'text-zinc-100'}`}>
        {value}
      </span>
    </div>
  );
}

export function Navbar({ snapshot, connected }: Props) {
  const mintProgress = snapshot
    ? Math.round((snapshot.nftsMinted / snapshot.collectionSize) * 100)
    : 0;

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <span
          className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}
        />
        <span className="text-emerald-400 font-bold text-sm tracking-[0.2em] uppercase">
          NFT Indexer
        </span>
        <span className="text-zinc-600 text-xs ml-1">
          {connected ? 'live' : 'connecting…'}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-10">
        <Stat label="Slot" value={snapshot ? `#${snapshot.slot.toLocaleString()}` : '—'} />
        <Stat label="Tick" value={snapshot ? `${snapshot.tickRateMs}ms` : '—'} />
        <Stat
          label="Total tokens"
          value={snapshot ? fmtTokens(snapshot.totalTokensAllocated) : '—'}
          highlight
        />
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Minted</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums text-zinc-100">
              {snapshot ? `${snapshot.nftsMinted}/${snapshot.collectionSize}` : '—'}
            </span>
            {snapshot && (
              <div className="w-20 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${mintProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
