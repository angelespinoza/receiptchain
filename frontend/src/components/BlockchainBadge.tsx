interface BlockchainBadgeProps {
  txHash: string;
  compact?: boolean;
}

export default function BlockchainBadge({ txHash, compact = false }: BlockchainBadgeProps) {
  // Format transaction hash - show first 6 and last 4 chars
  const truncatedHash = `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 text-[#35D07F] text-sm font-medium">
        <span>⛓</span>
        <span className="font-mono">{truncatedHash}</span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#1E3A2F] to-[#2D5A4A] rounded-2xl p-4 text-white">
      {/* Header with chain icon */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⛓</span>
        <h3 className="font-bold text-sm">Registro en Blockchain</h3>
      </div>

      {/* Explanation text */}
      <p className="text-xs text-gray-200 mb-3 leading-relaxed">
        Se registrará un hash de tu gasto en la blockchain de Celo. Esto garantiza
        transparencia, seguridad e inmutabilidad de tu registro.
      </p>

      {/* Transaction hash */}
      <div className="bg-white bg-opacity-10 rounded-lg px-3 py-2 mb-3">
        <p className="text-xs text-gray-300 mb-1">Hash de transacción</p>
        <p className="font-mono text-xs text-[#35D07F] break-all">{txHash}</p>
      </div>

      {/* Cost estimate - subsidized */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-300">Costo para ti</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 line-through">$0.005</span>
          <p className="text-sm font-bold text-[#35D07F]">GRATIS ✓</p>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-1">El gas es subsidiado por ReceiptChain</p>
    </div>
  );
}
