/**
 * Campfire API Service for Accounts Receivable Integration
 * 
 * This service handles authentication and data fetching from Campfire's AR endpoints
 * to integrate invoice data into the cashflow projections.
 */

export interface CampfireConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface CampfireInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  amount_due: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  client: {
    id: string;
    name: string;
  };
  entity: {
    id: string;
    name: string;
  };
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  payment_terms: string;
  message_on_invoice?: string;
  billing_address?: string;
  shipping_address?: string;
  created_at: string;
  updated_at: string;
}

export interface CampfireListResponse<T> {
  results: T[];
  count: number;
  next?: string;
  previous?: string;
}

export interface CampfireError {
  message: string;
  code: string;
  details?: Record<string, any>;
}

export class CampfireService {
  private config: CampfireConfig;
  private baseUrl: string;

  constructor(config: CampfireConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.campfire.ai';
  }

  /**
   * Make authenticated request to Campfire API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Campfire API Error: ${response.status} - ${errorData.message || response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Campfire API request failed:', error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple endpoint - list invoices with limit 1
      await this.request('/api/accounts-receivable/invoices?limit=1');
      return true;
    } catch (error) {
      console.error('Campfire connection test failed:', error);
      return false;
    }
  }

  /**
   * Get all outstanding invoices (unpaid/partially paid)
   */
  async getOutstandingInvoices(): Promise<CampfireInvoice[]> {
    try {
      // Filter for invoices that are not fully paid
      const response = await this.request<CampfireListResponse<CampfireInvoice>>(
        '/api/accounts-receivable/invoices?status__in=sent,overdue&amount_due__gt=0'
      );
      
      return response.results;
    } catch (error) {
      console.error('Failed to fetch outstanding invoices:', error);
      throw error;
    }
  }

  /**
   * Get invoices within a specific date range
   */
  async getInvoicesByDateRange(
    startDate: Date,
    endDate: Date,
    includeStatus: string[] = ['sent', 'overdue']
  ): Promise<CampfireInvoice[]> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      const statusFilter = includeStatus.map(s => `status=${s}`).join('&');
      
      const response = await this.request<CampfireListResponse<CampfireInvoice>>(
        `/api/accounts-receivable/invoices?due_date__gte=${startDateStr}&due_date__lte=${endDateStr}&${statusFilter}&amount_due__gt=0`
      );
      
      return response.results;
    } catch (error) {
      console.error('Failed to fetch invoices by date range:', error);
      throw error;
    }
  }

  /**
   * Get invoice details by ID
   */
  async getInvoiceById(invoiceId: string): Promise<CampfireInvoice> {
    try {
      return await this.request<CampfireInvoice>(
        `/api/accounts-receivable/invoices/${invoiceId}`
      );
    } catch (error) {
      console.error(`Failed to fetch invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  /**
   * Get AR aging report data
   */
  async getARAgingData(): Promise<{
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_over_90: number;
    total: number;
  }> {
    try {
      const invoices = await this.getOutstandingInvoices();
      const now = new Date();
      
      const aging = {
        current: 0,
        days_1_30: 0,
        days_31_60: 0,
        days_61_90: 0,
        days_over_90: 0,
        total: 0,
      };

      invoices.forEach(invoice => {
        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const amount = invoice.amount_due;

        aging.total += amount;

        if (daysOverdue <= 0) {
          aging.current += amount;
        } else if (daysOverdue <= 30) {
          aging.days_1_30 += amount;
        } else if (daysOverdue <= 60) {
          aging.days_31_60 += amount;
        } else if (daysOverdue <= 90) {
          aging.days_61_90 += amount;
        } else {
          aging.days_over_90 += amount;
        }
      });

      return aging;
    } catch (error) {
      console.error('Failed to calculate AR aging:', error);
      throw error;
    }
  }
}

// Default configuration helper
export const createCampfireService = (apiKey: string, options?: Partial<CampfireConfig>) => {
  return new CampfireService({
    apiKey,
    ...options,
  });
};

// Helper function to estimate collection timing based on payment terms and historical data
export const estimateCollectionTiming = (invoice: CampfireInvoice): {
  estimatedCollectionDate: Date;
  confidence: 'high' | 'medium' | 'low';
} => {
  const dueDate = new Date(invoice.due_date);
  const now = new Date();
  
  // Simple estimation logic - can be enhanced with ML/historical data
  let estimatedDays = 0;
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  
  // Parse payment terms
  if (invoice.payment_terms?.includes('net_30')) {
    estimatedDays = 35; // Assume 5 days late on average
    confidence = 'medium';
  } else if (invoice.payment_terms?.includes('net_15')) {
    estimatedDays = 18;
    confidence = 'high';
  } else if (invoice.payment_terms?.includes('due_on_receipt')) {
    estimatedDays = 7;
    confidence = 'high';
  } else {
    estimatedDays = 30; // Default assumption
    confidence = 'low';
  }
  
  // If already overdue, adjust estimation
  const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysOverdue > 0) {
    estimatedDays = Math.max(7, 30 - daysOverdue); // Reduce expected days if overdue
    confidence = 'low';
  }
  
  const estimatedCollectionDate = new Date();
  estimatedCollectionDate.setDate(estimatedCollectionDate.getDate() + estimatedDays);
  
  return {
    estimatedCollectionDate,
    confidence,
  };
};