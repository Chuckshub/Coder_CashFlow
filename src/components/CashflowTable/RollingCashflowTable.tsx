import React, { useState } from 'react';
import { WeeklyCashflow, Estimate, CashflowSession, RollingTimelineConfig } from '../../types';
import { formatCurrency, getCurrencyColor, getBalanceColor } from '../../utils/dateUtils';
import { formatRollingWeekRange, getWeekStatusStyles, getWeekStatusText } from '../../utils/rollingTimeline';
import EstimateModal from '../EstimateManager/EstimateModal';
import ScenarioSelector from '../ScenarioManager/ScenarioSelector';

interface RollingCashflowTableProps {
  weeklyCashflows: WeeklyCashflow[];
  currentSession: CashflowSession;
  activeScenario: string;
  rollingConfig: RollingTimelineConfig;
  onAddEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateEstimate: (id: string, estimate: Partial<Estimate>) => void;
  onDeleteEstimate: (id: string) => void;
  onScenarioChange: (scenario: string) => void;
  onAddScenario: (scenarioName: string) => void;
  onTimelineShift: (direction: 'backward' | 'forward') => void;
}

interface ModalState {
  isOpen: boolean;
  weekDate: Date;
  type: 'inflow' | 'outflow' | null;
  editingEstimate?: Estimate;
}

const RollingCashflowTable: React.FC<RollingCashflowTableProps> = ({
  weeklyCashflows,
  currentSession,
  activeScenario,
  rollingConfig,
  onAddEstimate,
  onUpdateEstimate,
  onDeleteEstimate,
  onScenarioChange,
  onAddScenario,
  onTimelineShift
}) => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    weekDate: new Date(),
    type: null
  });

  const openEstimateModal = (weekDate: Date, type: 'inflow' | 'outflow', estimate?: Estimate) => {
    setModalState({
      isOpen: true,
      weekDate,
      type,
      editingEstimate: estimate
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      weekDate: new Date(),
      type: null,
      editingEstimate: undefined
    });
  };

  const handleSaveEstimate = (estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const enhancedEstimate = {
      ...estimateData,
      weekDate: modalState.weekDate,
      scenario: activeScenario
    };
    
    if (modalState.editingEstimate) {
      onUpdateEstimate(modalState.editingEstimate.id, enhancedEstimate);
    } else {
      onAddEstimate(enhancedEstimate);
    }
    closeModal();
  };

  const CellContent: React.FC<{ 
    weekData: WeeklyCashflow;
    type: 'inflow' | 'outflow';
  }> = ({ weekData, type }) => {
    const actualValue = type === 'inflow' ? weekData.actualInflow : weekData.actualOutflow;
    const estimatedValue = type === 'inflow' ? weekData.estimatedInflow : weekData.estimatedOutflow;
    const totalValue = type === 'inflow' ? weekData.totalInflow : weekData.totalOutflow;
    const cellEstimates = weekData.estimates.filter(e => e.type === type);
    const styles = getWeekStatusStyles(weekData.weekStatus);
    
    const showActual = weekData.weekStatus === 'past' || (weekData.weekStatus === 'current' && actualValue > 0);
    const showEstimated = weekData.weekStatus !== 'past' && estimatedValue > 0;

    return (
      <div 
        className={`relative p-3 min-h-[80px] cursor-pointer transition-all border-r border-gray-200 group hover:bg-opacity-80 ${
          styles.background
        }`}
        onClick={() => openEstimateModal(weekData.weekStart, type)}
      >
        {/* Week Status Badge */}
        <div className="absolute top-1 right-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${styles.badge}`}>
            {getWeekStatusText(weekData.weekStatus)}
          </span>
        </div>
        
        {/* Actual Value */}
        {showActual && (
          <div className="mb-2">
            <div className="text-sm font-semibold text-gray-900">
              {formatCurrency(actualValue)}
            </div>
            <div className="text-xs text-gray-600">Actual</div>
          </div>
        )}
        
        {/* Estimated Value */}
        {showEstimated && (
          <div className={`mb-2 ${showActual ? 'border-t border-gray-300 pt-2' : ''}`}>
            <div className="text-sm font-medium text-blue-700">
              {formatCurrency(estimatedValue)}
            </div>
            <div className="text-xs text-blue-600">Estimated</div>
          </div>
        )}
        
        {/* Individual Estimates */}
        {cellEstimates.length > 0 && (
          <div className="space-y-1">
            {cellEstimates.slice(0, 2).map((estimate) => (
              <div
                key={estimate.id}
                className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 truncate hover:bg-blue-100 transition-colors"
                title={`${estimate.description} - ${estimate.notes || ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  openEstimateModal(weekData.weekStart, type, estimate);
                }}
              >
                <div className="font-medium text-blue-800">
                  {formatCurrency(estimate.amount)}
                </div>
                <div className="text-blue-600 truncate">
                  {estimate.description}
                </div>
              </div>
            ))}
            {cellEstimates.length > 2 && (
              <div className="text-xs text-gray-500 text-center">
                +{cellEstimates.length - 2} more
              </div>
            )}
          </div>
        )}
        
        {/* Add/Edit Button on Hover */}
        <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
          styles.background
        } bg-opacity-90`}>
          <button className="text-blue-600 hover:text-blue-800 font-medium text-sm px-3 py-1 bg-white rounded shadow-sm border">
            {cellEstimates.length > 0 ? 'Edit' : '+ Add'}
          </button>
        </div>
        
        {/* Estimate Accuracy for Past Weeks */}
        {weekData.weekStatus === 'past' && weekData.estimateAccuracy && estimatedValue > 0 && (
          <div className="absolute bottom-1 left-1 text-xs">
            <div className={`px-1 py-0.5 rounded text-white text-xs ${
              Math.abs(weekData.estimateAccuracy[type === 'inflow' ? 'inflowVariance' : 'outflowVariance']) <= 10
                ? 'bg-green-600'
                : Math.abs(weekData.estimateAccuracy[type === 'inflow' ? 'inflowVariance' : 'outflowVariance']) <= 25
                ? 'bg-yellow-600'
                : 'bg-red-600'
            }`}>
              {weekData.estimateAccuracy[type === 'inflow' ? 'inflowVariance' : 'outflowVariance'] > 0 ? '+' : ''}
              {weekData.estimateAccuracy[type === 'inflow' ? 'inflowVariance' : 'outflowVariance'].toFixed(0)}%
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Rolling Cashflow Timeline</h2>
            <p className="text-gray-600 mt-1">
              {rollingConfig.pastWeeks} weeks past • current week • {rollingConfig.futureWeeks} weeks projected
            </p>
          </div>
          
          {/* Timeline Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onTimelineShift('backward')}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              title="Shift timeline backward"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-sm text-gray-600 min-w-[100px] text-center">
              Week of {rollingConfig.currentDate.toLocaleDateString()}
            </div>
            <button
              onClick={() => onTimelineShift('forward')}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              title="Shift timeline forward"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Scenario Selector */}
        <ScenarioSelector
          currentSession={currentSession}
          activeScenario={activeScenario}
          onScenarioChange={onScenarioChange}
          onAddScenario={onAddScenario}
        />
      </div>
      
      {/* Rolling Timeline Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[140px]">
                Week
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                Inflows
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                Outflows
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                Net Cashflow
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">
                Running Balance
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-white">
            {weeklyCashflows.map((weekData) => {
              const styles = getWeekStatusStyles(weekData.weekStatus);
              
              return (
                <tr key={`${weekData.weekNumber}-${weekData.weekStart.toISOString()}`} className="hover:bg-gray-50">
                  {/* Week Info */}
                  <td className={`px-4 py-3 border-r border-gray-200 ${styles.background}`}>
                    <div>
                      <div className={`text-sm font-medium ${styles.text}`}>
                        {weekData.weekNumber === 0 ? 'This Week' : 
                         weekData.weekNumber > 0 ? `Week +${weekData.weekNumber}` : 
                         `Week ${weekData.weekNumber}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatRollingWeekRange(weekData.weekStart)}
                      </div>
                      <div className="mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${styles.badge}`}>
                          {getWeekStatusText(weekData.weekStatus)}
                        </span>
                      </div>
                    </div>
                  </td>
                  
                  {/* Inflows */}
                  <td className="border-r border-gray-200 p-0">
                    <CellContent weekData={weekData} type="inflow" />
                  </td>
                  
                  {/* Outflows */}
                  <td className="border-r border-gray-200 p-0">
                    <CellContent weekData={weekData} type="outflow" />
                  </td>
                  
                  {/* Net Cashflow */}
                  <td className={`px-4 py-3 text-center border-r border-gray-200 ${styles.background}`}>
                    <div className={`text-sm font-medium ${getCurrencyColor(weekData.netCashflow)}`}>
                      {formatCurrency(weekData.netCashflow)}
                    </div>
                    {weekData.weekStatus !== 'past' && (weekData.estimatedInflow > 0 || weekData.estimatedOutflow > 0) && (
                      <div className="text-xs text-gray-500 mt-1">
                        Projected
                      </div>
                    )}
                  </td>
                  
                  {/* Running Balance */}
                  <td className={`px-4 py-3 text-center ${styles.background}`}>
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
      
      {/* Summary Footer */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-gray-900">13-Week Summary:</span>
          <div className="flex space-x-8">
            <span className="text-green-600">
              Total Inflows: {formatCurrency(
                weeklyCashflows.reduce((sum, week) => sum + week.totalInflow, 0)
              )}
            </span>
            <span className="text-red-600">
              Total Outflows: {formatCurrency(
                weeklyCashflows.reduce((sum, week) => sum + week.totalOutflow, 0)
              )}
            </span>
            <span className={getCurrencyColor(
              weeklyCashflows.reduce((sum, week) => sum + week.netCashflow, 0)
            )}>
              Net Change: {formatCurrency(
                weeklyCashflows.reduce((sum, week) => sum + week.netCashflow, 0)
              )}
            </span>
          </div>
        </div>
      </div>
      
      {/* Estimate Modal */}
      <EstimateModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onSave={handleSaveEstimate}
        weekDate={modalState.weekDate}
        type={modalState.type}
        estimate={modalState.editingEstimate}
        scenario={activeScenario}
        onDelete={modalState.editingEstimate ? () => {
          onDeleteEstimate(modalState.editingEstimate!.id);
          closeModal();
        } : undefined}
      />
    </div>
  );
};

export default RollingCashflowTable;