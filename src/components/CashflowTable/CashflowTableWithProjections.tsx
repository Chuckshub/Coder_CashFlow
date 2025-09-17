import React, { useState } from 'react';
import { formatCurrency, formatWeekRange } from '../../utils/dateUtils';
import { WeeklyCashflowWithProjections, Estimate, ClientPaymentProjection } from '../../types';
import EstimateModal from '../EstimateManager/EstimateModal';
import WeeklyDetailView from './WeeklyDetailView';

interface CashflowTableWithProjectionsProps {
  weeklyCashflows: WeeklyCashflowWithProjections[];
  onRefreshData?: () => void;
  onBankBalanceUpdate?: (weekNumber: number, actualBalance: number) => void;
  showClientProjections?: boolean;
  // Estimate CRUD operations
  onAddEstimate?: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateEstimate?: (id: string, estimate: Partial<Estimate>) => void;
  onDeleteEstimate?: (id: string) => void;
}

const CashflowTableWithProjections: React.FC<CashflowTableWithProjectionsProps> = ({ 
  weeklyCashflows, 
  onRefreshData,
  onBankBalanceUpdate,
  showClientProjections = true,
  onAddEstimate,
  onUpdateEstimate,
  onDeleteEstimate
}) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    weekNumber: number;
    type: 'inflow' | 'outflow' | null;
    editingEstimate?: Estimate;
  }>({ isOpen: false, weekNumber: 1, type: null });
  
  const [showDetailView, setShowDetailView] = useState(false);

  // Helper functions for styling
  const getCurrencyColor = (amount: number) => {
    if (amount > 0) return 'text-green-600';
    if (amount < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const getBalanceColor = (amount: number) => {
    if (amount > 0) return 'text-green-600';
    if (amount < 0) return 'text-red-600';
    return 'text-gray-900';
  };

  const openEstimateModal = (weekNumber: number, type: 'inflow' | 'outflow', estimate?: Estimate) => {
    console.log('💼 Opening modal for week', weekNumber, 'type', type, estimate ? 'editing' : 'creating');
    
    setModalState({
      isOpen: true,
      weekNumber,
      type,
      editingEstimate: estimate,
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      weekNumber: 1,
      type: null,
    });
  };

  const handleEstimateSubmit = (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    console.log('💾 Estimate submitted:', estimate);
    
    if (modalState.editingEstimate) {
      // Update existing estimate
      if (onUpdateEstimate) {
        onUpdateEstimate(modalState.editingEstimate.id, estimate);
      }
    } else {
      // Create new estimate
      if (onAddEstimate) {
        onAddEstimate({
          ...estimate,
          weekNumber: modalState.weekNumber,
          type: modalState.type!
        });
      }
    }
    
    closeModal();
  };

  const handleEstimateDelete = () => {
    if (modalState.editingEstimate && onDeleteEstimate) {
      console.log('🗑️ Deleting estimate:', modalState.editingEstimate.id);
      onDeleteEstimate(modalState.editingEstimate.id);
      closeModal();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          13-Week Cashflow Forecast
          {showClientProjections && (
            <span className="ml-2 text-sm text-blue-600 font-normal">
              (+Client Payment Projections)
            </span>
          )}
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDetailView(true)}
            className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Weekly Details
          </button>
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              🔄 Refresh Data
            </button>
          )}
        </div>
      </div>

      {/* Main table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Week
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Inflows
                  {showClientProjections && (
                    <div className="text-xs normal-case text-gray-400 mt-1">
                      (+Client Payments)
                    </div>
                  )}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Outflows
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Net Cashflow
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Running Balance
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actual Bank Balance
                </th>
              </tr>
            </thead>
            
            <tbody className="bg-white divide-y divide-gray-200">
              {weeklyCashflows.map((weekData) => {
                const hasProjections = showClientProjections && 
                  weekData.clientPaymentProjections && 
                  weekData.clientPaymentProjections.length > 0;
                  
                return (
                  <tr key={weekData.weekNumber} className="hover:bg-gray-50">
                    {/* Week Column */}
                    <td className="px-4 py-3 border-r border-gray-200">
                      <div>
                        <div className={`text-sm font-medium ${
                          weekData.weekNumber === -1 ? 'text-red-600' : 
                          weekData.weekNumber === 0 ? 'text-blue-600' : 
                          'text-gray-900'
                        }`}>
                          Week {weekData.weekNumber}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatWeekRange(weekData.weekStart)}
                        </div>
                      </div>
                    </td>
                    
                    {/* Inflows Column */}
                    <td className="border-r border-gray-200 p-0">
                      <div className="px-4 py-3">
                        {/* Actual Inflows */}
                        <div className={`text-sm font-medium mb-2 ${getCurrencyColor(weekData.actualInflow)}`}>
                          {formatCurrency(weekData.actualInflow)}
                        </div>
                        
                        {/* Individual Inflow Estimates */}
                        <div className="space-y-1 mt-1">
                          {weekData.estimates
                            .filter(est => est.type === 'inflow')
                            .map(estimate => (
                              <div
                                key={estimate.id}
                                className="cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 border border-transparent hover:border-blue-200 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEstimateModal(weekData.weekNumber, 'inflow', estimate);
                                }}
                                title={`Click to edit: ${estimate.description}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-blue-600 font-medium truncate flex-1 mr-1">
                                    {estimate.description}
                                  </span>
                                  <span className="text-xs text-blue-600 font-medium whitespace-nowrap">
                                    {formatCurrency(estimate.amount)}
                                  </span>
                                </div>
                              </div>
                            ))
                          }
                          
                          {/* Add New Estimate Button */}
                          {weekData.estimates.filter(est => est.type === 'inflow').length < 3 && (
                            <div
                              className="cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
                              onClick={() => openEstimateModal(weekData.weekNumber, 'inflow')}
                              title="Click to add new inflow estimate"
                            >
                              <div className="text-xs text-gray-400 text-center">
                                + Add Estimate
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Client Payment Projections */}
                        {hasProjections && (
                          <div className="relative mt-3 pt-2 border-t border-gray-100">
                            <div 
                              className="hover:bg-green-50 rounded px-2 py-1 -mx-2 transition-colors"
                              title={`Client Payments: ${weekData.clientPaymentProjections?.map(p => `${p.clientName}: ${formatCurrency(p.expectedAmount)}`).join(', ') || 'None'}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1">
                                  <span className="text-xs text-blue-600">📋</span>
                                  <span className="text-xs font-medium text-blue-600">Client Payments</span>
                                </div>
                                <span className="text-xs font-medium text-green-600">
                                  {formatCurrency(weekData.projectedClientPayments || 0)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {weekData.clientPaymentProjections?.length || 0} client{(weekData.clientPaymentProjections?.length || 0) !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Outflows Column */}
                    <td className="border-r border-gray-200 p-0">
                      <div className="px-4 py-3">
                        {/* Actual Outflows */}
                        <div className={`text-sm font-medium mb-2 ${getCurrencyColor(-weekData.actualOutflow)}`}>
                          {formatCurrency(weekData.actualOutflow)}
                        </div>
                        
                        {/* Individual Outflow Estimates */}
                        <div className="space-y-1 mt-1">
                          {weekData.estimates
                            .filter(est => est.type === 'outflow')
                            .map(estimate => (
                              <div
                                key={estimate.id}
                                className="cursor-pointer hover:bg-red-50 rounded px-1 py-0.5 border border-transparent hover:border-red-200 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEstimateModal(weekData.weekNumber, 'outflow', estimate);
                                }}
                                title={`Click to edit: ${estimate.description}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-red-600 font-medium truncate flex-1 mr-1">
                                    {estimate.description}
                                  </span>
                                  <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                                    {formatCurrency(estimate.amount)}
                                  </span>
                                </div>
                              </div>
                            ))
                          }
                          
                          {/* Add New Estimate Button */}
                          {weekData.estimates.filter(est => est.type === 'outflow').length < 3 && (
                            <div
                              className="cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
                              onClick={() => openEstimateModal(weekData.weekNumber, 'outflow')}
                              title="Click to add new outflow estimate"
                            >
                              <div className="text-xs text-gray-400 text-center">
                                + Add Estimate
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Net Cashflow Column */}
                    <td className="px-4 py-3 text-center border-r border-gray-200">
                      <div className={`text-sm font-medium ${getCurrencyColor(weekData.netCashflow)}`}>
                        {formatCurrency(weekData.netCashflow)}
                      </div>
                      {(weekData.estimatedInflow > 0 || weekData.estimatedOutflow > 0) && (
                        <div className="text-xs text-gray-500 mt-1">
                          Est: {formatCurrency(weekData.estimatedInflow - weekData.estimatedOutflow)}
                        </div>
                      )}
                    </td>
                    
                    {/* Running Balance Column */}
                    <td className="px-4 py-3 text-center">
                      <div className={`text-sm font-medium ${getBalanceColor(weekData.runningBalance)}`}>
                        {formatCurrency(weekData.runningBalance)}
                      </div>
                    </td>
                    
                    {/* Bank Balance Input Column */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center space-y-2">
                        <input
                          type="text"
                          placeholder="$0"
                          value={weekData.actualBankBalance ? formatCurrency(weekData.actualBankBalance) : ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value.replace(/[$,]/g, ''));
                            if (!isNaN(value) && onBankBalanceUpdate) {
                              onBankBalanceUpdate(weekData.weekNumber, value);
                            }
                          }}
                          className="w-24 text-center text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {weekData.actualBankBalance && (
                          <div className={`text-xs ${getBalanceColor(weekData.actualBankBalance)}`}>
                            {formatCurrency(weekData.actualBankBalance)}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary section for client projections */}
      {showClientProjections && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            📊 Client Payment Projections Summary
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Projected Payments</div>
              <div className="font-semibold text-blue-800">
                {formatCurrency(
                  weeklyCashflows.reduce((sum, week) => sum + (week.projectedClientPayments || 0), 0)
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Active Invoices</div>
              <div className="font-semibold text-blue-800">
                {weeklyCashflows.reduce((sum, week) => {
                  return sum + (week.clientPaymentProjections?.reduce((clientSum, projection) => {
                    return clientSum + projection.invoiceCount;
                  }, 0) || 0);
                }, 0)}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Unique Clients</div>
              <div className="font-semibold text-blue-800">
                {new Set(
                  weeklyCashflows.flatMap(week => 
                    week.clientPaymentProjections?.map(p => p.clientName) || []
                  )
                ).size}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estimate Modal */}
      {modalState.isOpen && (
        <EstimateModal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          onSave={handleEstimateSubmit}
          onDelete={modalState.editingEstimate ? handleEstimateDelete : undefined}
          weekNumber={modalState.weekNumber}
          type={modalState.type!}
          estimate={modalState.editingEstimate}
        />
      )}

      {/* Weekly Detail View Modal */}
      {showDetailView && (
        <WeeklyDetailView
          weeklyCashflows={weeklyCashflows}
          transactions={[]}
          onClose={() => setShowDetailView(false)}
          onRefreshData={onRefreshData}
        />
      )}
    </div>
  );
};

export default CashflowTableWithProjections;