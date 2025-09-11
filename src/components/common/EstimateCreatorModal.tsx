import React, { useEffect, useState } from 'react';
import { getSimpleFirebaseService } from '../../services/firebaseServiceSimple';
import { Estimate } from '../../types';

interface EstimateCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  estimateId: string;
  userId: string;
}

interface EstimateWithCreator extends Estimate {
  createdBy: string;
  createdByUserId: string;
}

const EstimateCreatorModal: React.FC<EstimateCreatorModalProps> = ({
  isOpen,
  onClose,
  estimateId,
  userId
}) => {
  const [estimate, setEstimate] = useState<EstimateWithCreator | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && estimateId && userId) {
      loadEstimateWithCreator();
    }
  }, [isOpen, estimateId, userId]);

  const loadEstimateWithCreator = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const firebaseService = getSimpleFirebaseService(userId);
      const estimateWithCreator = await firebaseService.getEstimateWithCreator(estimateId);
      
      if (estimateWithCreator) {
        setEstimate(estimateWithCreator);
      } else {
        setError('Estimate not found');
      }
    } catch (error: any) {
      console.error('Error loading estimate with creator:', error);
      setError(`Failed to load estimate details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Estimate Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          {estimate && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p className="text-gray-900">{estimate.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <p className="text-gray-900">
                    {estimate.type === 'inflow' ? '+' : '-'}${estimate.amount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <p className="text-gray-900 capitalize">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      estimate.type === 'inflow' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {estimate.type}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="text-gray-900">{estimate.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Week Number</label>
                  <p className="text-gray-900">Week {estimate.weekNumber}</p>
                </div>
              </div>

              {estimate.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="text-gray-900">{estimate.notes}</p>
                </div>
              )}

              {estimate.isRecurring && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Recurring</label>
                  <p className="text-gray-900">
                    Yes - {estimate.recurringType || 'weekly'}
                  </p>
                </div>
              )}

              {/* Creator Information */}
              <div className="pt-4 border-t border-gray-200">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">Created By</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {estimate.createdBy.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-blue-900 font-medium">{estimate.createdBy}</p>
                        <p className="text-blue-700 text-xs">
                          {estimate.createdAt.toLocaleDateString()} at {estimate.createdAt.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {estimate.updatedAt.getTime() !== estimate.createdAt.getTime() && (
                <div className="text-xs text-gray-500">
                  Last updated: {estimate.updatedAt.toLocaleDateString()} at {estimate.updatedAt.toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EstimateCreatorModal;
