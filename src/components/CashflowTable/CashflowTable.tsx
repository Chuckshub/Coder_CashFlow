import React, { useState } from 'react';
import { WeeklyCashflow, Estimate, Transaction } from '../../types';
import { formatCurrency, formatWeekRange, getCurrencyColor, getBalanceColor } from '../../utils/dateUtils';
import EstimateModal from '../EstimateManager/EstimateModal';
import WeeklyDetailView from './WeeklyDetailView';

interface CashflowTableProps {
  weeklyCashflows: WeeklyCashflow[];
  transactions: Transaction[];
  onAddEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateEstimate: (id: string, estimate: Partial<Estimate>) => void;
  onDeleteEstimate: (id: string) => void;
  onEstimateClick?: (estimateId: string) => void; // Optional click handler to show creator info
  onRefreshData?: () => void; // Optional refresh callback
}

interface ModalState {
  isOpen: boolean;
  weekNumber: number;
  type: 'inflow' | 'outflow' | null;
  editingEstimate?: Estimate;
}

const CashflowTable: React.FC<CashflowTableProps> = ({ 
  weeklyCashflows, 
  transactions, 
  onAddEstimate, 
  onUpdateEstimate, 
  onDeleteEstimate,
  onEstimateClick,
  onRefreshData
}) => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    weekNumber: 1,
    type: null
  });
  const [showDetailView, setShowDetailView] = useState(false);

  const openEstimateModal = (weekNumber: number, type: 'inflow' | 'outflow', estimate?: Estimate) => {
    setModalState({
      isOpen: true,
      weekNumber,
      type,
      editingEstimate: estimate
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

  const handleSaveEstimate = (estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (modalState.editingEstimate) {
      onUpdateEstimate(modalState.editingEstimate.id, estimateData);
    } else {
      onAddEstimate(estimateData);
    }
    closeModal();
  };

  const CellContent: React.FC<{ 
    value: number; 
    weekNumber: number; 
    type: 'inflow' | 'outflow';
    estimates: Estimate[];
    onEstimateClick?: (estimateId: string) => void;
  }> = ({ value, weekNumber, type, estimates, onEstimateClick }) => {
    const cellEstimates = estimates.filter(e => e.type === type);
    const hasEstimates = cellEstimates.length > 0;
    const estimateTotal = cellEstimates.reduce((sum, e) => sum + e.amount, 0);
    const totalValue = value + estimateTotal;

    return (
      <div 
        className="relative p-3 min-h-[60px] cursor-pointer transition-colors border-r border-gray-200 group hover:bg-gray-50"
        onClick={() => openEstimateModal(weekNumber, type)}
      >
        {/* Actual amount */}
        {value !== 0 && (
          <div className="text-sm font-medium text-gray-900 mb-1">
            {formatCurrency(value)}
          </div>
        )}
        
        {/* Estimates */}
        {cellEstimates.map((estimate) => (
          <div
            key={estimate.id}
            className="text-xs bg-blue-50 rounded px-2 py-1 mb-1 truncate hover:bg-blue-100 transition-colors relative"
            title={`${estimate.description} - ${estimate.notes || ''}`}
          >
            <div className="text-blue-600 font-medium">
              {formatCurrency(estimate.amount)}
            </div>
            <div className="text-blue-500 text-xs truncate">
              {estimate.description}
            </div>
            
            {/* Click handlers */}
            <div className="absolute inset-0 flex">
              {/* Left half - Show creator info */}
              {onEstimateClick && (
                <button
                  className="flex-1 hover:bg-blue-200 hover:bg-opacity-30 rounded-l transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEstimateClick(estimate.id);
                  }}
                  title="Click to see who created this estimate"
                />
              )}
              {/* Right half - Edit estimate */}
              <button
                className="flex-1 hover:bg-yellow-200 hover:bg-opacity-30 rounded-r transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  openEstimateModal(weekNumber, type, estimate);
                }}
                title="Click to edit this estimate"
              />
            </div>
          </div>
        ))}
        
        {/* Add button on hover */}
        <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-gray-50 bg-opacity-90 ${
          hasEstimates ? 'hidden' : ''
        }`}>
          <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
            + Add Estimate
          </button>
        </div>
        
        {/* Total indicator */}
        {hasEstimates && (
          <div className="text-xs text-gray-600 mt-1 font-medium">
            Total: {formatCurrency(totalValue)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">13-Week Cashflow Projection</h2>
            <p className="text-gray-600 mt-1">Click any cell to add estimates</p>
          </div>
          <button
            onClick={() => setShowDetailView(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Weekly Details</span>
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full">
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
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Running Balance
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {weeklyCashflows.map((weekData) => {
              return (
                <tr key={weekData.weekNumber} className="hover:bg-gray-50">
                  <td className="px-4 py-3 border-r border-gray-200">
                    <div>
                      <div className={`text-sm font-medium ${
                        weekData.weekNumber === 0 ? 'text-blue-600' :
                        weekData.weekNumber < 0 ? 'text-gray-600' :
                        'text-gray-900'
                      }`}>
                        {weekData.weekNumber === -1 ? 'Last Week' :
                         weekData.weekNumber === 0 ? 'Current Week' :
                         weekData.weekNumber > 0 ? `Week +${weekData.weekNumber}` :
                         `Week ${weekData.weekNumber}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatWeekRange(weekData.weekStart)}
                      </div>
                    </div>
                  </td>
                  
                  <td className="border-r border-gray-200 p-0">
                    <CellContent 
                      value={weekData.actualInflow}
                      weekNumber={weekData.weekNumber}
                      type="inflow"
                      estimates={weekData.estimates}
                      onEstimateClick={onEstimateClick}
                    />
                  </td>
                  
                  <td className="border-r border-gray-200 p-0">
                    <CellContent 
                      value={weekData.actualOutflow}
                      weekNumber={weekData.weekNumber}
                      type="outflow"
                      estimates={weekData.estimates}
                      onEstimateClick={onEstimateClick}
                    />
                  </td>
                  
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
                  
                  <td className="px-4 py-3 text-center">
                    <div className={`text-sm font-medium ${getBalanceColor(weekData.runningBalance)}`}>
                      {formatCurrency(weekData.runningBalance)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Summary row */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-gray-900">13-Week Totals:</span>
          <div className="flex space-x-8">
            <span className="text-green-600">
              Inflows: {formatCurrency(
                weeklyCashflows.reduce((sum, week) => 
                  sum + week.actualInflow + week.estimatedInflow, 0
                )
              )}
            </span>
            <span className="text-red-600">
              Outflows: {formatCurrency(
                weeklyCashflows.reduce((sum, week) => 
                  sum + week.actualOutflow + week.estimatedOutflow, 0
                )
              )}
            </span>
            <span className={getCurrencyColor(
              weeklyCashflows.reduce((sum, week) => sum + week.netCashflow, 0)
            )}>
              Net: {formatCurrency(
                weeklyCashflows.reduce((sum, week) => sum + week.netCashflow, 0)
              )}
            </span>
          </div>
        </div>
      </div>
      
      <EstimateModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onSave={handleSaveEstimate}
        weekNumber={modalState.weekNumber}
        type={modalState.type}
        estimate={modalState.editingEstimate}
        onDelete={modalState.editingEstimate ? () => {
          onDeleteEstimate(modalState.editingEstimate!.id);
          closeModal();
        } : undefined}
      />
      
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

export default CashflowTable;