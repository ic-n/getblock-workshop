import { useEffect, useRef, useState } from 'react';
import type { EventType, StateSnapshot } from '../../shared/types';

export interface Stats {
    totalEvents: number;
    byType: Record<EventType, number>;
    avgHoldTimeSec: number | null;
    avgNftsPerHolder: number;
    avgTokensPerHolder: number;
}

const ZERO_BY_TYPE: Record<EventType, number> = {
    MINT: 0,
    TRANSFER: 0,
    LIST: 0,
    UNLIST: 0,
    PURCHASE: 0,
};

const INITIAL: Stats = {
    totalEvents: 0,
    byType: { ...ZERO_BY_TYPE },
    avgHoldTimeSec: null,
    avgNftsPerHolder: 0,
    avgTokensPerHolder: 0,
};

export function useStats(snapshot: StateSnapshot | null): Stats {
    const seenIds = useRef(new Set<string>());

    const acquiredAt = useRef(new Map<number, number>());
    const holdTimes = useRef<number[]>([]);

    const [stats, setStats] = useState<Stats>(INITIAL);

    useEffect(() => {
        if (!snapshot) return;

        const allEvents = [...snapshot.recentMints, ...snapshot.recentEvents];

        const newEvents = allEvents.filter((e) => {
            const id = `${e.type}-${e.nftId}-${e.slot}`;
            if (seenIds.current.has(id)) return false;
            seenIds.current.add(id);
            return true;
        });

        if (newEvents.length === 0) return;

        for (const e of newEvents) {
            if (
                e.type === 'MINT' ||
                e.type === 'PURCHASE' ||
                e.type === 'UNLIST'
            ) {
                acquiredAt.current.set(e.nftId, e.timestamp);
            } else if (e.type === 'LIST') {
                const since = acquiredAt.current.get(e.nftId);
                if (since !== undefined) {
                    holdTimes.current.push(e.timestamp - since);
                    acquiredAt.current.delete(e.nftId);
                }
            }
        }

        setStats((prev) => {
            const byType = { ...prev.byType };
            for (const e of newEvents) byType[e.type]++;

            const avgHold =
                holdTimes.current.length > 0
                    ? holdTimes.current.reduce((a, b) => a + b, 0) /
                      holdTimes.current.length /
                      1000
                    : prev.avgHoldTimeSec;

            const holders = snapshot.leaderboard;
            const avgNfts =
                holders.length > 0
                    ? holders.reduce((s, h) => s + h.nftsHeld, 0) /
                      holders.length
                    : 0;
            const avgTokens =
                holders.length > 0
                    ? holders.reduce((s, h) => s + h.tokensAllocated, 0) /
                      holders.length
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
