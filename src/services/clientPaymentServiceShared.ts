import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { ClientPayment, CampfireInvoice, CampfireImportSummary } from '../types';
import { getCampfireService } from './campfireService';

// ============================================================================
// SHARED CLIENT PAYMENT SERVICE
// ============================================================================

/**
 * Shared Firebase interfaces for client payments
 */
export interface SharedFirebaseClientPayment {
  id: string;
  sessionId: string;
  campfireInvoiceId?: number;
  clientName: string;
  invoiceNumber: string;
  originalAmount: number;
  amountDue: number;
  originalDueDate: Timestamp;
  expectedPaymentDate: Timestamp;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
  daysUntilDue: number;
  description?: string;
  notes?: string;
  paymentTerms?: string;
  isImported: boolean;
  lastCampfireSync?: Timestamp;
  source: 'manual' | 'campfire';
  campfireData?: {
    invoiceNumber: string;
    projectName: string;
    clientId: string;
    dueDate: Timestamp;
    issueDate: Timestamp;
    totalAmount: number;
    paidAmount: number;
    currency: string;
    lastSync: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  lastModifiedBy: string;
}

/**
 * Service for managing shared client payments in Firebase
 */
class SharedClientPaymentService {
  private currentUserId: string;
  private sessionId: string;
  private collectionPath: string;

  constructor(currentUserId: string, sessionId: string) {
    this.currentUserId = currentUserId;
    this.sessionId = sessionId;
    this.collectionPath = 'shared_client_payments';
  }

  /**
   * Get all client payments from shared collection
   */
  async getClientPayments(): Promise<ClientPayment[]> {
    try {
      console.log('📄 Loading client payments from shared collection...');
      
      // TEMPORARY: Remove sessionId filter to avoid composite index requirement
      // TODO: Add back sessionId filter once Firebase indexes are created
      const q = query(
        collection(db, this.collectionPath),
        // where('sessionId', '==', this.sessionId), // Temporarily commented out
        orderBy('expectedPaymentDate', 'asc')
      );
      
      const snapshot = await getDocs(q);
      const payments: ClientPayment[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data() as SharedFirebaseClientPayment;
        
        const payment: ClientPayment = {
          id: doc.id,
          campfireInvoiceId: data.campfireInvoiceId,
          clientName: data.clientName,
          invoiceNumber: data.invoiceNumber,
          originalAmount: data.originalAmount,
          amountDue: data.amountDue,
          originalDueDate: data.originalDueDate.toDate(),
          expectedPaymentDate: data.expectedPaymentDate.toDate(),
          status: data.status,
          daysUntilDue: data.daysUntilDue,
          description: data.description,
          notes: data.notes,
          paymentTerms: data.paymentTerms,
          isImported: data.isImported,
          lastCampfireSync: data.lastCampfireSync?.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        };
        
        payments.push(payment);
      });
      
      console.log(`✅ Loaded ${payments.length} client payments from shared collection`);
      return payments;
      
    } catch (error) {
      console.error('💥 Error loading client payments from shared collection:', error);
      return [];
    }
  }

  /**
   * Save or update a client payment in shared collection
   */
  async saveClientPayment(payment: Omit<ClientPayment, 'id'>): Promise<string> {
    try {
      console.log('💾 Saving client payment to shared collection:', payment.clientName);
      
      const firebaseData: Omit<SharedFirebaseClientPayment, 'id'> = {
        sessionId: this.sessionId,
        campfireInvoiceId: payment.campfireInvoiceId,
        clientName: payment.clientName,
        invoiceNumber: payment.invoiceNumber,
        originalAmount: payment.originalAmount,
        amountDue: payment.amountDue,
        originalDueDate: Timestamp.fromDate(payment.originalDueDate),
        expectedPaymentDate: Timestamp.fromDate(payment.expectedPaymentDate),
        status: payment.status,
        daysUntilDue: payment.daysUntilDue,
        description: payment.description,
        notes: payment.notes,
        paymentTerms: payment.paymentTerms,
        isImported: payment.isImported,
        lastCampfireSync: payment.lastCampfireSync ? Timestamp.fromDate(payment.lastCampfireSync) : undefined,
        source: 'campfire',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: this.currentUserId,
        lastModifiedBy: this.currentUserId
      };
      
      const docRef = await addDoc(collection(db, this.collectionPath), firebaseData);
      console.log('✅ Client payment saved to shared collection:', docRef.id);
      return docRef.id;
      
    } catch (error) {
      console.error('💥 Error saving client payment to shared collection:', error);
      throw error;
    }
  }

  /**
   * Update a client payment in shared collection
   */
  async updateClientPayment(paymentId: string, updates: Partial<ClientPayment>): Promise<void> {
    try {
      console.log('📝 Updating client payment in shared collection:', paymentId);
      
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
        lastModifiedBy: this.currentUserId
      };
      
      // Convert Date fields to Timestamps
      if (updates.expectedPaymentDate) {
        updateData.expectedPaymentDate = Timestamp.fromDate(updates.expectedPaymentDate);
      }
      if (updates.originalDueDate) {
        updateData.originalDueDate = Timestamp.fromDate(updates.originalDueDate);
      }
      if (updates.lastCampfireSync) {
        updateData.lastCampfireSync = Timestamp.fromDate(updates.lastCampfireSync);
      }
      if (updates.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updates.createdAt);
      }
      
      const docRef = doc(db, this.collectionPath, paymentId);
      await updateDoc(docRef, updateData);
      
      console.log('✅ Client payment updated in shared collection');
      
    } catch (error) {
      console.error('💥 Error updating client payment in shared collection:', error);
      throw error;
    }
  }

  /**
   * Delete a client payment from shared collection
   */
  async deleteClientPayment(paymentId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting client payment from shared collection:', paymentId);
      
      const docRef = doc(db, this.collectionPath, paymentId);
      await deleteDoc(docRef);
      
      console.log('✅ Client payment deleted from shared collection');
      
    } catch (error) {
      console.error('💥 Error deleting client payment from shared collection:', error);
      throw error;
    }
  }

  /**
   * Import Campfire invoices into shared collection (alias for importCampfireInvoices)
   */
  async importFromCampfire(): Promise<CampfireImportSummary> {
    return await this.importCampfireInvoices();
  }

  /**
   * Import Campfire invoices into shared collection
   */
  async importCampfireInvoices(): Promise<CampfireImportSummary> {
    try {
      console.log('🔥 Starting Campfire import to shared collection...');
      
      const campfireService = getCampfireService();
      const invoices = await campfireService.fetchAllOpenInvoices();
      
      if (invoices.length === 0) {
        console.log('📭 No invoices found in Campfire');
        return {
          totalInvoices: 0,
          importedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          errors: [],
          importedPayments: []
        };
      }
      
      console.log(`🔥 Found ${invoices.length} invoices in Campfire`);
      
      // For now, just return the count - actual import logic can be added later
      console.log('🎉 Campfire import to shared collection completed (placeholder)');
      return {
        totalInvoices: invoices.length,
        importedCount: 0, // TODO: Implement actual import
        updatedCount: 0,
        skippedCount: 0,
        errors: [],
        importedPayments: []
      };
      
    } catch (error) {
      console.error('💥 Campfire import to shared collection failed:', error);
      return {
        totalInvoices: 0,
        importedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown import error'],
        importedPayments: []
      };
    }
  }
}

// Service factory
const sharedServiceInstances = new Map<string, SharedClientPaymentService>();

export const getSharedClientPaymentService = (currentUserId: string, sessionId: string): SharedClientPaymentService => {
  const serviceKey = `${currentUserId}_${sessionId}`;
  
  if (!sharedServiceInstances.has(serviceKey)) {
    console.log('🔧 Creating new shared client payment service instance for:', serviceKey);
    sharedServiceInstances.set(serviceKey, new SharedClientPaymentService(currentUserId, sessionId));
  } else {
    console.log('♻️ Reusing existing shared client payment service instance for:', serviceKey);
  }
  
  return sharedServiceInstances.get(serviceKey)!;
};

export default SharedClientPaymentService;
