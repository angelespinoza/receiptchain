/**
 * ReceiptChain Constants
 * Global constants for the MiniPay Mini App on Celo blockchain
 */

import { defineChain } from 'viem';

// Smart contract address on Celo Sepolia
// NOTE: Update this after redeploying the v3 contract
export const CONTRACT_ADDRESS = '0xb53ee540C23A854c3c6928A3c23d9F87275bFdEa' as const;

/**
 * Celo Sepolia Testnet Configuration
 */
export const CELO_CHAIN = defineChain({
  id: 11142220,
  name: 'Celo Sepolia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: {
      http: ['https://forno.celo-sepolia.celo-testnet.org'],
    },
    public: {
      http: ['https://forno.celo-sepolia.celo-testnet.org'],
    },
  },
  blockExplorers: {
    default: { name: 'Celoscan', url: 'https://celo-sepolia.celoscan.io' },
  },
  testnet: true,
});

/**
 * Expense Categories
 */
export const CATEGORIES = [
  { id: 'alimentos', name: 'Alimentos', icon: '🍔', color: '#FF6B6B' },
  { id: 'transporte', name: 'Transporte', icon: '🚗', color: '#4ECDC4' },
  { id: 'hogar', name: 'Hogar', icon: '🏠', color: '#45B7D1' },
  { id: 'entretenimiento', name: 'Entretenimiento', icon: '🎬', color: '#FFA07A' },
  { id: 'salud', name: 'Salud', icon: '🏥', color: '#98D8C8' },
  { id: 'ropa', name: 'Ropa', icon: '👕', color: '#F7DC6F' },
  { id: 'educacion', name: 'Educación', icon: '📚', color: '#BB8FCE' },
  { id: 'otros', name: 'Otros', icon: '⚙️', color: '#95A5A6' },
] as const;

/**
 * ExpenseRegistry v3 ABI — Privacy-first
 * Only stores dataHash + dataCID on-chain
 */
export const CONTRACT_ABI = [
  {
    type: 'function',
    name: 'registerExpense',
    inputs: [
      { name: '_dataHash', type: 'bytes32' },
      { name: '_dataCID', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registerExpenseFor',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_dataHash', type: 'bytes32' },
      { name: '_dataCID', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getExpenseCount',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getExpense',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_index', type: 'uint256' },
    ],
    outputs: [
      { name: 'dataHash', type: 'bytes32' },
      { name: 'dataCID', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'ExpenseRegistered',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'dataHash', type: 'bytes32', indexed: false },
      { name: 'dataCID', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

/**
 * cUSD token address on Celo Sepolia
 */
export const cUSD_ADDRESS = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1' as const;

/**
 * Pinata IPFS Gateway
 */
export const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs' as const;

export const DEFAULT_CHAIN = CELO_CHAIN;
