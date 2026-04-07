'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Header from '@/components/Header';
import CategorySelector from '@/components/CategorySelector';
import BlockchainBadge from '@/components/BlockchainBadge';
import PinModal from '@/components/PinModal';
import { processReceipt, suggestCategory, type ReceiptData } from '@/lib/ocr';
import { generateExpenseHash, registerExpense } from '@/lib/blockchain';
import { saveReceipt } from '@/lib/storage';
import {
  getEncryptionKey,
  encryptPayload,
  hasPinBackup,
  createPinBackup,
  saveBackupCID,
  type ExpensePayload,
} from '@/lib/encryption';
import { uploadToIPFS } from '@/lib/ipfs';
import type { ReceiptRecord } from '@/lib/storage';

export default function ScanPage() {
  const router = useRouter();
  const { address } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [imageData, setImageData] = useState<string>('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('alimentos');
  const [editedMerchant, setEditedMerchant] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editedAmount, setEditedAmount] = useState('');
  const [editedCurrency, setEditedCurrency] = useState('$');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [progressText, setProgressText] = useState('');
  const [imageExpanded, setImageExpanded] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<ReceiptRecord | null>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setImageData(base64);
        setStep(1);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error reading file:', err);
    }
  };

  useEffect(() => {
    if (step === 1 && imageData) {
      processOCR();
    }
  }, [step]);

  const processOCR = async () => {
    try {
      const data = await processReceipt(imageData);
      setReceiptData(data);
      setEditedMerchant(data.merchant);
      setEditedDate(data.date);
      setEditedAmount(data.amount.toString());
      setEditedCurrency(data.currency || '$');
      const suggestedCat = suggestCategory(data.merchant, data.items);
      setSelectedCategory(suggestedCat);
      setStep(2);
    } catch (err) {
      console.error('OCR error:', err);
      setReceiptData({
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        currency: '$',
        items: [],
        rawText: '',
        confidence: 0,
      });
      setStep(2);
    }
  };

  const handleConfirmAndRegister = async () => {
    setIsRegistering(true);
    setRegistrationError('');
    setProgressText('Preparando...');

    try {
      if (!editedMerchant.trim()) {
        setRegistrationError('El comercio es requerido');
        setIsRegistering(false);
        return;
      }

      const amount = parseFloat(editedAmount);
      if (isNaN(amount) || amount <= 0) {
        setRegistrationError('El monto debe ser mayor a 0');
        setIsRegistering(false);
        return;
      }

      const account = address || '0x0000000000000000000000000000000000000000';

      // Step A: Generate hash (proof of expense)
      setProgressText('Generando hash...');
      const dataHash = generateExpenseHash(amount, editedDate, editedMerchant, account);

      // Step B: Encrypt ALL data — no signature needed, key auto-generated
      setProgressText('Encriptando datos...');
      const encKey = await getEncryptionKey(account);

      const payload: ExpensePayload = {
        merchant: editedMerchant,
        amount,
        date: editedDate,
        category: selectedCategory,
        imageBase64: imageData,
      };

      const encryptedData = await encryptPayload(payload, encKey);

      // Step C: Upload encrypted payload to IPFS
      setProgressText('Subiendo a IPFS...');
      const dataCID = await uploadToIPFS(encryptedData);

      if (!dataCID) {
        throw new Error('No se pudo subir los datos a IPFS');
      }

      // Step D: Register on blockchain (only hash + CID, no personal data)
      setProgressText('Registrando en blockchain...');
      const txHash = await registerExpense(dataHash, dataCID, account);

      // Step E: Save to IndexedDB (local backup)
      const record: ReceiptRecord = {
        imageData,
        merchant: editedMerchant,
        date: editedDate,
        amount,
        currency: editedCurrency,
        category: selectedCategory,
        txHash,
        dataHash,
        timestamp: Date.now(),
      };
      await saveReceipt(record);

      // Step F: Check if PIN backup is configured; if not, prompt
      const hasBackup = await hasPinBackup(account);
      if (!hasBackup) {
        setPendingRecord(record);
        setShowPinSetup(true);
        setProgressText('');
        setIsRegistering(false);
        return;
      }

      setSuccessMessage('✓ Gasto registrado exitosamente');
      setProgressText('');

      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al registrar el gasto';
      setRegistrationError(errorMsg);
      setProgressText('');
      console.error('Registration error:', err);
    } finally {
      setIsRegistering(false);
    }
  };

  const handlePinSetup = async (pin: string) => {
    const account = address || '0x0000000000000000000000000000000000000000';
    const backupData = await createPinBackup(account, pin);
    const cid = await uploadToIPFS(btoa(backupData));
    if (cid) {
      await saveBackupCID(account, cid);
    }
    setShowPinSetup(false);
    setSuccessMessage('✓ Gasto registrado y PIN configurado');
    setTimeout(() => router.push('/'), 2000);
  };

  const handlePinSkip = () => {
    setShowPinSetup(false);
    setSuccessMessage('✓ Gasto registrado exitosamente');
    setTimeout(() => router.push('/'), 2000);
  };

  const handleCancel = () => {
    setStep(0);
    setImageData('');
    setReceiptData(null);
    setEditedMerchant('');
    setEditedDate('');
    setEditedAmount('');
    setEditedCurrency('$');
    setRegistrationError('');
    setSuccessMessage('');
    setProgressText('');
    setImageExpanded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Escanear Recibo"
        onBack={() => {
          if (step === 0) router.push('/');
          else handleCancel();
        }}
      />

      {/* PIN Setup Modal */}
      {showPinSetup && (
        <PinModal
          mode="setup"
          onSubmit={handlePinSetup}
          onSkip={handlePinSkip}
        />
      )}

      {step === 0 && (
        <div className="px-5 py-6">
          <div className="mb-6">
            <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 border-2 border-[#35D07F] opacity-30"></div>
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#35D07F]"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#35D07F]"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#35D07F]"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#35D07F]"></div>
              <div className="text-center z-10">
                <p className="text-white text-lg font-medium mb-2">📸</p>
                <p className="text-white text-sm">Toma una foto del recibo</p>
              </div>
            </div>
          </div>
          {/* Hidden inputs */}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
          <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-[#35D07F] text-white font-bold py-3 rounded-lg text-center transition-opacity active:opacity-80">
              📸 Tomar Foto
            </button>
            <button onClick={() => galleryInputRef.current?.click()} className="flex-1 bg-[#1E3A2F] text-white font-bold py-3 rounded-lg text-center transition-opacity active:opacity-80">
              🖼️ Galería
            </button>
          </div>
          <p className="text-center text-xs text-gray-500 mt-4">Asegúrate de que el recibo sea legible y tenga buena iluminación</p>
        </div>
      )}

      {step === 1 && (
        <div className="px-5 py-12 flex flex-col items-center justify-center">
          <div className="text-4xl animate-spin mb-4">⚙️</div>
          <p className="text-lg font-bold text-[#1E3A2F] mb-2">Procesando recibo...</p>
          <p className="text-sm text-gray-600 mb-6">Extrayendo datos con OCR</p>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#35D07F] animate-pulse rounded-full" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {step === 2 && receiptData && (
        <div className="px-5 py-6">
          {successMessage && (
            <div className="bg-green-50 rounded-lg p-4 mb-4 text-green-700 text-sm font-medium">{successMessage}</div>
          )}

          {/* Receipt image thumbnail — collapsible */}
          {imageData && (
            <div className="mb-4">
              <button
                onClick={() => setImageExpanded(!imageExpanded)}
                className="w-full flex items-center justify-between bg-gray-50 rounded-xl p-3 transition-colors active:bg-gray-100"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={imageData}
                    alt="Recibo"
                    className="w-12 h-16 object-cover rounded-lg border border-gray-200"
                  />
                  <span className="text-sm font-medium text-[#1E3A2F]">Foto del recibo</span>
                </div>
                <span className="text-gray-400 text-lg">
                  {imageExpanded ? '▲' : '▼'}
                </span>
              </button>

              {imageExpanded && (
                <div className="mt-2 rounded-xl overflow-hidden border border-gray-200">
                  <img
                    src={imageData}
                    alt="Recibo completo"
                    className="w-full max-h-80 object-contain bg-gray-50"
                  />
                </div>
              )}
            </div>
          )}

          <div className="mb-6">
            {receiptData.confidence >= 70 ? (
              <div className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">✓ OCR exitoso</div>
            ) : (
              <div className="inline-block bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-medium">⚠ Revisa los datos</div>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-[#1E3A2F] mb-1">Comercio</label>
              <input type="text" value={editedMerchant} onChange={(e) => setEditedMerchant(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#35D07F]" placeholder="Nombre del comercio" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E3A2F] mb-1">Fecha</label>
              <input type="date" value={editedDate} onChange={(e) => setEditedDate(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#35D07F]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E3A2F] mb-1">Monto</label>
              <div className="flex gap-2">
                <select value={editedCurrency} onChange={(e) => setEditedCurrency(e.target.value)} className="px-3 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#35D07F] bg-white text-sm font-medium">
                  <option value="S/">S/ (PEN)</option>
                  <option value="$">$ (USD)</option>
                  <option value="¥">¥ (JPY)</option>
                  <option value="€">€ (EUR)</option>
                  <option value="MX$">MX$ (MXN)</option>
                  <option value="COP">COP</option>
                  <option value="R$">R$ (BRL)</option>
                </select>
                <input type="number" value={editedAmount} onChange={(e) => setEditedAmount(e.target.value)} step="0.01" min="0" className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#35D07F]" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E3A2F] mb-2">Categoría</label>
              <CategorySelector selected={selectedCategory} onSelect={setSelectedCategory} />
            </div>
          </div>

          <div className="mb-6">
            <BlockchainBadge txHash={receiptData.rawText.slice(0, 66) || '0x0000'} />
          </div>

          {/* Privacy notice */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-700">🔒 Tus datos se encriptan automáticamente antes de guardarse. Solo tú puedes verlos.</p>
          </div>

          {registrationError && (
            <div className="bg-red-50 rounded-lg p-4 mb-4 text-red-700 text-sm">{registrationError}</div>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={handleCancel} disabled={isRegistering} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg transition-opacity active:opacity-80 disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleConfirmAndRegister} disabled={isRegistering} className="flex-1 bg-[#35D07F] text-white font-bold py-3 rounded-lg transition-opacity active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2">
              {isRegistering ? (
                <>
                  <span className="animate-spin">⏳</span>
                  {progressText || 'Registrando...'}
                </>
              ) : (
                'Confirmar y Registrar'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
