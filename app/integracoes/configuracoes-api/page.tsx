"use client";

import React from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { ConfiguracoesApiPage as ConfiguracoesApiPageView } from '@/components/integracoes/configuracoes-api-page';

function ConfiguracoesApiPage() {
  return <ConfiguracoesApiPageView />;
}

export default withAuth(ConfiguracoesApiPage, { module: 'INTEGRACOES' });
