/**
 * ReceiptChain Wallet Integration
 * Supports MiniPay (auto-connect) and MetaMask/other EVM wallets (manual connect)
 */

import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type WalletClient,
  type PublicClient,
  type Transport,
} from 'viem';
import { CELO_CHAIN } from './constants';

/**
 * Global type declaration for MiniPay provider
 * (window.ethereum is already declared by wagmi types)
 */
declare global {
  interface Window {
    provider: any;       // MiniPay provider
  }
}

/**
 * Check if running inside MiniPay
 */
export function isMiniPay(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.provider !== 'undefined';
}

/**
 * Check if MetaMask or another EVM wallet is available
 */
export function hasExternalWallet(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.ethereum !== 'undefined';
}

/**
 * Check if any wallet is available
 */
export function hasAnyWallet(): boolean {
  return isMiniPay() || hasExternalWallet();
}

/**
 * Get the active provider (MiniPay first, then MetaMask)
 */
function getProvider(): any {
  if (isMiniPay()) return window.provider;
  if (hasExternalWallet()) return window.ethereum;
  return null;
}

/**
 * Get wallet client for signing transactions
 * Uses MiniPay provider if available, otherwise MetaMask/EVM wallet
 */
export async function getWalletClient(): Promise<
  WalletClient<Transport, typeof CELO_CHAIN>
> {
  const provider = getProvider();
  if (!provider) {
    throw new Error('No wallet available. Please use MiniPay or install MetaMask.');
  }

  try {
    const client = createWalletClient({
      chain: CELO_CHAIN,
      transport: custom(provider),
    });
    return client;
  } catch (error) {
    throw new Error(
      `Failed to create wallet client: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get public client for reading blockchain data
 */
export async function getPublicClient(): Promise<PublicClient<Transport, typeof CELO_CHAIN>> {
  try {
    const client = createPublicClient({
      chain: CELO_CHAIN,
      transport: http(),
    });
    return client;
  } catch (error) {
    throw new Error(
      `Failed to create public client: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the currently connected wallet account address
 * Works with MiniPay, MetaMask, and other EVM wallets
 */
export async function getAccount(): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error('No wallet available');
  }

  try {
    const accounts = await provider.request({
      method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet');
    }

    return accounts[0];
  } catch (error) {
    throw new Error(
      `Failed to get account: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get account without requesting permission
 * Returns null if no wallet is connected
 */
export async function getConnectedAccount(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;

  try {
    const accounts = await provider.request({
      method: 'eth_accounts',
    });

    if (!accounts || accounts.length === 0) {
      return null;
    }

    return accounts[0];
  } catch {
    return null;
  }
}

/**
 * Check if wallet is connected to the correct chain
 */
export async function isConnectedToCorrectChain(): Promise<boolean> {
  const provider = getProvider();
  if (!provider) return false;

  try {
    const chainId = await provider.request({
      method: 'eth_chainId',
    });

    return parseInt(chainId, 16) === CELO_CHAIN.id;
  } catch {
    return false;
  }
}

/**
 * Switch to Celo Sepolia chain
 */
export async function switchToCeloChain(): Promise<void> {
  const provider = getProvider();
  if (!provider) {
    throw new Error('No wallet available');
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${CELO_CHAIN.id.toString(16)}` }],
    });
  } catch (error: any) {
    if (error.code === 4902) {
      // Chain not added to wallet, try adding it
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${CELO_CHAIN.id.toString(16)}`,
            chainName: CELO_CHAIN.name,
            rpcUrls: CELO_CHAIN.rpcUrls.default.http,
            blockExplorerUrls: [CELO_CHAIN.blockExplorers?.default.url || ''],
            nativeCurrency: CELO_CHAIN.nativeCurrency,
          },
        ],
      });
    } else {
      throw error;
    }
  }
}
