import type { NFTEvent, EventType } from '../types';
import { agentLabel } from '../lib/fmt';
import { Panel, Empty } from './MintLog';

interface Props {
  mints: NFTEvent[];
  events: NFTEvent[];
}

const TYPE_COLOR: Record<EventType, string> = {
  MINT:     'text-emerald-400',
  LIST:     'text-amber-400',
  UNLIST:   'text-zinc-400',
  PURCHASE: 'text-violet-400',
  TRANSFER: 'text-blue-400',
};

const TYPE_ICON: Record<EventType, string> = {
  MINT:     '✦',
  LIST:     '↑',
  UNLIST:   '↓',
  PURCHASE: '⚡',
  TRANSFER: '→',
};

function formatEvent(e: NFTEvent): React.ReactNode {
  const from  = agentLabel(e.from);
  const to    = agentLabel(e.to);
  const nft   = <span className="text-zinc-300">{e.nftName}</span>;
  const color = TYPE_COLOR[e.type];

  switch (e.type) {
    case 'MINT':
      return <><span className={color}>{to}</span> minted {nft}</>;
    case 'LIST':
      return <><span className={color}>{from}</span> listed {nft}</>;
    case 'UNLIST':
      return <><span className={color}>{from}</span> unlisted {nft}</>;
    case 'PURCHASE':
      return <><span className={color}>{to}</span> bought {nft}</>;
    case 'TRANSFER':
      return <>{nft} <span className={color}>{from} → {to}</span></>;
  }
}

export function EventLog({ mints, events }: Props) {
  // Merge both streams and sort newest-first by slot
  const combined = [...mints, ...events]
    .sort((a, b) => b.slot - a.slot || b.timestamp - a.timestamp)
    .slice(0, 40);

  return (
    <Panel title="Event Log" count={combined.length}>
      {combined.length === 0 ? (
        <Empty text="Waiting for events…" />
      ) : (
        combined.map((e, i) => {
          const color = TYPE_COLOR[e.type];
          const icon  = TYPE_ICON[e.type];
          return (
            <div
              key={`${e.type}-${e.nftId}-${e.slot}-${i}`}
              className="flex items-start gap-2 py-1.5 border-b border-zinc-800/50 last:border-0"
            >
              <span className={`${color} text-xs mt-0.5 shrink-0 w-3 text-center`}>{icon}</span>
              <div className="min-w-0">
                <p className="text-xs text-zinc-100 truncate">{formatEvent(e)}</p>
                <p className="text-[10px] text-zinc-600">slot {e.slot}</p>
              </div>
            </div>
          );
        })
      )}
    </Panel>
  );
}
