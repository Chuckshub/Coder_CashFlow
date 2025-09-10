import React, { useState } from 'react';
import { FirebaseCashflowSession } from '../../services/firebase';
import { formatCurrency } from '../../utils/dateUtils';

interface SessionManagerProps {
  sessions: FirebaseCashflowSession[];
  currentSession: FirebaseCashflowSession | null;
  onCreateSession: (name: string, description?: string) => void;
  onLoadSession: (sessionId: string) => void;
  onClearSession: () => void;
  isFirebaseEnabled: boolean;
  isSaving: boolean;
}

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
  isSaving: boolean;
}

const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSaving
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Create New Cashflow Session
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSaving}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Q4 2024 Cashflow Analysis"
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Brief description of this cashflow analysis..."
                disabled={isSaving}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving || !name.trim()}
              >
                {isSaving ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const SessionManager: React.FC<SessionManagerProps> = ({
  sessions,
  currentSession,
  onCreateSession,
  onLoadSession,
  onClearSession,
  isFirebaseEnabled,
  isSaving
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);

  if (!isFirebaseEnabled) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Local Storage Only</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Firebase is not configured. Data will only be stored locally and may be lost.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Cloud Storage Active
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Your data is automatically saved to Firebase
            </p>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setShowSessionList(!showSessionList)}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Sessions ({sessions.length})</span>
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-1"
              disabled={isSaving}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>New Session</span>
            </button>
          </div>
        </div>

        {currentSession && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-blue-900">Current Session</h4>
                <p className="text-blue-800 font-semibold">{currentSession.name}</p>
                {currentSession.description && (
                  <p className="text-sm text-blue-700 mt-1">{currentSession.description}</p>
                )}
                <div className="text-xs text-blue-600 mt-2 space-x-4">
                  <span>Transactions: {currentSession.transactionCount}</span>
                  <span>Estimates: {currentSession.estimateCount}</span>
                  <span>Balance: {formatCurrency(currentSession.startingBalance)}</span>
                </div>
              </div>
              
              <button
                onClick={onClearSession}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
                disabled={isSaving}
              >
                Clear Data
              </button>
            </div>
          </div>
        )}

        {showSessionList && sessions.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Available Sessions</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    currentSession?.id === session.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => onLoadSession(session.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{session.name}</h5>
                      {session.description && (
                        <p className="text-sm text-gray-600 mt-1">{session.description}</p>
                      )}
                      <div className="text-xs text-gray-500 mt-2 space-x-3">
                        <span>Created: {new Date(session.createdAt).toLocaleDateString()}</span>
                        <span>Transactions: {session.transactionCount}</span>
                        <span>Estimates: {session.estimateCount}</span>
                      </div>
                    </div>
                    
                    {currentSession?.id === session.id && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <CreateSessionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={onCreateSession}
        isSaving={isSaving}
      />
    </>
  );
};

export default SessionManager;