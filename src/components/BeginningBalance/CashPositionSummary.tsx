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
  
  // High APR Account props
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
              Operating + High APR Account
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

        {/* High APR Account */}
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
              <span className="text-gray-600">High APR:</span>
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

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
        <div className="flex items-start space-x-2">
          <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-700">
            <p className="font-medium">Cash Position Overview</p>
            <p className="mt-1">
              The <strong>Operating Account</strong> balance is used in cashflow calculations and projections.
              The <strong>High APR Account</strong> is tracked separately and does not affect cashflow forecasts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashPositionSummary;