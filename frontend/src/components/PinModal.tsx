'use client';

import { useState, useRef, useEffect } from 'react';

interface PinModalProps {
  /** 'setup' = first time, asks to create PIN; 'recover' = asks for existing PIN */
  mode: 'setup' | 'recover';
  onSubmit: (pin: string) => Promise<void>;
  onSkip?: () => void;
  error?: string;
}

export default function PinModal({ mode, onSubmit, onSkip, error }: PinModalProps) {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);

  const PIN_LENGTH = 6;

  useEffect(() => {
    // Auto-focus first input
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigit = (
    index: number,
    value: string,
    currentPin: string[],
    setCurrentPin: (p: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (!/^\d?$/.test(value)) return;

    const newPin = [...currentPin];
    newPin[index] = value;
    setCurrentPin(newPin);
    setLocalError('');

    if (value && index < PIN_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent,
    currentPin: string[],
    setCurrentPin: (p: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace' && !currentPin[index] && index > 0) {
      const newPin = [...currentPin];
      newPin[index - 1] = '';
      setCurrentPin(newPin);
      refs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const pinStr = pin.join('');

    if (pinStr.length < PIN_LENGTH) {
      setLocalError('Ingresa los 6 dígitos');
      return;
    }

    if (mode === 'setup' && step === 'enter') {
      setStep('confirm');
      setConfirmPin(['', '', '', '', '', '']);
      setTimeout(() => confirmRefs.current[0]?.focus(), 100);
      return;
    }

    if (mode === 'setup' && step === 'confirm') {
      const confirmStr = confirmPin.join('');
      if (pinStr !== confirmStr) {
        setLocalError('Los PINs no coinciden. Intenta de nuevo.');
        setConfirmPin(['', '', '', '', '', '']);
        setTimeout(() => confirmRefs.current[0]?.focus(), 100);
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit(pinStr);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Error al procesar PIN');
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || localError;

  const renderPinInputs = (
    currentPin: string[],
    setCurrentPin: (p: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => (
    <div className="flex gap-3 justify-center">
      {currentPin.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleDigit(i, e.target.value, currentPin, setCurrentPin, refs)}
          onKeyDown={(e) => handleKeyDown(i, e, currentPin, setCurrentPin, refs)}
          className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl
                     focus:outline-none focus:border-[#35D07F] transition-colors bg-white"
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">
            {mode === 'setup' ? '🔐' : '🔑'}
          </div>
          <h2 className="text-xl font-bold text-[#1E3A2F]">
            {mode === 'setup'
              ? (step === 'enter' ? 'Crea tu PIN de seguridad' : 'Confirma tu PIN')
              : 'Ingresa tu PIN'}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            {mode === 'setup'
              ? (step === 'enter'
                  ? 'Este PIN protege tus datos. Lo necesitarás si cambias de dispositivo.'
                  : 'Ingresa el mismo PIN para confirmar.')
              : 'Ingresa tu PIN para recuperar tus datos en este dispositivo.'}
          </p>
        </div>

        {/* PIN Input */}
        {step === 'enter' && renderPinInputs(pin, setPin, inputRefs)}
        {step === 'confirm' && renderPinInputs(confirmPin, setConfirmPin, confirmRefs)}

        {/* Warning message — only shown during setup */}
        {mode === 'setup' && step === 'enter' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              ⚠️ Si cambias de dispositivo o borras los datos del navegador, necesitarás este PIN para recuperar tus gastos.
              Sin el PIN, no será posible acceder a tu historial encriptado.
              <span className="font-bold"> Guárdalo en un lugar seguro.</span>
            </p>
          </div>
        )}

        {/* Error */}
        {displayError && (
          <p className="text-red-500 text-sm text-center mt-3">{displayError}</p>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#35D07F] text-white font-bold py-3 rounded-xl transition-opacity
                       active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Procesando...
              </>
            ) : mode === 'setup' ? (
              step === 'enter' ? 'Continuar' : 'Crear PIN'
            ) : (
              'Recuperar datos'
            )}
          </button>

          {mode === 'setup' && step === 'enter' && onSkip && (
            <button
              onClick={onSkip}
              className="w-full text-gray-400 text-sm py-2 transition-opacity active:opacity-60"
            >
              Configurar después
            </button>
          )}

          {step === 'confirm' && (
            <button
              onClick={() => {
                setStep('enter');
                setLocalError('');
              }}
              className="w-full text-gray-400 text-sm py-2 transition-opacity active:opacity-60"
            >
              Volver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
