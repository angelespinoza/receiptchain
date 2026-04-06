'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getConnectedAccount } from '@/lib/wallet';
import { CELO_CHAIN } from '@/lib/constants';

export default function SettingsPage() {
  const [account, setAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccount() {
      try {
        setLoading(true);
        const connectedAccount = await getConnectedAccount();
        setAccount(connectedAccount);
      } catch (err) {
        console.error('Error loading account:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, []);

  // Format address: show first 6 and last 4 chars
  const truncatedAddress = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'No conectado';

  return (
    <div className="min-h-screen">
      <Header title="Ajustes" />

      {/* Settings Content */}
      <div className="px-5 py-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <p className="text-gray-500">Cargando ajustes...</p>
          </div>
        ) : (
          <>
            {/* Wallet Info Card */}
            <div className="bg-gradient-to-br from-[#1E3A2F] to-[#2D5A4A] rounded-2xl p-5 text-white mb-6 shadow-md">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-300 mb-1">Billetera Conectada</p>
                  <p className="font-bold text-sm font-mono">{truncatedAddress}</p>
                </div>
                <div className="flex items-center gap-2">
                  {account && <span className="w-3 h-3 bg-[#35D07F] rounded-full"></span>}
                  <span className="text-xs font-medium">
                    {account ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-white border-opacity-20">
                <p className="text-xs text-gray-300 mb-1">Red Blockchain</p>
                <p className="font-medium text-sm">{CELO_CHAIN.name}</p>
              </div>
            </div>

            {/* Settings List */}
            <div className="space-y-3 mb-8">
              {/* OCR Quality */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-xl">📸</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[#1E3A2F]">Calidad OCR</p>
                    <p className="text-xs text-gray-600 mt-1">Tesseract.js (Local)</p>
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-xl">🏷</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[#1E3A2F]">Categorías</p>
                    <p className="text-xs text-gray-600 mt-1">8 categorías disponibles</p>
                  </div>
                </div>
              </div>

              {/* Receipt Images */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-xl">💾</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[#1E3A2F]">Imágenes de Recibos</p>
                    <p className="text-xs text-gray-600 mt-1">Solo en dispositivo</p>
                  </div>
                </div>
              </div>

              {/* Blockchain Network */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-xl">🌐</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[#1E3A2F]">Red Blockchain</p>
                    <p className="text-xs text-gray-600 mt-1">Celo Alfajores (Testnet)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* App Info */}
            <div className="border-t border-gray-200 pt-6 text-center">
              <p className="text-xs text-gray-500">
                ReceiptChain v1.0.0 MVP
                <br />
                Powered by Celo
              </p>
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="settings" />
    </div>
  );
}
