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

/**
 * Service for managing client payments in Firebase
 */
class ClientPaymentService {
  private userId: string;
  private collectionPath: string;

  constructor(userId: string) {
    this.userId = userId;
    this.collectionPath = `users/${userId}/clientPayments`;
  }

  /**
   * Get all client payments for the user
   */
  async getClientPayments(): Promise<ClientPayment[]> {
    try {
      console.log('📄 Loading client payments from Firebase...');
      
      const q = query(
        collection(db, this.collectionPath),
        orderBy('expectedPaymentDate', 'asc')
      );
      
      const snapshot = await getDocs(q);
      const payments: ClientPayment[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        payments.push({
          id: doc.id,
          ...data,
          originalDueDate: data.originalDueDate?.toDate() || new Date(),
          expectedPaymentDate: data.expectedPaymentDate?.toDate() || new Date(),
          lastCampfireSync: data.lastCampfireSync?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as ClientPayment);
      });
      
      console.log(`✅ Loaded ${payments.length} client payments`);
      return payments;
      
    } catch (error) {
      console.error('💥 Error loading client payments:', error);
      throw error;
    }
  }

  /**
   * Get a specific client payment by ID
   */
  async getClientPayment(id: string): Promise<ClientPayment | null> {
    try {
      const docRef = doc(db, this.collectionPath, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        originalDueDate: data.originalDueDate?.toDate() || new Date(),
        expectedPaymentDate: data.expectedPaymentDate?.toDate() || new Date(),
        lastCampfireSync: data.lastCampfireSync?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as ClientPayment;
      
    } catch (error) {
      console.error(`💥 Error loading client payment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new client payment
   */
  async createClientPayment(payment: Omit<ClientPayment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('➕ Creating new client payment:', payment.invoiceNumber);
      
      const now = new Date();
      const paymentData = {
        ...payment,
        originalDueDate: Timestamp.fromDate(payment.originalDueDate),
        expectedPaymentDate: Timestamp.fromDate(payment.expectedPaymentDate),
        lastCampfireSync: payment.lastCampfireSync ? Timestamp.fromDate(payment.lastCampfireSync) : null,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };
      
      const docRef = await addDoc(collection(db, this.collectionPath), paymentData);
      console.log(`✅ Created client payment with ID: ${docRef.id}`);
      
      return docRef.id;
      
    } catch (error) {
      console.error('💥 Error creating client payment:', error);
      throw error;
    }
  }

  /**
   * Update an existing client payment
   */
  async updateClientPayment(id: string, updates: Partial<Omit<ClientPayment, 'id' | 'createdAt'>>): Promise<void> {
    try {
      console.log('🔄 Updating client payment:', id);
      
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      
      // Convert dates to Timestamps if they exist in updates
      if (updates.originalDueDate) {
        updateData.originalDueDate = Timestamp.fromDate(updates.originalDueDate);
      }
      if (updates.expectedPaymentDate) {
        updateData.expectedPaymentDate = Timestamp.fromDate(updates.expectedPaymentDate);
      }
      if (updates.lastCampfireSync) {
        updateData.lastCampfireSync = Timestamp.fromDate(updates.lastCampfireSync);
      }
      
      const docRef = doc(db, this.collectionPath, id);
      await updateDoc(docRef, updateData);
      
      console.log(`✅ Updated client payment: ${id}`);
      
    } catch (error) {
      console.error(`💥 Error updating client payment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a client payment
   */
  async deleteClientPayment(id: string): Promise<void> {
    try {
      console.log('🗑️ Deleting client payment:', id);
      
      const docRef = doc(db, this.collectionPath, id);
      await deleteDoc(docRef);
      
      console.log(`✅ Deleted client payment: ${id}`);
      
    } catch (error) {
      console.error(`💥 Error deleting client payment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Import invoices from Campfire and convert to client payments
   */
  async importFromCampfire(): Promise<CampfireImportSummary> {
    console.log('🔥 Starting Campfire import...');
    
    const summary: CampfireImportSummary = {
      totalInvoices: 0,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: [],
      importedPayments: []
    };
    
    try {
      // Get Campfire service and fetch invoices
      const campfireService = getCampfireService();
      
      if (!campfireService.isConfigured()) {
        throw new Error('Campfire API not configured');
      }
      
      const invoices = await campfireService.fetchAllOpenInvoices();
      summary.totalInvoices = invoices.length;
      
      console.log(`📄 Processing ${invoices.length} invoices from Campfire...`);
      
      // Get existing payments to avoid duplicates
      const existingPayments = await this.getClientPayments();
      const existingCampfireIds = new Set(
        existingPayments
          .filter(p => p.campfireInvoiceId)
          .map(p => p.campfireInvoiceId!)
      );
      
      const batch = writeBatch(db);
      const now = new Date();
      
      for (const invoice of invoices) {
        try {
          // Skip if already imported and not significantly changed
          if (existingCampfireIds.has(invoice.id)) {
            // Could add logic here to check if invoice needs updating
            summary.skippedCount++;
            continue;
          }
          
          // Convert Campfire invoice to ClientPayment
          const clientPayment: Omit<ClientPayment, 'id'> = {
            campfireInvoiceId: invoice.id,
            clientName: invoice.client_name,
            invoiceNumber: invoice.invoice_number,
            originalAmount: invoice.total_amount,
            amountDue: invoice.amount_due,
            originalDueDate: new Date(invoice.due_date),
            expectedPaymentDate: new Date(invoice.due_date), // Default to due date, user can adjust
            status: this.mapCampfireStatusToClientPaymentStatus(invoice.status, invoice.past_due_days),
            daysUntilDue: this.calculateDaysUntilDue(new Date(invoice.due_date)),
            description: invoice.contract_name,
            paymentTerms: invoice.terms,
            isImported: true,
            lastCampfireSync: now,
            createdAt: now,
            updatedAt: now
          };
          
          // Add to batch
          const docRef = doc(collection(db, this.collectionPath));
          batch.set(docRef, {
            ...clientPayment,
            originalDueDate: Timestamp.fromDate(clientPayment.originalDueDate),
            expectedPaymentDate: Timestamp.fromDate(clientPayment.expectedPaymentDate),
            lastCampfireSync: Timestamp.fromDate(clientPayment.lastCampfireSync!),
            createdAt: Timestamp.fromDate(clientPayment.createdAt),
            updatedAt: Timestamp.fromDate(clientPayment.updatedAt),
          });
          
          summary.importedPayments.push({ ...clientPayment, id: docRef.id });
          summary.importedCount++;
          
        } catch (error) {
          console.error(`Error processing invoice ${invoice.invoice_number}:`, error);
          summary.errors.push(`Invoice ${invoice.invoice_number}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Commit the batch
      if (summary.importedCount > 0) {
        await batch.commit();
        console.log(`✅ Successfully imported ${summary.importedCount} client payments`);
      }
      
      return summary;
      
    } catch (error) {
      console.error('💥 Error during Campfire import:', error);
      summary.errors.push(error instanceof Error ? error.message : 'Unknown import error');
      return summary;
    }
  }

  /**
   * Map Campfire invoice status to ClientPayment status
   */
  private mapCampfireStatusToClientPaymentStatus(
    campfireStatus: string, 
    pastDueDays: number | null
  ): ClientPayment['status'] {
    switch (campfireStatus) {
      case 'paid':
        return 'paid';
      case 'open':
        return (pastDueDays && pastDueDays > 0) ? 'overdue' : 'pending';
      case 'past_due':
        return 'overdue';
      default:
        return 'pending';
    }
  }

  /**
   * Calculate days until due
   */
  private calculateDaysUntilDue(dueDate: Date): number {
    const today = new Date();
    const timeDiff = dueDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  /**
   * Get client payments that should appear in cashflow (pending/overdue)
   */
  async getActiveClientPayments(): Promise<ClientPayment[]> {
    try {
      const allPayments = await this.getClientPayments();
      return allPayments.filter(payment => 
        payment.status === 'pending' || 
        payment.status === 'overdue' || 
        payment.status === 'partially_paid'
      );
    } catch (error) {
      console.error('💥 Error getting active client payments:', error);
      return [];
    }
  }
}

// Cache for service instances
const serviceCache = new Map<string, ClientPaymentService>();

/**
 * Get ClientPaymentService instance for a user
 */
export const getClientPaymentService = (userId: string): ClientPaymentService => {
  if (!serviceCache.has(userId)) {
    serviceCache.set(userId, new ClientPaymentService(userId));
  }
  return serviceCache.get(userId)!;
};

export default ClientPaymentService;