/**
 * ReceiptChain Blockchain Interaction (v3 — Privacy-first)
 *
 * Only dataHash + dataCID are stored on-chain.
 * All personal data lives encrypted on IPFS.
 */

import {
  encodePacked,
  keccak256,
  type Hash,
  type Address,
} from 'viem';
import { getWalletClient, getPublicClient, getAccount } from './wallet';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CELO_CHAIN } from './constants';

/**
 * On-chain expense record (minimal — only hash + CID + timestamp)
 */
export interface OnChainExpense {
  dataHash: string;
  dataCID: string;
  timestamp: number;
}

/**
 * Generate a hash for an expense using keccak256
 */
export function generateExpenseHash(
  amount: number,
  date: string,
  merchant: string,
  account: string
): `0x${string}` {
  try {
    const amountInWei = BigInt(Math.floor(amount * 1e18));
    const hash = keccak256(
      encodePacked(
        ['uint256', 'string', 'string', 'address'],
        [amountInWei, date, merchant, account as Address]
      )
    );
    return hash;
  } catch (error) {
    throw new Error(
      `Failed to generate expense hash: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

interface RelayResponse {
  success: boolean;
  txHash: string;
  blockNumber: number;
  status: string;
  gasUsed: string;
  message: string;
  error?: string;
}

/**
 * Register an expense via the Relayer API (gas subsidized)
 * Only sends dataHash + dataCID — no personal data.
 */
export async function registerExpense(
  dataHash: `0x${string}`,
  dataCID: string,
  userAddress?: string
): Promise<Hash> {
  try {
    let account = userAddress;
    if (!account) {
      try {
        account = await getAccount();
      } catch {
        account = '0x0000000000000000000000000000000000000000';
      }
    }

    const response = await fetch('/api/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: account,
        dataHash,
        dataCID,
      }),
    });

    const result: RelayResponse = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Relay transaction failed');
    }

    return result.txHash as Hash;
  } catch (error) {
    throw new Error(
      `Failed to register expense: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Register expense directly (user pays gas) — fallback
 */
export async function registerExpenseDirect(
  dataHash: `0x${string}`,
  dataCID: string
): Promise<Hash> {
  try {
    const walletClient = await getWalletClient();
    const account = await getAccount();

    const txHash = await walletClient.writeContract({
      account: account as Address,
      address: CONTRACT_ADDRESS as Address,
      abi: CONTRACT_ABI,
      functionName: 'registerExpense' as const,
      args: [dataHash, dataCID],
      chain: CELO_CHAIN,
    });

    return txHash;
  } catch (error) {
    throw new Error(
      `Failed to register expense directly: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get all on-chain expenses for a wallet address
 * Returns only hash + CID + timestamp (data is encrypted on IPFS)
 */
export async function getOnChainExpenses(account: string): Promise<OnChainExpense[]> {
  try {
    const publicClient = await getPublicClient();
    const count = await getExpenseCount(account);
    const expenses: OnChainExpense[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: CONTRACT_ABI,
          functionName: 'getExpense',
          args: [account as Address, BigInt(i)],
        });

        if (Array.isArray(result) && result.length >= 3) {
          expenses.push({
            dataHash: result[0] as string,
            dataCID: result[1] as string,
            timestamp: Number(result[2]),
          });
        }
      } catch (indexError) {
        console.warn(`Failed to fetch expense at index ${i}:`, indexError);
        continue;
      }
    }

    return expenses;
  } catch (error) {
    throw new Error(
      `Failed to get expenses: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the count of expenses for a wallet address
 */
export async function getExpenseCount(account: string): Promise<number> {
  try {
    const publicClient = await getPublicClient();
    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESS as Address,
      abi: CONTRACT_ABI,
      functionName: 'getExpenseCount',
      args: [account as Address],
    });
    return Number(result);
  } catch (error) {
    throw new Error(
      `Failed to get expense count: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Wait for a transaction to be mined
 */
export async function waitForTransaction(txHash: Hash): Promise<boolean> {
  try {
    const publicClient = await getPublicClient();
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      if (receipt) return receipt.status === 'success';
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }

    throw new Error('Transaction confirmation timeout');
  } catch (error) {
    throw new Error(
      `Failed to wait for transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
