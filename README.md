# ReceiptChain 🧾⛓️

Mini App para MiniPay (Celo) que permite escanear recibos de pago, extraer datos con OCR, y registrar gastos en la blockchain de Celo con gas subsidiado.

## Características

- **OCR de recibos**: Escanea recibos con la cámara y extrae datos automáticamente (Tesseract.js, español)
- **Registro en blockchain**: Cada gasto se registra como hash en Celo con gas subsidiado (patrón relayer)
- **Gastos organizados**: Dashboard con categorías, totales mensuales y historial
- **Privacidad**: Las imágenes se guardan solo en el dispositivo (IndexedDB)
- **Sin costo para el usuario**: El gas lo paga el relayer, no el usuario

## Stack Técnico

- **Frontend**: Next.js 16 + TypeScript + TailwindCSS v4
- **Blockchain**: Celo Sepolia Testnet, viem, Solidity ^0.8.24
- **OCR**: Tesseract.js (client-side)
- **Storage**: IndexedDB (local)
- **Smart Contract**: `ExpenseRegistry.sol` con patrón relayer

## Estructura

```
receiptchain/
├── contracts/          # Smart contracts (Hardhat)
│   ├── contracts/      # Solidity files
│   ├── scripts/        # Deploy scripts
│   └── hardhat.config.ts
├── frontend/           # Next.js app
│   ├── src/app/        # Pages (dashboard, scan, history, settings)
│   ├── src/components/ # UI components
│   └── src/lib/        # Utils (blockchain, OCR, storage, wallet)
└── README.md
```

## Setup

### 1. Smart Contract

```bash
cd contracts
npm install
cp .env.example .env
# Editar .env con tu RELAYER_PRIVATE_KEY
npx hardhat compile
npx hardhat run scripts/deploy.ts --network celo-sepolia
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Editar .env con RELAYER_PRIVATE_KEY y CONTRACT_ADDRESS
npm run dev
```

### 3. Testing en MiniPay

```bash
# Opción A: ngrok
ngrok http 3000

# Opción B: Deploy en Vercel y usar la URL
```

## Contrato Deployado

- **Red**: Celo Sepolia Testnet
- **Dirección**: `0x92Ea27f36f601F8Ae5DE664fB41405D053bF0Abf`
- **Explorer**: [Ver en CeloScan](https://celo-sepolia.celoscan.io/address/0x92Ea27f36f601F8Ae5DE664fB41405D053bF0Abf)

## Licencia

MIT
