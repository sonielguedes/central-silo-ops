"use client";

import React from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { IntegracoesPageShell } from '@/components/integracoes/integracoes-page-shell';

function ConfiguracoesApiPage() {
  return (
    <IntegracoesPageShell
      title="Configurações API"
      subtitle="Endpoints, credenciais e parâmetros base da integração"
      integrationName="API"
    />
  );
}

export default withAuth(ConfiguracoesApiPage, { module: 'INTEGRACOES' });
