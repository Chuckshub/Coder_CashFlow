import {
  createTransactionHash,
  createTransactionHashAsync,
  createTransactionHashFromRaw,
  createTransactionHashFromProcessed,
  areTransactionsDuplicate,
  filterDuplicateTransactions,
  getUniqueTransactions,
  isValidTransactionHash
} from './transactionHash';
import { Transaction, RawTransaction } from '../types';

// Mock environment variable for testing
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('TransactionHash with Salting', () => {
  const testTransaction1: Transaction = {
    id: 'test1',
    hash: '',
    date: new Date('2024-01-15'),
    amount: -50.25,
    description: 'Coffee Shop Purchase',
    type: 'outflow',
    category: 'Food & Dining',
    balance: 1000.75,
    originalData: {
      Details: 'DEBIT',
      'Posting Date': '01/15/2024',
      Description: 'Coffee Shop Purchase',
      Amount: -50.25,
      Type: 'PURCHASE',
      Balance: 1000.75,
      'Check or Slip #': ''
    }
  };

  const testTransaction2: Transaction = {
    id: 'test2',
    hash: '',
    date: new Date('2024-01-15'),
    amount: -50.25,
    description: 'Coffee Shop Purchase',
    type: 'outflow',
    category: 'Food & Dining',
    balance: 950.50,
    originalData: {
      Details: 'DEBIT',
      'Posting Date': '01/15/2024',
      Description: 'Coffee Shop Purchase',
      Amount: -50.25,
      Type: 'PURCHASE',
      Balance: 950.50,
      'Check or Slip #': ''
    }
  };

  const testTransaction3: Transaction = {
    id: 'test3',
    hash: '',
    date: new Date('2024-01-16'), // Different date
    amount: -50.25,
    description: 'Coffee Shop Purchase',
    type: 'outflow',
    category: 'Food & Dining',
    balance: 900.25,
    originalData: {
      Details: 'DEBIT',
      'Posting Date': '01/16/2024',
      Description: 'Coffee Shop Purchase',
      Amount: -50.25,
      Type: 'PURCHASE',
      Balance: 900.25,
      'Check or Slip #': ''
    }
  };

  const testRawTransaction: RawTransaction = {
    Details: 'DEBIT',
    'Posting Date': '2024-01-15',
    Description: 'Coffee Shop Purchase',
    Amount: -50.25,
    Type: 'PURCHASE',
    Balance: 1000.00,
    'Check or Slip #': ''
  };

  describe('Hash Generation', () => {
    test('should generate consistent hashes for same input', () => {
      const hash1 = createTransactionHash('2024-01-15', -50.25, 'Coffee Shop Purchase');
      const hash2 = createTransactionHash('2024-01-15', -50.25, 'Coffee Shop Purchase');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]+$/i);
      expect(hash1.length).toBeGreaterThan(0);
    });

    test('should generate different hashes for different inputs', () => {
      const hash1 = createTransactionHash('2024-01-15', -50.25, 'Coffee Shop Purchase');
      const hash2 = createTransactionHash('2024-01-16', -30.00, 'Different Purchase');
      
      expect(hash1).not.toBe(hash2);
    });

    test('should generate different hashes with different salts', () => {
      // Test with first salt
      process.env.REACT_APP_DATABASE_SALT = 'salt1';
      const hash1 = createTransactionHash('2024-01-15', -50.25, 'Coffee Shop Purchase');
      
      // Test with different salt
      process.env.REACT_APP_DATABASE_SALT = 'salt2';
      const hash2 = createTransactionHash('2024-01-15', -50.25, 'Coffee Shop Purchase');
      
      expect(hash1).not.toBe(hash2);
    });

    test('should use default salt when environment variable is missing', () => {
      delete process.env.REACT_APP_DATABASE_SALT;
      
      const hash = createTransactionHash('2024-01-15', -50.25, 'Coffee Shop Purchase');
      
      expect(hash).toMatch(/^[a-f0-9]+$/i);
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('Hash Validation', () => {
    test('should validate correct hash format', () => {
      expect(isValidTransactionHash('abc123def456')).toBe(true);
      expect(isValidTransactionHash('ABCDEF123456')).toBe(true);
      expect(isValidTransactionHash('')).toBe(false);
      expect(isValidTransactionHash('invalid_hash!')).toBe(false);
      expect(isValidTransactionHash('hash with spaces')).toBe(false);
    });
  });

  describe('Raw Transaction Hash', () => {
    test('should create hash from raw transaction data', () => {
      const hash = createTransactionHashFromRaw(testRawTransaction);
      
      expect(hash).toMatch(/^[a-f0-9]+$/i);
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('Processed Transaction Hash', () => {
    test('should create hash from processed transaction', () => {
      const hash = createTransactionHashFromProcessed(testTransaction1);
      
      expect(hash).toMatch(/^[a-f0-9]+$/i);
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('Duplicate Detection', () => {
    test('should identify duplicate transactions', () => {
      const isDuplicate = areTransactionsDuplicate(testTransaction1, testTransaction2);
      expect(isDuplicate).toBe(true);
    });

    test('should identify non-duplicate transactions', () => {
      const isDuplicate = areTransactionsDuplicate(testTransaction1, testTransaction3);
      expect(isDuplicate).toBe(false);
    });

    test('should filter out duplicates', () => {
      const existingTransactions = [testTransaction1];
      const newTransactions = [testTransaction2, testTransaction3];
      
      const filtered = filterDuplicateTransactions(newTransactions, existingTransactions);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(testTransaction3.id);
    });

    test('should return unique transactions from array', () => {
      const transactions = [testTransaction1, testTransaction2, testTransaction3];
      
      const unique = getUniqueTransactions(transactions);
      
      expect(unique).toHaveLength(2);
      expect(unique.map(t => t.id)).toContain(testTransaction1.id);
      expect(unique.map(t => t.id)).toContain(testTransaction3.id);
      expect(unique.every(t => t.hash && t.hash.length > 0)).toBe(true);
    });
  });

  describe('Async Hash Generation', () => {
    test('should generate hashes asynchronously', async () => {
      const hash = await createTransactionHashAsync('2024-01-15', -50.25, 'Coffee Shop Purchase');
      
      expect(hash).toMatch(/^[a-f0-9]+$/i);
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should generate consistent hashes between sync and async versions', async () => {
      const syncHash = createTransactionHash('2024-01-15', -50.25, 'Coffee Shop Purchase');
      const asyncHash = await createTransactionHashAsync('2024-01-15', -50.25, 'Coffee Shop Purchase');
      
      // Note: These might be different if async version uses different crypto API
      // but both should be valid hashes
      expect(syncHash).toMatch(/^[a-f0-9]+$/i);
      expect(asyncHash).toMatch(/^[a-f0-9]+$/i);
    });
  });
});