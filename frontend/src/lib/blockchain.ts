/**
 * ReceiptChain Blockchain Interaction
 * Smart contract integration for registering expenses on Celo
 */

import {
  encodePacked,
  keccak256,
  type Hash,
  type Address,
} from 'viem';
import { getWalletClient, getPublicClient, getAccount } from './wallet';
import { CONTRACT_ADDRESS, CONTRACT_ABI, cUSD_ADDRESS, CELO_CHAIN } from './constants';

/**
 * Registered expense record from blockchain
 */
export interface Expense {
  dataHash: string;
  timestamp: number;
  amount: number;
  category: string;
}

/**
 * Generate a hash for an expense using keccak256
 * Combines amount, date, merchant, and account address
 */
export function generateExpenseHash(
  amount: number,
  date: string,
  merchant: string,
  account: string
): `0x${string}` {
  try {
    // Ensure amount is in wei (18 decimals for Celo)
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

/**
 * Relay API response type
 */
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
 * The user does NOT pay gas — the relayer wallet covers it.
 */
export async function registerExpense(
  amount: number,
  category: string,
  dataHash: `0x${string}`
): Promise<Hash> {
  try {
    const account = await getAccount();

    // Send to relayer API instead of directly to blockchain
    const response = await fetch('/api/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: account,
        dataHash,
        amount,
        category,
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
 * Register an expense directly (user pays gas) — fallback method
 * Use this if the relayer is unavailable
 */
export async function registerExpenseDirect(
  amount: number,
  category: string,
  dataHash: `0x${string}`
): Promise<Hash> {
  try {
    const walletClient = await getWalletClient();
    const account = await getAccount();
    const amountInWei = BigInt(Math.floor(amount * 1e18));

    const txHash = await walletClient.writeContract({
      account: account as Address,
      address: CONTRACT_ADDRESS as Address,
      abi: CONTRACT_ABI,
      functionName: 'registerExpense' as const,
      args: [dataHash, amountInWei, category],
      chain: CELO_CHAIN,
      // @ts-expect-error - feeCurrency is a Celo-specific field supported by MiniPay
      feeCurrency: cUSD_ADDRESS as Address,
    });

    return txHash;
  } catch (error) {
    throw new Error(
      `Failed to register expense directly: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get all expenses for a wallet address
 */
export async function getExpenses(account: string): Promise<Expense[]> {
  try {
    const publicClient = await getPublicClient();
    const count = await getExpenseCount(account);

    const expenses: Expense[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: CONTRACT_ABI,
          functionName: 'expenses',
          args: [account as Address, BigInt(i)],
          account: account as Address,
        });

        if (Array.isArray(result) && result.length === 4) {
          expenses.push({
            dataHash: result[0] as string,
            timestamp: Number(result[1]),
            amount: Number(result[2]) / 1e18, // Convert from wei
            category: result[3] as string,
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
      account: account as Address,
    });

    return Number(result);
  } catch (error) {
    throw new Error(
      `Failed to get expense count: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Wait for a transaction to be mined and get the receipt
 */
export async function waitForTransaction(txHash: Hash): Promise<boolean> {
  try {
    const publicClient = await getPublicClient();

    // Poll for transaction receipt with timeout
    const maxAttempts = 60; // 30 seconds with 500ms interval
    let attempts = 0;

    while (attempts < maxAttempts) {
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash,
      });

      if (receipt) {
        return receipt.status === 'success';
      }

      // Wait before next attempt
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

/**
 * Get transaction details including status
 */
export async function getTransactionStatus(txHash: Hash): Promise<'success' | 'failed' | 'pending'> {
  try {
    const publicClient = await getPublicClient();

    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash,
    });

    if (!receipt) {
      return 'pending';
    }

    return receipt.status === 'success' ? 'success' : 'failed';
  } catch (error) {
    console.error('Failed to get transaction status:', error);
    return 'pending';
  }
}

/**
 * Estimate gas cost for registering an expense
 */
export async function estimateRegisterExpenseGas(
  amount: number,
  category: string,
  dataHash: `0x${string}`
): Promise<bigint> {
  try {
    const publicClient = await getPublicClient();
    const account = await getAccount();
    const amountInWei = BigInt(Math.floor(amount * 1e18));

    const gasEstimate = await publicClient.estimateContractGas({
      account: account as Address,
      address: CONTRACT_ADDRESS as Address,
      abi: CONTRACT_ABI,
      functionName: 'registerExpense',
      args: [dataHash, amountInWei, category],
    });

    return gasEstimate;
  } catch (error) {
    throw new Error(
      `Failed to estimate gas: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
