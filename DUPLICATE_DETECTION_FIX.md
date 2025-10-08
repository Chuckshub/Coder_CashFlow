# Duplicate Detection Fix

## Problem

The CSV upload process was incorrectly detecting duplicates **within the same CSV file** being uploaded, rather than only checking for duplicates against previously uploaded transactions in the database.

This caused legitimate transactions from a bank export to be flagged as duplicates when they were actually unique transactions that happened to have similar characteristics (e.g., multiple transactions on the same day with similar amounts).

## Root Cause

Both pipeline implementations had a "Stage 3.5: Smart Duplicate Detection" step that used `removeSimilarDuplicates()` to compare transactions within the incoming CSV file:

```typescript
// INCORRECT - This was comparing transactions within the same file
const duplicateResult = removeSimilarDuplicates(processedTransactions, {
  maxDateDifferenceHours: 72,
  descriptionSimilarityThreshold: 0.85,
  allowAmountVariance: 0
});
```

This logic would remove transactions from the same upload batch that looked similar, which is incorrect. A bank CSV export should be considered authoritative - all transactions in it are legitimate.

## Solution

Removed the in-file duplicate detection logic from both pipeline implementations:

1. **csvToFirebasePipelineSimple.ts** - Removed Stage 3.5 and the `removeSimilarDuplicates` import
2. **csvToFirebasePipelineShared.ts** - Removed Stage 5 and the `removeSimilarDuplicates` import

### How Duplicate Detection Now Works

Duplicate detection now happens **only at the database level** when checking against previously uploaded transactions:

1. Each transaction gets a unique hash based on its date, amount, and description
2. The hash is used as the Firestore document ID
3. When uploading, Firestore automatically prevents documents with duplicate IDs
4. This means:
   - ✅ All transactions in a CSV are uploaded (no false positives within the file)
   - ✅ Transactions already in the database are correctly skipped (no true duplicates)
   - ✅ If you upload overlapping CSV files, only the overlap is skipped

## Files Changed

- `src/services/csvToFirebasePipelineSimple.ts` - Removed in-file duplicate detection
- `src/services/csvToFirebasePipelineShared.ts` - Removed in-file duplicate detection

## Testing

To verify the fix:

1. Upload a fresh CSV export from your bank
2. All transactions should be uploaded successfully
3. Upload the same CSV again
4. All transactions should be detected as duplicates (database-level detection)
5. Upload a CSV with partial overlap to a previous upload
6. Only the overlapping transactions should be detected as duplicates

## Expected Behavior After Fix

**Before:** "Found 5 duplicates" when uploading a single CSV file with unique transactions

**After:** "Uploaded X transactions" with no false duplicate detection within the file. Duplicates only detected when re-uploading previously imported data.
