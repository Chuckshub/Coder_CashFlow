import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { HighAprBalance } from '../types';

export class HighAprBalanceService {
  private readonly collectionPath: string;
  private readonly userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.collectionPath = `users/${userId}/highAprBalance`;
  }

  /**
   * Get the current high APR balance
   */
  async getHighAprBalance(): Promise<HighAprBalance | null> {
    try {
      const docRef = doc(db, this.collectionPath, 'current');
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        console.log('💰 No high APR balance found, using default $0');
        return null;
      }
      
      const data = docSnap.data();
      
      return {
        id: docSnap.id,
        userId: this.userId,
        balance: data.balance || 0,
        isLocked: data.isLocked || false,
        lastModified: data.lastModified?.toDate() || new Date(),
        lastModifiedBy: data.lastModifiedBy || this.userId,
        createdAt: data.createdAt?.toDate() || new Date()
      };
      
    } catch (error) {
      console.error('💥 Error loading high APR balance:', error);
      throw error;
    }
  }

  /**
   * Update the high APR balance
   */
  async updateHighAprBalance(balance: number, isLocked: boolean = false): Promise<void> {
    try {
      const docRef = doc(db, this.collectionPath, 'current');
      
      // Check if document exists to determine if this is an update or create
      const existingDoc = await getDoc(docRef);
      const isUpdate = existingDoc.exists();
      
      const data = {
        balance,
        isLocked,
        lastModified: serverTimestamp(),
        lastModifiedBy: this.userId,
        userId: this.userId,
        ...(isUpdate ? {} : {
          createdAt: serverTimestamp()
        })
      };
      
      await setDoc(docRef, data, { merge: true });
      
      console.log(`✅ ${isUpdate ? 'Updated' : 'Created'} high APR balance:`, {
        balance,
        isLocked,
        userId: this.userId
      });
      
    } catch (error) {
      console.error('💥 Error updating high APR balance:', error);
      throw error;
    }
  }
}

// Singleton pattern for service instances
const serviceInstances = new Map<string, HighAprBalanceService>();

export function getHighAprBalanceService(userId: string): HighAprBalanceService {
  if (!serviceInstances.has(userId)) {
    serviceInstances.set(userId, new HighAprBalanceService(userId));
  }
  return serviceInstances.get(userId)!;
}