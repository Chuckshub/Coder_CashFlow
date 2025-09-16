import { CampfireInvoice, ClientPaymentProjection } from '../types';
import { generate13Weeks, getWeekStart, getWeekEnd, isDateInWeek } from '../utils/dateUtils';

/**
 * Service for generating 13-week cash flow projections from Campfire invoice data
 */
class CampfireProjectionService {
  
  /**
   * Generate 13-week projections from Campfire invoice data
   */
  generateProjectionsFromInvoices(
    invoices: CampfireInvoice[],
    startDate: Date = new Date()
  ): ClientPaymentProjection[] {
    console.log(`📈 Generating 13-week projections from ${invoices.length} invoices...`);
    
    // Generate the 13 week periods starting from current week
    const weekDates = generate13Weeks(startDate);
    const projections: ClientPaymentProjection[] = [];
    
    // Group projections by week
    weekDates.forEach((weekStart, index) => {
      const weekEnd = getWeekEnd(weekStart);
      const weekNumber = index - 1; // Week -1, 0, 1, 2, ..., 12
      
      // Find invoices that fall within this week based on their due dates
      const weekInvoices = invoices.filter(invoice => {
        const dueDate = new Date(invoice.due_date);
        return isDateInWeek(dueDate, weekStart);
      });
      
      if (weekInvoices.length > 0) {
        // Group by client to create consolidated projections
        const clientGroups = this.groupInvoicesByClient(weekInvoices);
        
        clientGroups.forEach((clientInvoices, clientName) => {
          const totalAmount = clientInvoices.reduce((sum, inv) => sum + inv.amount_due, 0);
          const invoiceNumbers = clientInvoices.map(inv => inv.invoice_number);
          
          // Determine confidence based on invoice status and age
          const confidence = this.calculateConfidence(clientInvoices);
          
          projections.push({
            weekNumber,
            weekStart,
            weekEnd,
            expectedAmount: totalAmount,
            clientName,
            invoiceNumbers,
            originalDueDate: new Date(clientInvoices[0].due_date), // Use first invoice's due date
            confidence,
            invoiceCount: clientInvoices.length
          });
        });
      }
    });
    
    // Sort projections by week number
    projections.sort((a, b) => a.weekNumber - b.weekNumber);
    
    console.log(`✅ Generated ${projections.length} client payment projections across ${weekDates.length} weeks`);
    
    return projections;
  }
  
  /**
   * Group invoices by client name
   */
  private groupInvoicesByClient(invoices: CampfireInvoice[]): Map<string, CampfireInvoice[]> {
    const groups = new Map<string, CampfireInvoice[]>();
    
    invoices.forEach(invoice => {
      const clientName = invoice.client_name;
      if (!groups.has(clientName)) {
        groups.set(clientName, []);
      }
      groups.get(clientName)!.push(invoice);
    });
    
    return groups;
  }
  
  /**
   * Calculate confidence level based on invoice characteristics
   */
  private calculateConfidence(invoices: CampfireInvoice[]): 'high' | 'medium' | 'low' {
    // Calculate average days past due across all invoices
    const totalPastDueDays = invoices.reduce((sum, inv) => {
      return sum + (inv.past_due_days || 0);
    }, 0);
    const avgPastDueDays = totalPastDueDays / invoices.length;
    
    // Check invoice status distribution
    const openInvoices = invoices.filter(inv => inv.status === 'open').length;
    const pastDueInvoices = invoices.filter(inv => inv.status === 'past_due').length;
    
    // Confidence scoring logic
    if (pastDueInvoices === 0 && avgPastDueDays === 0) {
      return 'high'; // All invoices are current
    } else if (pastDueInvoices <= invoices.length * 0.3 && avgPastDueDays < 10) {
      return 'medium'; // Less than 30% past due, average less than 10 days
    } else {
      return 'low'; // High proportion past due or significantly overdue
    }
  }
  
  /**
   * Aggregate projections by week for cashflow integration
   */
  aggregateProjectionsByWeek(
    projections: ClientPaymentProjection[]
  ): Map<number, { totalAmount: number; clientCount: number; projections: ClientPaymentProjection[] }> {
    const weeklyAggregates = new Map();
    
    projections.forEach(projection => {
      const { weekNumber } = projection;
      
      if (!weeklyAggregates.has(weekNumber)) {
        weeklyAggregates.set(weekNumber, {
          totalAmount: 0,
          clientCount: 0,
          projections: []
        });
      }
      
      const aggregate = weeklyAggregates.get(weekNumber);
      aggregate.totalAmount += projection.expectedAmount;
      aggregate.clientCount += 1;
      aggregate.projections.push(projection);
    });
    
    return weeklyAggregates;
  }
  
  /**
   * Apply confidence adjustments to projection amounts for different scenarios
   */
  applyConfidenceAdjustments(
    projections: ClientPaymentProjection[],
    scenario: 'optimistic' | 'realistic' | 'pessimistic'
  ): ClientPaymentProjection[] {
    return projections.map(projection => {
      let multiplier = 1.0;
      
      switch (scenario) {
        case 'optimistic':
          multiplier = projection.confidence === 'high' ? 1.0 :
                      projection.confidence === 'medium' ? 0.95 : 0.85;
          break;
        case 'realistic':
          multiplier = projection.confidence === 'high' ? 0.95 :
                      projection.confidence === 'medium' ? 0.80 : 0.60;
          break;
        case 'pessimistic':
          multiplier = projection.confidence === 'high' ? 0.85 :
                      projection.confidence === 'medium' ? 0.65 : 0.40;
          break;
      }
      
      return {
        ...projection,
        expectedAmount: projection.expectedAmount * multiplier
      };
    });
  }
  
  /**
   * Get summary statistics for projections
   */
  getProjectionSummary(projections: ClientPaymentProjection[]) {
    const totalAmount = projections.reduce((sum, p) => sum + p.expectedAmount, 0);
    const clientCount = new Set(projections.map(p => p.clientName)).size;
    const invoiceCount = projections.reduce((sum, p) => sum + p.invoiceCount, 0);
    
    const confidenceBreakdown = {
      high: projections.filter(p => p.confidence === 'high').length,
      medium: projections.filter(p => p.confidence === 'medium').length,
      low: projections.filter(p => p.confidence === 'low').length
    };
    
    // Calculate weekly distribution
    const weeklyDistribution = this.aggregateProjectionsByWeek(projections);
    
    return {
      totalAmount,
      clientCount,
      invoiceCount,
      projectionCount: projections.length,
      confidenceBreakdown,
      weeklyDistribution,
      lastGenerated: new Date()
    };
  }
}

// Singleton instance
let projectionServiceInstance: CampfireProjectionService | null = null;

export const getCampfireProjectionService = (): CampfireProjectionService => {
  if (!projectionServiceInstance) {
    projectionServiceInstance = new CampfireProjectionService();
  }
  return projectionServiceInstance;
};

export default CampfireProjectionService;
