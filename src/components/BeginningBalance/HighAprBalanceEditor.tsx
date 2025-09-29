import React, { useState, useEffect } from 'react';
import { NumericFormat } from 'react-number-format';
import { formatCurrency } from '../../utils/dateUtils';

interface HighAprBalanceEditorProps {
  currentBalance: number;
  isLocked: boolean;
  onUpdateBalance: (newBalance: number) => void;
  onToggleLock: (locked: boolean) => void;
  isLoading?: boolean;
}

const HighAprBalanceEditor: React.FC<HighAprBalanceEditorProps> = ({
  currentBalance,
  isLocked,
  onUpdateBalance,
  onToggleLock,
  isLoading = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize edit value when starting to edit
  useEffect(() => {
    if (isEditing) {
      setEditValue(currentBalance.toString());
      setError(null);
    }
  }, [isEditing, currentBalance]);

  const handleStartEdit = () => {
    if (isLocked) return;
    setIsEditing(true);
  };

  const handleSave = () => {
    const numValue = parseFloat(editValue);
    
    // Validation
    if (isNaN(numValue)) {
      setError('Please enter a valid number');
      return;
    }

    // Allow negative balances (overdraft scenarios)
    if (Math.abs(numValue) > 1000000000) {
      setError('Balance must be less than $1 billion');
      return;
    }

    onUpdateBalance(numValue);
    setIsEditing(false);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleToggleLock = () => {
    if (isEditing) {
      handleCancel();
    }
    onToggleLock(!isLocked);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-900">Investment Account</h3>
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>
          
          {/* Lock/Unlock Toggle */}
          <button
            onClick={handleToggleLock}
            className={`p-1 rounded transition-colors ${
              isLocked
                ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
            }`}
            title={isLocked ? 'Click to unlock for editing' : 'Click to lock from editing'}
          >
            {isLocked ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Balance Display/Editor */}
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <div className="relative">
                <NumericFormat
                  value={editValue}
                  onValueChange={(values) => setEditValue(values.value || '')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSave();
                    } else if (e.key === 'Escape') {
                      handleCancel();
                    }
                  }}
                  thousandSeparator=","
                  prefix="$"
                  placeholder="$0"
                  className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  allowNegative={true}
                />
              </div>
              <button
                onClick={handleSave}
                className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div 
              className={`flex items-center space-x-2 ${
                !isLocked ? 'cursor-pointer hover:bg-gray-50 px-2 py-1 rounded' : ''
              }`}
              onClick={handleStartEdit}
            >
              <span className={`text-lg font-medium ${
                currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(currentBalance)}
              </span>
              {!isLocked && (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Lock Status Indicator */}
      <div className="mt-2 text-xs text-gray-500">
        {isLocked ? (
          <span className="flex items-center space-x-1">
            <span>🔒</span>
            <span>Balance is locked from editing</span>
          </span>
        ) : (
          <span className="flex items-center space-x-1">
            <span>🔓</span>
            <span>Click balance to edit • Click lock to secure</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default HighAprBalanceEditor;