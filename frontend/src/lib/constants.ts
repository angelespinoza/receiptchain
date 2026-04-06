/**
 * ReceiptChain Constants
 * Global constants for the MiniPay Mini App on Celo blockchain
 */

import { defineChain } from 'viem';

// Smart contract address on Celo Sepolia
export const CONTRACT_ADDRESS = '0x92Ea27f36f601F8Ae5DE664fB41405D053bF0Abf' as const;

/**
 * Celo Sepolia Testnet Configuration
 * Mainnet: chainId 42220
 * Sepolia Testnet: chainId 11142220
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
 * Expense Categories with Spanish names, emojis, and colors
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
 * ExpenseRegistry Smart Contract ABI
 */
export const CONTRACT_ABI = [
  {
    type: 'function',
    name: 'registerExpense',
    inputs: [
      { name: '_dataHash', type: 'bytes32' },
      { name: '_amount', type: 'uint256' },
      { name: '_category', type: 'string' },
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
    name: 'expenses',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [
      { name: 'dataHash', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'category', type: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registerExpenseFor',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_dataHash', type: 'bytes32' },
      { name: '_amount', type: 'uint256' },
      { name: '_category', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'ExpenseRegistered',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'dataHash', type: 'bytes32', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'category', type: 'string', indexed: false },
    ],
  },
] as const;

/**
 * cUSD token address on Alfajores testnet
 */
export const cUSD_ADDRESS = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1' as const;

/**
 * Default network configuration
 */
export const DEFAULT_CHAIN = CELO_CHAIN;
