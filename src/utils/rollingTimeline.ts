import { 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  format, 
  isWithinInterval,
  differenceInWeeks,
  startOfDay,
  endOfDay,
  isSameWeek,
  subWeeks
} from 'date-fns';
import { 
  Transaction, 
  Estimate, 
  WeeklyCashflow, 
  WeekStatus, 
  RollingTimelineConfig,
  ScenarioComparison
} from '../types';
import { getWeekStart, getWeekEnd, isDateInWeek } from './dateUtils';

// Default rolling timeline configuration
export const DEFAULT_ROLLING_CONFIG: RollingTimelineConfig = {
  pastWeeks: 4,
  futureWeeks: 8,
  currentDate: new Date()
};

// Generate rolling weeks array with relative week numbers
export const generateRollingWeeks = (
  config: RollingTimelineConfig = DEFAULT_ROLLING_CONFIG
): Array<{
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  weekStatus: WeekStatus;
}> => {
  const weeks = [];
  const currentWeekStart = getWeekStart(config.currentDate);
  
  // Generate weeks from -pastWeeks to +futureWeeks
  const totalWeeks = config.pastWeeks + 1 + config.futureWeeks; // past + current + future
  const startWeekNumber = -config.pastWeeks;
  
  for (let i = 0; i < totalWeeks; i++) {
    const weekNumber = startWeekNumber + i;
    const weekStart = addWeeks(currentWeekStart, weekNumber);
    const weekEnd = getWeekEnd(weekStart);
    
    let weekStatus: WeekStatus;
    if (weekNumber < 0) {
      weekStatus = 'past';
    } else if (weekNumber === 0) {
      weekStatus = 'current';
    } else {
      weekStatus = 'future';
    }
    
    weeks.push({
      weekNumber,
      weekStart,
      weekEnd,
      weekStatus
    });
  }
  
  return weeks;
};

// Get transactions for a specific week
export const getTransactionsForWeek = (
  transactions: Transaction[],
  weekStart: Date
): Transaction[] => {
  return transactions.filter(transaction =>
    isDateInWeek(transaction.date, weekStart)
  );
};

// Get estimates for a specific week and scenario
export const getEstimatesForWeek = (
  estimates: Estimate[],
  weekStart: Date,
  scenario: string
): Estimate[] => {
  return estimates.filter(estimate =>
    estimate.scenario === scenario &&
    isDateInWeek(estimate.weekDate, weekStart)
  );
};

// Calculate actual flows for a week from transactions
export const calculateActualFlows = (transactions: Transaction[]) => {
  const inflow = transactions
    .filter(t => t.type === 'inflow')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const outflow = transactions
    .filter(t => t.type === 'outflow')
    .reduce((sum, t) => sum + t.amount, 0);
  
  return { inflow, outflow };
};

// Calculate estimated flows for a week from estimates
export const calculateEstimatedFlows = (estimates: Estimate[]) => {
  const inflow = estimates
    .filter(e => e.type === 'inflow')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const outflow = estimates
    .filter(e => e.type === 'outflow')
    .reduce((sum, e) => sum + e.amount, 0);
  
  return { inflow, outflow };
};

// Calculate estimate accuracy by comparing actual vs estimated
export const calculateEstimateAccuracy = (
  actualInflow: number,
  actualOutflow: number,
  estimatedInflow: number,
  estimatedOutflow: number
) => {
  const inflowVariance = estimatedInflow > 0 
    ? ((actualInflow - estimatedInflow) / estimatedInflow) * 100
    : 0;
  
  const outflowVariance = estimatedOutflow > 0
    ? ((actualOutflow - estimatedOutflow) / estimatedOutflow) * 100
    : 0;
  
  return {
    inflowVariance: Math.round(inflowVariance * 100) / 100, // round to 2 decimal places
    outflowVariance: Math.round(outflowVariance * 100) / 100
  };
};

// Generate complete rolling cashflow data
export const calculateRollingCashflows = (
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number,
  activeScenario: string,
  config: RollingTimelineConfig = DEFAULT_ROLLING_CONFIG
): WeeklyCashflow[] => {
  const weeks = generateRollingWeeks(config);
  const weeklyCashflows: WeeklyCashflow[] = [];
  let runningBalance = startingBalance;
  
  // Calculate starting balance by working backwards from past weeks
  // Find the earliest week and calculate balance at that point
  const firstWeek = weeks[0];
  let adjustedStartingBalance = startingBalance;
  
  // Adjust starting balance by subtracting past weeks' net flows
  for (const week of weeks) {
    if (week.weekStatus === 'past') {
      const weekTransactions = getTransactionsForWeek(transactions, week.weekStart);
      const { inflow, outflow } = calculateActualFlows(weekTransactions);
      const netFlow = inflow - outflow;
      adjustedStartingBalance -= netFlow;
    }
  }
  
  runningBalance = adjustedStartingBalance;
  
  weeks.forEach((week) => {
    const weekTransactions = getTransactionsForWeek(transactions, week.weekStart);
    const weekEstimates = getEstimatesForWeek(estimates, week.weekStart, activeScenario);
    
    // Calculate actual flows
    const actualFlows = calculateActualFlows(weekTransactions);
    
    // Calculate estimated flows
    const estimatedFlows = calculateEstimatedFlows(weekEstimates);
    
    // Determine which values to use based on week status
    let totalInflow: number;
    let totalOutflow: number;
    
    if (week.weekStatus === 'past') {
      // Use actual data for past weeks
      totalInflow = actualFlows.inflow;
      totalOutflow = actualFlows.outflow;
    } else if (week.weekStatus === 'current') {
      // For current week, use actual + remaining estimates
      // (For now, we'll just use actual if available, otherwise estimates)
      totalInflow = actualFlows.inflow > 0 ? actualFlows.inflow : estimatedFlows.inflow;
      totalOutflow = actualFlows.outflow > 0 ? actualFlows.outflow : estimatedFlows.outflow;
    } else {
      // Use estimates for future weeks
      totalInflow = estimatedFlows.inflow;
      totalOutflow = estimatedFlows.outflow;
    }
    
    const netCashflow = totalInflow - totalOutflow;
    runningBalance += netCashflow;
    
    // Calculate estimate accuracy for past weeks if estimates existed
    let estimateAccuracy;
    if (week.weekStatus === 'past' && (estimatedFlows.inflow > 0 || estimatedFlows.outflow > 0)) {
      estimateAccuracy = calculateEstimateAccuracy(
        actualFlows.inflow,
        actualFlows.outflow,
        estimatedFlows.inflow,
        estimatedFlows.outflow
      );
    }
    
    weeklyCashflows.push({
      weekNumber: week.weekNumber,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      weekStatus: week.weekStatus,
      
      actualInflow: actualFlows.inflow,
      actualOutflow: actualFlows.outflow,
      
      estimatedInflow: estimatedFlows.inflow,
      estimatedOutflow: estimatedFlows.outflow,
      
      totalInflow,
      totalOutflow,
      netCashflow,
      runningBalance,
      
      transactions: weekTransactions,
      estimates: weekEstimates,
      
      estimateAccuracy
    });
  });
  
  return weeklyCashflows;
};

// Generate scenario comparison data
export const generateScenarioComparison = (
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number,
  scenarios: string[],
  config: RollingTimelineConfig = DEFAULT_ROLLING_CONFIG
): ScenarioComparison[] => {
  const weeks = generateRollingWeeks(config);
  
  return weeks.map(week => {
    const scenarioData: { [scenarioName: string]: any } = {};
    
    scenarios.forEach(scenario => {
      const cashflows = calculateRollingCashflows(
        transactions,
        estimates,
        startingBalance,
        scenario,
        config
      );
      
      const weekCashflow = cashflows.find(cf => cf.weekNumber === week.weekNumber);
      if (weekCashflow) {
        scenarioData[scenario] = {
          inflow: weekCashflow.totalInflow,
          outflow: weekCashflow.totalOutflow,
          netCashflow: weekCashflow.netCashflow,
          runningBalance: weekCashflow.runningBalance
        };
      }
    });
    
    return {
      weekDate: week.weekStart,
      scenarios: scenarioData
    };
  });
};

// Helper to format week range for display
export const formatRollingWeekRange = (weekStart: Date): string => {
  const weekEnd = getWeekEnd(weekStart);
  return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;
};

// Helper to get week status color classes
export const getWeekStatusStyles = (weekStatus: WeekStatus) => {
  switch (weekStatus) {
    case 'past':
      return {
        background: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-900',
        badge: 'bg-green-100 text-green-800'
      };
    case 'current':
      return {
        background: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-900',
        badge: 'bg-blue-100 text-blue-800'
      };
    case 'future':
      return {
        background: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-900',
        badge: 'bg-gray-100 text-gray-600'
      };
    default:
      return {
        background: 'bg-white',
        border: 'border-gray-200',
        text: 'text-gray-900',
        badge: 'bg-gray-100 text-gray-600'
      };
  }
};

// Helper to get week status display text
export const getWeekStatusText = (weekStatus: WeekStatus): string => {
  switch (weekStatus) {
    case 'past':
      return '✓ Actual';
    case 'current':
      return '📅 Current';
    case 'future':
      return '📊 Projected';
    default:
      return 'Unknown';
  }
};