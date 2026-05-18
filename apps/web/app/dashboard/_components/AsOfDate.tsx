'use client';

import { useEffect, useState } from 'react';

function format(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function AsOfDate({ asOf }: { asOf: string }) {
  // SSR renders a stable, locale-agnostic fallback (the ISO date portion).
  // The browser swaps in the wall-clock-correct value once hydrated, so the
  // rendered date always reflects the viewer's timezone rather than the
  // server's UTC.
  const [label, setLabel] = useState<string>(() => asOf.slice(0, 10));

  useEffect(() => {
    setLabel(format(asOf));
  }, [asOf]);

  return <>{label}</>;
}
