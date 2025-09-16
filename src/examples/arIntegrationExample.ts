/**
 * AR Integration Example
 * 
 * This file demonstrates how to use the Campfire AR integration
 * with sample data and configuration.
 */

import { getCampfireService } from '../services/campfireService';
import { CampfireInvoice } from '../types';
import { createARIntegrationService } from '../services/arIntegrationService';
import { ARConfig, AREstimate } from '../types';

// Sample AR configuration
const sampleARConfig: ARConfig = {
  campfireApiKey: 'your_campfire_api_key_here',
  enabled: true,
  autoRefreshInterval: 60, // 1 hour
  collectionAssumptions: {
    currentOnTime: 90, // 90% of current invoices collected on time
    overdueCollectionRate: 75, // 75% of overdue invoices eventually collected
    averageDelayDays: 14, // Average 2 weeks delay
  },
};

// Sample invoice data for testing - TODO: Fix this to match CampfireInvoice interface
/*
const sampleInvoices: CampfireInvoice[] = [
  {
    id: 1,
    invoice_number: 'INV-2024-001',
    invoice_date: '2024-11-01',
    due_date: '2024-12-01',
    total_amount: 15000,
    amount_due: 15000,
    currency: 'USD',
    status: 'sent',
    client: {
      id: 'client-1',
      name: 'Acme Corporation',
    },
    entity: {
      id: 'entity-1',
      name: 'Your Company',
    },
    lines: [
      {
        id: '1',
        description: 'Professional Services - November',
        quantity: 1,
        unit_price: 15000,
        total: 15000,
      },
    ],
    payment_terms: 'net_30',
    message_on_invoice: 'Thank you for your business',
    billing_address: '123 Client St, City, State 12345',
    created_at: '2024-11-01T00:00:00Z',
    updated_at: '2024-11-01T00:00:00Z',
  },
  {
    id: 2,
    invoice_number: 'INV-2024-002',
    invoice_date: '2024-10-15',
    due_date: '2024-11-15',
    total_amount: 8500,
    amount_due: 8500,
    currency: 'USD',
    status: 'overdue',
    client: {
      id: 'client-2',
      name: 'Beta Industries',
    },
    entity: {
      id: 'entity-1',
      name: 'Your Company',
    },
    lines: [
      {
        id: '2',
        description: 'Consulting Services - October',
        quantity: 1,
        unit_price: 8500,
        total: 8500,
      },
    ],
    payment_terms: 'net_30',
    created_at: '2024-10-15T00:00:00Z',
    updated_at: '2024-10-15T00:00:00Z',
  },
];
*/

// Simplified example for now
const sampleInvoices: CampfireInvoice[] = [];

/**
 * Example: Basic AR Integration Setup
 */
export async function basicARExample() {
  console.log('AR Integration Example - Basic Setup');
  
  // 1. Create Campfire service
  const campfireService = getCampfireService();
  
  // 2. Create AR integration service
  const arService = createARIntegrationService(sampleARConfig);
  
  try {
    // 3. Test connection (would normally hit Campfire API)
    console.log('Testing connection...');
    const connectionTest = await arService.testConnection();
    console.log('Connection result:', connectionTest);
    
    // 4. In a real scenario, this would fetch from Campfire API
    // For demo purposes, we'll simulate the AR processing
    console.log('\nProcessing sample invoices...');
    console.log(`Found ${sampleInvoices.length} outstanding invoices`);
    
    sampleInvoices.forEach(invoice => {
      console.log(`- ${invoice.invoice_number}: $${invoice.amount_due} (${invoice.status})`);
    });
    
  } catch (error) {
    console.error('AR Integration failed:', error);
  }
}

/**
 * Run all examples
 */
export async function runARExamples() {
  console.log('Campfire AR Integration Examples');
  console.log('=================================\n');
  
  await basicARExample();
  
  console.log('\n=================================');
  console.log('AR Integration Examples Complete');
}