import { useState } from 'react';
import { useSse } from './hooks/useSse';
import { Navbar } from './components/Navbar';
import { MintLog } from './components/MintLog';
import { MarketplaceGrid } from './components/MarketplaceGrid';
import { EventLog } from './components/EventLog';
import { Leaderboard } from './components/Leaderboard';

const API = 'http://localhost:3001';

export default function App() {
  const { snapshot, connected } = useSse();
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono flex flex-col">
      <Navbar snapshot={snapshot} connected={connected} />

      <main className="flex-1 grid grid-cols-4 gap-3 p-3 min-h-0">
        <MintLog events={snapshot?.recentMints ?? []} />
        <MarketplaceGrid items={snapshot?.marketplace ?? []} />
        <EventLog events={snapshot?.recentEvents ?? []} />
        <Leaderboard entries={snapshot?.leaderboard ?? []} />
      </main>

      {/* Splash overlay — visible until simulation starts */}
      {!started && (
        <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-sm flex flex-col items-center justify-center gap-8 z-50">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3 mb-2">
              <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-emerald-400 font-bold text-lg tracking-[0.3em] uppercase">
                NFT Indexer
              </span>
            </div>
            <p className="text-zinc-500 text-sm tracking-widest uppercase">
              Yellowstone gRPC Workshop
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleStart}
              disabled={!connected || starting}
              className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500
                         text-zinc-950 font-bold text-sm tracking-[0.2em] uppercase rounded
                         transition-all duration-150 cursor-pointer disabled:cursor-not-allowed
                         shadow-lg shadow-emerald-500/20"
            >
              {starting ? 'Starting…' : 'Start Simulation'}
            </button>

            {!connected && (
              <p className="text-zinc-600 text-xs">
                Waiting for server on{' '}
                <span className="text-zinc-400">localhost:3001</span>…
              </p>
            )}
          </div>

          {/* Architecture hint for the workshop */}
          <div className="absolute bottom-8 text-center text-zinc-700 text-xs space-y-1">
            <p>[Faker] → [MockAdapter] → [AllocationEngine] → [SSE] → [Dashboard]</p>
            <p className="text-zinc-600">swap MockAdapter for YellowstoneAdapter to go live</p>
          </div>
        </div>
      )}
    </div>
  );
}
