import { useEffect, useRef, useState } from 'react';
import type { EventType, StateSnapshot } from '../types';

export interface Stats {
  totalEvents: number;
  byType: Record<EventType, number>;
  avgHoldTimeSec: number | null;  // null until at least one NFT has been listed
  avgNftsPerHolder: number;
  avgTokensPerHolder: number;
}

const ZERO_BY_TYPE: Record<EventType, number> = {
  MINT: 0, TRANSFER: 0, LIST: 0, UNLIST: 0, PURCHASE: 0,
};

const INITIAL: Stats = {
  totalEvents: 0,
  byType: { ...ZERO_BY_TYPE },
  avgHoldTimeSec: null,
  avgNftsPerHolder: 0,
  avgTokensPerHolder: 0,
};

export function useStats(snapshot: StateSnapshot | null): Stats {
  const seenIds   = useRef(new Set<string>());
  // nftId → timestamp when it was minted (or last acquired via PURCHASE/UNLIST)
  const acquiredAt = useRef(new Map<number, number>());
  const holdTimes  = useRef<number[]>([]);

  const [stats, setStats] = useState<Stats>(INITIAL);

  useEffect(() => {
    if (!snapshot) return;

    const allEvents = [...snapshot.recentMints, ...snapshot.recentEvents];

    const newEvents = allEvents.filter(e => {
      const id = `${e.type}-${e.nftId}-${e.slot}`;
      if (seenIds.current.has(id)) return false;
      seenIds.current.add(id);
      return true;
    });

    if (newEvents.length === 0) return;

    // Update per-NFT acquisition time and hold-time history
    for (const e of newEvents) {
      if (e.type === 'MINT' || e.type === 'PURCHASE' || e.type === 'UNLIST') {
        // NFT arrived in a wallet — start the hold clock
        acquiredAt.current.set(e.nftId, e.timestamp);
      } else if (e.type === 'LIST') {
        // NFT left a wallet — record hold duration
        const since = acquiredAt.current.get(e.nftId);
        if (since !== undefined) {
          holdTimes.current.push(e.timestamp - since);
          acquiredAt.current.delete(e.nftId);
        }
      }
    }

    setStats(prev => {
      const byType = { ...prev.byType };
      for (const e of newEvents) byType[e.type]++;

      const avgHold = holdTimes.current.length > 0
        ? holdTimes.current.reduce((a, b) => a + b, 0) / holdTimes.current.length / 1000
        : prev.avgHoldTimeSec;

      const holders = snapshot.leaderboard;
      const avgNfts = holders.length > 0
        ? holders.reduce((s, h) => s + h.nftsHeld, 0) / holders.length
        : 0;
      const avgTokens = holders.length > 0
        ? holders.reduce((s, h) => s + h.tokensAllocated, 0) / holders.length
        : 0;

      return {
        totalEvents: prev.totalEvents + newEvents.length,
        byType,
        avgHoldTimeSec: avgHold,
        avgNftsPerHolder: avgNfts,
        avgTokensPerHolder: avgTokens,
      };
    });
  }, [snapshot]);

  return stats;
}
