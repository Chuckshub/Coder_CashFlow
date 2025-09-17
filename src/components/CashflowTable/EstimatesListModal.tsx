import React from 'react';
import { Estimate } from '../../types';
import { formatCurrency } from '../../utils/dateUtils';

interface EstimatesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  estimates: Estimate[];
  weekNumber: number;
  type: 'inflow' | 'outflow';
  onEditEstimate: (estimate: Estimate) => void;
  onDeleteEstimate: (estimateId: string) => void;
  onAddNewEstimate: () => void;
}

const EstimatesListModal: React.FC<EstimatesListModalProps> = ({
  isOpen,
  onClose,
  estimates,
  weekNumber,
  type,
  onEditEstimate,
  onDeleteEstimate,
  onAddNewEstimate
}) => {
  if (!isOpen) return null;

  const typeColor = type === 'inflow' ? 'blue' : 'red';
  const typeText = type === 'inflow' ? 'Inflow' : 'Outflow';
  
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDeleteClick = (estimateId: string, description: string) => {
    if (window.confirm(`Are you sure you want to delete "${description}"?`)) {
      onDeleteEstimate(estimateId);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-96 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Week {weekNumber} {typeText} Estimates
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-semibold"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {estimates.length} estimate{estimates.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Estimates List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {estimates.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">📝</div>
              <p>No {type} estimates for this week</p>
              <p className="text-sm mt-1">Click "Add New Estimate" to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {estimates.map((estimate) => (
                <div
                  key={estimate.id}
                  className={`border border-${typeColor}-200 rounded-lg p-3 hover:shadow-sm transition-shadow`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium text-${typeColor}-600`}>
                        {formatCurrency(estimate.amount)}
                      </div>
                      <div className="text-sm text-gray-600 truncate mt-1">
                        {estimate.description || 'No description'}
                      </div>
                      {estimate.category && (
                        <div className="text-xs text-gray-500 mt-1">
                          {estimate.category}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-3">
                      <button
                        onClick={() => onEditEstimate(estimate)}
                        className={`p-1.5 text-${typeColor}-600 hover:bg-${typeColor}-50 rounded transition-colors`}
                        title="Edit estimate"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(estimate.id, estimate.description)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete estimate"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={onAddNewEstimate}
              className={`px-4 py-2 text-sm font-medium text-${typeColor}-700 bg-${typeColor}-50 border border-${typeColor}-200 rounded-md hover:bg-${typeColor}-100 focus:outline-none focus:ring-2 focus:ring-${typeColor}-500 transition-colors`}
            >
              + Add New Estimate
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimatesListModal;