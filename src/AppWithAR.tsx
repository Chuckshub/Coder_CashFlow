import React, { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import UserHeader from './components/common/UserHeader';
import CSVUpload from './components/DataImport/CSVUpload';
import FirebaseStatus from './components/common/FirebaseStatus';
import EstimateCreatorModal from './components/common/EstimateCreatorModal';
import CashflowTable from './components/CashflowTable/CashflowTable';
import AREstimatesPanel from './components/AREstimates/AREstimatesPanel';
import ARConfigModal from './components/AREstimates/ARConfigModal';

import { 
  Transaction, 
  Estimate, 
  WeeklyCashflow, 
  WeeklyCashflowWithAR,
  RawTransaction,
  AREstimate,
  ARSummary,
  ARConfig
} from './types';
import { formatCurrency, generate13Weeks } from './utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';
import { 
  processRawTransactionsSimple, 
  PipelineProgress, 
  PipelineResult 
} from './services/csvToFirebasePipelineSimple';
import { getSimpleDataLoader, DataLoadingState } from './services/dataLoaderSimple';
import { testFirebaseConnection } from './utils/firebaseTest';
import { getSimpleFirebaseService } from './services/firebaseServiceSimple';
import { createCampfireService } from './services/campfireService';
import { createARIntegrationService } from './services/arIntegrationService';
import { calculateWeeklyCashflowsWithAR, CashflowCalculationOptions } from './services/cashflowCalculationService';

type ActiveView = 'upload' | 'cashflow' | 'ar';

// Main App Component with AR Integration
function MainApp() {
  const { currentUser } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('cashflow');
  
  // Existing state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [weeklyCashflows, setWeeklyCashflows] = useState<WeeklyCashflowWithAR[]>([]);
  const [startingBalance, setStartingBalance] = useState<number>(50000);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress>({
    stage: 'parsing',
    message: 'Idle',
    progress: 0,
    completed: 0,
    total: 0,
    errors: [],
  });
  
  // AR-related state
  const [arEstimates, setArEstimates] = useState<AREstimate[]>([]);
  const [arSummary, setArSummary] = useState<ARSummary | null>(null);
  const [arConfig, setArConfig] = useState<ARConfig>({
    enabled: false,
    autoRefreshInterval: 60,
    collectionAssumptions: {
      currentOnTime: 90,
      overdueCollectionRate: 75,
      averageDelayDays: 14,
    },
  });
  const [isArLoading, setIsArLoading] = useState<boolean>(false);
  const [showArConfig, setShowArConfig] = useState<boolean>(false);
  const [includeAR, setIncludeAR] = useState<boolean>(false);

  // AR Services (initialized when config is available)
  const [arService, setArService] = useState<any>(null);

  // Initialize AR service when config is available
  useEffect(() => {
    if (arConfig.enabled && arConfig.campfireApiKey) {
      const campfireService = createCampfireService(arConfig.campfireApiKey);
      const integrationService = createARIntegrationService(campfireService, arConfig);
      setArService(integrationService);
    } else {
      setArService(null);
    }
  }, [arConfig]);

  // Load AR data when service is available
  useEffect(() => {
    if (arService && arConfig.enabled) {
      loadARData();
      
      // Set up auto-refresh if configured
      if (arConfig.autoRefreshInterval && arConfig.autoRefreshInterval > 0) {
        const interval = setInterval(() => {
          loadARData();
        }, arConfig.autoRefreshInterval * 60 * 1000);
        
        return () => clearInterval(interval);
      }
    }
  }, [arService, arConfig.enabled]);

  // Recalculate cashflows when AR data or settings change
  useEffect(() => {
    if (transactions.length > 0 || estimates.length > 0 || (includeAR && arEstimates.length > 0)) {
      const options: CashflowCalculationOptions = {
        includeAREstimates: includeAR && arConfig.enabled,
        arEstimates: includeAR ? arEstimates : [],
      };
      
      const cashflows = calculateWeeklyCashflowsWithAR(
        transactions,
        estimates,
        startingBalance,
        options
      );
      
      setWeeklyCashflows(cashflows);
    }
  }, [transactions, estimates, arEstimates, startingBalance, includeAR, arConfig.enabled]);

  // Load AR data from Campfire
  const loadARData = async () => {
    if (!arService) return;

    setIsArLoading(true);
    try {
      const { estimates: newArEstimates, summary } = await arService.refreshARData();
      setArEstimates(newArEstimates);
      setArSummary(summary);
    } catch (error) {
      console.error('Failed to load AR data:', error);
      // You might want to show a toast notification here
    } finally {
      setIsArLoading(false);
    }
  };

  // Test Campfire connection
  const testCampfireConnection = async (apiKey: string) => {
    try {
      const campfireService = createCampfireService(apiKey);
      const testService = createARIntegrationService(campfireService, { 
        ...arConfig, 
        campfireApiKey: apiKey,
        enabled: true 
      });
      
      return await testService.testConnection();
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };

  // Handle AR configuration changes
  const handleArConfigChange = (newConfig: ARConfig) => {
    setArConfig(newConfig);
    // Save to localStorage or Firebase
    localStorage.setItem('arConfig', JSON.stringify(newConfig));
  };

  // Handle AR toggle
  const handleArToggle = (enabled: boolean) => {
    if (enabled && !arConfig.campfireApiKey) {
      setShowArConfig(true);
      return;
    }
    
    const newConfig = { ...arConfig, enabled };
    handleArConfigChange(newConfig);
  };

  // Load AR config on component mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('arConfig');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setArConfig({ ...arConfig, ...parsedConfig });
      } catch (error) {
        console.error('Failed to parse saved AR config:', error);
      }
    }
  }, []);

  // Existing functions (simplified for space)
  const handleCSVData = useCallback(async (rawTransactions: RawTransaction[]) => {
    setIsLoading(true);
    try {
      const result = await processRawTransactionsSimple(
        rawTransactions,
        setPipelineProgress
      );
      
      if (result.success) {
        setTransactions(result.processedTransactions || []);
        setActiveView('cashflow');
      }
    } catch (error) {
      console.error('Failed to process transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleEstimateCreate = (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEstimate: Estimate = {
      ...estimate,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setEstimates(prev => [...prev, newEstimate]);
  };

  const handleEstimateUpdate = (updatedEstimate: Estimate) => {
    setEstimates(prev => 
      prev.map(est => est.id === updatedEstimate.id ? updatedEstimate : est)
    );
  };

  const handleEstimateDelete = (estimateId: string) => {
    setEstimates(prev => prev.filter(est => est.id !== estimateId));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <UserHeader />
      <FirebaseStatus />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveView('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Data Import
            </button>
            <button
              onClick={() => setActiveView('cashflow')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === 'cashflow'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Cashflow Projections
            </button>
            <button
              onClick={() => setActiveView('ar')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === 'ar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Accounts Receivable
              {arEstimates.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {arEstimates.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeView === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Import Transaction Data</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Upload your Chase bank CSV file to import transaction data.
                </p>
              </div>
              <div className="p-6">
                <CSVUpload onDataReceived={handleCSVData} isLoading={isLoading} />
              </div>
            </div>
          </div>
        )}

        {activeView === 'cashflow' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">13-Week Cashflow Projections</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Weekly cashflow analysis with actual transactions and estimates
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  {arConfig.enabled && (
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={includeAR}
                        onChange={(e) => setIncludeAR(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Include AR Estimates
                      </span>
                    </label>
                  )}
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">
                      Starting Balance:
                    </label>
                    <input
                      type="number"
                      value={startingBalance}
                      onChange={(e) => setStartingBalance(Number(e.target.value))}
                      className="w-32 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              
              {includeAR && arSummary && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span>AR Integration Active:</span>
                    <span className="font-medium">
                      {arEstimates.length} invoices · {formatCurrency(arSummary.totalOutstanding)} outstanding
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Cashflow Table */}
            <CashflowTable
              weeklyCashflows={weeklyCashflows}
              estimates={estimates}
              onEstimateCreate={handleEstimateCreate}
              onEstimateUpdate={handleEstimateUpdate}
              onEstimateDelete={handleEstimateDelete}
            />
          </div>
        )}

        {activeView === 'ar' && (
          <AREstimatesPanel
            arEstimates={arEstimates}
            arSummary={arSummary}
            isLoading={isArLoading}
            isEnabled={arConfig.enabled}
            onRefresh={loadARData}
            onToggleEnabled={handleArToggle}
            onConfigChange={handleArConfigChange}
          />
        )}
      </div>

      {/* AR Configuration Modal */}
      <ARConfigModal
        isOpen={showArConfig}
        config={arConfig}
        onSave={handleArConfigChange}
        onClose={() => setShowArConfig(false)}
        onTestConnection={testCampfireConnection}
      />
    </div>
  );
}

// Main App with Auth Provider
export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <MainApp />
      </ProtectedRoute>
    </AuthProvider>
  );
}