import { RawTransaction, Transaction } from '../types';

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
  
  // For browser compatibility, use a simple hash function instead of crypto
  return simpleHash(hashInput);
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
 * Simple hash function that works in browsers
 * Based on Java's String.hashCode() algorithm
 */
function simpleHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string
  return Math.abs(hash).toString(16);
}

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