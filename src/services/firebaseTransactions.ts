import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { ParsedTransaction } from '../utils/chaseCSVParser';

interface FirestoreTransaction {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  balance: number;
  category: string;
  userId: string;
  createdAt: string;
  hash: string;
}

function createSimpleHash(transaction: ParsedTransaction): string {
  const dateStr = transaction.date.toISOString().split('T')[0];
  const amountStr = transaction.amount.toString();
  const descStr = transaction.description.substring(0, 50);
  const combined = `${dateStr}|${amountStr}|${descStr}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

export const saveTransactionsToFirebase = async (
  transactions: ParsedTransaction[],
  userId: string
): Promise<{ success: boolean; saved: number; duplicates: number; errors: string[] }> => {
  console.log('🔥 saveTransactionsToFirebase called with', transactions.length, 'transactions for user:', userId);
  
  const result = {
    success: false,
    saved: 0,
    duplicates: 0,
    errors: [] as string[]
  };
  
  if (!db) {
    const error = 'Firebase not initialized';
    console.error('❌', error);
    result.errors.push(error);
    return result;
  }
  
  if (!userId) {
    const error = 'User ID required';
    console.error('❌', error);
    result.errors.push(error);
    return result;
  }
  
  if (transactions.length === 0) {
    const error = 'No transactions to save';
    console.error('❌', error);
    result.errors.push(error);
    return result;
  }
  
  try {
    const collectionPath = `users/${userId}/transactions`;
    console.log('📋 Collection path:', collectionPath);
    
    const collectionRef = collection(db, 'users', userId, 'transactions');
    console.log('📋 Collection reference created:', !!collectionRef);
    
    // Check for existing transactions (simple duplicate detection)
    console.log('🔍 Checking for existing transactions...');
    const existingDocs = await getDocs(collectionRef);
    console.log('🔍 Found', existingDocs.size, 'existing transactions');
    
    const existingHashes = new Set<string>();
    existingDocs.forEach(doc => {
      const data = doc.data() as FirestoreTransaction;
      if (data.hash) {
        existingHashes.add(data.hash);
      }
    });
    
    console.log('🔍 Existing hashes:', existingHashes.size);
    
    // Prepare transactions for saving
    const transactionsToSave: FirestoreTransaction[] = [];
    const now = new Date().toISOString();
    
    for (const transaction of transactions) {
      const hash = createSimpleHash(transaction);
      
      if (existingHashes.has(hash)) {
        result.duplicates++;
        console.log('🔄 Skipping duplicate:', hash);
        continue;
      }
      
      const firestoreTransaction: FirestoreTransaction = {
        id: transaction.id,
        date: transaction.date.toISOString(),
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        balance: transaction.balance,
        category: transaction.category,
        userId,
        createdAt: now,
        hash
      };
      
      transactionsToSave.push(firestoreTransaction);
    }
    
    console.log('📋 Prepared', transactionsToSave.length, 'transactions for saving');
    console.log('🔄 Found', result.duplicates, 'duplicates');
    
    if (transactionsToSave.length === 0) {
      console.log('⚠️ No new transactions to save after duplicate filtering');
      result.success = true;
      return result;
    }
    
    // Use individual document writes for better debugging
    console.log('💾 Starting individual document writes...');
    
    for (let i = 0; i < transactionsToSave.length; i++) {
      const transaction = transactionsToSave[i];
      
      try {
        const docRef = doc(collectionRef, transaction.id);
        console.log(`📄 [${i + 1}/${transactionsToSave.length}] Writing transaction:`, transaction.id);
        
        await setDoc(docRef, transaction);
        result.saved++;
        
        if (i < 3) {
          console.log(`✅ Successfully wrote transaction ${i + 1}:`, {
            id: transaction.id,
            description: transaction.description.substring(0, 30) + '...',
            amount: transaction.amount,
            type: transaction.type
          });
        }
        
      } catch (error) {
        const errorMsg = `Failed to save transaction ${transaction.id}: ${error}`;
        console.error(`❌ Error writing transaction ${i + 1}:`, error);
        result.errors.push(errorMsg);
      }
    }
    
    console.log('🎉 Completed writing transactions. Saved:', result.saved, 'Errors:', result.errors.length);
    
    // Verify the save by checking document count
    console.log('🔍 Verifying save - checking document count...');
    const verificationDocs = await getDocs(collectionRef);
    console.log('🔍 Verification: Found', verificationDocs.size, 'total documents in collection');
    
    result.success = result.errors.length === 0;
    return result;
    
  } catch (error) {
    const errorMsg = `Firebase save failed: ${error}`;
    console.error('💥 Critical error in saveTransactionsToFirebase:', error);
    result.errors.push(errorMsg);
    return result;
  }
};

export const loadTransactionsFromFirebase = async (
  userId: string
): Promise<ParsedTransaction[]> => {
  console.log('📋 Loading transactions from Firebase for user:', userId);
  
  if (!db) {
    console.error('❌ Firebase not initialized');
    return [];
  }
  
  if (!userId) {
    console.error('❌ User ID required');
    return [];
  }
  
  try {
    const collectionPath = `users/${userId}/transactions`;
    console.log('📋 Loading from collection:', collectionPath);
    
    const collectionRef = collection(db, 'users', userId, 'transactions');
    const querySnapshot = await getDocs(collectionRef);
    
    console.log('📋 Found', querySnapshot.size, 'documents');
    
    const transactions: ParsedTransaction[] = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data() as FirestoreTransaction;
      
      try {
        const transaction: ParsedTransaction = {
          id: data.id,
          date: new Date(data.date),
          description: data.description,
          amount: data.amount,
          type: data.type,
          balance: data.balance,
          category: data.category,
          originalData: {} as any
        };
        
        transactions.push(transaction);
        
      } catch (error) {
        console.error('❌ Error converting document:', doc.id, error);
      }
    });
    
    console.log('✅ Successfully loaded', transactions.length, 'transactions');
    
    // Sort by date (newest first)
    transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return transactions;
    
  } catch (error) {
    console.error('💥 Error loading transactions from Firebase:', error);
    return [];
  }
};