import type { MarketplaceEntry } from '../types';
import { sinceMs } from '../lib/fmt';
import { Panel, Empty } from './MintLog';

interface Props {
  items: MarketplaceEntry[];
}

export function MarketplaceGrid({ items }: Props) {
  return (
    <Panel title="Marketplace" count={items.length}>
      {items.length === 0 ? (
        <Empty text="No listings" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map(item => (
            <NFTCard key={item.nftId} item={item} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function NFTCard({ item }: { item: MarketplaceEntry }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-700/50 rounded p-3 flex flex-col gap-1.5 hover:border-amber-500/40 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-amber-400 text-[10px] uppercase tracking-widest font-bold">
          Listed
        </span>
        <span className="text-zinc-500 text-[10px] tabular-nums">
          {sinceMs(item.listedAt)} ago
        </span>
      </div>
      <p className="text-zinc-100 text-sm font-bold truncate">{item.nftName}</p>
      <p className="text-zinc-500 text-[10px] truncate">
        by <span className="text-zinc-400">{item.listedBy}</span>
      </p>
    </div>
  );
}
