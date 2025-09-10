import { 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  format, 
  isWithinInterval,
  differenceInWeeks,
  startOfDay,
  endOfDay
} from 'date-fns';
import { Transaction, WeeklyCashflow, Estimate } from '../types';

export const getWeekStart = (date: Date): Date => {
  return startOfWeek(date, { weekStartsOn: 1 }); // Start week on Monday
};

export const getWeekEnd = (date: Date): Date => {
  return endOfWeek(date, { weekStartsOn: 1 });
};

export const formatWeekRange = (weekStart: Date): string => {
  const weekEnd = getWeekEnd(weekStart);
  return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
};

export const generate13Weeks = (startDate: Date = new Date()): Date[] => {
  const weeks: Date[] = [];
  let currentWeek = getWeekStart(startDate);
  
  for (let i = 0; i < 13; i++) {
    weeks.push(new Date(currentWeek));
    currentWeek = addWeeks(currentWeek, 1);
  }
  
  return weeks;
};

export const getWeekNumber = (date: Date, baseDate: Date): number => {
  const weekStart = getWeekStart(baseDate);
  return differenceInWeeks(getWeekStart(date), weekStart) + 1;
};

export const isDateInWeek = (date: Date, weekStart: Date): boolean => {
  const weekEnd = getWeekEnd(weekStart);
  return isWithinInterval(date, {
    start: startOfDay(weekStart),
    end: endOfDay(weekEnd)
  });
};

export const calculateWeeklyCashflows = (
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number,
  baseDate: Date = new Date()
): WeeklyCashflow[] => {
  const weeks = generate13Weeks(baseDate);
  const weeklyCashflows: WeeklyCashflow[] = [];
  let runningBalance = startingBalance;
  
  weeks.forEach((weekStart, index) => {
    const weekNumber = index + 1;
    const weekEnd = getWeekEnd(weekStart);
    
    // Get actual transactions for this week
    const weekTransactions = transactions.filter(transaction =>
      isDateInWeek(transaction.date, weekStart)
    );
    
    // Get estimates for this week
    const weekEstimates = estimates.filter(estimate =>
      estimate.weekNumber === weekNumber
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
    
    // Calculate net cashflow (actual + estimated)
    const totalInflow = actualInflow + estimatedInflow;
    const totalOutflow = actualOutflow + estimatedOutflow;
    const netCashflow = totalInflow - totalOutflow;
    
    // Update running balance
    runningBalance += netCashflow;
    
    weeklyCashflows.push({
      weekNumber,
      weekStart,
      weekEnd,
      actualInflow,
      actualOutflow,
      estimatedInflow,
      estimatedOutflow,
      netCashflow,
      runningBalance,
      estimates: weekEstimates
    });
  });
  
  return weeklyCashflows;
};

export const getTransactionsInDateRange = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] => {
  return transactions.filter(transaction =>
    isWithinInterval(transaction.date, {
      start: startOfDay(startDate),
      end: endOfDay(endDate)
    })
  );
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatCurrencyWithCents = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const getCurrencyColor = (amount: number): string => {
  if (amount > 0) return 'text-green-600';
  if (amount < 0) return 'text-red-600';
  return 'text-gray-900';
};

export const getBalanceColor = (balance: number): string => {
  if (balance > 100000) return 'text-green-600';
  if (balance > 50000) return 'text-blue-600';
  if (balance > 0) return 'text-gray-900';
  return 'text-red-600';
};