import { useRef } from 'react';
import type { HolderEntry } from '../../shared/types';
import { fmtTokens } from '../lib/fmt';
import { Panel, Empty } from './MintLog';

interface Props {
    entries: HolderEntry[];
}

type RankDelta = 'up' | 'down' | 'new' | 'same';

const RANK_COLORS = ['text-yellow-400', 'text-zinc-300', 'text-amber-600'];
const RANK_BG = ['bg-yellow-400/5', 'bg-zinc-300/5', 'bg-amber-600/5'];

export function Leaderboard({ entries }: Props) {
    const prevRanks = useRef<Map<string, number>>(new Map());

    const deltas = new Map<string, RankDelta>();
    entries.forEach((e, i) => {
        const prev = prevRanks.current.get(e.address);
        if (prev === undefined) deltas.set(e.address, 'new');
        else if (i < prev) deltas.set(e.address, 'up');
        else if (i > prev) deltas.set(e.address, 'down');
        else deltas.set(e.address, 'same');
    });
    prevRanks.current = new Map(entries.map((e, i) => [e.address, i]));

    return (
        <Panel title="Leaderboard" count={entries.length}>
            {entries.length === 0 ? (
                <Empty text="Waiting for holders…" />
            ) : (
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="text-[10px] tracking-widest text-zinc-600 uppercase">
                            <th className="w-6 pb-2 text-left">#</th>
                            <th className="pb-2 text-left">Agent</th>
                            <th className="pb-2 text-right">NFTs</th>
                            <th className="pr-1 pb-2 text-right">Tokens</th>
                            <th className="w-4 pb-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry, i) => {
                            const delta = deltas.get(entry.address) ?? 'same';
                            const podium = i < 3;
                            const rankCol = podium
                                ? RANK_COLORS[i]
                                : 'text-zinc-500';
                            const rowBg = podium ? RANK_BG[i] : '';

                            return (
                                <tr
                                    key={entry.address}
                                    className={`border-b border-zinc-800/50 last:border-0 ${rowBg}`}
                                >
                                    <td
                                        className={`py-1.5 font-bold tabular-nums ${rankCol}`}
                                    >
                                        {i + 1}
                                    </td>
                                    <td className="max-w-[80px] truncate py-1.5 font-medium text-zinc-100">
                                        {entry.name}
                                    </td>
                                    <td className="py-1.5 text-right text-zinc-400 tabular-nums">
                                        {entry.nftsHeld}
                                    </td>
                                    <td
                                        className={`py-1.5 pr-1 text-right font-bold tabular-nums ${
                                            podium ? rankCol : 'text-zinc-200'
                                        }`}
                                    >
                                        {fmtTokens(entry.tokensAllocated)}
                                    </td>
                                    <td className="w-4 py-1.5 text-center">
                                        <DeltaBadge delta={delta} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </Panel>
    );
}

function DeltaBadge({ delta }: { delta: RankDelta }) {
    if (delta === 'up')
        return <span className="text-[10px] text-emerald-400">↑</span>;
    if (delta === 'down')
        return <span className="text-[10px] text-red-400">↓</span>;
    if (delta === 'new')
        return <span className="text-[10px] text-blue-400">★</span>;
    return <span className="text-[10px] text-zinc-700">–</span>;
}
