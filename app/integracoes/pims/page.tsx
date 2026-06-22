"use client";

import React from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { IntegracoesPageShell } from '@/components/integracoes/integracoes-page-shell';

function PimsPage() {
  return (
    <IntegracoesPageShell
      title="PIMS"
      subtitle="Integração operacional do PIMS com base local da Central"
      integrationName="PIMS"
    />
  );
}

export default withAuth(PimsPage, { module: 'INTEGRACOES' });
