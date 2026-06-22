"use client";

import React from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { LogsPage } from '@/components/integracoes/logs-page';

function LogsRoute() {
  return <LogsPage />;
}

export default withAuth(LogsRoute, { module: 'INTEGRACOES' });

