import React, { useState } from 'react';
import { WeeklyCashflowWithAR, Estimate, Transaction, AREstimate } from '../../types';
import { formatCurrency, formatWeekRange, getCurrencyColor, getBalanceColor } from '../../utils/dateUtils';
import EstimateModal from '../EstimateManager/EstimateModal';

interface CashflowTableWithARProps {
  weeklyCashflows: WeeklyCashflowWithAR[];
  estimates: Estimate[];
  onEstimateCreate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onEstimateUpdate: (estimate: Estimate) => void;
  onEstimateDelete: (estimateId: string) => void;
  showARDetails?: boolean;
}

interface ModalState {
  isOpen: boolean;
  weekNumber: number;
  type: 'inflow' | 'outflow' | null;
  editingEstimate?: Estimate;
}

const CashflowTableWithAR: React.FC<CashflowTableWithARProps> = ({ 
  weeklyCashflows, 
  estimates,
  onEstimateCreate, 
  onEstimateUpdate, 
  onEstimateDelete,
  showARDetails = false,
}) => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    weekNumber: 0,
    type: null,
  });
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const handleAddEstimate = (weekNumber: number, type: 'inflow' | 'outflow') => {
    setModalState({
      isOpen: true,
      weekNumber,
      type,
    });
  };

  const handleEditEstimate = (estimate: Estimate) => {
    setModalState({
      isOpen: true,
      weekNumber: estimate.weekNumber,
      type: estimate.type,
      editingEstimate: estimate,
    });
  };

  const handleEstimateSubmit = (estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (modalState.editingEstimate) {
      onEstimateUpdate({
        ...modalState.editingEstimate,
        ...estimateData,
        updatedAt: new Date(),
      });
    } else {
      onEstimateCreate(estimateData);
    }
    setModalState({ isOpen: false, weekNumber: 0, type: null });
  };

  const getWeekStatusColor = (status: string) => {
    switch (status) {
      case 'past': return 'bg-gray-50';
      case 'current': return 'bg-blue-50';
      case 'future': return 'bg-white';
      default: return 'bg-white';
    }
  };

  const getARConfidenceIcon = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return '🟢';
      case 'medium': return '🟡';
      case 'low': return '🔴';
      default: return '⚪';
    }
  };

  const renderAREstimateTooltip = (arEstimate: AREstimate) => {
    return (
      <div className="absolute z-10 p-2 bg-gray-800 text-white text-xs rounded shadow-lg min-w-48 -top-2 left-full ml-2">
        <div className="font-semibold">{arEstimate.invoiceNumber}</div>
        <div>{arEstimate.clientName}</div>
        <div>Due: {arEstimate.dueDate.toLocaleDateString()}</div>
        <div>Est: {arEstimate.estimatedCollectionDate.toLocaleDateString()}</div>
        <div className="capitalize">{arEstimate.confidence} confidence</div>
        {arEstimate.daysOverdue > 0 && (
          <div className="text-red-300">{arEstimate.daysOverdue} days overdue</div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Weekly Cashflow Projections</h3>
            <p className="mt-1 text-sm text-gray-500">
              13-week rolling forecast with actual transactions, estimates, and AR projections
            </p>
          </div>
          <div className="text-sm text-gray-500">
            Click on amounts to add or edit estimates
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Week
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actual Inflow
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Est. Inflow
              </th>
              {showARDetails && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  AR Inflow
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Inflow
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actual Outflow
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Est. Outflow
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Outflow
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Net Cashflow
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Running Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {weeklyCashflows.map((week, index) => {
              const weekLabel = 
                week.weekNumber === -1 ? 'Last Week' :
                week.weekNumber === 0 ? 'This Week' :
                week.weekNumber > 0 ? `Week +${week.weekNumber}` : 
                `Week ${week.weekNumber}`;
              
              return (
                <tr
                  key={week.weekNumber}
                  className={`${getWeekStatusColor(week.weekStatus)} hover:bg-gray-50 transition-colors`}
                  onClick={() => setSelectedWeek(selectedWeek === week.weekNumber ? null : week.weekNumber)}
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {weekLabel}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatWeekRange(week.weekStart)}
                      </div>
                    </div>
                  </td>
                  
                  {/* Actual Inflow */}
                  <td className="px-4 py-4 text-right">
                    <div className={`text-sm font-medium ${getCurrencyColor(week.actualInflow)}`}>
                      {formatCurrency(week.actualInflow)}
                    </div>
                  </td>
                  
                  {/* Estimated Inflow */}
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddEstimate(week.weekNumber, 'inflow');
                      }}
                      className={`text-sm font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors ${getCurrencyColor(week.estimatedInflow)}`}
                    >
                      {formatCurrency(week.estimatedInflow)}
                    </button>
                  </td>
                  
                  {/* AR Inflow */}
                  {showARDetails && (
                    <td className="px-4 py-4 text-right">
                      <div className="relative group">
                        <div className={`text-sm font-medium ${getCurrencyColor(week.estimatedARInflow)} flex items-center justify-end space-x-1`}>
                          <span>{formatCurrency(week.estimatedARInflow)}</span>
                          {week.arEstimates.length > 0 && (
                            <div className="flex">
                              {week.arEstimates.slice(0, 3).map((ar, idx) => (
                                <span key={ar.id} className="text-xs">
                                  {getARConfidenceIcon(ar.confidence)}
                                </span>
                              ))}
                              {week.arEstimates.length > 3 && (
                                <span className="text-xs text-gray-500">+{week.arEstimates.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Tooltip for AR details */}
                        {week.arEstimates.length > 0 && (
                          <div className="absolute hidden group-hover:block z-10 p-3 bg-gray-800 text-white text-xs rounded shadow-lg min-w-64 -top-2 right-0 mr-8">
                            <div className="font-semibold mb-2">AR Estimates ({week.arEstimates.length})</div>
                            {week.arEstimates.slice(0, 5).map(ar => (
                              <div key={ar.id} className="mb-1 flex justify-between">
                                <span>{ar.invoiceNumber}</span>
                                <span>{formatCurrency(ar.amount)} {getARConfidenceIcon(ar.confidence)}</span>
                              </div>
                            ))}
                            {week.arEstimates.length > 5 && (
                              <div className="text-gray-300">...and {week.arEstimates.length - 5} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                  
                  {/* Total Inflow */}
                  <td className="px-4 py-4 text-right">
                    <div className={`text-sm font-semibold ${getCurrencyColor(week.totalInflow)}`}>
                      {formatCurrency(week.totalInflow)}
                    </div>
                  </td>
                  
                  {/* Actual Outflow */}
                  <td className="px-4 py-4 text-right">
                    <div className={`text-sm font-medium ${getCurrencyColor(-week.actualOutflow)}`}>
                      {formatCurrency(week.actualOutflow)}
                    </div>
                  </td>
                  
                  {/* Estimated Outflow */}
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddEstimate(week.weekNumber, 'outflow');
                      }}
                      className={`text-sm font-medium hover:bg-red-50 px-2 py-1 rounded transition-colors ${getCurrencyColor(-week.estimatedOutflow)}`}
                    >
                      {formatCurrency(week.estimatedOutflow)}
                    </button>
                  </td>
                  
                  {/* Total Outflow */}
                  <td className="px-4 py-4 text-right">
                    <div className={`text-sm font-semibold ${getCurrencyColor(-week.totalOutflow)}`}>
                      {formatCurrency(week.totalOutflow)}
                    </div>
                  </td>
                  
                  {/* Net Cashflow */}
                  <td className="px-4 py-4 text-right">
                    <div className={`text-sm font-bold ${getCurrencyColor(week.netCashflow)}`}>
                      {formatCurrency(week.netCashflow)}
                    </div>
                  </td>
                  
                  {/* Running Balance */}
                  <td className="px-6 py-4 text-right">
                    <div className={`text-sm font-bold ${getBalanceColor(week.runningBalance)}`}>
                      {formatCurrency(week.runningBalance)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded Week Details */}
      {selectedWeek !== null && weeklyCashflows.find(w => w.weekNumber === selectedWeek) && (() => {
        const week = weeklyCashflows.find(w => w.weekNumber === selectedWeek)!;
        return (
          <div className="border-t border-gray-200 bg-gray-50 p-6">
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900">
                Week {selectedWeek} Details
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Estimates */}
                {week.estimates.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Estimates</h5>
                    <div className="space-y-2">
                      {week.estimates.map(estimate => (
                        <div key={estimate.id} className="flex justify-between items-center p-3 bg-white rounded border">
                          <div>
                            <div className="font-medium">{estimate.category}</div>
                            <div className="text-sm text-gray-600">{estimate.description}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-medium ${getCurrencyColor(estimate.type === 'inflow' ? estimate.amount : -estimate.amount)}`}>
                              {formatCurrency(estimate.amount)}
                            </div>
                            <div className="text-xs text-gray-500 space-x-2">
                              <button 
                                onClick={() => handleEditEstimate(estimate)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => onEstimateDelete(estimate.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* AR Estimates */}
                {showARDetails && week.arEstimates.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-3">
                      AR Estimates ({week.arEstimates.length})
                    </h5>
                    <div className="space-y-2">
                      {week.arEstimates.map(arEstimate => (
                        <div key={arEstimate.id} className="flex justify-between items-center p-3 bg-white rounded border">
                          <div>
                            <div className="font-medium">{arEstimate.invoiceNumber}</div>
                            <div className="text-sm text-gray-600">{arEstimate.clientName}</div>
                            <div className="text-xs text-gray-500">
                              Due: {arEstimate.dueDate.toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-green-600">
                              {formatCurrency(arEstimate.amount)}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center">
                              {getARConfidenceIcon(arEstimate.confidence)}
                              <span className="ml-1 capitalize">{arEstimate.confidence}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Transactions */}
                {week.transactions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-3">
                      Actual Transactions ({week.transactions.length})
                    </h5>
                    <div className="space-y-2">
                      {week.transactions.slice(0, 5).map(transaction => (
                        <div key={transaction.id} className="flex justify-between items-center p-2 bg-white rounded border border-gray-100">
                          <div>
                            <div className="text-sm font-medium">{transaction.description}</div>
                            <div className="text-xs text-gray-600">{transaction.category}</div>
                          </div>
                          <div className={`text-sm font-medium ${getCurrencyColor(transaction.type === 'inflow' ? transaction.amount : -transaction.amount)}`}>
                            {formatCurrency(transaction.amount)}
                          </div>
                        </div>
                      ))}
                      {week.transactions.length > 5 && (
                        <div className="text-xs text-gray-500 text-center py-2">
                          ...and {week.transactions.length - 5} more transactions
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Estimate Modal */}
      {modalState.isOpen && (
        <EstimateModal
          isOpen={modalState.isOpen}
          onClose={() => setModalState({ isOpen: false, weekNumber: 0, type: null })}
          onSave={handleEstimateSubmit}
          weekNumber={modalState.weekNumber}
          type={modalState.type!}
          estimate={modalState.editingEstimate}
        />
      )}
    </div>
  );
};

export default CashflowTableWithAR;