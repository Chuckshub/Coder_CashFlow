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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">High APR Account Balance</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onToggleLock(!isLocked)}
              disabled={isLoading}
              className={`p-1 rounded ${
                isLocked 
                  ? 'text-red-600 hover:bg-red-50' 
                  : 'text-gray-400 hover:bg-gray-50'
              } transition-colors disabled:opacity-50`}
              title={isLocked ? 'Click to unlock editing' : 'Click to lock editing'}
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
        </div>
        
        <div className="space-y-3">
          <div>
            <NumericFormat
              value={editValue}
              onValueChange={(values) => {
                setEditValue(values.value);
                setError(null);
              }}
              onKeyDown={handleKeyPress}
              thousandSeparator={true}
              prefix="$"
              decimalScale={2}
              fixedDecimalScale={false}
              allowNegative={true}
              placeholder="Enter high APR account balance"
              className={`w-full px-3 py-2 text-lg font-medium border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                error ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              autoFocus
            />
            {error && (
              <p className="mt-1 text-xs text-red-600">{error}</p>
            )}
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">High APR Account</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onToggleLock(!isLocked)}
            disabled={isLoading}
            className={`p-1 rounded ${
              isLocked 
                ? 'text-red-600 hover:bg-red-50' 
                : 'text-gray-400 hover:bg-gray-50'
            } transition-colors disabled:opacity-50`}
            title={isLocked ? 'Click to unlock editing' : 'Click to lock editing'}
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
      </div>
      
      <div 
        className={`text-2xl font-bold ${
          isLocked 
            ? 'text-gray-500 cursor-not-allowed' 
            : 'text-blue-600 cursor-pointer hover:text-blue-800'
        } transition-colors`}
        onClick={handleStartEdit}
        title={isLocked ? 'Balance is locked' : 'Click to edit high APR account balance'}
      >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading...</span>
          </div>
        ) : (
          formatCurrency(currentBalance)
        )}
      </div>
      
      <p className="text-xs text-gray-500 mt-1">
        {isLocked ? (
          <>
            <span className="inline-flex items-center">
              <svg className="w-3 h-3 mr-1 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Balance is locked
            </span>
          </>
        ) : (
          'Click to edit • Separate from cashflow calculations'
        )}
      </p>
    </div>
  );
};

export default HighAprBalanceEditor;