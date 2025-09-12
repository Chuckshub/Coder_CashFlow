/**
 * AR Configuration Modal Component
 * 
 * Allows users to configure Campfire API settings and collection assumptions.
 */

import React, { useState } from 'react';
import { ARConfig } from '../../types';

interface ARConfigModalProps {
  isOpen: boolean;
  config: ARConfig;
  onSave: (config: ARConfig) => void;
  onClose: () => void;
  onTestConnection: (apiKey: string) => Promise<{ success: boolean; message: string }>;
}

const ARConfigModal: React.FC<ARConfigModalProps> = ({
  isOpen,
  config,
  onSave,
  onClose,
  onTestConnection,
}) => {
  const [formData, setFormData] = useState<ARConfig>(config);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!formData.campfireApiKey) {
      setConnectionTestResult({
        success: false,
        message: 'Please enter a Campfire API key first.',
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const result = await onTestConnection(formData.campfireApiKey);
      setConnectionTestResult(result);
    } catch (error) {
      setConnectionTestResult({
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const handleInputChange = (
    field: keyof ARConfig,
    value: string | number | boolean
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAssumptionChange = (
    field: keyof ARConfig['collectionAssumptions'],
    value: number
  ) => {
    setFormData(prev => ({
      ...prev,
      collectionAssumptions: {
        ...prev.collectionAssumptions,
        [field]: value,
      },
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              AR Integration Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* API Configuration */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Campfire API Configuration
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={formData.campfireApiKey || ''}
                    onChange={(e) => handleInputChange('campfireApiKey', e.target.value)}
                    placeholder="Enter your Campfire API key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || !formData.campfireApiKey}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
                
                {connectionTestResult && (
                  <div className={`p-3 rounded-md text-sm ${
                    connectionTestResult.success
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {connectionTestResult.message}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auto-refresh Interval (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={formData.autoRefreshInterval || 60}
                    onChange={(e) => handleInputChange('autoRefreshInterval', parseInt(e.target.value) || 60)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Collection Assumptions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Collection Assumptions
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Invoices On-Time Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.collectionAssumptions.currentOnTime}
                    onChange={(e) => handleAssumptionChange('currentOnTime', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Percentage of current invoices expected to be collected on time
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Overdue Collection Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.collectionAssumptions.overdueCollectionRate}
                    onChange={(e) => handleAssumptionChange('overdueCollectionRate', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Percentage of overdue invoices expected to be eventually collected
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Average Delay Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={formData.collectionAssumptions.averageDelayDays}
                    onChange={(e) => handleAssumptionChange('averageDelayDays', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Average number of days customers pay late
                  </p>
                </div>
              </div>
            </div>

            {/* Enable/Disable */}
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => handleInputChange('enabled', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Enable AR Integration
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-8">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ARConfigModal;
