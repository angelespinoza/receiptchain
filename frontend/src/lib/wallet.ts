/**
 * ReceiptChain Wallet Integration
 * MiniPay wallet connection using viem
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
 */
declare global {
  interface Window {
    provider: any;
  }
}

/**
 * Check if MiniPay wallet is available
 */
export function isMiniPay(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.provider !== 'undefined';
}

/**
 * Get wallet client for signing transactions
 * Uses MiniPay provider if available, otherwise throws error
 */
export async function getWalletClient(): Promise<
  WalletClient<Transport, typeof CELO_CHAIN>
> {
  if (!isMiniPay()) {
    throw new Error('MiniPay provider not available. Please use MiniPay wallet.');
  }

  try {
    const client = createWalletClient({
      chain: CELO_CHAIN,
      transport: custom(window.provider),
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
 * Requests permission from user if not already connected
 */
export async function getAccount(): Promise<string> {
  if (!isMiniPay()) {
    throw new Error('MiniPay provider not available');
  }

  try {
    const accounts = await window.provider.request({
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
 * Returns null if wallet is not connected
 */
export async function getConnectedAccount(): Promise<string | null> {
  if (!isMiniPay()) {
    return null;
  }

  try {
    const accounts = await window.provider.request({
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
  if (!isMiniPay()) {
    return false;
  }

  try {
    const chainId = await window.provider.request({
      method: 'eth_chainId',
    });

    return parseInt(chainId, 16) === CELO_CHAIN.id;
  } catch {
    return false;
  }
}

/**
 * Switch to Celo Alfajores chain
 */
export async function switchToCeloChain(): Promise<void> {
  if (!isMiniPay()) {
    throw new Error('MiniPay provider not available');
  }

  try {
    await window.provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${CELO_CHAIN.id.toString(16)}` }],
    });
  } catch (error: any) {
    if (error.code === 4902) {
      // Chain not added to wallet, try adding it
      await window.provider.request({
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
