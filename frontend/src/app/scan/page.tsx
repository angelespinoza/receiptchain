'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import CategorySelector from '@/components/CategorySelector';
import BlockchainBadge from '@/components/BlockchainBadge';
import { processReceipt, suggestCategory, type ReceiptData } from '@/lib/ocr';
import { generateExpenseHash, registerExpense } from '@/lib/blockchain';
import { saveReceipt } from '@/lib/storage';
import { getAccount } from '@/lib/wallet';
import type { ReceiptRecord } from '@/lib/storage';

export default function ScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0: camera, 1: processing, 2: confirm
  const [imageData, setImageData] = useState<string>('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('alimentos');
  const [editedMerchant, setEditedMerchant] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editedAmount, setEditedAmount] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Step 0: Camera / Image Upload
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Convert file to base64
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

  // Step 1: Process OCR and suggest category
  useEffect(() => {
    if (step === 1 && imageData) {
      processOCR();
    }
  }, [step]);

  const processOCR = async () => {
    try {
      const data = await processReceipt(imageData);
      setReceiptData(data);

      // Set initial values for step 2
      setEditedMerchant(data.merchant);
      setEditedDate(data.date);
      setEditedAmount(data.amount.toString());

      // Suggest category
      const suggestedCat = suggestCategory(data.merchant, data.items);
      setSelectedCategory(suggestedCat);

      // Move to confirm step
      setStep(2);
    } catch (err) {
      console.error('OCR error:', err);
      setReceiptData({
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        items: [],
        rawText: '',
        confidence: 0,
      });
      setStep(2);
    }
  };

  // Step 2: Confirm and Register
  const handleConfirmAndRegister = async () => {
    setIsRegistering(true);
    setRegistrationError('');

    try {
      // Validate inputs
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

      // Get account for hash generation
      let account = '';
      try {
        account = await getAccount();
      } catch {
        // Continue without account - hash will still be generated
        account = '0x0000000000000000000000000000000000000000';
      }

      // Generate hash
      const dataHash = generateExpenseHash(amount, editedDate, editedMerchant, account);

      // Register on blockchain (pass account to avoid re-requesting provider)
      const txHash = await registerExpense(amount, selectedCategory, dataHash, account);

      // Save to IndexedDB
      const record: ReceiptRecord = {
        imageData,
        merchant: editedMerchant,
        date: editedDate,
        amount,
        category: selectedCategory,
        txHash,
        dataHash,
        timestamp: Date.now(),
      };

      await saveReceipt(record);

      // Show success message
      setSuccessMessage(`✓ Gasto registrado exitosamente`);

      // Redirect to home after 2 seconds
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al registrar el gasto';
      setRegistrationError(errorMsg);
      console.error('Registration error:', err);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCancel = () => {
    setStep(0);
    setImageData('');
    setReceiptData(null);
    setEditedMerchant('');
    setEditedDate('');
    setEditedAmount('');
    setRegistrationError('');
    setSuccessMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Escanear Recibo"
        onBack={() => {
          if (step === 0) {
            router.push('/');
          } else {
            handleCancel();
          }
        }}
      />

      {/* Step 0: Camera */}
      {step === 0 && (
        <div className="px-5 py-6">
          {/* Camera Viewfinder Area */}
          <div className="mb-6">
            <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center">
              {/* Corner guides */}
              <div className="absolute inset-0 border-2 border-[#35D07F] opacity-30"></div>
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#35D07F]"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#35D07F]"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#35D07F]"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#35D07F]"></div>

              {/* Center text */}
              <div className="text-center z-10">
                <p className="text-white text-lg font-medium mb-2">📸</p>
                <p className="text-white text-sm">Toma una foto del recibo</p>
              </div>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Camera Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-[#35D07F] text-white font-bold py-3 rounded-lg text-center transition-opacity active:opacity-80"
          >
            Abrir Cámara
          </button>

          {/* Info Text */}
          <p className="text-center text-xs text-gray-500 mt-4">
            Asegúrate de que el recibo sea legible y tenga buena iluminación
          </p>
        </div>
      )}

      {/* Step 1: Processing */}
      {step === 1 && (
        <div className="px-5 py-12 flex flex-col items-center justify-center">
          <div className="text-4xl animate-spin mb-4">⚙️</div>
          <p className="text-lg font-bold text-[#1E3A2F] mb-2">Procesando recibo...</p>
          <p className="text-sm text-gray-600 mb-6">Extrayendo datos con OCR</p>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#35D07F] animate-pulse rounded-full" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Step 2: Confirm & Register */}
      {step === 2 && receiptData && (
        <div className="px-5 py-6">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 rounded-lg p-4 mb-4 text-green-700 text-sm font-medium">
              {successMessage}
            </div>
          )}

          {/* OCR Confidence Badge */}
          <div className="mb-6">
            {receiptData.confidence >= 70 ? (
              <div className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                ✓ OCR exitoso
              </div>
            ) : (
              <div className="inline-block bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-medium">
                ⚠ Revisa los datos
              </div>
            )}
          </div>

          {/* Editable Fields */}
          <div className="space-y-4 mb-6">
            {/* Comercio */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A2F] mb-1">Comercio</label>
              <input
                type="text"
                value={editedMerchant}
                onChange={(e) => setEditedMerchant(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#35D07F]"
                placeholder="Nombre del comercio"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A2F] mb-1">Fecha</label>
              <input
                type="date"
                value={editedDate}
                onChange={(e) => setEditedDate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#35D07F]"
              />
            </div>

            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A2F] mb-1">Monto</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500 font-medium">$</span>
                <input
                  type="number"
                  value={editedAmount}
                  onChange={(e) => setEditedAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#35D07F]"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-sm font-medium text-[#1E3A2F] mb-2">Categoría</label>
              <CategorySelector selected={selectedCategory} onSelect={setSelectedCategory} />
            </div>
          </div>

          {/* Blockchain Badge */}
          <div className="mb-6">
            <BlockchainBadge txHash={receiptData.rawText.slice(0, 66) || '0x0000'} />
          </div>

          {/* Error Message */}
          {registrationError && (
            <div className="bg-red-50 rounded-lg p-4 mb-4 text-red-700 text-sm">
              {registrationError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCancel}
              disabled={isRegistering}
              className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg transition-opacity active:opacity-80 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmAndRegister}
              disabled={isRegistering}
              className="flex-1 bg-[#35D07F] text-white font-bold py-3 rounded-lg transition-opacity active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRegistering ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Registrando...
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
