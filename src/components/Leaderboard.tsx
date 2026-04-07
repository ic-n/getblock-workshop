import { useRef } from 'react';
import type { HolderEntry } from '../types';
import { fmtTokens } from '../lib/fmt';
import { Panel, Empty } from './MintLog';

interface Props {
  entries: HolderEntry[];
}

type RankDelta = 'up' | 'down' | 'new' | 'same';

const RANK_COLORS = ['text-yellow-400', 'text-zinc-300', 'text-amber-600'];
const RANK_BG    = ['bg-yellow-400/5', 'bg-zinc-300/5', 'bg-amber-600/5'];

export function Leaderboard({ entries }: Props) {
  const prevRanks = useRef<Map<string, number>>(new Map());

  // Compute rank deltas vs previous snapshot
  const deltas = new Map<string, RankDelta>();
  entries.forEach((e, i) => {
    const prev = prevRanks.current.get(e.address);
    if (prev === undefined)      deltas.set(e.address, 'new');
    else if (i < prev)           deltas.set(e.address, 'up');
    else if (i > prev)           deltas.set(e.address, 'down');
    else                         deltas.set(e.address, 'same');
  });
  prevRanks.current = new Map(entries.map((e, i) => [e.address, i]));

  return (
    <Panel title="Leaderboard" count={entries.length}>
      {entries.length === 0 ? (
        <Empty text="Waiting for holders…" />
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-zinc-600 uppercase tracking-widest text-[10px]">
              <th className="text-left pb-2 w-6">#</th>
              <th className="text-left pb-2">Agent</th>
              <th className="text-right pb-2">NFTs</th>
              <th className="text-right pb-2 pr-1">Tokens</th>
              <th className="w-4 pb-2" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const delta   = deltas.get(entry.address) ?? 'same';
              const podium  = i < 3;
              const rankCol = podium ? RANK_COLORS[i] : 'text-zinc-500';
              const rowBg   = podium ? RANK_BG[i] : '';

              return (
                <tr
                  key={entry.address}
                  className={`border-b border-zinc-800/50 last:border-0 ${rowBg}`}
                >
                  <td className={`py-1.5 font-bold tabular-nums ${rankCol}`}>
                    {i + 1}
                  </td>
                  <td className="py-1.5 text-zinc-100 font-medium truncate max-w-[80px]">
                    {entry.name}
                  </td>
                  <td className="py-1.5 text-right text-zinc-400 tabular-nums">
                    {entry.nftsHeld}
                  </td>
                  <td className={`py-1.5 text-right tabular-nums font-bold pr-1 ${podium ? rankCol : 'text-zinc-200'}`}>
                    {fmtTokens(entry.tokensAllocated)}
                  </td>
                  <td className="py-1.5 text-center w-4">
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
  if (delta === 'up')   return <span className="text-emerald-400 text-[10px]">↑</span>;
  if (delta === 'down') return <span className="text-red-400 text-[10px]">↓</span>;
  if (delta === 'new')  return <span className="text-blue-400 text-[10px]">★</span>;
  return <span className="text-zinc-700 text-[10px]">–</span>;
}
