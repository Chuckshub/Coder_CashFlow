import { RawTransaction, Transaction } from '../types';
import { parseCSVFile, convertToTransaction, validateCSVStructure } from '../utils/csvParser';
import { categorizeTransactions } from '../utils/transactionCategorizer';
import { createTransactionHashFromProcessed } from '../utils/transactionHash';
import { getFirebaseService } from './firebaseService';

// ============================================================================
// CSV TO FIREBASE PIPELINE
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
  uploadedIds: string[];
  processingTimeMs: number;
}

export class CSVToFirebasePipeline {
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
   * Process CSV file and upload to Firebase
   */
  async processCSVFile(file: File): Promise<PipelineResult> {
    const startTime = Date.now();
    console.log('🚀 Starting CSV to Firebase pipeline for file:', file.name);
    
    const result: PipelineResult = {
      success: false,
      totalProcessed: 0,
      uploaded: 0,
      duplicates: 0,
      errors: [],
      uploadedIds: [],
      processingTimeMs: 0
    };

    try {
      // Stage 1: Parse CSV File
      this.updateProgress({
        stage: 'parsing',
        message: 'Parsing CSV file...',
        progress: 10
      });

      let rawTransactions: RawTransaction[];
      try {
        rawTransactions = await parseCSVFile(file);
        console.log('✅ Parsed', rawTransactions.length, 'raw transactions');
      } catch (error) {
        const errorMsg = `CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        this.updateProgress({
          stage: 'parsing',
          message: errorMsg,
          errors: result.errors
        });
        return result;
      }

      if (rawTransactions.length === 0) {
        result.errors.push('No valid transactions found in CSV file');
        this.updateProgress({
          stage: 'parsing',
          message: 'No transactions found',
          errors: result.errors
        });
        return result;
      }

      result.totalProcessed = rawTransactions.length;

      // Stage 2: Validate CSV Structure
      this.updateProgress({
        stage: 'validating',
        message: 'Validating CSV structure...',
        progress: 20,
        total: rawTransactions.length
      });

      const validation = validateCSVStructure(rawTransactions);
      if (!validation.isValid) {
        const errorMsg = `CSV validation failed: ${validation.errors.join(', ')}`;
        result.errors.push(errorMsg);
        this.updateProgress({
          stage: 'validating',
          message: errorMsg,
          errors: result.errors
        });
        return result;
      }

      console.log('✅ CSV structure validation passed');

      // Stage 3: Process Transactions
      this.updateProgress({
        stage: 'processing',
        message: 'Processing transactions...',
        progress: 40,
        total: rawTransactions.length
      });

      let processedTransactions: Transaction[];
      try {
        // Convert raw transactions to processed format
        processedTransactions = rawTransactions.map(convertToTransaction);
        console.log('✅ Converted', processedTransactions.length, 'transactions');

        // Categorize transactions
        processedTransactions = categorizeTransactions(processedTransactions);
        console.log('✅ Categorized', processedTransactions.length, 'transactions');

        // Add hashes for duplicate detection
        processedTransactions = processedTransactions.map(transaction => ({
          ...transaction,
          hash: transaction.hash || createTransactionHashFromProcessed(transaction)
        }));
        console.log('✅ Added hashes to', processedTransactions.length, 'transactions');

      } catch (error) {
        const errorMsg = `Transaction processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        this.updateProgress({
          stage: 'processing',
          message: errorMsg,
          errors: result.errors
        });
        return result;
      }

      // Stage 4: Upload to Firebase
      this.updateProgress({
        stage: 'uploading',
        message: 'Uploading to Firebase...',
        progress: 60,
        total: processedTransactions.length
      });

      try {
        const firebaseService = getFirebaseService(this.userId);
        await firebaseService.initialize();

        const uploadResult = await firebaseService.uploadCSVTransactions(
          processedTransactions,
          (uploadProgress) => {
            this.updateProgress({
              stage: 'uploading',
              message: `Uploading... ${uploadProgress.completed}/${uploadProgress.total}`,
              progress: 60 + (uploadProgress.completed / uploadProgress.total) * 30,
              completed: uploadProgress.completed,
              total: uploadProgress.total,
              errors: [...result.errors, ...uploadProgress.errors]
            });
          }
        );

        result.uploaded = uploadResult.uploaded;
        result.duplicates = uploadResult.duplicates;
        result.uploadedIds = uploadResult.uploadedIds;
        result.errors.push(...uploadResult.errors);
        result.success = uploadResult.success;

        console.log('✅ Firebase upload completed:', uploadResult);

      } catch (error) {
        const errorMsg = `Firebase upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        this.updateProgress({
          stage: 'uploading',
          message: errorMsg,
          errors: result.errors
        });
        return result;
      }

      // Stage 5: Complete
      result.processingTimeMs = Date.now() - startTime;
      
      this.updateProgress({
        stage: 'complete',
        message: `Processing complete! Uploaded ${result.uploaded} transactions, found ${result.duplicates} duplicates`,
        progress: 100,
        completed: result.uploaded,
        total: result.totalProcessed,
        errors: result.errors
      });

      console.log('🎉 Pipeline completed successfully:', result);
      return result;

    } catch (error) {
      const errorMsg = `Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('💥 Pipeline error:', error);
      
      result.errors.push(errorMsg);
      result.processingTimeMs = Date.now() - startTime;
      
      this.updateProgress({
        stage: 'parsing', // Reset to parsing stage on failure
        message: errorMsg,
        errors: result.errors
      });
      
      return result;
    }
  }

  /**
   * Process raw transactions directly (for testing or when you already have parsed data)
   */
  async processRawTransactions(rawTransactions: RawTransaction[]): Promise<PipelineResult> {
    const startTime = Date.now();
    console.log('🚀 Processing', rawTransactions.length, 'raw transactions directly');
    
    const result: PipelineResult = {
      success: false,
      totalProcessed: rawTransactions.length,
      uploaded: 0,
      duplicates: 0,
      errors: [],
      uploadedIds: [],
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

      // Upload
      const firebaseService = getFirebaseService(this.userId);
      await firebaseService.initialize();
      
      const uploadResult = await firebaseService.uploadCSVTransactions(processedTransactions);
      
      result.uploaded = uploadResult.uploaded;
      result.duplicates = uploadResult.duplicates;
      result.uploadedIds = uploadResult.uploadedIds;
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
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick function to process a CSV file
 */
export const processCSVFile = async (
  file: File,
  userId: string,
  onProgress?: (progress: PipelineProgress) => void
): Promise<PipelineResult> => {
  const pipeline = new CSVToFirebasePipeline(userId, onProgress);
  return pipeline.processCSVFile(file);
};

/**
 * Quick function to process raw transactions
 */
export const processRawTransactions = async (
  rawTransactions: RawTransaction[],
  userId: string
): Promise<PipelineResult> => {
  const pipeline = new CSVToFirebasePipeline(userId);
  return pipeline.processRawTransactions(rawTransactions);
};
