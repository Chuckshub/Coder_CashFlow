import React from 'react';
import { formatCurrency } from '../../utils/dateUtils';
import BeginningBalanceEditor from './BeginningBalanceEditor';
import HighAprBalanceEditor from './HighAprBalanceEditor';

interface CashPositionSummaryProps {
  // Operating Account props
  operatingBalance: number;
  isOperatingLocked: boolean;
  onUpdateOperatingBalance: (newBalance: number) => void;
  onToggleOperatingLock: (locked: boolean) => void;
  isLoadingOperating?: boolean;
  
  // Investment Account props
  highAprBalance: number;
  isHighAprLocked: boolean;
  onUpdateHighAprBalance: (newBalance: number) => void;
  onToggleHighAprLock: (locked: boolean) => void;
  isLoadingHighApr?: boolean;
}

const CashPositionSummary: React.FC<CashPositionSummaryProps> = ({
  operatingBalance,
  isOperatingLocked,
  onUpdateOperatingBalance,
  onToggleOperatingLock,
  isLoadingOperating = false,
  highAprBalance,
  isHighAprLocked,
  onUpdateHighAprBalance,
  onToggleHighAprLock,
  isLoadingHighApr = false
}) => {
  const totalCash = operatingBalance + highAprBalance;
  const isAnyLoading = isLoadingOperating || isLoadingHighApr;

  return (
    <div className="mb-6 space-y-4">
      {/* Total Cash Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Total Cash Position</h2>
            <p className="text-blue-100 text-sm">Combined balance across all accounts</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {isAnyLoading ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-6 w-6 text-blue-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading...</span>
                </div>
              ) : (
                formatCurrency(totalCash)
              )}
            </div>
            <div className="text-xs text-blue-200 mt-1">
              Operating + Investment Account
            </div>
          </div>
        </div>
      </div>

      {/* Account Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Operating Account */}
        <div>
          <BeginningBalanceEditor
            currentBalance={operatingBalance}
            isLocked={isOperatingLocked}
            onUpdateBalance={onUpdateOperatingBalance}
            onToggleLock={onToggleOperatingLock}
            isLoading={isLoadingOperating}
          />
        </div>

        {/* Investment Account */}
        <div>
          <HighAprBalanceEditor
            currentBalance={highAprBalance}
            isLocked={isHighAprLocked}
            onUpdateBalance={onUpdateHighAprBalance}
            onToggleLock={onToggleHighAprLock}
            isLoading={isLoadingHighApr}
          />
        </div>
      </div>

      {/* Quick Summary Bar */}
      <div className="bg-gray-50 p-3 rounded-lg border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-6">
            <div>
              <span className="text-gray-600">Operating:</span>
              <span className="ml-2 font-medium text-gray-900">
                {formatCurrency(operatingBalance)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Investment:</span>
              <span className="ml-2 font-medium text-gray-900">
                {formatCurrency(highAprBalance)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-gray-600">Total Available:</span>
            <span className="ml-2 font-semibold text-lg text-blue-600">
              {formatCurrency(totalCash)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashPositionSummary;