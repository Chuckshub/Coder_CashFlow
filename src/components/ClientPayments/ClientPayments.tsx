import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getClientPaymentService } from '../../services/clientPaymentService';
import { getCampfireService } from '../../services/campfireService';
import { ClientPayment, CampfireInvoice, CampfireImportSummary, ImportStatus } from '../../types';
import { formatCurrency } from '../../utils/dateUtils';

interface ClientPaymentRowProps {
  payment: ClientPayment;
  onUpdate: (id: string, updates: Partial<ClientPayment>) => void;
  onDelete: (id: string) => void;
}

const ClientPaymentRow: React.FC<ClientPaymentRowProps> = ({ payment, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDate, setEditedDate] = useState(
    payment.expectedPaymentDate.toISOString().split('T')[0]
  );
  const [editedStatus, setEditedStatus] = useState(payment.status);
  const [editedConfidence, setEditedConfidence] = useState(payment.confidence);
  const [editedNotes, setEditedNotes] = useState(payment.notes || '');

  const handleSave = () => {
    onUpdate(payment.id, {
      expectedPaymentDate: new Date(editedDate),
      status: editedStatus,
      confidence: editedConfidence,
      notes: editedNotes.trim() || undefined
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedDate(payment.expectedPaymentDate.toISOString().split('T')[0]);
    setEditedStatus(payment.status);
    setEditedConfidence(payment.confidence);
    setEditedNotes(payment.notes || '');
    setIsEditing(false);
  };

  const getStatusColor = (status: ClientPayment['status']) => {
    switch (status) {
      case 'pending': return 'text-blue-600';
      case 'partially_paid': return 'text-yellow-600';
      case 'paid': return 'text-green-600';
      case 'overdue': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConfidenceColor = (confidence: ClientPayment['confidence']) => {
    switch (confidence) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 border-r border-gray-200">
        <div>
          <div className="font-medium text-gray-900">{payment.clientName}</div>
          <div className="text-sm text-gray-500">
            {payment.invoiceNumber}
            {payment.isImported && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                🔥 Campfire
              </span>
            )}
          </div>
        </div>
      </td>
      
      <td className="px-4 py-3 text-right border-r border-gray-200">
        <div className="font-medium">{formatCurrency(payment.amountDue)}</div>
        {payment.originalAmount !== payment.amountDue && (
          <div className="text-xs text-gray-500">
            Orig: {formatCurrency(payment.originalAmount)}
          </div>
        )}
      </td>
      
      <td className="px-4 py-3 text-center border-r border-gray-200">
        <div className="text-sm text-gray-600">
          {payment.originalDueDate.toLocaleDateString()}
        </div>
      </td>
      
      <td className="px-4 py-3 text-center border-r border-gray-200">
        {isEditing ? (
          <input
            type="date"
            value={editedDate}
            onChange={(e) => setEditedDate(e.target.value)}
            className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="text-sm font-medium">
            {payment.expectedPaymentDate.toLocaleDateString()}
          </div>
        )}
      </td>
      
      <td className="px-4 py-3 text-center border-r border-gray-200">
        {isEditing ? (
          <select
            value={editedStatus}
            onChange={(e) => setEditedStatus(e.target.value as ClientPayment['status'])}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="pending">Pending</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        ) : (
          <span className={`text-sm font-medium ${getStatusColor(payment.status)}`}>
            {payment.status.replace('_', ' ')}
          </span>
        )}
      </td>
      
      <td className="px-4 py-3 text-center border-r border-gray-200">
        {isEditing ? (
          <select
            value={editedConfidence}
            onChange={(e) => setEditedConfidence(e.target.value as ClientPayment['confidence'])}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        ) : (
          <span className={`text-sm font-medium ${getConfidenceColor(payment.confidence)}`}>
            {payment.confidence}
          </span>
        )}
      </td>
      
      <td className="px-4 py-3 border-r border-gray-200">
        {isEditing ? (
          <input
            type="text"
            value={editedNotes}
            onChange={(e) => setEditedNotes(e.target.value)}
            placeholder="Add notes..."
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="text-sm text-gray-600">
            {payment.notes || '—'}
          </div>
        )}
      </td>
      
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(payment.id)}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

const ClientPayments: React.FC = () => {
  const { currentUser } = useAuth();
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    isImporting: false,
    progress: 0,
    message: ''
  });
  const [lastImportSummary, setLastImportSummary] = useState<CampfireImportSummary | null>(null);
  
  // Connection test state
  const [connectionTest, setConnectionTest] = useState<{
    testing: boolean;
    result: { success: boolean; message: string; invoiceCount?: number } | null;
  }>({ testing: false, result: null });
  
  // Live invoice data state
  const [invoiceData, setInvoiceData] = useState<{
    loading: boolean;
    invoices: CampfireInvoice[];
    error: string | null;
    lastFetched: Date | null;
  }>({ loading: false, invoices: [], error: null, lastFetched: null });
  const [error, setError] = useState<string | null>(null);

  const clientPaymentService = getClientPaymentService(currentUser?.uid || '');
  const campfireService = getCampfireService();

  // Load payments on component mount
  useEffect(() => {
    loadPayments();
  }, [currentUser]);

  const loadPayments = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError(null);
      const loadedPayments = await clientPaymentService.getClientPayments();
      setPayments(loadedPayments);
    } catch (error) {
      console.error('Error loading payments:', error);
      setError('Failed to load client payments');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromCampfire = async () => {
    if (!campfireService.isConfigured()) {
      setError('Campfire API is not configured. Please set your API key.');
      return;
    }

    setImportStatus({
      isImporting: true,
      progress: 0,
      message: 'Connecting to Campfire...'
    });

    try {
      // Test connection first
      const connectionTest = await campfireService.testConnection();
      if (!connectionTest.success) {
        throw new Error(connectionTest.message);
      }

      setImportStatus(prev => ({ ...prev, progress: 25, message: 'Fetching invoices...' }));
      
      // Import invoices
      const summary = await clientPaymentService.importFromCampfire();
      
      setImportStatus(prev => ({ ...prev, progress: 75, message: 'Processing invoices...' }));
      
      // Refresh the payments list
      await loadPayments();
      
      setImportStatus({
        isImporting: false,
        progress: 100,
        message: `Import completed: ${summary.importedCount} imported, ${summary.skippedCount} skipped`,
        lastImport: new Date()
      });
      
      setLastImportSummary(summary);
      
    } catch (error) {
      console.error('Import error:', error);
      setImportStatus({
        isImporting: false,
        progress: 0,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setError(error instanceof Error ? error.message : 'Import failed');
    }
  };

  const handleUpdatePayment = async (id: string, updates: Partial<ClientPayment>) => {
    try {
      await clientPaymentService.updateClientPayment(id, updates);
      await loadPayments(); // Refresh the list
    } catch (error) {
      console.error('Error updating payment:', error);
      setError('Failed to update payment');
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this client payment?')) {
      return;
    }

    try {
      await clientPaymentService.deleteClientPayment(id);
      await loadPayments(); // Refresh the list
    } catch (error) {
      console.error('Error deleting payment:', error);
      setError('Failed to delete payment');
    }
  };

  const handleConnectionTest = async () => {
    console.log('🧪 Testing Campfire API connection...');
    setConnectionTest({ testing: true, result: null });
    
    try {
      const result = await campfireService.testConnection();
      console.log('📄 Connection test result:', result);
      setConnectionTest({ testing: false, result });
    } catch (error) {
      console.error('💥 Connection test failed:', error);
      setConnectionTest({ 
        testing: false, 
        result: { 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        } 
      });
    }
  };

  const handleFetchInvoices = async () => {
    console.log('🔥 Fetching live invoice data from Campfire...');
    setInvoiceData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const invoices = await campfireService.fetchAllOpenInvoices();
      console.log(`📄 Fetched ${invoices.length} open invoices`);
      
      setInvoiceData({
        loading: false,
        invoices,
        error: null,
        lastFetched: new Date()
      });
      
    } catch (error) {
      console.error('💥 Failed to fetch invoices:', error);
      setInvoiceData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  const activePayments = payments.filter(p => 
    p.status === 'pending' || p.status === 'overdue' || p.status === 'partially_paid'
  );
  const totalActiveAmount = activePayments.reduce((sum, p) => sum + p.amountDue, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading client payments...</span>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Campfire Invoice Data</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage invoice projections and import data from Campfire API
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={loadPayments}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            🔄 Refresh
          </button>
          <button
            onClick={handleImportFromCampfire}
            disabled={importStatus.isImporting || !campfireService.isConfigured()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {importStatus.isImporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Importing...
              </>
            ) : (
              <>
                🔥 Import from Campfire
              </>
            )}
          </button>
        </div>
      </div>

      {/* Import Status */}
      {(importStatus.message || importStatus.isImporting) && (
        <div className={`p-4 rounded-md ${
          error ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-center">
            {importStatus.isImporting && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            )}
            <div className={`text-sm font-medium ${
              error ? 'text-red-800' : 'text-blue-800'
            }`}>
              {importStatus.message}
            </div>
          </div>
          {importStatus.isImporting && importStatus.progress > 0 && (
            <div className="mt-2">
              <div className="bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importStatus.progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Total Payments</div>
          <div className="text-lg font-semibold text-gray-900">{payments.length}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-600">Active Payments</div>
          <div className="text-lg font-semibold text-blue-800">{activePayments.length}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm text-green-600">Total Expected</div>
          <div className="text-lg font-semibold text-green-800">{formatCurrency(totalActiveAmount)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="text-sm text-yellow-600">Last Import</div>
          <div className="text-lg font-semibold text-yellow-800">
            {importStatus.lastImport ? importStatus.lastImport.toLocaleDateString() : 'Never'}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Client / Invoice
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Amount Due
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Original Due
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Expected Payment
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Confidence
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Notes
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="text-4xl mb-2">💰</div>
                      <div className="text-lg font-medium mb-1">No client payments found</div>
                      <div className="text-sm">
                        {campfireService.isConfigured() ? 
                          'Click "Import from Campfire" to get started' : 
                          'Configure Campfire API key to import invoices'
                        }
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map(payment => (
                  <ClientPaymentRow
                    key={payment.id}
                    payment={payment}
                    onUpdate={handleUpdatePayment}
                    onDelete={handleDeletePayment}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Summary */}
      {lastImportSummary && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Last Import Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Invoices</div>
              <div className="font-semibold">{lastImportSummary.totalInvoices}</div>
            </div>
            <div>
              <div className="text-gray-600">Imported</div>
              <div className="font-semibold text-green-600">{lastImportSummary.importedCount}</div>
            </div>
            <div>
              <div className="text-gray-600">Skipped</div>
              <div className="font-semibold text-yellow-600">{lastImportSummary.skippedCount}</div>
            </div>
            <div>
              <div className="text-gray-600">Errors</div>
              <div className="font-semibold text-red-600">{lastImportSummary.errors.length}</div>
            </div>
          </div>
          {lastImportSummary.errors.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-red-600">
                <div className="font-medium">Errors:</div>
                <ul className="list-disc list-inside mt-1">
                  {lastImportSummary.errors.slice(0, 3).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {lastImportSummary.errors.length > 3 && (
                    <li>... and {lastImportSummary.errors.length - 3} more</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connection Test Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900">API Connection</h3>
          <button
            onClick={handleConnectionTest}
            disabled={connectionTest.testing}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {connectionTest.testing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Testing...
              </>
            ) : (
              <>
                🧪 Test Connection
              </>
            )}
          </button>
        </div>
        
        {connectionTest.result && (
          <div className={`p-3 rounded-md ${
            connectionTest.result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center">
              <span className={`text-sm font-medium ${
                connectionTest.result.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {connectionTest.result.success ? '✅ Success' : '❌ Failed'}
              </span>
            </div>
            <p className={`text-sm mt-1 ${
              connectionTest.result.success ? 'text-green-700' : 'text-red-700'
            }`}>
              {connectionTest.result.message}
              {connectionTest.result.success && connectionTest.result.invoiceCount && (
                <span> | Found {connectionTest.result.invoiceCount} total invoices</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Live Invoice Data Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Live Invoice Data</h3>
            <p className="text-sm text-gray-600">
              {invoiceData.lastFetched ? 
                `Last updated: ${invoiceData.lastFetched.toLocaleTimeString()}` : 
                'Fetch invoices to see live data from Campfire'
              }
            </p>
          </div>
          <button
            onClick={handleFetchInvoices}
            disabled={invoiceData.loading || !campfireService.isConfigured()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {invoiceData.loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading...
              </>
            ) : (
              <>
                🔥 Fetch Invoices
              </>
            )}
          </button>
        </div>
        
        {invoiceData.error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 mb-3">
            <p className="text-sm text-red-700">❌ Error: {invoiceData.error}</p>
          </div>
        )}
        
        {invoiceData.invoices.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="font-medium text-gray-900">
                  {invoiceData.invoices.length} Open Invoices
                </p>
                <p className="text-sm text-gray-600">
                  Total Outstanding: {formatCurrency(invoiceData.invoices.reduce((sum, inv) => sum + inv.amount_due, 0))}
                </p>
              </div>
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              <div className="grid gap-2">
                {invoiceData.invoices.slice(0, 10).map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md text-sm">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{invoice.client_name}</span>
                        <span className="text-gray-500">#{invoice.invoice_number}</span>
                      </div>
                      <div className="text-gray-600 text-xs mt-1">
                        Due: {new Date(invoice.due_date).toLocaleDateString()} 
                        {invoice.past_due_days && invoice.past_due_days > 0 && (
                          <span className="text-red-600 ml-2">({invoice.past_due_days} days overdue)</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(invoice.amount_due)}</div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        invoice.status === 'open' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'past_due' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {invoice.status === 'past_due' ? 'Overdue' : 'Open'}
                      </div>
                    </div>
                  </div>
                ))}
                
                {invoiceData.invoices.length > 10 && (
                  <div className="text-center p-2 text-gray-500 text-sm">
                    ... and {invoiceData.invoices.length - 10} more invoices
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientPayments;