import type { NFTEvent } from '../../shared/types';
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
                        className="flex items-start gap-2 border-b border-zinc-800/50 py-1.5 last:border-0"
                    >
                        <span className="mt-0.5 shrink-0 text-xs text-emerald-400">
                            ✦
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-xs text-zinc-100">
                                <span className="text-emerald-400">
                                    {agentLabel(e.to)}
                                </span>{' '}
                                minted{' '}
                                <span className="text-zinc-300">
                                    {e.nftName}
                                </span>
                            </p>
                            <p className="text-[10px] text-zinc-600">
                                slot {e.slot}
                            </p>
                        </div>
                    </div>
                ))
            )}
        </Panel>
    );
}



interface PanelProps {
    title: string;
    count?: number;
    children: React.ReactNode;
}

export function Panel({ title, count, children }: PanelProps) {
    return (
        <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-800/40 px-4 py-2.5">
                <h2 className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">
                    {title}
                </h2>
                {count !== undefined && (
                    <span className="text-[10px] text-zinc-600 tabular-nums">
                        {count}
                    </span>
                )}
            </div>
            <div className="min-h-0 flex-1 space-y-0 overflow-y-auto px-4 py-2">
                {children}
            </div>
        </div>
    );
}

export function Empty({ text }: { text: string }) {
    return (
        <div className="flex h-full items-center justify-center">
            <p className="text-xs text-zinc-600">{text}</p>
        </div>
    );
}
