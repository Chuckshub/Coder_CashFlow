/**
 * Enhanced Cashflow Calculation Service with AR Integration
 * 
 * This service extends the existing cashflow calculations to include
 * AR estimates from Campfire integration.
 */

import { Transaction, Estimate, WeeklyCashflow, AREstimate, WeeklyCashflowWithAR } from '../types';
import { generate13Weeks } from '../utils/dateUtils';

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
