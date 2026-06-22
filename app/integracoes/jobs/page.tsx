"use client";

import React from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { JobsPage } from '@/components/integracoes/jobs-page';

function JobsRoute() {
  return <JobsPage />;
}

export default withAuth(JobsRoute, { module: 'INTEGRACOES' });

