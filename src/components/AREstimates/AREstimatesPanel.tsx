/**
 * AR Estimates Panel Component
 * 
 * Displays AR data from Campfire integration including aging, estimates,
 * and collection projections.
 */

import React, { useState, useEffect } from 'react';
import { AREstimate, ARSummary, ARConfig } from '../../types';
import { formatCurrency } from '../../utils/dateUtils';

interface AREstimatesPanelProps {
  arEstimates: AREstimate[];
  arSummary: ARSummary | null;
  isLoading: boolean;
  isEnabled: boolean;
  onRefresh: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onConfigChange: (config: Partial<ARConfig>) => void;
  className?: string;
}

interface GroupedAREstimates {
  current: AREstimate[];
  overdue: AREstimate[];
  collections: AREstimate[];
}

const AREstimatesPanel: React.FC<AREstimatesPanelProps> = ({
  arEstimates,
  arSummary,
  isLoading,
  isEnabled,
  onRefresh,
  onToggleEnabled,
  onConfigChange,
  className = '',
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState<'status' | 'week' | 'client'>('status');
  const [showConfig, setShowConfig] = useState(false);

  // Group AR estimates by status
  const groupedByStatus: GroupedAREstimates = arEstimates.reduce(
    (groups, estimate) => {
      groups[estimate.status].push(estimate);
      return groups;
    },
    { current: [], overdue: [], collections: [] } as GroupedAREstimates
  );

  // Group AR estimates by week
  const groupedByWeek = arEstimates.reduce((groups, estimate) => {
    const weekKey = estimate.weekNumber.toString();
    if (!groups[weekKey]) {
      groups[weekKey] = [];
    }
    groups[weekKey].push(estimate);
    return groups;
  }, {} as Record<string, AREstimate[]>);

  // Group AR estimates by client
  const groupedByClient = arEstimates.reduce((groups, estimate) => {
    const clientName = estimate.clientName;
    if (!groups[clientName]) {
      groups[clientName] = [];
    }
    groups[clientName].push(estimate);
    return groups;
  }, {} as Record<string, AREstimate[]>);

  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status: 'current' | 'overdue' | 'collections') => {
    switch (status) {
      case 'current': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-yellow-100 text-yellow-800';
      case 'collections': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderAREstimate = (estimate: AREstimate) => (
    <div
      key={estimate.id}
      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium text-gray-900">{estimate.invoiceNumber}</h4>
          <p className="text-sm text-gray-600">{estimate.clientName}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-gray-900">{formatCurrency(estimate.amount)}</p>
          <p className={`text-xs font-medium ${getConfidenceColor(estimate.confidence)}`}>
            {estimate.confidence} confidence
          </p>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(estimate.status)}`}>
          {estimate.status}
        </span>
        
        <div className="flex flex-col text-right">
          <span>Due: {formatDate(estimate.dueDate)}</span>
          <span>Est: {formatDate(estimate.estimatedCollectionDate)}</span>
        </div>
      </div>
      
      {estimate.daysOverdue > 0 && (
        <div className="mt-2 text-xs text-red-600">
          {estimate.daysOverdue} days overdue
        </div>
      )}
      
      {estimate.notes && (
        <div className="mt-2 text-xs text-gray-600 italic">
          {estimate.notes}
        </div>
      )}
    </div>
  );

  const renderStatusGroup = (status: keyof GroupedAREstimates, estimates: AREstimate[]) => {
    if (estimates.length === 0) return null;
    
    const totalAmount = estimates.reduce((sum, est) => sum + est.amount, 0);
    
    return (
      <div key={status} className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {status} ({estimates.length})
          </h3>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(totalAmount)}
          </span>
        </div>
        <div className="space-y-2">
          {estimates.map(renderAREstimate)}
        </div>
      </div>
    );
  };

  const renderWeekGroup = (weekNumber: string, estimates: AREstimate[]) => {
    const totalAmount = estimates.reduce((sum, est) => sum + est.amount, 0);
    const weekNum = parseInt(weekNumber);
    const weekLabel = weekNum === -1 ? 'Last Week' : 
                     weekNum === 0 ? 'This Week' : 
                     weekNum > 0 ? `Week +${weekNum}` : `Week ${weekNum}`;
    
    return (
      <div key={weekNumber} className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {weekLabel} ({estimates.length})
          </h3>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(totalAmount)}
          </span>
        </div>
        <div className="space-y-2">
          {estimates.map(renderAREstimate)}
        </div>
      </div>
    );
  };

  const renderClientGroup = (clientName: string, estimates: AREstimate[]) => {
    const totalAmount = estimates.reduce((sum, est) => sum + est.amount, 0);
    
    return (
      <div key={clientName} className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {clientName} ({estimates.length})
          </h3>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(totalAmount)}
          </span>
        </div>
        <div className="space-y-2">
          {estimates.map(renderAREstimate)}
        </div>
      </div>
    );
  };

  if (!isEnabled) {
    return (
      <div className={`bg-gray-50 rounded-lg p-6 text-center ${className}`}>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">AR Integration</h2>
        <p className="text-gray-600 mb-4">
          Connect to Campfire to automatically import your accounts receivable data
          and improve your cashflow projections.
        </p>
        <button
          onClick={() => onToggleEnabled(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Enable AR Integration
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Accounts Receivable</h2>
          <div className="flex items-center space-x-2">
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'status' | 'week' | 'client')}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="status">Group by Status</option>
              <option value="week">Group by Week</option>
              <option value="client">Group by Client</option>
            </select>
            
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
            
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Settings
            </button>
          </div>
        </div>
        
        {arSummary && (
          <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">{formatCurrency(arSummary.totalOutstanding)}</div>
              <div className="text-gray-600">Total Outstanding</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-600">{formatCurrency(arSummary.totalCurrent)}</div>
              <div className="text-gray-600">Current</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-yellow-600">{formatCurrency(arSummary.totalOverdue)}</div>
              <div className="text-gray-600">Overdue</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-blue-600">{formatCurrency(arSummary.estimatedCollections.next4Weeks)}</div>
              <div className="text-gray-600">Next 4 Weeks</div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-gray-600">Loading AR data...</div>
          </div>
        ) : arEstimates.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-600">No outstanding invoices found</div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupBy === 'status' && Object.entries(groupedByStatus).map(([status, estimates]) =>
              renderStatusGroup(status as keyof GroupedAREstimates, estimates)
            )}
            
            {groupBy === 'week' && Object.entries(groupedByWeek)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([week, estimates]) => renderWeekGroup(week, estimates))
            }
            
            {groupBy === 'client' && Object.entries(groupedByClient)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([client, estimates]) => renderClientGroup(client, estimates))
            }
          </div>
        )}
      </div>
      
      {/* Config Panel */}
      {showConfig && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">AR Settings</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span>AR Integration</span>
              <button
                onClick={() => onToggleEnabled(false)}
                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
              >
                Disable
              </button>
            </div>
            
            <div className="text-xs text-gray-600">
              Last updated: {arSummary?.lastUpdated ? formatDate(arSummary.lastUpdated) : 'Never'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AREstimatesPanel;
