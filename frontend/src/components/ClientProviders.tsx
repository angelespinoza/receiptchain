'use client';

import { type ReactNode } from 'react';
import dynamic from 'next/dynamic';

const Web3Provider = dynamic(() => import('@/components/Web3Provider'), { ssr: false });

export default function ClientProviders({ children }: { children: ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>;
}
