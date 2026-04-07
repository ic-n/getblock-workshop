import type { MarketplaceEntry } from "../../shared/types";
import { sinceMs } from "../lib/fmt";
import { Panel, Empty } from "./MintLog";

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
          {items.map((item) => (
            <NFTCard key={item.nftId} item={item} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function NFTCard({ item }: { item: MarketplaceEntry }) {
  const localId = item.nftId + 1;
  const imgUrl  = `/images/${localId}.png`;
  const fallback = `https://img-cdn.magiceden.dev/rs:fill:800:0:0/plain/https%3A%2F%2Fmadlads.s3.us-west-2.amazonaws.com%2Fimages%2F${localId}.png`;

  return (
    <div className="bg-zinc-800/60 border border-zinc-700/50 rounded overflow-hidden hover:border-amber-500/40 transition-colors flex flex-col">
      <img
        src={imgUrl}
        alt={item.nftName}
        className="w-full aspect-square object-cover"
        loading="lazy"
        onError={e => { (e.currentTarget as HTMLImageElement).src = fallback; }}
      />
      <div className="p-2 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-zinc-100 text-xs font-bold truncate">
            {item.nftName}
          </p>
          <span className="text-zinc-500 text-[10px] tabular-nums shrink-0 ml-1">
            {sinceMs(item.listedAt)} ago
          </span>
        </div>
        <p className="text-zinc-500 text-[10px] truncate">
          by <span className="text-zinc-400">{item.listedBy}</span>
        </p>
      </div>
    </div>
  );
}
