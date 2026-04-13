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
            <span className="text-[10px] tracking-widest text-zinc-500 uppercase">
                {label}
            </span>
            <span
                className={`text-sm font-bold tabular-nums ${highlight ? 'text-emerald-400' : 'text-zinc-100'}`}
            >
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
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-3">
            {/* Brand */}
            <div className="flex items-center gap-3">
                <span
                    className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-400' : 'bg-red-500'}`}
                />
                <span className="text-sm font-bold tracking-[0.2em] text-emerald-400 uppercase">
                    NFT Indexer
                </span>
                <span className="ml-1 text-xs text-zinc-600">
                    {connected ? 'live' : 'connecting…'}
                </span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-10">
                <Stat
                    label="Slot"
                    value={
                        snapshot ? `#${snapshot.slot.toLocaleString()}` : '—'
                    }
                />
                <Stat
                    label="Tick"
                    value={snapshot ? `${snapshot.tickRateMs}ms` : '—'}
                />
                <Stat
                    label="Total tokens"
                    value={
                        snapshot
                            ? fmtTokens(snapshot.totalTokensAllocated)
                            : '—'
                    }
                    highlight
                />
                <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] tracking-widest text-zinc-500 uppercase">
                        Minted
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-100 tabular-nums">
                            {snapshot
                                ? `${snapshot.nftsMinted}/${snapshot.collectionSize}`
                                : '—'}
                        </span>
                        {snapshot && (
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-700">
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
