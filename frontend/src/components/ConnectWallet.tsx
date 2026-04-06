'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { isMiniPay, getAccount as getMiniPayAccount } from '@/lib/wallet';

interface ConnectWalletProps {
  onConnected?: (address: string) => void;
}

export default function ConnectWallet({ onConnected }: ConnectWalletProps) {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();

  // Auto-connect MiniPay
  useEffect(() => {
    if (isMiniPay()) {
      getMiniPayAccount()
        .then((addr) => onConnected?.(addr))
        .catch(() => {});
      return;
    }
  }, []);

  // Notify parent when wagmi connects
  useEffect(() => {
    if (isConnected && address) {
      onConnected?.(address);
    }
  }, [isConnected, address]);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  // MiniPay: show compact badge
  if (isMiniPay()) {
    return (
      <div className="flex items-center gap-2 bg-white bg-opacity-20 px-3 py-1.5 rounded-lg">
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span className="text-xs text-white font-medium">MiniPay</span>
      </div>
    );
  }

  // Connected via WalletConnect/MetaMask
  if (isConnected && address) {
    return (
      <button
        onClick={() => open({ view: 'Account' })}
        className="flex items-center gap-2 bg-white bg-opacity-20 px-3 py-1.5 rounded-lg active:opacity-80 transition-opacity"
      >
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span className="text-xs text-white font-medium">{shortAddress}</span>
      </button>
    );
  }

  // Not connected — show connect button
  return (
    <button
      onClick={() => open()}
      className="flex items-center gap-2 bg-[#35D07F] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity active:opacity-80"
    >
      Conectar Wallet
    </button>
  );
}
