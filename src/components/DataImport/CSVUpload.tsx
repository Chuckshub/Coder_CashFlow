import React, { useState, useCallback, useRef } from 'react';
import { RawTransaction, CSVUploadState } from '../../types';
import { parseCSVFile, validateCSVStructure, getTransactionSummary } from '../../utils/csvParser';
import { formatCurrency } from '../../utils/dateUtils';

interface CSVUploadProps {
  onDataParsed?: (transactions: RawTransaction[]) => void;
  onError: (error: string) => void;
  onFileUpload?: (file: File) => Promise<void>; // New direct file upload handler
}

const CSVUpload: React.FC<CSVUploadProps> = ({ onDataParsed, onError, onFileUpload }) => {
  const [uploadState, setUploadState] = useState<CSVUploadState>({
    isUploading: false,
    isProcessing: false,
    error: null,
    previewData: [],
    fileName: null
  });
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fullData, setFullData] = useState<RawTransaction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      onError('Please select a CSV file');
      return;
    }
    
    // If direct file upload handler is provided, use that
    if (onFileUpload) {
      setUploadState(prev => ({
        ...prev,
        isUploading: true,
        error: null,
        fileName: file.name
      }));
      
      try {
        await onFileUpload(file);
        setUploadState({
          isUploading: false,
          isProcessing: false,
          error: null,
          previewData: [],
          fileName: null
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          error: errorMessage
        }));
        onError(errorMessage);
      }
      return;
    }
    
    // Legacy preview-based approach
    setUploadState(prev => ({
      ...prev,
      isUploading: true,
      error: null,
      fileName: file.name
    }));
    
    try {
      const rawTransactions = await parseCSVFile(file);
      
      // Validate structure
      const validation = validateCSVStructure(rawTransactions);
      if (!validation.isValid) {
        throw new Error(`Invalid CSV structure: ${validation.errors.join(', ')}`);
      }
      
      console.log('✅ Parsed', rawTransactions.length, 'transactions, setting fullData and preview');
      
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        previewData: rawTransactions.slice(0, 10), // Show first 10 for preview
      }));
      
      setFullData(rawTransactions); // 🔧 FIX: Store all transactions for Import Data
      setShowPreview(true);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage
      }));
      onError(errorMessage);
    }
  }, [onError, onFileUpload]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);
  
  const handleConfirmData = () => {
    console.log('💆 Import Data button clicked!');
    console.log('📊 fullData.length:', fullData.length);
    console.log('🔗 onDataParsed exists:', !!onDataParsed);
    
    if (fullData.length > 0 && onDataParsed) {
      console.log('✅ Calling onDataParsed with', fullData.length, 'transactions');
      setUploadState(prev => ({ ...prev, isProcessing: true }));
      
      try {
        onDataParsed(fullData);
        setShowPreview(false);
        setUploadState({
          isUploading: false,
          isProcessing: false,
          error: null,
          previewData: [],
          fileName: null
        });
        setFullData([]);
        
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Processing failed';
        console.error('💥 Error in handleConfirmData:', error);
        onError(errorMessage);
        setUploadState(prev => ({ ...prev, isProcessing: false, error: errorMessage }));
      }
    } else {
      console.warn('⚠️ Import Data conditions not met:', {
        fullDataLength: fullData.length,
        onDataParsedExists: !!onDataParsed
      });
    }
  };
  
  const getSummary = () => {
    if (fullData.length === 0) return null;
    
    try {
      return getTransactionSummary(fullData);
    } catch {
      return null;
    }
  };
  
  const summary = getSummary();

  if (showPreview && uploadState.previewData.length > 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Data Preview: {uploadState.fileName}
          </h3>
          
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-lg font-semibold">{summary.totalTransactions}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Inflows</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(summary.totalInflows)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Outflows</p>
                <p className="text-lg font-semibold text-red-600">
                  {formatCurrency(summary.totalOutflows)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Net Cashflow</p>
                <p className={`text-lg font-semibold ${
                  summary.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(summary.netCashflow)}
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3">Sample Data (First 10 transactions)</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    Description
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {uploadState.previewData.map((transaction, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-sm text-gray-900 border-b">
                      {transaction['Posting Date']}
                    </td>
                    <td className="px-4 py-2 text-sm border-b">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.Details === 'CREDIT' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.Details}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 border-b max-w-xs truncate" title={transaction.Description}>
                      {transaction.Description}
                    </td>
                    <td className={`px-4 py-2 text-sm text-right font-medium border-b ${
                      transaction.Amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(Math.abs(transaction.Amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => setShowPreview(false)}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmData}
            disabled={uploadState.isProcessing}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadState.isProcessing ? 'Processing...' : 'Import Data'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {uploadState.isUploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Processing CSV file...</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Upload Transaction Data
            </h3>
            
            <p className="text-gray-600 mb-4">
              Drag and drop your CSV file here, or click to select a file
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            
            <label
              htmlFor="csv-upload"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition-colors"
            >
              Select CSV File
            </label>
            
            <p className="text-xs text-gray-500 mt-4">
              Supported format: Chase bank CSV export
            </p>
          </>
        )}
      </div>
      
      {uploadState.error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                {uploadState.error}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CSVUpload;