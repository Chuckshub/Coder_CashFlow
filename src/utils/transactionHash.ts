import { RawTransaction, Transaction } from '../types';

/**
 * Get the database salt from environment variables
 * This salt should be stored as an environment variable in Vercel
 */
const getDatabaseSalt = (): string => {
  // Try different possible environment variable names
  const salt = process.env.REACT_APP_DATABASE_SALT || 
               process.env.DATABASE_SALT || 
               process.env.VITE_DATABASE_SALT;
               
  if (!salt) {
    console.warn('⚠️  DATABASE_SALT not found in environment variables.');
    console.warn('🔍 Available env vars:', Object.keys(process.env).filter(key => key.includes('SALT')));
    console.warn('🔧 Using default salt for development - SHOULD BE REPLACED IN PRODUCTION');
    
    // Use a default salt for development - should be replaced in production
    const defaultSalt = 'coder_cashflow_default_salt_2024';
    console.warn('🧂 Default salt being used:', defaultSalt.substring(0, 10) + '...');
    return defaultSalt;
  }
  
  console.log('✅ Using production salt from environment variables');
  console.log('🧂 Salt loaded (first 10 chars):', salt.substring(0, 10) + '...');
  return salt;
};

/**
 * Secure hash function using Web Crypto API with salting
 * Falls back to enhanced simple hash for environments without crypto support
 */
async function createSecureHash(input: string): Promise<string> {
  const salt = getDatabaseSalt();
  const saltedInput = `${salt}|${input}`;
  
  // Try to use SubtleCrypto API for secure hashing
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(saltedInput);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('SubtleCrypto not available, falling back to enhanced hash:', error);
    }
  }
  
  // Fallback: Enhanced hash with salting for Node.js environments
  return enhancedSimpleHash(saltedInput);
}

/**
 * Synchronous secure hash function for backwards compatibility
 * Uses salting with enhanced simple hash algorithm
 */
function createSecureHashSync(input: string): string {
  const salt = getDatabaseSalt();
  const saltedInput = `${salt}|${input}`;
  
  console.log('  🧂 Salt applied:', salt.substring(0, 15) + '...');
  console.log('  🔗 Salted input length:', saltedInput.length);
  
  const result = enhancedSimpleHash(saltedInput);
  
  console.log('  ⚙️ Hash algorithm: enhancedSimpleHash');
  console.log('  🎯 Final result:', result);
  
  return result;
}

/**
 * Enhanced hash function with better collision resistance
 * Based on djb2 algorithm with additional mixing
 */
function enhancedSimpleHash(str: string): string {
  let hash1 = 5381; // djb2 hash
  let hash2 = 0;    // Additional hash for mixing
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    // djb2: hash * 33 + char
    hash1 = ((hash1 << 5) + hash1) + char;
    // Additional mixing
    hash2 = ((hash2 << 3) + hash2) ^ char;
  }
  
  // Combine both hashes and ensure positive result
  const combined = Math.abs(hash1 ^ hash2);
  return combined.toString(16).padStart(8, '0');
}

/**
 * Create a unique hash for a transaction based on date, amount, and description
 * This helps prevent duplicate transactions in the database
 */
export const createTransactionHash = (
  date: string,
  amount: number,
  description: string
): string => {
  // Normalize the inputs
  const normalizedDate = new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD format
  const normalizedAmount = Math.round(amount * 100) / 100; // Round to 2 decimal places
  const normalizedDescription = description.trim().toUpperCase(); // Consistent case
  
  // Create the hash input string
  const hashInput = `${normalizedDate}|${normalizedAmount}|${normalizedDescription}`;
  
  console.log('🔍 Transaction hash generation:');
  console.log('  📅 Date:', date, '->', normalizedDate);
  console.log('  💰 Amount:', amount, '->', normalizedAmount);
  console.log('  📝 Description length:', description.length, '->', normalizedDescription.length);
  console.log('  🔗 Hash input:', hashInput.substring(0, 100) + (hashInput.length > 100 ? '...' : ''));
  
  // Use secure salted hash function
  const result = createSecureHashSync(hashInput);
  
  console.log('  ✨ Generated hash:', result);
  console.log('  🔍 Hash length:', result.length);
  
  return result;
};

/**
 * Async version of createTransactionHash using Web Crypto API when available
 */
export const createTransactionHashAsync = async (
  date: string,
  amount: number,
  description: string
): Promise<string> => {
  // Normalize the inputs
  const normalizedDate = new Date(date).toISOString().split('T')[0];
  const normalizedAmount = Math.round(amount * 100) / 100;
  const normalizedDescription = description.trim().toUpperCase();
  
  // Create the hash input string
  const hashInput = `${normalizedDate}|${normalizedAmount}|${normalizedDescription}`;
  
  // Use async secure hash function
  return await createSecureHash(hashInput);
};

/**
 * Create hash from raw transaction data
 */
export const createTransactionHashFromRaw = (raw: RawTransaction): string => {
  return createTransactionHash(
    raw['Posting Date'],
    raw.Amount,
    raw.Description
  );
};

/**
 * Create hash from processed transaction
 */
export const createTransactionHashFromProcessed = (transaction: Transaction): string => {
  return createTransactionHash(
    transaction.date.toISOString(),
    transaction.amount,
    transaction.description
  );
};

/**
 * Async version of createTransactionHashFromProcessed
 */
export const createTransactionHashFromProcessedAsync = async (transaction: Transaction): Promise<string> => {
  return await createTransactionHashAsync(
    transaction.date.toISOString(),
    transaction.amount,
    transaction.description
  );
};

/**
 * Check if two transactions are duplicates based on their hashes
 */
export const areTransactionsDuplicate = (
  transaction1: Transaction,
  transaction2: Transaction
): boolean => {
  const hash1 = createTransactionHashFromProcessed(transaction1);
  const hash2 = createTransactionHashFromProcessed(transaction2);
  return hash1 === hash2;
};

/**
 * Filter out duplicate transactions from an array
 */
export const filterDuplicateTransactions = (
  newTransactions: Transaction[],
  existingTransactions: Transaction[]
): Transaction[] => {
  const existingHashes = new Set(
    existingTransactions.map(t => createTransactionHashFromProcessed(t))
  );
  
  return newTransactions.filter(transaction => {
    const hash = createTransactionHashFromProcessed(transaction);
    return !existingHashes.has(hash);
  });
};

/**
 * Get unique transactions within a single array
 */
export const getUniqueTransactions = (transactions: Transaction[]): Transaction[] => {
  const seenHashes = new Set<string>();
  const uniqueTransactions: Transaction[] = [];
  
  for (const transaction of transactions) {
    const hash = createTransactionHashFromProcessed(transaction);
    if (!seenHashes.has(hash)) {
      seenHashes.add(hash);
      uniqueTransactions.push({
        ...transaction,
        hash // Add hash to the transaction for future reference
      });
    }
  }
  
  return uniqueTransactions;
};

/**
 * Validate transaction hash
 */
export const isValidTransactionHash = (hash: string): boolean => {
  return /^[a-f0-9]+$/i.test(hash) && hash.length > 0;
};