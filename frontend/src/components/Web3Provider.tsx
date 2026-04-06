'use client';

import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, type Config } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { wagmiAdapter, projectId, celoSepolia } from '@/lib/web3config';

// Create query client
const queryClient = new QueryClient();

// Metadata for WalletConnect
const metadata = {
  name: 'ReceiptChain',
  description: 'Escanea recibos y registra gastos en la blockchain de Celo',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://receiptchain.vercel.app',
  icons: ['https://receiptchain.vercel.app/favicon.ico'],
};

// Initialize AppKit (only once)
let appKitInitialized = false;
if (typeof window !== 'undefined' && !appKitInitialized) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: [celoSepolia],
    defaultNetwork: celoSepolia,
    metadata,
    features: {
      analytics: false,
    },
  });
  appKitInitialized = true;
}

interface Web3ProviderProps {
  children: ReactNode;
  cookies?: string | null;
}

export default function Web3Provider({ children, cookies }: Web3ProviderProps) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
