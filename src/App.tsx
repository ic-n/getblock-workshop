import { useState } from 'react';
import { useSse } from './hooks/useSse';
import { useStats } from './hooks/useStats';
import { Navbar } from './components/Navbar';
import { StatsPanel } from './components/StatsPanel';
import { MarketplaceGrid } from './components/MarketplaceGrid';
import { EventLog } from './components/EventLog';
import { Leaderboard } from './components/Leaderboard';

const API = 'http://localhost:3001';

export default function App() {
    const { snapshot, connected } = useSse();
    const stats = useStats(snapshot);
    const [starting, setStarting] = useState(false);
    const [simStarted, setSimStarted] = useState(false);

    const started = simStarted || snapshot !== null;

    async function handleStart() {
        setStarting(true);
        try {
            await fetch(`${API}/simulate`, { method: 'POST' });
            setSimStarted(true);
        } finally {
            setStarting(false);
        }
    }

    return (
        <div className="flex min-h-screen flex-col bg-zinc-950 font-mono text-zinc-100">
            <Navbar snapshot={snapshot} connected={connected} />

            <main className="grid min-h-0 flex-1 grid-cols-4 gap-3 p-3">
                <StatsPanel stats={stats} snapshot={snapshot} />
                <MarketplaceGrid items={snapshot?.marketplace ?? []} />
                <EventLog
                    mints={snapshot?.recentMints ?? []}
                    events={snapshot?.recentEvents ?? []}
                />
                <Leaderboard entries={snapshot?.leaderboard ?? []} />
            </main>

            {!started && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-zinc-950/95 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="mb-2 flex items-center gap-3">
                            <span
                                className={`h-3 w-3 rounded-full ${connected ? 'animate-pulse bg-emerald-400' : 'bg-red-500'}`}
                            />
                            <span className="text-lg font-bold tracking-[0.3em] text-emerald-400 uppercase">
                                NFT Indexer
                            </span>
                        </div>
                        <p className="text-sm tracking-widest text-zinc-500 uppercase">
                            Yellowstone gRPC Workshop
                        </p>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <button
                            onClick={handleStart}
                            disabled={!connected || starting}
                            className="cursor-pointer rounded bg-emerald-500 px-10 py-4 text-sm font-bold tracking-[0.2em] text-zinc-950 uppercase shadow-lg shadow-emerald-500/20 transition-all duration-150 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                        >
                            {starting ? 'Starting…' : 'Start Simulation'}
                        </button>

                        {!connected && (
                            <p className="text-xs text-zinc-600">
                                Waiting for server on{' '}
                                <span className="text-zinc-400">
                                    localhost:3001
                                </span>
                                …
                            </p>
                        )}
                    </div>

                    <div className="absolute bottom-8 space-y-1 text-center text-xs text-zinc-700">
                        <p>
                            [Faker] → [MockAdapter] → [AllocationEngine] → [SSE]
                            → [Dashboard]
                        </p>
                        <p className="text-zinc-600">
                            swap MockAdapter for YellowstoneAdapter to go live
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
