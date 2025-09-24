import React, { useState, useMemo } from 'react';
import { Transaction } from '../../types';
import { getSharedFirebaseService } from '../../services/firebaseServiceSharedWrapper';
import { useAuth } from '../../contexts/AuthContext';
import { areTransactionsSimilar } from '../../utils/smartDuplicateDetection';
import { formatCurrency } from '../../utils/dateUtils';

interface DataManagementProps {
  className?: string;
  transactions: Transaction[];
  onTransactionUpdate: (transaction: Transaction) => void;
  onTransactionDelete: (transactionId: string) => void;
}

interface FilterState {
  searchTerm: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  category: string;
}

interface SimilarGroup {
  transactions: Transaction[];
  similarity: number;
}

const DataManagement: React.FC<DataManagementProps> = ({ 
  className = '', 
  transactions,
  onTransactionUpdate,
  onTransactionDelete
}) => {
  const { currentUser } = useAuth();
  const [error, setError] = useState<string>('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '0.00',
    maxAmount: '999999.00',
    category: ''
  });
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  // Find similar transaction groups for duplicate highlighting
  const similarGroups = useMemo(() => {
    const groups: SimilarGroup[] = [];
    const processed = new Set<string>();

    transactions.forEach((trans1, i) => {
      if (processed.has(trans1.id)) return;

      const similar: Transaction[] = [trans1];
      processed.add(trans1.id);

      transactions.forEach((trans2, j) => {
        if (i === j || processed.has(trans2.id)) return;

        if (areTransactionsSimilar(trans1, trans2, {
          maxDateDifferenceHours: 72,
          descriptionSimilarityThreshold: 0.8, // Slightly lower threshold for highlighting
          allowAmountVariance: 0
        })) {
          similar.push(trans2);
          processed.add(trans2.id);
        }
      });

      if (similar.length > 1) {
        groups.push({ transactions: similar, similarity: 0.8 });
      }
    });

    return groups;
  }, [transactions]);

  // Get set of transaction IDs that are part of similar groups
  const duplicateTransactionIds = useMemo(() => {
    const ids = new Set<string>();
    similarGroups.forEach(group => {
      group.transactions.forEach(trans => ids.add(trans.id));
    });
    return ids;
  }, [similarGroups]);

  // Filter transactions based on current filters
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply duplicate filter first
    if (showDuplicatesOnly) {
      filtered = filtered.filter(trans => duplicateTransactionIds.has(trans.id));
    }

    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(trans => 
        trans.description.toLowerCase().includes(searchLower) ||
        trans.category.toLowerCase().includes(searchLower) ||
        trans.id.toLowerCase().includes(searchLower)
      );
    }

    // Date filters
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(trans => trans.date >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      filtered = filtered.filter(trans => trans.date <= toDate);
    }

    // Amount filters
    if (filters.minAmount) {
      const minAmount = parseFloat(filters.minAmount);
      if (!isNaN(minAmount)) {
        filtered = filtered.filter(trans => Math.abs(trans.amount) >= minAmount);
      }
    }
    if (filters.maxAmount) {
      const maxAmount = parseFloat(filters.maxAmount);
      if (!isNaN(maxAmount)) {
        filtered = filtered.filter(trans => Math.abs(trans.amount) <= maxAmount);
      }
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter(trans => trans.category === filters.category);
    }

    return filtered;
  }, [transactions, filters, showDuplicatesOnly, duplicateTransactionIds]);

  // Get unique categories for filter dropdown
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(transactions.map(t => t.category)))
      .filter(cat => cat && cat.trim())
      .sort();
    return uniqueCategories;
  }, [transactions]);

  // Handle individual transaction deletion
  const handleDeleteTransaction = async (transactionHash: string) => {
    if (!currentUser) return;

    setDeleting(prev => new Set(prev).add(transactionHash));
    try {
      const firebaseService = getSharedFirebaseService(currentUser.uid);
      const result = await firebaseService.deleteTransaction(transactionHash);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete transaction');
      }
      
      // Remove from local state using hash to find the transaction
      const transactionToDelete = transactions.find(t => t.hash === transactionHash);
      if (transactionToDelete) {
        onTransactionDelete(transactionToDelete.id);
      }
      setSelectedTransactions(prev => {
        const newSet = new Set(prev);
        // Remove by hash, but selected transactions are stored by hash now
        newSet.delete(transactionHash);
        return newSet;
      });
      
      console.log(`✅ Deleted transaction: ${transactionHash}`);
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError(`Failed to delete transaction: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeleting(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionHash);
        return newSet;
      });
      setShowDeleteConfirm(null);
    }
  };

  // Handle bulk deletion
  const handleBulkDelete = async () => {
    if (!currentUser || selectedTransactions.size === 0) return;

    const transactionHashes = Array.from(selectedTransactions);
    console.log(`🗑️ Bulk deleting ${transactionHashes.length} transactions`);

    setDeleting(new Set(transactionHashes));
    try {
      const firebaseService = getSharedFirebaseService(currentUser.uid);
      
      // Delete transactions in parallel using hashes
      const results = await Promise.all(
        transactionHashes.map(hash => firebaseService.deleteTransaction(hash))
      );
      
      // Check for any failures
      const failures = results.filter(result => !result.success);
      if (failures.length > 0) {
        console.error('Some deletions failed:', failures);
        setError(`Failed to delete ${failures.length} transactions`);
      }
      
      // Remove successfully deleted transactions from local state using hashes
      const successfulHashes = transactionHashes.filter((hash, index) => results[index].success);
      successfulHashes.forEach(hash => {
        const transactionToDelete = transactions.find(t => t.hash === hash);
        if (transactionToDelete) {
          onTransactionDelete(transactionToDelete.id);
        }
      });
      setSelectedTransactions(new Set());
      
      console.log(`✅ Bulk deleted ${successfulHashes.length} transactions`);
    } catch (err) {
      console.error('Error bulk deleting transactions:', err);
      setError(`Failed to delete transactions: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeleting(new Set());
    }
  };

  // Toggle transaction selection
  const toggleTransactionSelection = (transactionHash: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionHash)) {
        newSet.delete(transactionHash);
      } else {
        newSet.add(transactionHash);
      }
      return newSet;
    });
  };

  // Select all filtered transactions
  const selectAllFiltered = () => {
    const allHashes = new Set(filteredTransactions.filter(t => t.hash).map(t => t.hash!));
    setSelectedTransactions(allHashes);
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedTransactions(new Set());
  };

  // Update filter
  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      searchTerm: '',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      category: ''
    });
    setShowDuplicatesOnly(false);
  };

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Transaction Data Management</h1>
        <p className="text-gray-600">
          Manage your Firebase transactions. Total: {transactions.length} transactions
          {similarGroups.length > 0 && (
            <span className="ml-2 text-amber-600">
              • {duplicateTransactionIds.size} potential duplicates in {similarGroups.length} groups
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Description/Category/ID
            </label>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              placeholder="Search transactions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date From
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date To
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Amount
            </label>
            <input
              type="number"
              value={filters.minAmount}
              onChange={(e) => updateFilter('minAmount', e.target.value)}
              placeholder="0.00"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Amount
            </label>
            <input
              type="number"
              value={filters.maxAmount}
              onChange={(e) => updateFilter('maxAmount', e.target.value)}
              placeholder="999999.00"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => updateFilter('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={clearAllFilters}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Clear All Filters
          </button>
          
          <button
            onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
            className={`px-3 py-1 text-sm rounded ${
              showDuplicatesOnly
                ? 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {showDuplicatesOnly ? '✅ Show All' : '🔍 Show Duplicates Only'}
            {duplicateTransactionIds.size > 0 && ` (${duplicateTransactionIds.size})`}
          </button>
        </div>
      </div>

      {/* Selection Controls */}
      {filteredTransactions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-blue-50 rounded">
          <span className="text-sm font-medium text-gray-700">
            {selectedTransactions.size} of {filteredTransactions.length} selected
          </span>
          
          <button
            onClick={selectAllFiltered}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Select All Filtered
          </button>
          
          <button
            onClick={clearAllSelections}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Clear Selection
          </button>
          
          {selectedTransactions.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deleting.size > 0}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
            >
              {deleting.size > 0 ? 'Deleting...' : `Delete ${selectedTransactions.size} Selected`}
            </button>
          )}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Select
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {showDuplicatesOnly 
                      ? 'No duplicate transactions found with current filters'
                      : 'No transactions found with current filters'
                    }
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => {
                  const isSelected = transaction.hash ? selectedTransactions.has(transaction.hash) : false;
                  const isDuplicate = duplicateTransactionIds.has(transaction.id);
                  const isDeleting = transaction.hash ? deleting.has(transaction.hash) : false;
                  
                  return (
                    <tr
                      key={transaction.hash || transaction.id}
                      className={`hover:bg-gray-50 ${
                        isDuplicate ? 'bg-amber-50 border-l-4 border-amber-400' : ''
                      } ${
                        isSelected ? 'bg-blue-50' : ''
                      } ${
                        isDeleting ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => transaction.hash && toggleTransactionSelection(transaction.hash)}
                          disabled={isDeleting || !transaction.hash}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.date.toLocaleDateString()}
                        {isDuplicate && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            Potential Duplicate
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span className={transaction.type === 'inflow' ? 'text-green-600' : 'text-red-600'}>
                          {transaction.type === 'inflow' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={transaction.description}>
                        {transaction.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {transaction.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => transaction.hash && setShowDeleteConfirm(transaction.hash)}
                          disabled={isDeleting || !transaction.hash}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          {isDeleting ? '⏳' : '🗑️'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredTransactions.length} of {transactions.length} transactions
        {similarGroups.length > 0 && (
          <div className="mt-2">
            <strong>Duplicate Groups Found:</strong>
            {similarGroups.map((group, index) => (
              <div key={index} className="ml-4 text-amber-700">
                Group {index + 1}: {group.transactions.length} similar transactions (${formatCurrency(group.transactions[0].amount)})
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-2">Delete Transaction</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this transaction? This action cannot be undone.
                </p>
                {(() => {
                  const trans = transactions.find(t => t.hash === showDeleteConfirm);
                  return trans ? (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-left">
                      <div className="text-sm font-medium">{trans.date.toLocaleDateString()}</div>
                      <div className="text-sm text-gray-600">{formatCurrency(Math.abs(trans.amount))}</div>
                      <div className="text-xs text-gray-500 truncate">{trans.description}</div>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={() => handleDeleteTransaction(showDeleteConfirm)}
                  className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-24 mr-2 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-24 hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataManagement;