'use client';

import { useState, useEffect } from 'react';
import { isMiniPay, hasExternalWallet, getAccount, getConnectedAccount, switchToCeloChain } from '@/lib/wallet';

interface ConnectWalletProps {
  onConnected?: (address: string) => void;
}

export default function ConnectWallet({ onConnected }: ConnectWalletProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  // Auto-connect if MiniPay, or check existing connection
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      // MiniPay auto-connects
      if (isMiniPay()) {
        const account = await getAccount();
        setAddress(account);
        onConnected?.(account);
        return;
      }

      // Check if already connected via MetaMask
      const existing = await getConnectedAccount();
      if (existing) {
        setAddress(existing);
        onConnected?.(existing);
      }
    } catch {
      // Not connected yet, that's fine
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError('');

    try {
      if (!hasExternalWallet()) {
        setError('No se encontró wallet. Instala MetaMask o usa MiniPay.');
        setIsConnecting(false);
        return;
      }

      const account = await getAccount();

      // Try to switch to Celo chain
      try {
        await switchToCeloChain();
      } catch {
        // User may reject chain switch, continue anyway
      }

      setAddress(account);
      onConnected?.(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  // Don't show anything in MiniPay (auto-connected)
  if (isMiniPay()) {
    if (address) {
      return (
        <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-xs text-green-700 font-medium">MiniPay: {shortAddress}</span>
        </div>
      );
    }
    return null;
  }

  // Already connected
  if (address) {
    return (
      <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-xs text-green-700 font-medium">{shortAddress}</span>
      </div>
    );
  }

  // Not connected — show connect button
  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="flex items-center gap-2 bg-[#35D07F] text-white px-4 py-2 rounded-lg text-sm font-bold transition-opacity active:opacity-80 disabled:opacity-50"
      >
        {isConnecting ? (
          <>
            <span className="animate-spin">⏳</span>
            Conectando...
          </>
        ) : (
          <>
            🔗 Conectar Wallet
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
