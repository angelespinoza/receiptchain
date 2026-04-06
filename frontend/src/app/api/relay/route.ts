/**
 * ReceiptChain Relayer API
 *
 * This endpoint receives expense data from users and submits the
 * transaction to the blockchain using the relayer wallet.
 * The relayer pays the gas fees, so users don't need cUSD.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CELO_CHAIN } from '@/lib/constants';

// Extended ABI with the relayer function
const RELAYER_ABI = [
  ...CONTRACT_ABI,
  {
    type: 'function',
    name: 'registerExpenseFor',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_dataHash', type: 'bytes32' },
      { name: '_amount', type: 'uint256' },
      { name: '_category', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

interface RelayRequest {
  userAddress: string;
  dataHash: string;
  amount: number;
  category: string;
}

export async function POST(request: NextRequest) {
  try {
    // ─── Validate environment ───
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      return NextResponse.json(
        { error: 'Relayer not configured' },
        { status: 500 }
      );
    }

    // ─── Parse request body ───
    const body: RelayRequest = await request.json();
    const { userAddress, dataHash, amount, category } = body;

    if (!userAddress || !dataHash || amount === undefined || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, dataHash, amount, category' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid user address format' },
        { status: 400 }
      );
    }

    // Validate dataHash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(dataHash)) {
      return NextResponse.json(
        { error: 'Invalid data hash format' },
        { status: 400 }
      );
    }

    // ─── Setup relayer wallet ───
    const formattedKey = relayerPrivateKey.startsWith('0x')
      ? relayerPrivateKey
      : `0x${relayerPrivateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    const walletClient = createWalletClient({
      account,
      chain: CELO_CHAIN,
      transport: http('https://forno.celo-sepolia.celo-testnet.org'),
    });

    const publicClient = createPublicClient({
      chain: CELO_CHAIN,
      transport: http('https://forno.celo-sepolia.celo-testnet.org'),
    });

    // ─── Convert amount to wei ───
    const amountInWei = BigInt(Math.floor(amount * 1e18));

    // ─── Send transaction via relayer ───
    const txHash: Hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS as Address,
      abi: RELAYER_ABI,
      functionName: 'registerExpenseFor',
      args: [
        userAddress as Address,
        dataHash as `0x${string}`,
        amountInWei,
        category,
      ],
    });

    // ─── Wait for confirmation ───
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 30_000,
    });

    // ─── Return result ───
    return NextResponse.json({
      success: true,
      txHash: txHash,
      blockNumber: Number(receipt.blockNumber),
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString(),
      message: 'Gasto registrado exitosamente en la blockchain',
    });

  } catch (error) {
    console.error('Relay error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for common errors
    if (errorMessage.includes('insufficient funds')) {
      return NextResponse.json(
        { error: 'Relayer wallet has insufficient funds. Please contact support.' },
        { status: 503 }
      );
    }

    if (errorMessage.includes('Not an authorized relayer')) {
      return NextResponse.json(
        { error: 'Relayer wallet is not authorized in the smart contract.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: `Failed to relay transaction: ${errorMessage}` },
      { status: 500 }
    );
  }
}
