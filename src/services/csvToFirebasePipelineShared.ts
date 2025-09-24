import { RawTransaction, Transaction } from '../types';
import { parseCSVFile, convertToTransaction, validateCSVStructure } from '../utils/csvParser';
import { categorizeTransactions } from '../utils/transactionCategorizer';
import { createTransactionHashFromProcessed } from '../utils/transactionHash';
import { removeSimilarDuplicates } from '../utils/smartDuplicateDetection';
import { getSharedFirebaseService } from './firebaseServiceSharedWrapper';

// ============================================================================
// SHARED CSV TO FIREBASE PIPELINE
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

export class SharedCSVToFirebasePipeline {
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

  async processRawTransactions(rawTransactions: RawTransaction[]): Promise<PipelineResult> {
    const startTime = Date.now();
    
    console.log('🚀 SharedCSVToFirebasePipeline.processRawTransactions - Starting shared pipeline...');
    console.log('📊 Input:', rawTransactions.length, 'raw transactions');
    
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
      // Stage 1: Validate CSV structure
      this.updateProgress({
        stage: 'validating',
        message: 'Validating CSV structure...',
        progress: 10,
        total: rawTransactions.length
      });

      const validation = validateCSVStructure(rawTransactions);
      if (!validation.isValid) {
        result.errors = validation.errors;
        console.error('❌ CSV validation failed:', validation.errors);
        return result;
      }

      console.log('✅ CSV structure validation passed');

      // Stage 2: Convert to Transaction objects
      this.updateProgress({
        stage: 'processing',
        message: 'Converting transactions...',
        progress: 25,
        completed: 0,
        total: rawTransactions.length
      });

      const transactions: Transaction[] = [];
      const conversionErrors: string[] = [];

      for (let i = 0; i < rawTransactions.length; i++) {
        try {
          const transaction = convertToTransaction(rawTransactions[i]);
          transactions.push(transaction);
        } catch (error) {
          const errorMsg = `Row ${i + 1}: ${error instanceof Error ? error.message : 'Conversion error'}`;
          conversionErrors.push(errorMsg);
          console.warn('⚠️ Transaction conversion error:', errorMsg);
        }

        // Update progress every 10 transactions
        if (i % 10 === 0) {
          this.updateProgress({
            stage: 'processing',
            message: `Converting transactions... ${i + 1}/${rawTransactions.length}`,
            progress: 25 + (i / rawTransactions.length) * 25,
            completed: i + 1,
            total: rawTransactions.length,
            errors: conversionErrors
          });
        }
      }

      result.errors.push(...conversionErrors);
      result.totalProcessed = transactions.length;

      console.log('✅ Conversion completed:', transactions.length, 'transactions converted');
      if (conversionErrors.length > 0) {
        console.warn('⚠️ Conversion errors:', conversionErrors.length);
      }

      // Stage 3: Categorize transactions
      this.updateProgress({
        stage: 'processing',
        message: 'Categorizing transactions...',
        progress: 50,
        completed: transactions.length,
        total: transactions.length,
        errors: result.errors
      });

      const categorizedTransactions = categorizeTransactions(transactions);
      console.log('✅ Categorization completed');

      // Stage 4: Generate hashes for duplicate detection
      this.updateProgress({
        stage: 'processing',
        message: 'Generating transaction hashes...',
        progress: 60,
        errors: result.errors
      });

      const transactionsWithHashes = categorizedTransactions.map(transaction => ({
        ...transaction,
        hash: createTransactionHashFromProcessed(transaction)
      }));
      
      console.log('✅ Hash generation completed');

      // Stage 5: Remove similar duplicates within the current batch
      this.updateProgress({
        stage: 'processing',
        message: 'Removing similar duplicates...',
        progress: 70,
        errors: result.errors
      });

      const deduplicationResult = removeSimilarDuplicates(transactionsWithHashes);
      const deduplicatedTransactions = deduplicationResult.unique as Transaction[];
      const localDuplicatesRemoved = deduplicationResult.removed.length;
      
      console.log('✅ Local duplicate removal completed:', localDuplicatesRemoved, 'duplicates removed');

      // Stage 6: Upload to shared Firebase
      this.updateProgress({
        stage: 'uploading',
        message: 'Uploading to shared collection...',
        progress: 75,
        completed: 0,
        total: deduplicatedTransactions.length,
        errors: result.errors
      });

      const firebaseService = getSharedFirebaseService(this.userId);
      
      const uploadResult = await firebaseService.uploadTransactions(
        deduplicatedTransactions,
        'System', // userName
        'system@shared.local', // userEmail
        (uploaded, total, duplicates) => {
          this.updateProgress({
            stage: 'uploading',
            message: `Uploading to shared collection... ${uploaded}/${total} (${duplicates} duplicates)`,
            progress: 75 + (uploaded / total) * 20,
            completed: uploaded,
            total: total,
            errors: result.errors
          });
        }
      );

      result.uploaded = uploadResult.uploaded;
      result.duplicates = uploadResult.duplicates + localDuplicatesRemoved;
      result.errors.push(...uploadResult.errors);
      result.uploadedHashes = deduplicatedTransactions
        .slice(0, uploadResult.uploaded)
        .map(t => t.hash || '');

      // Stage 7: Complete
      const endTime = Date.now();
      result.processingTimeMs = endTime - startTime;
      result.success = uploadResult.success;

      this.updateProgress({
        stage: 'complete',
        message: result.success 
          ? `Successfully uploaded ${result.uploaded} transactions to shared collection (${result.duplicates} duplicates skipped)`
          : `Upload failed: ${result.errors.join('; ')}`,
        progress: 100,
        completed: result.uploaded,
        total: deduplicatedTransactions.length,
        errors: result.errors
      });

      console.log('✅ Shared pipeline completed:', {
        success: result.success,
        totalProcessed: result.totalProcessed,
        uploaded: result.uploaded,
        duplicates: result.duplicates,
        errors: result.errors.length,
        processingTimeMs: result.processingTimeMs
      });

      return result;

    } catch (error) {
      const endTime = Date.now();
      result.processingTimeMs = endTime - startTime;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown pipeline error';
      result.errors.push(`Pipeline error: ${errorMessage}`);
      
      console.error('💥 Shared pipeline error:', error);
      
      this.updateProgress({
        stage: 'complete',
        message: `Pipeline failed: ${errorMessage}`,
        progress: 100,
        errors: result.errors
      });
      
      return result;
    }
  }
}

// Convenience function matching the original API
export const processRawTransactionsShared = async (
  rawTransactions: RawTransaction[],
  userId: string,
  onProgress?: (progress: PipelineProgress) => void
): Promise<PipelineResult> => {
  console.log('🚀 processRawTransactionsShared - Starting shared processing...');
  
  const pipeline = new SharedCSVToFirebasePipeline(userId, onProgress);
  return await pipeline.processRawTransactions(rawTransactions);
};
