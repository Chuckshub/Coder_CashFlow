import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { BeginningBalance } from '../types';

export class BeginningBalanceService {
  private readonly collectionPath: string;
  private readonly userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.collectionPath = `users/${userId}/beginningBalance`;
  }

  /**
   * Get the current beginning balance
   */
  async getBeginningBalance(): Promise<BeginningBalance | null> {
    try {
      const docRef = doc(db, this.collectionPath, 'current');
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        console.log('📊 No beginning balance found, using default $0');
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
        notes: data.notes
      };
    } catch (error) {
      console.error('💥 Error loading beginning balance:', error);
      throw error;
    }
  }

  /**
   * Update the beginning balance
   */
  async updateBeginningBalance(balance: number, isLocked: boolean, notes?: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionPath, 'current');
      
      const updateData = {
        userId: this.userId,
        balance,
        isLocked,
        lastModified: serverTimestamp(),
        lastModifiedBy: this.userId,
        notes: notes || ''
      };
      
      await setDoc(docRef, updateData, { merge: true });
      
      console.log('✅ Beginning balance updated:', {
        balance,
        isLocked,
        notes
      });
    } catch (error) {
      console.error('💥 Error updating beginning balance:', error);
      throw error;
    }
  }

  /**
   * Initialize default beginning balance if none exists
   */
  async initializeDefaultBalance(): Promise<BeginningBalance> {
    const defaultBalance: Omit<BeginningBalance, 'id'> = {
      userId: this.userId,
      balance: 0,
      isLocked: false,
      lastModified: new Date(),
      lastModifiedBy: this.userId,
      notes: 'Default beginning balance'
    };
    
    await this.updateBeginningBalance(defaultBalance.balance, defaultBalance.isLocked, defaultBalance.notes);
    
    return {
      id: 'current',
      ...defaultBalance
    };
  }

  /**
   * Toggle lock status
   */
  async toggleLock(): Promise<boolean> {
    try {
      const current = await this.getBeginningBalance();
      const newLockStatus = !current?.isLocked;
      
      await this.updateBeginningBalance(
        current?.balance || 0, 
        newLockStatus,
        current?.notes
      );
      
      return newLockStatus;
    } catch (error) {
      console.error('💥 Error toggling lock:', error);
      throw error;
    }
  }
}

// Service cache to avoid recreating instances
const serviceCache = new Map<string, BeginningBalanceService>();

/**
 * Get BeginningBalanceService instance for a user
 */
export const getBeginningBalanceService = (userId: string): BeginningBalanceService => {
  if (!serviceCache.has(userId)) {
    serviceCache.set(userId, new BeginningBalanceService(userId));
  }
  return serviceCache.get(userId)!;
};