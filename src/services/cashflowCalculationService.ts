/**
 * Enhanced Cashflow Calculation Service with AR Integration
 * 
 * This service extends the existing cashflow calculations to include
 * AR estimates from Campfire integration.
 */

import { Transaction, Estimate, WeeklyCashflow, AREstimate, WeeklyCashflowWithAR,
  WeeklyCashflowWithProjections, CashflowProjections, ClientPaymentProjection
 } from '../types';
import { generate13Weeks } from '../utils/dateUtils';
import { getCampfireProjectionService } from './campfireProjectionService';

export interface CashflowCalculationOptions {
  includeAREstimates: boolean;
  arEstimates?: AREstimate[];
}

/**
 * Enhanced weekly cashflow calculation that includes AR estimates
 */
export function calculateWeeklyCashflowsWithAR(
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number,
  options: CashflowCalculationOptions = { includeAREstimates: false }
): WeeklyCashflowWithAR[] {
  try {
    if (transactions.length === 0 && estimates.length === 0 && (!options.arEstimates || options.arEstimates.length === 0)) {
      return [];
    }

    const weekDates = generate13Weeks();
    let runningBalance = startingBalance;
    const arEstimates = options.arEstimates || [];

    return weekDates.map((weekStartDate, index) => {
      const weekNumber = index - 1; // Week -1, 0, 1, 2, ..., 12
      
      // Calculate week end date (6 days after start)
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      weekEndDate.setHours(23, 59, 59, 999);

      // Get transactions for this week
      const weekTransactions = transactions.filter(
        (t) => t.date >= weekStartDate && t.date <= weekEndDate
      );

      // Get estimates for this week
      const weekEstimates = estimates.filter(
        (e) => e.weekNumber === weekNumber
      );

      // Get AR estimates for this week
      const weekAREstimates = arEstimates.filter(
        (ar) => ar.weekNumber === weekNumber
      );

      // Calculate actual amounts
      const actualInflow = weekTransactions
        .filter((t) => t.type === 'inflow')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const actualOutflow = weekTransactions
        .filter((t) => t.type === 'outflow')
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate estimated amounts from regular estimates
      const estimatedInflow = weekEstimates
        .filter((e) => e.type === 'inflow')
        .reduce((sum, e) => sum + e.amount, 0);
      
      const estimatedOutflow = weekEstimates
        .filter((e) => e.type === 'outflow')
        .reduce((sum, e) => sum + e.amount, 0);

      // Calculate AR estimated inflow
      const estimatedARInflow = options.includeAREstimates
        ? weekAREstimates.reduce((sum, ar) => sum + ar.amount, 0)
        : 0;

      // Total inflow includes AR estimates if enabled
      const totalInflow = actualInflow + estimatedInflow + estimatedARInflow;
      const totalOutflow = actualOutflow + estimatedOutflow;
      const netCashflow = totalInflow - totalOutflow;
      
      // Calculate separate net cashflows
      const netCashflowActuals = actualInflow - actualOutflow; // Only actual transactions
      const netCashflowWithEstimates = (actualInflow + estimatedInflow) - (actualOutflow + estimatedOutflow); // Actuals + estimates, no AR
      
      runningBalance += netCashflow;
      
      // Determine week status
      const now = new Date();
      let weekStatus: 'past' | 'current' | 'future';
      if (weekEndDate < now) {
        weekStatus = 'past';
      } else if (weekStartDate <= now && now <= weekEndDate) {
        weekStatus = 'current';
      } else {
        weekStatus = 'future';
      }

      const weeklyCashflow: WeeklyCashflowWithAR = {
        weekNumber,
        weekStart: weekStartDate,
        weekEnd: weekEndDate,
        weekStatus,
        actualInflow,
        actualOutflow,
        estimatedInflow,
        estimatedOutflow,
        totalInflow,
        totalOutflow,
        netCashflow,
        runningBalance,
        estimates: weekEstimates,
        transactions: weekTransactions,
        arEstimates: weekAREstimates,
        estimatedARInflow,
        netCashflowActuals,
        netCashflowWithEstimates,
      };
      
      return weeklyCashflow;
    });
  } catch (error) {
    console.error('Error calculating weekly cashflows with AR:', error);
    throw error;
  }
}

/**
 * Get AR contribution summary across all weeks
 */
export function getARContributionSummary(
  cashflows: WeeklyCashflowWithAR[]
): {
  totalARContribution: number;
  weeklyBreakdown: Array<{
    weekNumber: number;
    arAmount: number;
    arCount: number;
    confidence: { high: number; medium: number; low: number };
  }>;
  confidenceDistribution: {
    high: { amount: number; count: number };
    medium: { amount: number; count: number };
    low: { amount: number; count: number };
  };
} {
  const totalARContribution = cashflows.reduce((sum, week) => sum + week.estimatedARInflow, 0);
  
  const weeklyBreakdown = cashflows.map(week => {
    const arAmount = week.estimatedARInflow;
    const arCount = week.arEstimates.length;
    
    // Calculate confidence distribution for this week
    const confidence = week.arEstimates.reduce(
      (acc, ar) => {
        acc[ar.confidence] += ar.amount;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );
    
    return {
      weekNumber: week.weekNumber,
      arAmount,
      arCount,
      confidence,
    };
  });
  
  // Overall confidence distribution
  const confidenceDistribution = cashflows.reduce(
    (acc, week) => {
      week.arEstimates.forEach(ar => {
        acc[ar.confidence].amount += ar.amount;
        acc[ar.confidence].count += 1;
      });
      return acc;
    },
    {
      high: { amount: 0, count: 0 },
      medium: { amount: 0, count: 0 },
      low: { amount: 0, count: 0 },
    }
  );
  
  return {
    totalARContribution,
    weeklyBreakdown,
    confidenceDistribution,
  };
}

/**
 * Filter AR estimates by various criteria
 */
export function filterAREstimates(
  arEstimates: AREstimate[],
  filters: {
    minAmount?: number;
    maxAmount?: number;
    confidence?: Array<'high' | 'medium' | 'low'>;
    status?: Array<'current' | 'overdue' | 'collections'>;
    clients?: string[];
    dateRange?: { start: Date; end: Date };
  }
): AREstimate[] {
  return arEstimates.filter(ar => {
    // Amount filter
    if (filters.minAmount && ar.amount < filters.minAmount) return false;
    if (filters.maxAmount && ar.amount > filters.maxAmount) return false;
    
    // Confidence filter
    if (filters.confidence && !filters.confidence.includes(ar.confidence)) return false;
    
    // Status filter
    if (filters.status && !filters.status.includes(ar.status)) return false;
    
    // Client filter
    if (filters.clients && !filters.clients.includes(ar.clientName)) return false;
    
    // Date range filter
    if (filters.dateRange) {
      const collectionDate = ar.estimatedCollectionDate;
      if (collectionDate < filters.dateRange.start || collectionDate > filters.dateRange.end) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Scenario analysis for different AR collection rates
 */
export function performARScenarioAnalysis(
  transactions: Transaction[],
  estimates: Estimate[],
  arEstimates: AREstimate[],
  startingBalance: number
): {
  optimistic: WeeklyCashflowWithAR[];
  realistic: WeeklyCashflowWithAR[];
  pessimistic: WeeklyCashflowWithAR[];
} {
  // Optimistic: 100% collection on estimated dates
  const optimisticAR = arEstimates.map(ar => ({ ...ar, amount: ar.amount }));
  
  // Realistic: Current estimates (already adjusted)
  const realisticAR = arEstimates;
  
  // Pessimistic: 70% collection with 2 week delay
  const pessimisticAR = arEstimates.map(ar => {
    const delayedDate = new Date(ar.estimatedCollectionDate);
    delayedDate.setDate(delayedDate.getDate() + 14);
    
    // Recalculate week number for delayed date
    const weekDates = generate13Weeks();
    let newWeekNumber = ar.weekNumber;
    for (let i = 0; i < weekDates.length; i++) {
      const weekStart = weekDates[i];
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      if (delayedDate >= weekStart && delayedDate <= weekEnd) {
        newWeekNumber = i - 1;
        break;
      }
    }
    
    return {
      ...ar,
      amount: ar.amount * 0.7,
      estimatedCollectionDate: delayedDate,
      weekNumber: newWeekNumber,
      confidence: 'low' as const,
    };
  });
  
  return {
    optimistic: calculateWeeklyCashflowsWithAR(transactions, estimates, startingBalance, {
      includeAREstimates: true,
      arEstimates: optimisticAR,
    }),
    realistic: calculateWeeklyCashflowsWithAR(transactions, estimates, startingBalance, {
      includeAREstimates: true,
      arEstimates: realisticAR,
    }),
    pessimistic: calculateWeeklyCashflowsWithAR(transactions, estimates, startingBalance, {
      includeAREstimates: true,
      arEstimates: pessimisticAR,
    }),
  };
}

/**
 * Enhanced cashflow calculation that includes client payment projections
 */
export interface CashflowCalculationOptionsWithProjections extends CashflowCalculationOptions {
  includeClientProjections?: boolean;
  clientProjections?: CashflowProjections;
}

/**
 * Calculate weekly cashflows with client payment projections
 */
export function calculateWeeklyCashflowsWithProjections(
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number,
  options: CashflowCalculationOptionsWithProjections = { 
    includeAREstimates: false,
    includeClientProjections: false
  }
): WeeklyCashflowWithProjections[] {
  try {
    // First get the base cashflow with AR
    const baseCashflows = calculateWeeklyCashflowsWithAR(
      transactions,
      estimates,
      startingBalance,
      options
    );

    // If client projections not requested, just return enhanced base cashflows
    if (!options.includeClientProjections || !options.clientProjections) {
      return baseCashflows.map(week => ({
        ...week,
        projectedClientPayments: 0,
        clientPaymentProjections: []
      }));
    }

    // For Phase 1 & 2: Simple integration without complex projection service
    // TODO: Integrate with actual client payments from Firebase
    return baseCashflows.map(week => ({
        ...week,
        projectedClientPayments: 0,
        clientPaymentProjections: []
      }));

  } catch (error) {
    console.error('Error calculating weekly cashflows with projections:', error);
    throw error;
  }
}

/**
 * Generate comprehensive cashflow scenarios with client projections
 */
export async function generateCashflowScenariosWithProjections(
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number,
  arEstimates?: AREstimate[]
) {
  console.log('🔮 Generating cashflow scenarios with client payment projections...');
  
  try {
    // For Phase 1 & 2: Simple scenarios without complex client projections
    // TODO: Add actual client payment integration from Firebase
    
    const emptyProjections: CashflowProjections = {
      clientPayments: [],
      totalProjectedAmount: 0,
      invoiceCount: 0,
      lastUpdated: new Date()
    };
    
    // Generate base AR estimates for different scenarios
    const baseAREstimates = arEstimates || [];
    const optimisticAR = baseAREstimates.map((estimate, index) => ({
      ...estimate,
      amount: estimate.amount * 1.2, // 20% higher for optimistic
      weekNumber: estimate.weekNumber,
      confidence: 'high' as const,
    }));
    
    const realisticAR = baseAREstimates.map((estimate, index) => ({
      ...estimate,
      amount: estimate.amount, // Base estimate
      weekNumber: estimate.weekNumber,
      confidence: 'medium' as const,
    }));
    
    const pessimisticAR = baseAREstimates.map((estimate, index) => ({
      ...estimate,
      amount: estimate.amount * 0.7, // 30% lower for pessimistic
      weekNumber: estimate.weekNumber,
      confidence: 'low' as const,
    }));
    
    return {
      optimistic: calculateWeeklyCashflowsWithProjections(transactions, estimates, startingBalance, {
        includeAREstimates: true,
        arEstimates: optimisticAR,
        includeClientProjections: false,
        clientProjections: emptyProjections
      }),
      realistic: calculateWeeklyCashflowsWithProjections(transactions, estimates, startingBalance, {
        includeAREstimates: true,
        arEstimates: realisticAR,
        includeClientProjections: false,
        clientProjections: emptyProjections
      }),
      pessimistic: calculateWeeklyCashflowsWithProjections(transactions, estimates, startingBalance, {
        includeAREstimates: true,
        arEstimates: pessimisticAR,
        includeClientProjections: false,
        clientProjections: emptyProjections
      }),
      clientProjectionsSummary: emptyProjections
    };
    
  } catch (error) {
    console.error('Error generating cashflow scenarios with projections:', error);
    // Fallback to basic scenario without projections
    return {
      optimistic: [],
      realistic: [],
      pessimistic: [],
      clientProjectionsSummary: {
        clientPayments: [],
        totalProjectedAmount: 0,
        invoiceCount: 0,
        lastUpdated: new Date()
      }
    };
  }
}

/**
 * Calculate weekly cashflows with projections generated directly from Campfire invoices
 */
export function calculateWeeklyCashflowsWithCampfireProjections(
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number,
  invoices: any[], // CampfireInvoice[] - using any for now to avoid circular imports
  options: CashflowCalculationOptions = { includeAREstimates: false }
): WeeklyCashflowWithProjections[] {
  try {
    console.log('📈 Calculating weekly cashflows with Campfire invoice projections...');
    
    // First get the base cashflow with AR
    const baseCashflows = calculateWeeklyCashflowsWithAR(
      transactions,
      estimates,
      startingBalance,
      options
    );

    // Generate projections from Campfire invoices
    const projectionService = getCampfireProjectionService();
    const projections = projectionService.generateProjectionsFromInvoices(invoices);
    
    console.log(`💰 Generated ${projections.length} client payment projections`);
    
    // Aggregate projections by week number
    const weeklyProjections = projectionService.aggregateProjectionsByWeek(projections);
    
    // Integrate projections into weekly cashflows
    let runningBalance = startingBalance;
    
    return baseCashflows.map((week, index) => {
      const weekNumber = index - 1; // Convert to week numbers (-1, 0, 1, 2, ...)
      const weekProjections = weeklyProjections.get(weekNumber);
      
      const projectedClientPayments = weekProjections ? weekProjections.totalAmount : 0;
      const clientPaymentProjections = weekProjections ? weekProjections.projections : [];
      
      // Recalculate totals including projections
      const totalInflow = week.totalInflow + projectedClientPayments;
      const netCashflow = totalInflow - week.totalOutflow;
      
      // Update separate net cashflows (projections affect the total but not the actuals/estimates split)
      const netCashflowWithProjections = week.netCashflowWithEstimates + projectedClientPayments;
      
      if (index === 0) {
        runningBalance += netCashflow;
      } else {
        runningBalance += netCashflow;
      }
      
      return {
        ...week,
        totalInflow,
        netCashflow,
        netCashflowWithEstimates: netCashflowWithProjections, // Include projections in the "with estimates" total
        endingBalance: runningBalance,
        projectedClientPayments,
        clientPaymentProjections
      };
    });
    
  } catch (error) {
    console.error('Error calculating weekly cashflows with Campfire projections:', error);
    throw error;
  }
}

/**
 * Generate different scenarios with Campfire invoice projections
 */
export function generateCampfireProjectionScenarios(
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number,
  invoices: any[], // CampfireInvoice[]
  arEstimates?: AREstimate[]
) {
  console.log('🔮 Generating Campfire projection scenarios...');
  
  try {
    const projectionService = getCampfireProjectionService();
    
    // Generate base projections
    const baseProjections = projectionService.generateProjectionsFromInvoices(invoices);
    
    // Apply different confidence adjustments for scenarios
    const optimisticProjections = projectionService.applyConfidenceAdjustments(baseProjections, 'optimistic');
    const realisticProjections = projectionService.applyConfidenceAdjustments(baseProjections, 'realistic');
    const pessimisticProjections = projectionService.applyConfidenceAdjustments(baseProjections, 'pessimistic');
    
    // Generate AR estimates for different scenarios
    const baseAREstimates = arEstimates || [];
    const optimisticAR = baseAREstimates.map(estimate => ({
      ...estimate,
      amount: estimate.amount * 1.2,
      confidence: 'high' as const
    }));
    
    const realisticAR = baseAREstimates.map(estimate => ({
      ...estimate,
      amount: estimate.amount,
      confidence: 'medium' as const
    }));
    
    const pessimisticAR = baseAREstimates.map(estimate => ({
      ...estimate,
      amount: estimate.amount * 0.7,
      confidence: 'low' as const
    }));
    
    // Calculate cashflows for each scenario
    return {
      optimistic: calculateWeeklyCashflowsWithCampfireProjections(
        transactions, estimates, startingBalance, 
        optimisticProjections.map(p => ({ 
          // Convert projection back to invoice-like format
          due_date: p.originalDueDate.toISOString(),
          amount_due: p.expectedAmount,
          client_name: p.clientName,
          invoice_number: p.invoiceNumbers[0] || 'PROJ',
          status: 'open',
          past_due_days: 0
        })),
        { includeAREstimates: true, arEstimates: optimisticAR }
      ),
      realistic: calculateWeeklyCashflowsWithCampfireProjections(
        transactions, estimates, startingBalance,
        realisticProjections.map(p => ({
          due_date: p.originalDueDate.toISOString(),
          amount_due: p.expectedAmount,
          client_name: p.clientName,
          invoice_number: p.invoiceNumbers[0] || 'PROJ',
          status: 'open',
          past_due_days: 0
        })),
        { includeAREstimates: true, arEstimates: realisticAR }
      ),
      pessimistic: calculateWeeklyCashflowsWithCampfireProjections(
        transactions, estimates, startingBalance,
        pessimisticProjections.map(p => ({
          due_date: p.originalDueDate.toISOString(),
          amount_due: p.expectedAmount,
          client_name: p.clientName,
          invoice_number: p.invoiceNumbers[0] || 'PROJ',
          status: 'open',
          past_due_days: 0
        })),
        { includeAREstimates: true, arEstimates: pessimisticAR }
      ),
      projectionSummary: projectionService.getProjectionSummary(baseProjections)
    };
    
  } catch (error) {
    console.error('Error generating Campfire projection scenarios:', error);
    throw error;
  }
}