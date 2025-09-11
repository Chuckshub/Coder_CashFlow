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
  ScenarioComparison,
  RollingWeek
} from '../types';
import { getWeekStart, getWeekEnd, isDateInWeek } from './dateUtils';

// Default rolling timeline configuration
export const DEFAULT_ROLLING_CONFIG: RollingTimelineConfig = {
  pastWeeks: 4,
  futureWeeks: 8,
  currentDate: new Date()
};

// Generate rolling weeks array with relative week numbers
export const generateRollingWeeks = (baseDate: Date = new Date()): RollingWeek[] => {
  const weeks: RollingWeek[] = [];
  const currentWeekStart = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday start
  
  // Generate from -1 week to +13 weeks (15 weeks total)
  for (let i = -1; i <= 13; i++) {
    const weekStart = addWeeks(currentWeekStart, i);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    
    // Determine week status based on week number
    let status: WeekStatus;
    if (i < 0) {
      status = 'past';
    } else if (i === 0) {
      status = 'current';
    } else {
      status = 'future';
    }
    
    weeks.push({
      weekNumber: i,
      weekStart,
      weekEnd,
      status,
      label: i === 0 ? 'Current Week' : 
             i === -1 ? 'Last Week' : 
             i > 0 ? `Week +${i}` : 
             `Week ${i}`
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
  activeScenario: string = 'base',
  config: RollingTimelineConfig = DEFAULT_ROLLING_CONFIG
): WeeklyCashflow[] => {
  const weeks = generateRollingWeeks(config.currentDate);
  const weeklyCashflows: WeeklyCashflow[] = [];
  let runningBalance = startingBalance;

  weeks.forEach((week) => {
    const { weekNumber, weekStart, weekEnd, status } = week;
    
    // Get actual transactions for this week
    const weekTransactions = transactions.filter(transaction =>
      isDateInWeek(transaction.date, weekStart)
    );
    
    // Get estimates for this week in the active scenario
    const weekEstimates = estimates.filter(estimate =>
      estimate.scenario === activeScenario &&
      isDateInWeek(estimate.weekDate, weekStart)
    );
    
    // Calculate actual flows
    const actualInflow = weekTransactions
      .filter(t => t.type === 'inflow')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const actualOutflow = weekTransactions
      .filter(t => t.type === 'outflow')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate estimated flows
    const estimatedInflow = weekEstimates
      .filter(e => e.type === 'inflow')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const estimatedOutflow = weekEstimates
      .filter(e => e.type === 'outflow')
      .reduce((sum, e) => sum + e.amount, 0);
    
    // For past weeks (-1), use actuals; for current/future (0, +1, +2...), combine actual + estimates
    const totalInflow = status === 'past' ? actualInflow : actualInflow + estimatedInflow;
    const totalOutflow = status === 'past' ? actualOutflow : actualOutflow + estimatedOutflow;
    const netCashflow = totalInflow - totalOutflow;
    
    // Update running balance
    runningBalance += netCashflow;
    
    weeklyCashflows.push({
      weekNumber,
      weekStart,
      weekEnd,
      weekStatus: status,
      actualInflow,
      actualOutflow,
      estimatedInflow,
      estimatedOutflow,
      totalInflow,
      totalOutflow,
      netCashflow,
      runningBalance,
      estimates: weekEstimates,
      transactions: weekTransactions
    });
  });
  
  return weeklyCashflows;
};

// Generate scenario comparison data
export const generateScenarioComparison = (
  transactions: Transaction[],
  allEstimates: Estimate[],
  scenarios: string[],
  startingBalance: number,
  config: RollingTimelineConfig = DEFAULT_ROLLING_CONFIG
): ScenarioComparison[] => {
  const weeks = generateRollingWeeks(config.currentDate);
  
  return weeks.map(week => {
    const scenarioData: { [scenarioName: string]: any } = {};
    
    scenarios.forEach(scenario => {
      const cashflows = calculateRollingCashflows(
        transactions,
        allEstimates,
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