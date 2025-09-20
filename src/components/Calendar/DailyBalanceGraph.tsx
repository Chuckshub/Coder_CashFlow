import React, { useState, useMemo } from 'react';
import { Transaction, Estimate, ClientPayment } from '../../types';
import { formatCurrency } from '../../utils/dateUtils';

interface DailyBalanceGraphProps {
  transactions: Transaction[];
  estimates: Estimate[];
  clientPayments: ClientPayment[];
  currentDate: Date;
  beginningBalance: number;
}

interface DailyBalance {
  date: Date;
  balance: number;
  dayOfMonth: number;
  transactions: Transaction[];
  estimates: Estimate[];
  clientPayments: ClientPayment[];
}

const DailyBalanceGraph: React.FC<DailyBalanceGraphProps> = ({
  transactions,
  estimates,
  clientPayments,
  currentDate,
  beginningBalance
}) => {
  const [transferThreshold, setTransferThreshold] = useState<number>(100000); // Default $100k threshold
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [tempThreshold, setTempThreshold] = useState<string>(transferThreshold.toString());

  // Helper function to get week number for a date
  const getWeekNumber = (date: Date) => {
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const targetWeekStart = new Date(date);
    targetWeekStart.setDate(date.getDate() - date.getDay());
    targetWeekStart.setHours(0, 0, 0, 0);
    
    const diffInMs = targetWeekStart.getTime() - currentWeekStart.getTime();
    const diffInWeeks = Math.floor(diffInMs / (7 * 24 * 60 * 60 * 1000));
    
    return diffInWeeks;
  };

  // Calculate daily balances for the month
  const dailyBalances = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    
    const balances: DailyBalance[] = [];
    let runningBalance = beginningBalance;
    
    // Generate daily balances for each day in the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const currentDay = new Date(year, month, day);
      currentDay.setHours(0, 0, 0, 0);
      
      // Get transactions for this day
      const dayTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        transactionDate.setHours(0, 0, 0, 0);
        return transactionDate.getTime() === currentDay.getTime();
      });
      
      // Get estimates for this day (using week number)
      const weekNumber = getWeekNumber(currentDay);
      const dayEstimates = estimates.filter(e => e.weekNumber === weekNumber);
      
      // Get client payments for this day
      const dayClientPayments = clientPayments.filter(cp => {
        const paymentDate = new Date(cp.expectedPaymentDate);
        paymentDate.setHours(0, 0, 0, 0);
        return paymentDate.getTime() === currentDay.getTime();
      });
      
      // Calculate day's cash flow
      const dayInflow = dayTransactions
        .filter(t => t.type === 'inflow')
        .reduce((sum, t) => sum + t.amount, 0) +
        dayEstimates
          .filter(e => e.type === 'inflow')
          .reduce((sum, e) => sum + e.amount, 0) +
        dayClientPayments
          .reduce((sum, cp) => sum + cp.amountDue, 0);
          
      const dayOutflow = dayTransactions
        .filter(t => t.type === 'outflow')
        .reduce((sum, t) => sum + t.amount, 0) +
        dayEstimates
          .filter(e => e.type === 'outflow')
          .reduce((sum, e) => sum + e.amount, 0);
      
      // Update running balance
      runningBalance += dayInflow - dayOutflow;
      
      balances.push({
        date: currentDay,
        balance: runningBalance,
        dayOfMonth: day,
        transactions: dayTransactions,
        estimates: dayEstimates,
        clientPayments: dayClientPayments
      });
    }
    
    return balances;
  }, [transactions, estimates, clientPayments, currentDate, beginningBalance]);

  // Find min and max balances for scaling
  const minBalance = Math.min(...dailyBalances.map(d => d.balance), transferThreshold);
  const maxBalance = Math.max(...dailyBalances.map(d => d.balance), transferThreshold);
  const balanceRange = maxBalance - minBalance;
  const padding = balanceRange * 0.1; // 10% padding
  const chartMin = minBalance - padding;
  const chartMax = maxBalance + padding;
  const chartRange = chartMax - chartMin;

  // Convert balance to chart Y position (0-100%)
  const balanceToY = (balance: number) => {
    return 100 - ((balance - chartMin) / chartRange) * 100;
  };

  // Handle threshold editing
  const handleThresholdEdit = () => {
    setIsEditingThreshold(true);
    setTempThreshold(transferThreshold.toString());
  };

  const handleThresholdSave = () => {
    const newThreshold = parseFloat(tempThreshold);
    if (!isNaN(newThreshold) && newThreshold >= 0) {
      setTransferThreshold(newThreshold);
    }
    setIsEditingThreshold(false);
  };

  const handleThresholdCancel = () => {
    setTempThreshold(transferThreshold.toString());
    setIsEditingThreshold(false);
  };

  // Generate SVG path for the balance line
  const balancePath = dailyBalances.map((balance, index) => {
    const x = (index / (dailyBalances.length - 1)) * 100;
    const y = balanceToY(balance.balance);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Calculate threshold line position
  const thresholdY = balanceToY(transferThreshold);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      {/* Header with threshold controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Daily Balance Overview - {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-600">Transfer Threshold:</span>
          {isEditingThreshold ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={tempThreshold}
                onChange={(e) => setTempThreshold(e.target.value)}
                className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleThresholdSave();
                  if (e.key === 'Escape') handleThresholdCancel();
                }}
                autoFocus
              />
              <button
                onClick={handleThresholdSave}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                ✓
              </button>
              <button
                onClick={handleThresholdCancel}
                className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={handleThresholdEdit}
              className="flex items-center space-x-1 px-3 py-1 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
            >
              <span className="text-sm font-medium text-red-700">
                {formatCurrency(transferThreshold)}
              </span>
              <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative bg-gray-50 rounded-lg p-6">
        {/* Chart area with proper margins for labels */}
        <div className="relative" style={{ marginLeft: '80px', marginBottom: '40px', height: '240px' }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between -ml-20">
            <span className="text-sm font-medium text-gray-700">{formatCurrency(chartMax)}</span>
            <span className="text-sm font-medium text-red-600">{formatCurrency(transferThreshold)}</span>
            <span className="text-sm font-medium text-gray-700">{formatCurrency(chartMin)}</span>
          </div>
          
          {/* Main chart SVG */}
          <div className="w-full h-full bg-white rounded border border-gray-200">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
              
              {/* Y-axis grid lines with labels */}
              {(() => {
                const yAxisSteps = 4;
                const lines: React.ReactElement[] = [];
                for (let i = 0; i <= yAxisSteps; i++) {
                  const y = 100 - (i / yAxisSteps) * 100;
                  lines.push(
                    <line
                      key={`y-grid-${i}`}
                      x1="0"
                      y1={y}
                      x2="100"
                      y2={y}
                      stroke="#f3f4f6"
                      strokeWidth="0.5"
                    />
                  );
                }
                return lines;
              })()}
              
              {/* X-axis grid lines */}
              {(() => {
                const xAxisDays = [1, 5, 10, 15, 20, 25, 30];
                const lines: React.ReactElement[] = [];
                xAxisDays.forEach(day => {
                  if (day <= dailyBalances.length) {
                    const x = ((day - 1) / (dailyBalances.length - 1)) * 100;
                    lines.push(
                      <line
                        key={`x-grid-${day}`}
                        x1={x}
                        y1="0"
                        x2={x}
                        y2="100"
                        stroke="#f3f4f6"
                        strokeWidth="0.5"
                      />
                    );
                  }
                });
                return lines;
              })()}
              
              {/* Transfer threshold line */}
              <line
                x1="0"
                y1={thresholdY}
                x2="100"
                y2={thresholdY}
                stroke="#dc2626"
                strokeWidth="0.8"
                strokeDasharray="3,3"
              />
              
              {/* Balance line */}
              <path
                d={balancePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
              
              {/* Balance points */}
              {dailyBalances.map((balance, index) => {
                const x = (index / (dailyBalances.length - 1)) * 100;
                const y = balanceToY(balance.balance);
                const isBelowThreshold = balance.balance < transferThreshold;
                
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="1.2"
                    fill={isBelowThreshold ? '#dc2626' : '#2563eb'}
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>
                      Day {balance.dayOfMonth}: {formatCurrency(balance.balance)}
                      {isBelowThreshold ? ' (Below Threshold!)' : ''}
                    </title>
                  </circle>
                );
              })}
            </svg>
          </div>
          
          {/* X-axis labels */}
          <div className="absolute -bottom-8 left-0 w-full">
            {(() => {
              const xAxisDays = [1, 5, 10, 15, 20, 25, 30];
              const lastDay = dailyBalances.length;
              return xAxisDays.map(day => {
                if (day <= lastDay) {
                  const position = ((day - 1) / (lastDay - 1)) * 100;
                  return (
                    <span 
                      key={day} 
                      className="absolute text-sm font-medium text-gray-700"
                      style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                    >
                      {day}
                    </span>
                  );
                }
                return null;
              }).filter(Boolean);
            })()}
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-between mt-4 text-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-0.5 bg-blue-600"></div>
            <span className="text-gray-600">Daily Balance</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-0.5 bg-red-600 border-dashed" style={{borderTop: '1px dashed #dc2626', background: 'none'}}></div>
            <span className="text-gray-600">Transfer Threshold</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-600 rounded-full"></div>
            <span className="text-gray-600">Below Threshold</span>
          </div>
        </div>
        
        {/* Summary stats */}
        <div className="flex items-center space-x-4">
          <span className="text-gray-600">
            Lowest: <span className="font-medium">{formatCurrency(Math.min(...dailyBalances.map(d => d.balance)))}</span>
          </span>
          <span className="text-gray-600">
            Highest: <span className="font-medium">{formatCurrency(Math.max(...dailyBalances.map(d => d.balance)))}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default DailyBalanceGraph;
