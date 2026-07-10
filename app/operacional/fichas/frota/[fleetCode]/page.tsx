'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CurrentFleetSheetRedirect() {
  const fleetCode = String(useParams().fleetCode ?? '');
  const router = useRouter();
  useEffect(() => {
    router.replace(`/operacional/fichas/atual?fleetCode=${encodeURIComponent(fleetCode)}`);
  }, [fleetCode, router]);
  return <div className="min-h-screen bg-background p-8 text-sm text-muted-foreground">Abrindo ficha operacional...</div>;
}
