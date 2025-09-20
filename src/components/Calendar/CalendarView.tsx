import React, { useState, useMemo } from 'react';
import { Transaction, Estimate, ClientPayment } from '../../types';
import { formatCurrency } from '../../utils/dateUtils';

interface CalendarViewProps {
  transactions: Transaction[];
  estimates: Estimate[];
  clientPayments: ClientPayment[];
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  transactions: Transaction[];
  estimates: Estimate[];
  clientPayments: ClientPayment[];
}

const CalendarView: React.FC<CalendarViewProps> = ({
  transactions,
  estimates,
  clientPayments
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper function to get the start of the week for a date
  const getWeekStart = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay()); // Go to Sunday
    start.setHours(0, 0, 0, 0);
    return start;
  };

  // Helper function to get week number for a date
  const getWeekNumber = (date: Date) => {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const targetWeekStart = getWeekStart(date);
    
    const diffInMs = targetWeekStart.getTime() - currentWeekStart.getTime();
    const diffInWeeks = Math.floor(diffInMs / (7 * 24 * 60 * 60 * 1000));
    
    return diffInWeeks;
  };

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of month and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the Sunday before the first day of the month
    const startDate = getWeekStart(firstDay);
    
    // Get the Saturday after the last day of the month
    const endDate = new Date(lastDay);
    endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    endDate.setHours(23, 59, 59, 999);
    
    const days: CalendarDay[] = [];
    const currentDateOnly = new Date();
    currentDateOnly.setHours(0, 0, 0, 0);
    
    // Generate all days to display
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayDate = new Date(d);
      dayDate.setHours(0, 0, 0, 0);
      
      // Filter transactions for this day
      const dayTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        transactionDate.setHours(0, 0, 0, 0);
        return transactionDate.getTime() === dayDate.getTime();
      });
      
      // Filter estimates for this day (using week number calculation)
      const weekNumber = getWeekNumber(dayDate);
      const dayEstimates = estimates.filter(e => e.weekNumber === weekNumber);
      
      // Filter client payments for this day
      const dayClientPayments = clientPayments.filter(cp => {
        const paymentDate = new Date(cp.expectedPaymentDate);
        paymentDate.setHours(0, 0, 0, 0);
        return paymentDate.getTime() === dayDate.getTime();
      });
      
      days.push({
        date: dayDate,
        isCurrentMonth: dayDate.getMonth() === month,
        isToday: dayDate.getTime() === currentDateOnly.getTime(),
        transactions: dayTransactions,
        estimates: dayEstimates,
        clientPayments: dayClientPayments
      });
    }
    
    return days;
  }, [currentDate, transactions, estimates, clientPayments, getWeekNumber]);

  // Navigate months
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Format month/year for header
  const monthYear = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{monthYear}</h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Today
            </button>
            <div className="flex items-center space-x-1">
              <button
                onClick={previousMonth}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={nextMonth}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 bg-gray-100">
        {weekdays.map(day => (
          <div key={day} className="px-2 py-3 text-center">
            <div className="text-sm font-medium text-gray-700">
              {day.slice(0, 3)}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          const totalInflow = day.transactions
            .filter(t => t.type === 'inflow')
            .reduce((sum, t) => sum + t.amount, 0) +
            day.estimates
              .filter(e => e.type === 'inflow')
              .reduce((sum, e) => sum + e.amount, 0) +
            day.clientPayments
              .reduce((sum, cp) => sum + cp.amountDue, 0);
              
          const totalOutflow = day.transactions
            .filter(t => t.type === 'outflow')
            .reduce((sum, t) => sum + t.amount, 0) +
            day.estimates
              .filter(e => e.type === 'outflow')
              .reduce((sum, e) => sum + e.amount, 0);
              
          const hasData = day.transactions.length > 0 || day.estimates.length > 0 || day.clientPayments.length > 0;
          
          return (
            <div
              key={index}
              className={`min-h-[120px] border-r border-b border-gray-200 p-2 ${
                !day.isCurrentMonth ? 'bg-gray-50' : 'bg-white'
              } ${day.isToday ? 'bg-blue-50 border-blue-300' : ''}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${
                  !day.isCurrentMonth ? 'text-gray-400' : 
                  day.isToday ? 'text-blue-700' : 'text-gray-900'
                }`}>
                  {day.date.getDate()}
                </span>
                
                {/* Indicators for data types */}
                {hasData && (
                  <div className="flex space-x-1">
                    {day.transactions.length > 0 && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Transactions" />
                    )}
                    {day.estimates.length > 0 && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" title="Estimates" />
                    )}
                    {day.clientPayments.length > 0 && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full" title="Client Payments" />
                    )}
                  </div>
                )}
              </div>
              
              {/* Financial summary */}
              {hasData && (
                <div className="space-y-1">
                  {totalInflow > 0 && (
                    <div className="text-xs text-green-700 font-medium">
                      +{formatCurrency(totalInflow)}
                    </div>
                  )}
                  {totalOutflow > 0 && (
                    <div className="text-xs text-red-700 font-medium">
                      -{formatCurrency(totalOutflow)}
                    </div>
                  )}
                  
                  {/* Item count indicators */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {day.transactions.map((_, i) => (
                      <div key={`t-${i}`} className="w-1 h-1 bg-green-400 rounded-full" />
                    ))}
                    {day.estimates.map((_, i) => (
                      <div key={`e-${i}`} className="w-1 h-1 bg-blue-400 rounded-full" />
                    ))}
                    {day.clientPayments.map((_, i) => (
                      <div key={`cp-${i}`} className="w-1 h-1 bg-purple-400 rounded-full" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div className="flex items-center justify-center space-x-6 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-gray-600">Actual Transactions</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span className="text-gray-600">Estimates</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full" />
            <span className="text-gray-600">Client Payments</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
