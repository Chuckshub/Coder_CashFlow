import { Transaction, RawTransaction } from '../types';

/**
 * Creates a hash from transaction data to prevent duplicates
 * Uses date, amount, and description to create a unique identifier
 */
export const createTransactionHash = (date: string, amount: number, description: string): string => {
  // Normalize the data
  const normalizedDate = new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD format
  const normalizedAmount = Math.abs(amount).toFixed(2); // Always positive, 2 decimals
  const normalizedDescription = description.trim().toUpperCase(); // Uppercase, trimmed
  
  // Create a simple hash string
  const hashString = `${normalizedDate}|${normalizedAmount}|${normalizedDescription}`;
  
  // Create a simple hash using built-in methods
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    const char = hashString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Return as positive hex string
  return Math.abs(hash).toString(16);
};

/**
 * Creates hash from a processed Transaction object
 */
export const createTransactionHashFromTransaction = (transaction: Transaction): string => {
  return createTransactionHash(
    transaction.date.toISOString(),
    transaction.amount,
    transaction.description
  );
};

/**
 * Creates hash from a raw CSV transaction
 */
export const createTransactionHashFromRaw = (rawTransaction: RawTransaction): string => {
  return createTransactionHash(
    rawTransaction['Posting Date'],
    rawTransaction.Amount,
    rawTransaction.Description
  );
};

/**
 * Check if a transaction hash already exists in a list of transactions
 */
export const isTransactionDuplicate = (hash: string, existingTransactions: Transaction[]): boolean => {
  return existingTransactions.some(transaction => {
    const existingHash = createTransactionHashFromTransaction(transaction);
    return existingHash === hash;
  });
};

/**
 * Filter out duplicate transactions from a list
 */
export const filterDuplicateTransactions = (
  newTransactions: Transaction[], 
  existingTransactions: Transaction[] = []
): Transaction[] => {
  const existingHashes = existingTransactions.map(createTransactionHashFromTransaction);
  
  return newTransactions.filter(transaction => {
    const hash = createTransactionHashFromTransaction(transaction);
    return !existingHashes.includes(hash);
  });
};

/**
 * Get transaction statistics including duplicates found
 */
export const getTransactionStats = (
  newTransactions: Transaction[], 
  existingTransactions: Transaction[] = []
) => {
  const uniqueTransactions = filterDuplicateTransactions(newTransactions, existingTransactions);
  const duplicatesFound = newTransactions.length - uniqueTransactions.length;
  
  return {
    total: newTransactions.length,
    unique: uniqueTransactions.length,
    duplicates: duplicatesFound,
    uniqueTransactions
  };
};