"use client";

import React from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { IntegracoesPageShell } from '@/components/integracoes/integracoes-page-shell';

function TotvsPage() {
  return (
    <IntegracoesPageShell
      title="TOTVS"
      subtitle="Conector preparado para exportação e troca de dados com TOTVS"
      integrationName="TOTVS"
    />
  );
}

export default withAuth(TotvsPage, { module: 'INTEGRACOES' });
