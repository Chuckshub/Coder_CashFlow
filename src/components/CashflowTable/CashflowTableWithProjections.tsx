import React, { useState } from 'react';
import { 
  WeeklyCashflowWithProjections, 
  Estimate, 
  Transaction, 
  ClientPaymentProjection 
} from '../../types';
import { 
  formatCurrency, 
  formatWeekRange, 
  getCurrencyColor, 
  getBalanceColor 
} from '../../utils/dateUtils';
import EstimateModal from '../EstimateManager/EstimateModal';
import WeeklyDetailView from './WeeklyDetailView';
import EstimatesListModal from './EstimatesListModal';
import { NumericFormat } from 'react-number-format';

interface CashflowTableWithProjectionsProps {
  weeklyCashflows: WeeklyCashflowWithProjections[];
  transactions: Transaction[];
  onAddEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateEstimate: (id: string, estimate: Partial<Estimate>) => void;
  onDeleteEstimate: (id: string) => void;
  onEstimateClick?: (estimateId: string) => void;
  onRefreshData?: () => void;
  onBankBalanceUpdate?: (weekNumber: number, actualBalance: number | null) => void;
  showClientProjections?: boolean;
}

interface ModalState {
  isOpen: boolean;
  weekNumber: number;
  type: 'inflow' | 'outflow' | null;
  editingEstimate?: Estimate;
}

/**
 * Get days until due badge background color
 */
const getDaysBadgeColor = (days: number) => {
  if (days < 0) {
    return 'bg-red-100 text-red-800'; // Overdue
  } else if (days <= 3) {
    return 'bg-orange-100 text-orange-800'; // Due very soon
  } else if (days <= 7) {
    return 'bg-yellow-100 text-yellow-800'; // Due soon
  } else {
    return 'bg-green-100 text-green-800'; // Due later
  }
};

/**
 * Format days display
 */
const formatDaysDisplay = (days: number) => {
  if (days === 0) return 'Today';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `${days}d`;
};

/**
 * Component for displaying client payment projection details
 */
const ClientProjectionTooltip: React.FC<{ 
  projections: ClientPaymentProjection[] 
}> = ({ projections }) => {
  if (projections.length === 0) return null;
  
  return (
    <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 mt-2 min-w-80 max-w-96">
      <div className="text-sm font-medium text-gray-700 mb-3">
        Expected Client Payments:
      </div>
      <div className="space-y-3">
        {projections.map((projection, index) => (
          <div key={index} className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">
                {projection.clientName}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {projection.invoiceCount} invoice{projection.invoiceCount !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Due: {projection.originalDueDate.toLocaleDateString()}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-sm font-medium mb-1 ${getCurrencyColor(projection.expectedAmount)}`}>
                {formatCurrency(projection.expectedAmount)}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${getDaysBadgeColor(projection.daysUntilDue)}`}>
                {formatDaysDisplay(projection.daysUntilDue)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CashflowTableWithProjections: React.FC<CashflowTableWithProjectionsProps> = ({ 
  weeklyCashflows, 
  transactions, 
  onAddEstimate, 
  onUpdateEstimate, 
  onDeleteEstimate,
  onEstimateClick,
  onRefreshData,
  onBankBalanceUpdate,
  showClientProjections = true
}) => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    weekNumber: 1,
    type: null
  });
  const [hoveredProjection, setHoveredProjection] = useState<{
    weekNumber: number;
    projections: ClientPaymentProjection[];
  } | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);
  
  // State for estimates list modal
  const [estimatesListModal, setEstimatesListModal] = useState<{
    isOpen: boolean;
    weekNumber: number;
    type: 'inflow' | 'outflow' | null;
    estimates: Estimate[];
  }>({ isOpen: false, weekNumber: 1, type: null, estimates: [] });

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
      editingEstimate: undefined
    });
  };

  const handleEstimateSubmit = (estimateData: any) => {
    if (modalState.editingEstimate) {
      onUpdateEstimate(modalState.editingEstimate.id, estimateData);
    } else {
      onAddEstimate({
        ...estimateData,
        weekNumber: modalState.weekNumber,
        type: modalState.type!
      });
    }
    closeModal();
  };

  const handleEstimateDelete = () => {
    if (modalState.editingEstimate) {
      console.log('🗑️ Deleting estimate:', modalState.editingEstimate.id);
      onDeleteEstimate(modalState.editingEstimate.id);
      closeModal();
    }
  };

  // Functions for estimates list modal
  const openEstimatesListModal = (weekNumber: number, type: 'inflow' | 'outflow', estimates: Estimate[]) => {
    const filteredEstimates = estimates.filter(est => est.type === type);
    setEstimatesListModal({
      isOpen: true,
      weekNumber,
      type,
      estimates: filteredEstimates
    });
  };

  const closeEstimatesListModal = () => {
    setEstimatesListModal({ isOpen: false, weekNumber: 1, type: null, estimates: [] });
  };

  const handleEstimateEditFromList = (estimate: Estimate) => {
    closeEstimatesListModal();
    openEstimateModal(estimate.weekNumber, estimate.type, estimate);
  };

  const handleEstimateDeleteFromList = (estimateId: string) => {
    onDeleteEstimate(estimateId);
    // Update the modal's estimate list by removing the deleted estimate
    setEstimatesListModal(prev => ({
      ...prev,
      estimates: prev.estimates.filter(est => est.id !== estimateId)
    }));
  };

  const handleAddNewEstimateFromList = () => {
    if (estimatesListModal.type) {
      closeEstimatesListModal();
      openEstimateModal(estimatesListModal.weekNumber, estimatesListModal.type);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          13-Week Cashflow Projection
          {showClientProjections && (
            <span className="ml-2 text-sm text-gray-500">
              (with client payment projections)
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
                    
                    {/* Inflows */}
                    <td className="px-6 py-4 text-right">
                      <div className="space-y-1">
                        <div className={`text-sm font-medium ${getCurrencyColor(weekData.actualInflow)}`}>
                          {formatCurrency(weekData.actualInflow)}
                        </div>
                        {weekData.estimatedInflow > 0 ? (
                          <button
                            onClick={() => openEstimatesListModal(
                              weekData.weekNumber, 
                              'inflow', 
                              weekData.estimates
                            )}
                            className="text-xs text-green-600 hover:text-green-800 hover:underline mt-1 cursor-pointer"
                            title={`Click to manage ${weekData.estimates.filter(est => est.type === 'inflow').length} inflow estimate(s)`}
                          >
                            Est: {formatCurrency(weekData.estimatedInflow)}
                          </button>
                        ) : (
                          <button
                            onClick={() => openEstimateModal(weekData.weekNumber, 'inflow')}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded mt-1 cursor-pointer transition-colors"
                            title="Click to add an inflow estimate for this week"
                          >
                            + Add Estimate
                          </button>
                        )}
                      </div>
                      
                      {/* Client Payment Projections */}
                      {hasProjections && (
                        <div className="relative mt-2">
                          <div 
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredProjection({
                              weekNumber: weekData.weekNumber,
                              projections: weekData.clientPaymentProjections!
                            })}
                            onMouseLeave={() => setHoveredProjection(null)}
                          >
                            <div className="flex items-center justify-between bg-blue-50 rounded px-2 py-1">
                              <div className="text-xs text-blue-600 font-medium">
                                🏢 Client Payments
                              </div>
                              <div className="text-sm font-medium text-blue-700">
                                {formatCurrency(weekData.projectedClientPayments || 0)}
                              </div>
                            </div>
                          </div>
                          
                          {/* Tooltip */}
                          {hoveredProjection?.weekNumber === weekData.weekNumber && (
                            <ClientProjectionTooltip projections={hoveredProjection.projections} />
                          )}
                        </div>
                      )}
                    </td>
                    
                    {/* Outflows */}
                    <td className="px-6 py-4 text-right">
                      <div className="space-y-1">
                        <div className={`text-sm font-medium ${getCurrencyColor(-weekData.actualOutflow)}`}>
                          {formatCurrency(weekData.actualOutflow)}
                        </div>
                        {weekData.estimatedOutflow > 0 ? (
                          <button
                            onClick={() => openEstimatesListModal(
                              weekData.weekNumber, 
                              'outflow', 
                              weekData.estimates
                            )}
                            className="text-xs text-red-600 hover:text-red-800 hover:underline mt-1 cursor-pointer"
                            title={`Click to manage ${weekData.estimates.filter(est => est.type === 'outflow').length} outflow estimate(s)`}
                          >
                            Est: {formatCurrency(weekData.estimatedOutflow)}
                          </button>
                        ) : (
                          <button
                            onClick={() => openEstimateModal(weekData.weekNumber, 'outflow')}
                            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded mt-1 cursor-pointer transition-colors"
                            title="Click to add an outflow estimate for this week"
                          >
                            + Add Estimate
                          </button>
                        )}
                      </div>
                    </td>
                    
                    {/* Net Cashflow Column */}
                    <td className="px-4 py-3 text-center border-r border-gray-200">
                      {/* Actuals Only */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                          Net (Actuals)
                        </div>
                        <div className={`text-sm font-medium ${getCurrencyColor(weekData.netCashflowActuals)}`}>
                          {formatCurrency(weekData.netCashflowActuals)}
                        </div>
                      </div>
                      
                      {/* With Estimates */}
                      <div className="space-y-1 mt-3 pt-2 border-t border-gray-100">
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                          Net (w/ Estimates)
                        </div>
                        <div className={`text-sm font-medium ${getCurrencyColor(weekData.netCashflowWithEstimates)}`}>
                          {formatCurrency(weekData.netCashflowWithEstimates)}
                        </div>
                      </div>
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
                        <NumericFormat
                          thousandSeparator=","
                          prefix="$"
                          placeholder="$0"
                          value={weekData.actualBankBalance || ''}
                          onValueChange={(values) => {
                            const value = values.value === '' ? null : parseFloat(values.value || '0');
                            if (onBankBalanceUpdate) {
                              onBankBalanceUpdate(weekData.weekNumber, value);
                            }
                          }}
                          className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          allowNegative={true}
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

      {/* Estimates List Modal */}
      {estimatesListModal.isOpen && (
        <EstimatesListModal
          isOpen={estimatesListModal.isOpen}
          onClose={closeEstimatesListModal}
          estimates={estimatesListModal.estimates}
          weekNumber={estimatesListModal.weekNumber}
          type={estimatesListModal.type!}
          onEditEstimate={handleEstimateEditFromList}
          onDeleteEstimate={handleEstimateDeleteFromList}
          onAddNewEstimate={handleAddNewEstimateFromList}
        />
      )}

      {/* Weekly Detail View Modal */}
      {showDetailView && (
        <WeeklyDetailView
          weeklyCashflows={weeklyCashflows}
          transactions={transactions}
          onClose={() => setShowDetailView(false)}
          onRefreshData={onRefreshData}
        />
      )}
    </div>
  );
};

export default CashflowTableWithProjections;