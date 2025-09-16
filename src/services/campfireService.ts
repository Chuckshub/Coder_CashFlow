import { CampfireApiResponse, CampfireInvoice } from '../types';

class CampfireService {
  private readonly baseUrl = 'https://api.meetcampfire.com/coa/api/v1';
  private readonly apiKey: string;

  constructor() {
    // Get API key from environment variable
    this.apiKey = process.env.REACT_APP_CAMPFIRE_API_KEY || process.env.CAMPFIRE_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ Campfire API key not found. Set REACT_APP_CAMPFIRE_API_KEY environment variable.');
    }
  }

  /**
   * Check if Campfire integration is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get request headers with authentication
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'authorization': this.apiKey,
    };
  }

  /**
   * Fetch all open invoices from Campfire
   */
  async fetchOpenInvoices(): Promise<CampfireInvoice[]> {
    if (!this.apiKey) {
      console.error('❌ Campfire API key not configured');
      return [];
    }

    console.log('🔥 Fetching open invoices from Campfire...');

    try {
      const response = await fetch(`${this.baseUrl}/invoice/`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Campfire API error: ${response.status} ${response.statusText}`);
      }

      const data: CampfireApiResponse = await response.json();
      
      // Filter for open invoices only (status = 'open' and amount_due > 0)
      const openInvoices = data.results.filter(invoice => 
        invoice.status === 'open' && 
        invoice.amount_due > 0
      );

      console.log(`✅ Fetched ${openInvoices.length} open invoices from Campfire (${data.results.length} total)`);
      
      return openInvoices;
      
    } catch (error) {
      console.error('💥 Error fetching Campfire invoices:', error);
      throw error;
    }
  }

  /**
   * Fetch invoices with pagination support
   */
  async fetchAllOpenInvoices(): Promise<CampfireInvoice[]> {
    if (!this.apiKey) {
      console.error('❌ Campfire API key not configured');
      return [];
    }

    let allInvoices: CampfireInvoice[] = [];
    let nextUrl: string | null = `${this.baseUrl}/invoice/`;
    let pageCount = 0;
    const maxPages = 10; // Safety limit

    console.log('🔥 Fetching all open invoices from Campfire with pagination...');

    try {
      while (nextUrl && pageCount < maxPages) {
        console.log(`📄 Fetching page ${pageCount + 1}...`);
        
        const response = await fetch(nextUrl, {
          method: 'GET',
          headers: this.getHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Campfire API error: ${response.status} ${response.statusText}`);
        }

        const data: CampfireApiResponse = await response.json();
        
        // Filter and add open invoices
        const openInvoices = data.results.filter(invoice => 
          invoice.status === 'open' && 
          invoice.amount_due > 0
        );
        
        allInvoices = [...allInvoices, ...openInvoices];
        nextUrl = data.next;
        pageCount++;
        
        console.log(`📊 Page ${pageCount}: ${openInvoices.length} open invoices (${data.results.length} total)`);
        
        // Small delay to be respectful to the API
        if (nextUrl) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (pageCount >= maxPages && nextUrl) {
        console.warn(`⚠️ Reached maximum page limit (${maxPages}). There may be more invoices.`);
      }

      console.log(`✅ Fetched total of ${allInvoices.length} open invoices from Campfire`);
      return allInvoices;
      
    } catch (error) {
      console.error('💥 Error fetching all Campfire invoices:', error);
      throw error;
    }
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; invoiceCount?: number }> {
    if (!this.apiKey) {
      return { success: false, message: 'API key not configured' };
    }

    try {
      console.log('🧪 Testing Campfire API connection...');
      
      const response = await fetch(`${this.baseUrl}/invoice/?page=1&page_size=1`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { 
          success: false, 
          message: `API error: ${response.status} ${response.statusText}` 
        };
      }

      const data: CampfireApiResponse = await response.json();
      
      console.log('✅ Campfire API connection successful');
      
      return {
        success: true,
        message: 'Connection successful',
        invoiceCount: data.count
      };
      
    } catch (error) {
      console.error('💥 Campfire API connection test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Singleton instance
let campfireServiceInstance: CampfireService | null = null;

export const getCampfireService = (): CampfireService => {
  if (!campfireServiceInstance) {
    campfireServiceInstance = new CampfireService();
  }
  return campfireServiceInstance;
};

export default CampfireService;
