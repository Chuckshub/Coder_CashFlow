import React, { useState } from 'react';
import { WeeklyCashflow, Transaction, Estimate } from '../../types';
import { formatCurrency, formatWeekRange, getCurrencyColor, isDateInWeek } from '../../utils/dateUtils';

interface WeeklyDetailViewProps {
  weeklyCashflows: WeeklyCashflow[];
  transactions: Transaction[];
  onClose: () => void;
  onRefreshData?: () => void; // Optional refresh callback
}

interface CategoryData {
  category: string;
  actual: number;
  estimated: number;
  total: number;
  transactions: Transaction[];
  estimates: Estimate[];
}

const WeeklyDetailView: React.FC<WeeklyDetailViewProps> = ({
  weeklyCashflows,
  transactions,
  onClose,
  onRefreshData
}) => {
  // Use the first available week instead of hardcoding Week 0
  const firstAvailableWeek = weeklyCashflows.length > 0 ? weeklyCashflows[0].weekNumber : 0;
  const [selectedWeek, setSelectedWeek] = useState(firstAvailableWeek);
  const [activeTab, setActiveTab] = useState<'inflow' | 'outflow'>('inflow');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshSuccess, setShowRefreshSuccess] = useState(false);

  // Update selected week if the first available week changes
  React.useEffect(() => {
    if (weeklyCashflows.length > 0 && !weeklyCashflows.find(w => w.weekNumber === selectedWeek)) {
      const newFirstWeek = weeklyCashflows[0].weekNumber;
      console.log('📊 WeeklyDetailView - Updating selected week from', selectedWeek, 'to', newFirstWeek);
      setSelectedWeek(newFirstWeek);
    }
  }, [weeklyCashflows, selectedWeek]);

  // Handle refresh with loading state
  const handleRefresh = async () => {
    if (!onRefreshData || isRefreshing) return;
    
    setIsRefreshing(true);
    setShowRefreshSuccess(false);
    try {
      await onRefreshData();
      console.log('✅ WeeklyDetailView - Data refresh completed');
      setShowRefreshSuccess(true);
      // Hide success message after 2 seconds
      setTimeout(() => setShowRefreshSuccess(false), 2000);
    } catch (error) {
      console.error('💥 WeeklyDetailView - Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // DEBUG: Log data to understand what's being passed
  console.log('📊 WeeklyDetailView - Debug Info:');
  console.log('  - weeklyCashflows:', weeklyCashflows.length);
  console.log('  - transactions:', transactions.length);
  console.log('  - selectedWeek:', selectedWeek);
  
  const selectedWeekData = weeklyCashflows.find(w => w.weekNumber === selectedWeek);
  console.log('  - selectedWeekData:', selectedWeekData ? 'found' : 'NOT FOUND');
  
  if (!selectedWeekData) {
    console.error('❌ WeeklyDetailView - selectedWeekData not found for week:', selectedWeek);
    const availableWeeks = weeklyCashflows.map(w => w.weekNumber).join(', ') || 'none';
    console.log('📊 Available weeks:', availableWeeks);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-screen overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Weekly Detail View</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-6 py-8">
            <div className="text-center">
              <div className="text-orange-500 text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Week Data Mismatch</h3>
              <p className="text-gray-600 mb-4">
                Looking for week {selectedWeek}, but only found weeks: {availableWeeks}
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="text-sm text-blue-800">
                  <strong>This usually means:</strong>
                  <ul className="mt-2 text-left space-y-1">
                    <li>• Your cashflow starts from Week 1, not Week 0</li>
                    <li>• Week numbering changed after data refresh</li>
                    <li>• Date range calculation issue</li>
                  </ul>
                </div>
              </div>
              {weeklyCashflows.length > 0 && (
                <button
                  onClick={() => setSelectedWeek(weeklyCashflows[0].weekNumber)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mr-2"
                >
                  Go to Week {weeklyCashflows[0].weekNumber}
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get transactions for this week using proper date comparison
  const weekTransactions = transactions.filter(transaction => 
    isDateInWeek(transaction.date, selectedWeekData.weekStart)
  );

  console.log('  - weekTransactions for week', selectedWeek, ':', weekTransactions.length);

  // Get estimates for this week
  const weekEstimates = selectedWeekData.estimates;

  // Group transactions and estimates by category
  const getWeeklyCategories = (type: 'inflow' | 'outflow'): CategoryData[] => {
    const categoryMap = new Map<string, CategoryData>();

    // Add actual transactions
    weekTransactions
      .filter(t => t.type === type)
      .forEach(transaction => {
        const category = transaction.category || 'Other';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            actual: 0,
            estimated: 0,
            total: 0,
            transactions: [],
            estimates: []
          });
        }
        const data = categoryMap.get(category)!;
        data.actual += transaction.amount;
        data.transactions.push(transaction);
      });

    // Add estimates
    weekEstimates
      .filter(e => e.type === type)
      .forEach(estimate => {
        const category = estimate.category || 'Other';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            actual: 0,
            estimated: 0,
            total: 0,
            transactions: [],
            estimates: []
          });
        }
        const data = categoryMap.get(category)!;
        data.estimated += estimate.amount;
        data.estimates.push(estimate);
      });

    // Calculate totals and sort
    const categories = Array.from(categoryMap.values()).map(data => ({
      ...data,
      total: data.actual + data.estimated
    })).sort((a, b) => b.total - a.total);

    return categories;
  };

  const inflowCategories = getWeeklyCategories('inflow');
  const outflowCategories = getWeeklyCategories('outflow');
  const activeCategories = activeTab === 'inflow' ? inflowCategories : outflowCategories;

  console.log('  - inflowCategories:', inflowCategories.length);
  console.log('  - outflowCategories:', outflowCategories.length);
  console.log('  - activeCategories:', activeCategories.length);
  console.log('  - weekEstimates:', weekEstimates.length);

  // Check if we have any data at all
  const hasAnyTransactions = transactions.length > 0;
  const hasAnyEstimates = weekEstimates.length > 0;
  const hasWeekTransactions = weekTransactions.length > 0;
  
  console.log('📊 WeeklyDetailView - Data Summary:');
  console.log('  - hasAnyTransactions:', hasAnyTransactions);
  console.log('  - hasAnyEstimates:', hasAnyEstimates);
  console.log('  - hasWeekTransactions:', hasWeekTransactions);

  const CategoryCard: React.FC<{ data: CategoryData; type: 'inflow' | 'outflow' }> = ({ data, type }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-gray-900">{data.category}</h4>
        <div className={`text-lg font-bold ${type === 'inflow' ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(data.total)}
        </div>
      </div>
      
      <div className="space-y-2">
        {data.actual > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Actual:</span>
            <span className={`font-medium ${type === 'inflow' ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.actual)} ({data.transactions.length} transactions)
            </span>
          </div>
        )}
        
        {data.estimated > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Estimated:</span>
            <span className={`font-medium ${type === 'inflow' ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(data.estimated)} ({data.estimates.length} estimates)
            </span>
          </div>
        )}
      </div>
      
      {/* Transaction details */}
      {data.transactions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-2">Recent Transactions:</div>
          {data.transactions.slice(0, 3).map(transaction => (
            <div key={transaction.id} className="text-xs text-gray-600 mb-1">
              <div className="font-medium">{formatCurrency(transaction.amount)}</div>
              <div className="truncate" title={transaction.description}>
                {transaction.description.substring(0, 50)}...
              </div>
            </div>
          ))}
          {data.transactions.length > 3 && (
            <div className="text-xs text-gray-400">+{data.transactions.length - 3} more</div>
          )}
        </div>
      )}
      
      {/* Estimate details */}
      {data.estimates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-2">Estimates:</div>
          {data.estimates.map(estimate => (
            <div key={estimate.id} className="text-xs text-gray-600 mb-1">
              <div className="font-medium">{formatCurrency(estimate.amount)}</div>
              <div className="truncate">{estimate.description}</div>
              {estimate.notes && (
                <div className="text-gray-400 truncate" title={estimate.notes}>
                  {estimate.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Weekly Cashflow Details</h2>
              <p className="text-gray-600 mt-1">Detailed breakdown by category</p>
            </div>
            <div className="flex items-center space-x-2">
              {onRefreshData && (
                <>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`p-2 rounded-full transition-colors ${
                      isRefreshing 
                        ? 'text-blue-400 bg-blue-50 cursor-not-allowed' 
                        : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                    }`}
                    title={isRefreshing ? 'Refreshing data...' : 'Refresh data from Firebase'}
                  >
                    <svg 
                      className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  
                  {/* Success notification */}
                  {showRefreshSuccess && (
                    <div className="text-green-600 text-sm font-medium animate-fade-in">
                      ✅ Refreshed!
                    </div>
                  )}
                </>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Week Selector */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            {weeklyCashflows.map(week => (
              <button
                key={week.weekNumber}
                onClick={() => setSelectedWeek(week.weekNumber)}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                  selectedWeek === week.weekNumber
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">Week {week.weekNumber}</div>
                <div className="text-xs">
                  {formatWeekRange(week.weekStart)}
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Week Summary */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600">Total Inflows</div>
              <div className="text-xl font-bold text-green-600">
                {formatCurrency(selectedWeekData.actualInflow + selectedWeekData.estimatedInflow)}
              </div>
              <div className="text-xs text-gray-500">
                {selectedWeekData.actualInflow > 0 && `${formatCurrency(selectedWeekData.actualInflow)} actual`}
                {selectedWeekData.actualInflow > 0 && selectedWeekData.estimatedInflow > 0 && ' + '}
                {selectedWeekData.estimatedInflow > 0 && `${formatCurrency(selectedWeekData.estimatedInflow)} est.`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Total Outflows</div>
              <div className="text-xl font-bold text-red-600">
                {formatCurrency(selectedWeekData.actualOutflow + selectedWeekData.estimatedOutflow)}
              </div>
              <div className="text-xs text-gray-500">
                {selectedWeekData.actualOutflow > 0 && `${formatCurrency(selectedWeekData.actualOutflow)} actual`}
                {selectedWeekData.actualOutflow > 0 && selectedWeekData.estimatedOutflow > 0 && ' + '}
                {selectedWeekData.estimatedOutflow > 0 && `${formatCurrency(selectedWeekData.estimatedOutflow)} est.`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Net Cashflow</div>
              <div className={`text-xl font-bold ${getCurrencyColor(selectedWeekData.netCashflow)}`}>
                {formatCurrency(selectedWeekData.netCashflow)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Running Balance</div>
              <div className={`text-xl font-bold ${getCurrencyColor(selectedWeekData.runningBalance)}`}>
                {formatCurrency(selectedWeekData.runningBalance)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('inflow')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'inflow'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            💰 Inflows ({inflowCategories.length} categories)
          </button>
          <button
            onClick={() => setActiveTab('outflow')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'outflow'
                ? 'border-b-2 border-red-500 text-red-600 bg-red-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            💸 Outflows ({outflowCategories.length} categories)
          </button>
        </div>
        
        {/* Category Details */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeCategories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCategories.map(category => (
                <CategoryCard
                  key={category.category}
                  data={category}
                  type={activeTab}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              {!hasAnyTransactions && !hasAnyEstimates ? (
                // No data at all - likely a data loading issue
                <div className="max-w-md mx-auto">
                  <div className="text-yellow-500 text-4xl mb-4">⚠️</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Loaded</h3>
                  <p className="text-gray-600 mb-4">
                    It looks like no transaction data or estimates have been loaded. This could be due to:
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <ul className="text-left text-sm text-yellow-800 space-y-1">
                      <li>• Data still loading from Firebase</li>
                      <li>• Firebase connection issues</li>
                      <li>• No data uploaded yet</li>
                      <li>• Authentication problems</li>
                    </ul>
                  </div>
                  <div className="text-xs text-gray-500">
                    Debug: {transactions.length} transactions, {weekEstimates.length} estimates for this week
                  </div>
                </div>
              ) : !hasWeekTransactions && !hasAnyEstimates ? (
                // Has data overall, but none for this specific week
                <div>
                  <div className="text-gray-400 mb-2">
                    {activeTab === 'inflow' ? '💰' : '💸'}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    No {activeTab}s for Week {selectedWeek}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    No transactions or estimates found for this week
                  </p>
                  <div className="text-xs text-gray-500">
                    Total data available: {transactions.length} transactions, {weekEstimates.length} estimates
                  </div>
                </div>
              ) : (
                // Default empty state
                <div>
                  <div className="text-gray-400 mb-2">
                    {activeTab === 'inflow' ? '💰' : '💸'}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    No {activeTab}s for this week
                  </h3>
                  <p className="text-gray-500">
                    No transactions or estimates found for Week {selectedWeek}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              Showing detailed breakdown for Week {selectedWeek} • {formatWeekRange(selectedWeekData.weekStart)}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyDetailView;