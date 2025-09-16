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
          
          // Determine days until due date (negative for overdue)
          const daysUntilDue = this.calculateDaysUntilDue(clientInvoices);
          
          projections.push({
            weekNumber,
            weekStart,
            weekEnd,
            expectedAmount: totalAmount,
            clientName,
            invoiceNumbers,
            originalDueDate: new Date(clientInvoices[0].due_date), // Use first invoice's due date
            daysUntilDue,
            invoiceCount: clientInvoices.length
          });
        });
      }
    });
    
    // Sort projections by days until due (overdue first), then by week number
    projections.sort((a, b) => {
      // First sort by days until due (overdue/negative first)
      if (a.daysUntilDue !== b.daysUntilDue) {
        return a.daysUntilDue - b.daysUntilDue;
      }
      // Then by week number as secondary sort
      return a.weekNumber - b.weekNumber;
    });
    
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
   * Calculate days until due date (negative for overdue)
   */
  private calculateDaysUntilDue(invoices: CampfireInvoice[]): number {
    if (invoices.length === 0) return 0;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    
    // Use the earliest due date if multiple invoices
    const earliestDueDate = invoices.reduce((earliest, invoice) => {
      const dueDate = new Date(invoice.due_date);
      return dueDate < earliest ? dueDate : earliest;
    }, new Date(invoices[0].due_date));
    
    earliestDueDate.setHours(0, 0, 0, 0);
    
    // Calculate days difference
    const timeDiff = earliestDueDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    return daysDiff;
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
          multiplier = projection.daysUntilDue >= 0 ? 1.0 :    // Not overdue
                      projection.daysUntilDue >= -7 ? 0.95 : 0.85;  // 1 week or less overdue vs more
          break;
        case 'realistic':
          multiplier = projection.daysUntilDue >= 7 ? 0.95 :   // Due in a week+
                      projection.daysUntilDue >= 0 ? 0.90 :    // Due soon but not overdue
                      projection.daysUntilDue >= -7 ? 0.70 : 0.50;  // Recently overdue vs very overdue
          break;
        case 'pessimistic':
          multiplier = projection.daysUntilDue >= 7 ? 0.85 :   // Due in a week+
                      projection.daysUntilDue >= 0 ? 0.75 :    // Due soon but not overdue
                      projection.daysUntilDue >= -7 ? 0.50 : 0.30;  // Recently overdue vs very overdue
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
    
    const daysBreakdown = {
      overdue: projections.filter(p => p.daysUntilDue < 0).length,
      dueSoon: projections.filter(p => p.daysUntilDue >= 0 && p.daysUntilDue <= 7).length,
      dueLater: projections.filter(p => p.daysUntilDue > 7).length
    };
    
    const weeklyDistribution = projections.reduce((acc, p) => {
      const weekKey = `Week ${p.weekNumber}`;
      acc[weekKey] = (acc[weekKey] || 0) + p.expectedAmount;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalAmount,
      clientCount,
      invoiceCount,
      projectionCount: projections.length,
      daysBreakdown,
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