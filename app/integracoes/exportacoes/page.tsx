"use client";

import React from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { ExportacoesPage } from '@/components/integracoes/exportacoes-page';

function ExportacoesRoute() {
  return <ExportacoesPage />;
}

export default withAuth(ExportacoesRoute, { module: 'INTEGRACOES' });

