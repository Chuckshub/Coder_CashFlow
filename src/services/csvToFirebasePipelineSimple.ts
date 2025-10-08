import { RawTransaction, Transaction } from '../types';
import { parseCSVFile, convertToTransaction, validateCSVStructure } from '../utils/csvParser';
import { categorizeTransactions } from '../utils/transactionCategorizer';
import { createTransactionHashFromProcessed } from '../utils/transactionHash';
import { getSimpleFirebaseService } from './firebaseServiceSimple';

// ============================================================================
// SIMPLIFIED CSV TO FIREBASE PIPELINE
// ============================================================================

export interface PipelineProgress {
  stage: 'parsing' | 'validating' | 'processing' | 'uploading' | 'complete';
  message: string;
  progress: number; // 0-100
  completed: number;
  total: number;
  errors: string[];
}

export interface PipelineResult {
  success: boolean;
  totalProcessed: number;
  uploaded: number;
  duplicates: number;
  errors: string[];
  uploadedHashes: string[];
  processingTimeMs: number;
}

export class SimpleCSVToFirebasePipeline {
  private userId: string;
  private onProgress?: (progress: PipelineProgress) => void;

  constructor(userId: string, onProgress?: (progress: PipelineProgress) => void) {
    this.userId = userId;
    this.onProgress = onProgress;
  }

  private updateProgress(update: Partial<PipelineProgress>) {
    if (this.onProgress) {
      const progress: PipelineProgress = {
        stage: 'parsing',
        message: '',
        progress: 0,
        completed: 0,
        total: 0,
        errors: [],
        ...update
      };
      this.onProgress(progress);
    }
  }

  /**
   * Process CSV file and upload to Firebase (SIMPLIFIED!)
   */
  async processCSVFile(file: File): Promise<PipelineResult> {
    const startTime = Date.now();
    console.log('🚀 Starting SIMPLIFIED CSV to Firebase pipeline for file:', file.name);
    
    const result: PipelineResult = {
      success: false,
      totalProcessed: 0,
      uploaded: 0,
      duplicates: 0,
      errors: [],
      uploadedHashes: [],
      processingTimeMs: 0
    };

    try {
      // Stage 1: Parse CSV File
      this.updateProgress({
        stage: 'parsing',
        message: 'Parsing CSV file...',
        progress: 20
      });

      const rawTransactions = await parseCSVFile(file);
      console.log('✅ Parsed', rawTransactions.length, 'raw transactions');
      
      if (rawTransactions.length === 0) {
        result.errors.push('No valid transactions found in CSV file');
        return result;
      }

      result.totalProcessed = rawTransactions.length;

      // Stage 2: Validate CSV Structure
      this.updateProgress({
        stage: 'validating',
        message: 'Validating CSV structure...',
        progress: 40,
        total: rawTransactions.length
      });

      const validation = validateCSVStructure(rawTransactions);
      if (!validation.isValid) {
        result.errors.push(`CSV validation failed: ${validation.errors.join(', ')}`);
        return result;
      }

      // Stage 3: Process Transactions
      this.updateProgress({
        stage: 'processing',
        message: 'Processing and categorizing transactions...',
        progress: 60,
        total: rawTransactions.length
      });

      // Convert, categorize, and add hashes
      let processedTransactions = rawTransactions.map(convertToTransaction);
      processedTransactions = categorizeTransactions(processedTransactions);
      
      // Ensure all transactions have hashes
      processedTransactions = processedTransactions.map(transaction => ({
        ...transaction,
        hash: transaction.hash || createTransactionHashFromProcessed(transaction)
      }));

      console.log('✅ Processed', processedTransactions.length, 'transactions with hashes');
      
      // Stage 4: Upload to Firebase (MUCH SIMPLER!)
      // Duplicate detection happens at the database level - Firestore uses transaction hash as document ID,
      // so duplicates from previous uploads are automatically prevented
      this.updateProgress({
        stage: 'uploading',
        message: 'Uploading to Firebase...',
        progress: 80,
        total: processedTransactions.length
      });

      const firebaseService = getSimpleFirebaseService(this.userId);
      const uploadResult = await firebaseService.uploadTransactions(processedTransactions);

      result.uploaded = uploadResult.uploaded;
      result.duplicates = uploadResult.duplicates;
      result.uploadedHashes = uploadResult.uploadedIds;
      result.errors.push(...uploadResult.errors);
      result.success = uploadResult.success;

      // Stage 5: Complete
      result.processingTimeMs = Date.now() - startTime;
      
      this.updateProgress({
        stage: 'complete',
        message: `Complete! Uploaded ${result.uploaded} transactions${result.duplicates > 0 ? `, ${result.duplicates} duplicates detected` : ''}`,
        progress: 100,
        completed: result.uploaded,
        total: result.totalProcessed,
        errors: result.errors
      });

      console.log('🎉 SIMPLIFIED pipeline completed:', result);
      return result;

    } catch (error) {
      const errorMsg = `Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('💥 Pipeline error:', error);
      
      result.errors.push(errorMsg);
      result.processingTimeMs = Date.now() - startTime;
      
      this.updateProgress({
        stage: 'parsing',
        message: errorMsg,
        errors: result.errors
      });
      
      return result;
    }
  }

  /**
   * Process raw transactions directly (SIMPLIFIED!)
   */
  async processRawTransactions(rawTransactions: RawTransaction[]): Promise<PipelineResult> {
    const startTime = Date.now();
    console.log('🚀 Processing', rawTransactions.length, 'raw transactions with SIMPLIFIED pipeline');
    
    const result: PipelineResult = {
      success: false,
      totalProcessed: rawTransactions.length,
      uploaded: 0,
      duplicates: 0,
      errors: [],
      uploadedHashes: [],
      processingTimeMs: 0
    };

    if (rawTransactions.length === 0) {
      result.success = true;
      return result;
    }

    try {
      // Validate
      const validation = validateCSVStructure(rawTransactions);
      if (!validation.isValid) {
        result.errors.push(`Validation failed: ${validation.errors.join(', ')}`);
        return result;
      }

      // Process
      let processedTransactions = rawTransactions.map(convertToTransaction);
      processedTransactions = categorizeTransactions(processedTransactions);
      processedTransactions = processedTransactions.map(transaction => ({
        ...transaction,
        hash: transaction.hash || createTransactionHashFromProcessed(transaction)
      }));

      // Upload (MUCH SIMPLER!)
      const firebaseService = getSimpleFirebaseService(this.userId);
      const uploadResult = await firebaseService.uploadTransactions(processedTransactions);
      
      result.uploaded = uploadResult.uploaded;
      result.duplicates = uploadResult.duplicates;
      result.uploadedHashes = uploadResult.uploadedIds;
      result.errors.push(...uploadResult.errors);
      result.success = uploadResult.success;
      result.processingTimeMs = Date.now() - startTime;

      return result;
      
    } catch (error) {
      const errorMsg = `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      result.processingTimeMs = Date.now() - startTime;
      return result;
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS (SIMPLIFIED!)
// ============================================================================

/**
 * Process a CSV file with the simplified pipeline
 */
export const processCSVFileSimple = async (
  file: File,
  userId: string,
  onProgress?: (progress: PipelineProgress) => void
): Promise<PipelineResult> => {
  const pipeline = new SimpleCSVToFirebasePipeline(userId, onProgress);
  return pipeline.processCSVFile(file);
};

/**
 * Process raw transactions with the simplified pipeline
 */
export const processRawTransactionsSimple = async (
  rawTransactions: RawTransaction[],
  userId: string
): Promise<PipelineResult> => {
  const pipeline = new SimpleCSVToFirebasePipeline(userId);
  return pipeline.processRawTransactions(rawTransactions);
};