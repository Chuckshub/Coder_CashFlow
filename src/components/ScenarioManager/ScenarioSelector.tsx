import React, { useState } from 'react';
import { CashflowSession } from '../../types';

interface ScenarioSelectorProps {
  currentSession: CashflowSession;
  activeScenario: string;
  onScenarioChange: (scenario: string) => void;
  onAddScenario: (scenarioName: string) => void;
  onRemoveScenario?: (scenario: string) => void;
}

const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  currentSession,
  activeScenario,
  onScenarioChange,
  onAddScenario,
  onRemoveScenario
}) => {
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const handleAddScenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (newScenarioName.trim() && !currentSession.scenarios.includes(newScenarioName.trim())) {
      onAddScenario(newScenarioName.trim());
      setNewScenarioName('');
      setIsAddingScenario(false);
    }
  };

  const handleRemoveScenario = (scenario: string) => {
    if (currentSession.scenarios.length > 1 && scenario !== activeScenario && onRemoveScenario) {
      onRemoveScenario(scenario);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center space-x-2">
        <label className="text-sm font-medium text-gray-700">
          Scenario:
        </label>
        
        {/* Scenario Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center justify-between min-w-[160px] px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <span className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                activeScenario === 'base' ? 'bg-blue-500' :
                activeScenario === 'conservative' ? 'bg-green-500' :
                activeScenario === 'optimistic' ? 'bg-orange-500' :
                'bg-purple-500'
              }`}></div>
              {activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)}
            </span>
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
              <div className="py-1">
                {currentSession.scenarios.map((scenario) => (
                  <div key={scenario} className="flex items-center justify-between group">
                    <button
                      onClick={() => {
                        onScenarioChange(scenario);
                        setShowDropdown(false);
                      }}
                      className={`flex items-center flex-1 px-3 py-2 text-sm text-left hover:bg-gray-100 ${
                        scenario === activeScenario ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        scenario === 'base' ? 'bg-blue-500' :
                        scenario === 'conservative' ? 'bg-green-500' :
                        scenario === 'optimistic' ? 'bg-orange-500' :
                        'bg-purple-500'
                      }`}></div>
                      {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
                      {scenario === activeScenario && (
                        <svg className="w-4 h-4 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    
                    {/* Remove button - only show if not active scenario and more than 1 scenario exists */}
                    {currentSession.scenarios.length > 1 && scenario !== activeScenario && onRemoveScenario && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveScenario(scenario);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 m-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-opacity"
                        title="Remove scenario"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                
                <div className="border-t border-gray-200 mt-1 pt-1">
                  <button
                    onClick={() => setIsAddingScenario(true)}
                    className="flex items-center w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Scenario
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Scenario Buttons */}
        <div className="hidden md:flex space-x-1">
          {currentSession.scenarios.slice(0, 4).map((scenario) => (
            <button
              key={scenario}
              onClick={() => onScenarioChange(scenario)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                scenario === activeScenario
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Add Scenario Modal */}
      {isAddingScenario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add New Scenario
            </h3>
            
            <form onSubmit={handleAddScenario}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scenario Name
                </label>
                <input
                  type="text"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Conservative, Optimistic, Q1 Planning"
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingScenario(false);
                    setNewScenarioName('');
                  }}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newScenarioName.trim() || currentSession.scenarios.includes(newScenarioName.trim())}
                  className="px-4 py-2 text-sm text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Scenario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowDropdown(false)}
        ></div>
      )}
    </div>
  );
};

export default ScenarioSelector;