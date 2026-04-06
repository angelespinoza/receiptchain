/**
 * Web3 Configuration for ReceiptChain
 * Uses Reown AppKit (formerly WalletConnect) + Wagmi
 * Supports: MiniPay (auto), MetaMask, WalletConnect QR, Coinbase, etc.
 */

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { cookieStorage, createStorage } from '@wagmi/core';
import { CELO_CHAIN } from './constants';

// Reown Cloud Project ID — get yours at https://cloud.reown.com
// Using a public demo ID for development; replace with your own for production
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';

// Define Celo Sepolia as a Reown-compatible network
export const celoSepolia = {
  id: CELO_CHAIN.id,
  name: CELO_CHAIN.name,
  nativeCurrency: CELO_CHAIN.nativeCurrency,
  rpcUrls: {
    default: { http: CELO_CHAIN.rpcUrls.default.http },
  },
  blockExplorers: CELO_CHAIN.blockExplorers,
  testnet: true,
} as const;

// Wagmi adapter configuration
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks: [celoSepolia],
});

// Export the wagmi config for use with WagmiProvider
export const wagmiConfig = wagmiAdapter.wagmiConfig;
