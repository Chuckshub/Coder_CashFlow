import { CampfireApiResponse, CampfireInvoice } from '../types';

class CampfireService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly useProxy: boolean;

  constructor() {
    // Get API key from environment variable
    this.apiKey = process.env.REACT_APP_CAMPFIRE_API_KEY || process.env.CAMPFIRE_API_KEY || '';
    
    // Determine if we should use proxy (in production) or direct API (in development with CORS disabled)
    this.useProxy = process.env.NODE_ENV === 'production' || process.env.REACT_APP_USE_CAMPFIRE_PROXY === 'true';
    
    if (this.useProxy) {
      // Use Vercel serverless function proxy
      this.baseUrl = window.location.origin + '/api/campfire-proxy';
      console.log('🔄 Using Campfire proxy endpoint:', this.baseUrl);
    } else {
      // Direct API call (development only)
      this.baseUrl = 'https://api.meetcampfire.com/coa/api/v1';
      console.log('🔗 Using direct Campfire API:', this.baseUrl);
    }
    
    if (!this.apiKey && !this.useProxy) {
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
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Only add Authorization header for direct API calls
    // Proxy handles authentication server-side
    if (!this.useProxy && this.apiKey) {
      headers['Authorization'] = `Token ${this.apiKey}`;
    }
    
    return headers;
  }

  /**
   * Build request URL for either proxy or direct API
   */
  private buildUrl(path: string, queryParams: Record<string, string | number> = {}): string {
    if (this.useProxy) {
      // For proxy: /api/campfire-proxy?path=invoice/&page=1&page_size=10
      const url = new URL(this.baseUrl);
      url.searchParams.set('path', path);
      
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value.toString());
      });
      
      return url.toString();
    } else {
      // For direct API: https://api.meetcampfire.com/coa/api/v1/invoice/?page=1&page_size=10
      const url = new URL(`${this.baseUrl}/${path}`);
      
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value.toString());
      });
      
      return url.toString();
    }
  }

  /**
   * Fetch all open invoices from Campfire
   */
  async fetchOpenInvoices(): Promise<CampfireInvoice[]> {
    if (!this.apiKey && !this.useProxy) {
      console.error('❌ Campfire API key not configured');
      return [];
    }

    console.log('🔥 Fetching open invoices from Campfire...');

    try {
      const url = this.buildUrl('invoice/');
      
      const response = await fetch(url, {
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
    if (!this.apiKey && !this.useProxy) {
      console.error('❌ Campfire API key not configured');
      return [];
    }

    let allInvoices: CampfireInvoice[] = [];
    let currentPage = 1;
    let hasMore = true;
    const maxPages = 10; // Safety limit

    console.log('🔥 Fetching all open invoices from Campfire with pagination...');

    try {
      while (hasMore && currentPage <= maxPages) {
        console.log(`📄 Fetching page ${currentPage}...`);
        
        const url = this.buildUrl('invoice/', {
          page: currentPage,
          page_size: 100 // Fetch more per page for efficiency
        });
        
        const response = await fetch(url, {
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
        
        console.log(`📊 Page ${currentPage}: ${openInvoices.length} open invoices (${data.results.length} total)`);
        
        // Check if there are more pages
        hasMore = !!data.next;
        currentPage++;
        
        // Small delay to be respectful to the API
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (currentPage > maxPages && hasMore) {
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
    if (!this.apiKey && !this.useProxy) {
      return { success: false, message: 'API key not configured' };
    }

    try {
      console.log('🧪 Testing Campfire API connection...');
      
      const url = this.buildUrl('invoice/', {
        page: 1,
        page_size: 1
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { 
          success: false, 
          message: `API error: ${response.status} ${response.statusText} - ${errorText}` 
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