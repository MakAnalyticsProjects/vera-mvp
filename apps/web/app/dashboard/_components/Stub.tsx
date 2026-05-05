import { VeraQuote } from '@vera/ui';

export function Stub({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-4xl tracking-tight md:text-5xl">{title}</h1>
      <VeraQuote>
        I&apos;ll fill this room in {phase}. The plumbing&apos;s already in place — the API
        is live and answering. Right now I just don&apos;t have the seats and the lighting.
      </VeraQuote>
    </div>
  );
}
