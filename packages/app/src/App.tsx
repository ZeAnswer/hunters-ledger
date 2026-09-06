import { ENGINE_VERSION } from '@hl/engine';

export default function App() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-2xl font-semibold">Hunter's Ledger</h1>
      <p className="text-sm text-zinc-400">engine {ENGINE_VERSION}</p>
    </main>
  );
}
