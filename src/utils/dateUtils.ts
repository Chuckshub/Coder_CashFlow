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
  const currentWeekStart = getWeekStart(startDate);
  
  // Start from one week before current week (week -1)
  let weekDate = addWeeks(currentWeekStart, -1);
  
  // Generate 14 weeks total: week -1, week 0 (current), weeks 1-12
  for (let i = 0; i < 14; i++) {
    weeks.push(new Date(weekDate));
    weekDate = addWeeks(weekDate, 1);
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

/* 
// DEPRECATED: Use calculateRollingCashflows from rollingTimeline.ts instead
export const calculateWeeklyCashflows = (
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number,
  baseDate: Date = new Date()
): WeeklyCashflow[] => {
  // This function is deprecated - use calculateRollingCashflows instead
  return [];
};
*/

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