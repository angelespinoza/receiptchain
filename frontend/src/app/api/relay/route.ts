/**
 * ReceiptChain Relayer API (v3 — Privacy-first)
 *
 * Receives only: userAddress, dataHash, dataCID
 * No personal data passes through the relay — it's all encrypted in IPFS.
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

interface RelayRequest {
  userAddress: string;
  dataHash: string;
  dataCID: string;
}

export async function POST(request: NextRequest) {
  try {
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      return NextResponse.json({ error: 'Relayer not configured' }, { status: 500 });
    }

    const body: RelayRequest = await request.json();
    const { userAddress, dataHash, dataCID } = body;

    if (!userAddress || !dataHash) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, dataHash' },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({ error: 'Invalid user address' }, { status: 400 });
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(dataHash)) {
      return NextResponse.json({ error: 'Invalid data hash' }, { status: 400 });
    }

    const formattedKey = relayerPrivateKey.startsWith('0x')
      ? relayerPrivateKey
      : `0x${relayerPrivateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    const walletClient = createWalletClient({
      account,
      chain: CELO_CHAIN,
      transport: http(CELO_CHAIN.rpcUrls.default.http[0]),
    });

    const publicClient = createPublicClient({
      chain: CELO_CHAIN,
      transport: http(CELO_CHAIN.rpcUrls.default.http[0]),
    });

    const txHash: Hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS as Address,
      abi: CONTRACT_ABI,
      functionName: 'registerExpenseFor',
      args: [
        userAddress as Address,
        dataHash as `0x${string}`,
        dataCID,
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 30_000,
    });

    return NextResponse.json({
      success: true,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString(),
      message: 'Gasto registrado exitosamente en la blockchain',
    });

  } catch (error) {
    console.error('Relay error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('insufficient funds')) {
      return NextResponse.json(
        { error: 'Relayer sin fondos. Contacta al administrador.' },
        { status: 503 }
      );
    }

    if (errorMessage.includes('Not an authorized relayer')) {
      return NextResponse.json(
        { error: 'Relayer no autorizado en el smart contract.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: `Failed to relay transaction: ${errorMessage}` },
      { status: 500 }
    );
  }
}
