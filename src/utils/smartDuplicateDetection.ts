import { Transaction, RawTransaction } from '../types';
import { createTransactionHashFromRaw } from './transactionHash';

/**
 * Smart duplicate detection utilities
 * Handles both exact duplicates and "fuzzy" duplicates that might be legitimate duplicates
 * but have slight variations in data
 */

interface SimilarityOptions {
  maxDateDifferenceHours?: number; // Maximum hours between similar transactions
  descriptionSimilarityThreshold?: number; // 0-1, how similar descriptions must be
  allowAmountVariance?: number; // Allow small amount differences (e.g., $0.01)
}

const DEFAULT_SIMILARITY_OPTIONS: SimilarityOptions = {
  maxDateDifferenceHours: 72, // 3 days
  descriptionSimilarityThreshold: 0.8, // 80% similarity
  allowAmountVariance: 0.01 // $0.01 variance
};

/**
 * Calculate similarity between two strings (0-1, where 1 is identical)
 * Uses a simple algorithm based on common words and length
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  
  // Split into words and compare
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  // Count common words
  let commonWords = 0;
  const totalWords = Math.max(words1.length, words2.length);
  
  for (const word1 of words1) {
    if (words2.includes(word1)) {
      commonWords++;
    }
  }
  
  // Basic similarity score based on common words
  const wordSimilarity = commonWords / totalWords;
  
  // Also consider overall string similarity (Jaccard similarity)
  const chars1 = new Set(s1.replace(/\s/g, ''));
  const chars2 = new Set(s2.replace(/\s/g, ''));
  const intersection = new Set(Array.from(chars1).filter(x => chars2.has(x)));
  const union = new Set(Array.from(chars1).concat(Array.from(chars2)));
  const charSimilarity = intersection.size / union.size;
  
  // Combine both metrics
  return (wordSimilarity * 0.7 + charSimilarity * 0.3);
}

/**
 * Check if two transactions are similar enough to be considered duplicates
 */
export function areTransactionsSimilar(
  trans1: Transaction | RawTransaction,
  trans2: Transaction | RawTransaction,
  options: SimilarityOptions = DEFAULT_SIMILARITY_OPTIONS
): boolean {
  // Extract comparable data from both transaction types
  const getData = (t: Transaction | RawTransaction) => {
    if ('originalData' in t) {
      // It's a processed Transaction
      return {
        date: t.date,
        amount: t.amount,
        description: t.description
      };
    } else {
      // It's a RawTransaction
      return {
        date: new Date(t['Posting Date']),
        amount: Math.abs(t.Amount),
        description: t.Description
      };
    }
  };
  
  const data1 = getData(trans1);
  const data2 = getData(trans2);
  
  // Check date similarity
  const dateDiffMs = Math.abs(data1.date.getTime() - data2.date.getTime());
  const maxDateDiffMs = (options.maxDateDifferenceHours || DEFAULT_SIMILARITY_OPTIONS.maxDateDifferenceHours!) * 60 * 60 * 1000;
  
  if (dateDiffMs > maxDateDiffMs) {
    return false; // Too far apart in time
  }
  
  // Check amount similarity
  const amountDiff = Math.abs(data1.amount - data2.amount);
  const maxAmountVariance = options.allowAmountVariance || DEFAULT_SIMILARITY_OPTIONS.allowAmountVariance!;
  
  if (amountDiff > maxAmountVariance) {
    return false; // Amounts too different
  }
  
  // Check description similarity
  const descSimilarity = calculateStringSimilarity(data1.description, data2.description);
  const minSimilarity = options.descriptionSimilarityThreshold || DEFAULT_SIMILARITY_OPTIONS.descriptionSimilarityThreshold!;
  
  if (descSimilarity < minSimilarity) {
    return false; // Descriptions too different
  }
  
  console.log(`🔍 Found similar transactions:`);
  console.log(`  Date diff: ${Math.round(dateDiffMs / 1000 / 60 / 60)} hours`);
  console.log(`  Amount diff: $${amountDiff.toFixed(2)}`);
  console.log(`  Description similarity: ${(descSimilarity * 100).toFixed(1)}%`);
  console.log(`  Transaction 1: ${data1.date.toDateString()} $${data1.amount} "${data1.description.substring(0, 50)}..."`);
  console.log(`  Transaction 2: ${data2.date.toDateString()} $${data2.amount} "${data2.description.substring(0, 50)}..."`);  
  
  return true; // They are similar enough
}

/**
 * Find potentially duplicate transactions in a list
 * Returns groups of similar transactions
 */
export function findSimilarTransactionGroups(
  transactions: (Transaction | RawTransaction)[],
  options: SimilarityOptions = DEFAULT_SIMILARITY_OPTIONS
): (Transaction | RawTransaction)[][] {
  const groups: (Transaction | RawTransaction)[][] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < transactions.length; i++) {
    if (processed.has(i)) continue;
    
    const group = [transactions[i]];
    processed.add(i);
    
    // Find similar transactions
    for (let j = i + 1; j < transactions.length; j++) {
      if (processed.has(j)) continue;
      
      if (areTransactionsSimilar(transactions[i], transactions[j], options)) {
        group.push(transactions[j]);
        processed.add(j);
      }
    }
    
    // Only add groups that have more than one transaction (potential duplicates)
    if (group.length > 1) {
      groups.push(group);
    }
  }
  
  return groups;
}

/**
 * Remove similar duplicates from a transaction list, keeping the first occurrence
 */
export function removeSimilarDuplicates(
  transactions: (Transaction | RawTransaction)[],
  options: SimilarityOptions = DEFAULT_SIMILARITY_OPTIONS
): {
  unique: (Transaction | RawTransaction)[];
  removed: (Transaction | RawTransaction)[];
  groups: (Transaction | RawTransaction)[][];
} {
  const groups = findSimilarTransactionGroups(transactions, options);
  const toRemove = new Set<number>();
  
  // For each group, keep the first transaction and mark others for removal
  groups.forEach(group => {
    for (let i = 1; i < group.length; i++) {
      const index = transactions.indexOf(group[i]);
      if (index !== -1) {
        toRemove.add(index);
      }
    }
  });
  
  const unique = transactions.filter((_, index) => !toRemove.has(index));
  const removed = transactions.filter((_, index) => toRemove.has(index));
  
  console.log(`🧹 Smart duplicate removal:`);
  console.log(`  Original: ${transactions.length} transactions`);
  console.log(`  Unique: ${unique.length} transactions`);
  console.log(`  Removed: ${removed.length} duplicates`);
  console.log(`  Groups found: ${groups.length}`);
  
  return { unique, removed, groups };
}

/**
 * Create a "fuzzy" hash for similar transaction detection
 * This creates a hash that's the same for similar transactions
 */
export function createFuzzyTransactionHash(
  transaction: Transaction | RawTransaction,
  options: { 
    datePrecisionDays?: number; // Round dates to this many days
    amountPrecisionDollars?: number; // Round amounts to this precision
    descriptionWords?: number; // Use only first N words of description
  } = {}
): string {
  const { datePrecisionDays = 1, amountPrecisionDollars = 1, descriptionWords = 10 } = options;
  
  // Extract data
  const getData = (t: Transaction | RawTransaction) => {
    if ('originalData' in t) {
      return { date: t.date, amount: t.amount, description: t.description };
    } else {
      return {
        date: new Date(t['Posting Date']),
        amount: Math.abs(t.Amount),
        description: t.Description
      };
    }
  };
  
  const data = getData(transaction);
  
  // Round date to nearest day boundary
  const roundedDate = new Date(data.date);
  roundedDate.setHours(0, 0, 0, 0);
  const dateKey = roundedDate.toISOString().split('T')[0];
  
  // Round amount
  const roundedAmount = Math.round(data.amount / amountPrecisionDollars) * amountPrecisionDollars;
  
  // Simplify description (first N words, normalized)
  const words = data.description.trim().toUpperCase().split(/\s+/).slice(0, descriptionWords);
  const simplifiedDesc = words.join(' ');
  
  // Create fuzzy hash input
  const fuzzyInput = `${dateKey}|${roundedAmount}|${simplifiedDesc}`;
  
  // Simple hash
  let hash = 0;
  for (let i = 0; i < fuzzyInput.length; i++) {
    const char = fuzzyInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}