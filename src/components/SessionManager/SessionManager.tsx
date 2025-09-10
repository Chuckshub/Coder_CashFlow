import React, { useState } from 'react';
import { FirebaseCashflowSession } from '../../services/firebase';
import { formatCurrency } from '../../utils/dateUtils';

interface SessionManagerProps {
  sessions: FirebaseCashflowSession[];
  currentSession: FirebaseCashflowSession | null;
  onCreateSession: (name: string, startingBalance: number) => Promise<void>;
  onRenameSession: (sessionId: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  onSwitchSession: (session: FirebaseCashflowSession) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
}

const SessionManager: React.FC<SessionManagerProps> = ({
  sessions,
  currentSession,
  onCreateSession,
  onRenameSession,
  onSwitchSession,
  isLoading,
  isSaving
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionBalance, setNewSessionBalance] = useState('');
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState('');

  const handleCreateSession = async () => {
    if (!newSessionName.trim() || !newSessionBalance.trim()) return;
    
    try {
      await onCreateSession(newSessionName.trim(), parseFloat(newSessionBalance));
      setNewSessionName('');
      setNewSessionBalance('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const startRenaming = (session: FirebaseCashflowSession) => {
    setEditingSession(session.id);
    setEditSessionName(session.name);
  };

  const handleRenameSession = async () => {
    if (!editingSession || !editSessionName.trim()) return;
    
    try {
      const result = await onRenameSession(editingSession, editSessionName.trim());
      if (result.success) {
        setEditingSession(null);
        setEditSessionName('');
      }
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  };

  const cancelRenaming = () => {
    setEditingSession(null);
    setEditSessionName('');
  };

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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              New Session
            </button>
          </div>
        </div>

        {currentSession && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-blue-900">Current Session</h4>
                  {editingSession !== currentSession.id && (
                    <button
                      onClick={() => startRenaming(currentSession)}
                      className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors"
                      title="Rename session"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {editingSession === currentSession.id ? (
                  <div className="mt-2 flex items-center space-x-2">
                    <input
                      type="text"
                      value={editSessionName}
                      onChange={(e) => setEditSessionName(e.target.value)}
                      className="flex-1 px-2 py-1 border border-blue-300 rounded text-blue-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && handleRenameSession()}
                      autoFocus
                    />
                    <button
                      onClick={handleRenameSession}
                      disabled={!editSessionName.trim() || isSaving}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelRenaming}
                      className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="text-blue-800 font-semibold">{currentSession.name}</p>
                )}
                
                {currentSession.description && (
                  <p className="text-sm text-blue-700 mt-1">{currentSession.description}</p>
                )}
                <div className="text-xs text-blue-600 mt-2 space-x-4">
                  <span>Transactions: {currentSession.transactionCount}</span>
                  <span>Estimates: {currentSession.estimateCount}</span>
                  <span>Balance: {formatCurrency(currentSession.startingBalance)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSessionList && sessions.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Available Sessions</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={async () => {
                    try {
                      await onSwitchSession(session);
                      setShowSessionList(false);
                    } catch (error) {
                      console.error('Failed to switch session:', error);
                    }
                  }}
                  className={`block w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                    currentSession?.id === session.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
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
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New Session</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCreateSession(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Name *
                </label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter session name"
                  disabled={isSaving}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Starting Balance *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={newSessionBalance}
                    onChange={(e) => setNewSessionBalance(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                    disabled={isSaving}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newSessionName.trim() || !newSessionBalance.trim() || isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SessionManager;