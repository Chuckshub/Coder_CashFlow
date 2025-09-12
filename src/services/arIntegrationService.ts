/**
 * AR Integration Service
 * 
 * This service handles the transformation of Campfire invoice data into
 * AR estimates that can be integrated into the weekly cashflow projections.
 */

import { CampfireService, CampfireInvoice, estimateCollectionTiming } from './campfireService';
import { AREstimate, ARSummary, ARConfig } from '../types';
import { generate13Weeks } from '../utils/dateUtils';

export class ARIntegrationService {
  private campfireService: CampfireService;
  private config: ARConfig;

  constructor(campfireService: CampfireService, config: ARConfig) {
    this.campfireService = campfireService;
    this.config = config;
  }

  /**
   * Transform Campfire invoices into AR estimates
   */
  private transformInvoicesToAREstimates(invoices: CampfireInvoice[]): AREstimate[] {
    const weekDates = generate13Weeks();
    
    return invoices.map(invoice => {
      const timing = estimateCollectionTiming(invoice);
      const dueDate = new Date(invoice.due_date);
      const now = new Date();
      
      // Calculate days overdue
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Determine status
      let status: 'current' | 'overdue' | 'collections';
      if (daysOverdue === 0) {
        status = 'current';
      } else if (daysOverdue <= 90) {
        status = 'overdue';
      } else {
        status = 'collections';
      }
      
      // Find which week this collection falls into
      const weekNumber = this.findWeekNumber(timing.estimatedCollectionDate, weekDates);
      
      const arEstimate: AREstimate = {
        id: `campfire_${invoice.id}`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientName: invoice.client.name,
        amount: invoice.amount_due,
        dueDate,
        estimatedCollectionDate: timing.estimatedCollectionDate,
        confidence: timing.confidence,
        status,
        paymentTerms: invoice.payment_terms,
        daysOverdue,
        weekNumber,
        source: 'campfire',
        notes: invoice.message_on_invoice,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      return arEstimate;
    });
  }

  /**
   * Find which week number an estimated collection date falls into
   */
  private findWeekNumber(collectionDate: Date, weekDates: Date[]): number {
    for (let i = 0; i < weekDates.length; i++) {
      const weekStart = weekDates[i];
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      if (collectionDate >= weekStart && collectionDate <= weekEnd) {
        return i - 1; // Week numbers are -1, 0, 1, 2, ..., 12
      }
    }
    
    // If beyond our 13-week horizon, put it in the last week
    return 12;
  }

  /**
   * Get all AR estimates from Campfire
   */
  async getAREstimates(): Promise<AREstimate[]> {
    try {
      if (!this.config.enabled) {
        return [];
      }

      // Fetch outstanding invoices from Campfire
      const invoices = await this.campfireService.getOutstandingInvoices();
      
      // Transform to AR estimates
      const arEstimates = this.transformInvoicesToAREstimates(invoices);
      
      // Apply collection assumptions
      return this.applyCollectionAssumptions(arEstimates);
    } catch (error) {
      console.error('Failed to get AR estimates:', error);
      throw new Error(`AR Integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply collection assumptions to adjust amounts and timing
   */
  private applyCollectionAssumptions(estimates: AREstimate[]): AREstimate[] {
    return estimates.map(estimate => {
      const assumptions = this.config.collectionAssumptions;
      let adjustedAmount = estimate.amount;
      let adjustedDate = new Date(estimate.estimatedCollectionDate);
      
      // Adjust based on status
      if (estimate.status === 'current') {
        // Apply on-time collection rate
        adjustedAmount *= (assumptions.currentOnTime / 100);
      } else if (estimate.status === 'overdue') {
        // Apply overdue collection rate and delay
        adjustedAmount *= (assumptions.overdueCollectionRate / 100);
        adjustedDate.setDate(adjustedDate.getDate() + assumptions.averageDelayDays);
      } else if (estimate.status === 'collections') {
        // Very conservative for collections
        adjustedAmount *= 0.5; // Assume 50% collection rate
        adjustedDate.setDate(adjustedDate.getDate() + 30); // Add 30 days delay
      }
      
      // Recalculate week number with adjusted date
      const weekDates = generate13Weeks();
      const adjustedWeekNumber = this.findWeekNumber(adjustedDate, weekDates);
      
      return {
        ...estimate,
        amount: Math.round(adjustedAmount * 100) / 100, // Round to 2 decimal places
        estimatedCollectionDate: adjustedDate,
        weekNumber: adjustedWeekNumber,
      };
    });
  }

  /**
   * Get AR summary data
   */
  async getARSummary(): Promise<ARSummary> {
    try {
      const estimates = await this.getAREstimates();
      const agingData = await this.campfireService.getARAgingData();
      
      // Calculate estimated collections by time period
      const now = new Date();
      const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fourWeeksLater = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
      const thirteenWeeksLater = new Date(now.getTime() + 91 * 24 * 60 * 60 * 1000);
      
      const thisWeek = estimates
        .filter(e => e.estimatedCollectionDate <= oneWeekLater)
        .reduce((sum, e) => sum + e.amount, 0);
        
      const next4Weeks = estimates
        .filter(e => e.estimatedCollectionDate > now && e.estimatedCollectionDate <= fourWeeksLater)
        .reduce((sum, e) => sum + e.amount, 0);
        
      const next13Weeks = estimates
        .filter(e => e.estimatedCollectionDate > now && e.estimatedCollectionDate <= thirteenWeeksLater)
        .reduce((sum, e) => sum + e.amount, 0);
      
      const totalOutstanding = estimates.reduce((sum, e) => sum + e.amount, 0);
      const totalOverdue = estimates
        .filter(e => e.status === 'overdue' || e.status === 'collections')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalCurrent = totalOutstanding - totalOverdue;
      
      return {
        totalOutstanding,
        totalCurrent,
        totalOverdue,
        agingBuckets: agingData,
        estimatedCollections: {
          thisWeek,
          next4Weeks,
          next13Weeks,
        },
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Failed to get AR summary:', error);
      throw error;
    }
  }

  /**
   * Get AR estimates for a specific week
   */
  async getAREstimatesForWeek(weekNumber: number): Promise<AREstimate[]> {
    const allEstimates = await this.getAREstimates();
    return allEstimates.filter(estimate => estimate.weekNumber === weekNumber);
  }

  /**
   * Refresh AR data from Campfire
   */
  async refreshARData(): Promise<{
    estimates: AREstimate[];
    summary: ARSummary;
  }> {
    const [estimates, summary] = await Promise.all([
      this.getAREstimates(),
      this.getARSummary(),
    ]);
    
    return { estimates, summary };
  }

  /**
   * Test the connection and configuration
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    invoiceCount?: number;
  }> {
    try {
      const connectionTest = await this.campfireService.testConnection();
      if (!connectionTest) {
        return {
          success: false,
          message: 'Failed to connect to Campfire API. Please check your API key.',
        };
      }
      
      const invoices = await this.campfireService.getOutstandingInvoices();
      return {
        success: true,
        message: `Successfully connected to Campfire. Found ${invoices.length} outstanding invoices.`,
        invoiceCount: invoices.length,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

/**
 * Create AR Integration Service with default configuration
 */
export const createARIntegrationService = (
  campfireService: CampfireService,
  config?: Partial<ARConfig>
): ARIntegrationService => {
  const defaultConfig: ARConfig = {
    enabled: true,
    autoRefreshInterval: 60, // 1 hour
    collectionAssumptions: {
      currentOnTime: 90, // 90% of current invoices collected on time
      overdueCollectionRate: 75, // 75% of overdue invoices eventually collected
      averageDelayDays: 14, // Average 2 weeks delay
    },
    ...config,
  };
  
  return new ARIntegrationService(campfireService, defaultConfig);
};
