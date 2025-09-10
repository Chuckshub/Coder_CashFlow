import Papa from 'papaparse';
import { RawTransaction, Transaction } from '../types';
import { parse, isValid } from 'date-fns';
import { createTransactionHashFromRaw } from './transactionHash';

export const parseCSVFile = (file: File): Promise<RawTransaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header: string) => header.trim(),
      transform: (value: string, header: string) => {
        // Clean up the value
        const cleanValue = value ? value.trim() : '';
        
        // Handle amount field - remove commas and convert to number
        if (header === 'Amount') {
          if (!cleanValue) return 0;
          const numericValue = parseFloat(cleanValue.replace(/,/g, ''));
          return isNaN(numericValue) ? 0 : numericValue;
        }
        
        // Handle balance field
        if (header === 'Balance') {
          if (!cleanValue) return 0;
          const numericValue = parseFloat(cleanValue.replace(/,/g, ''));
          return isNaN(numericValue) ? 0 : numericValue;
        }
        
        return cleanValue;
      },
      // Allow flexible field counts
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '"',
      complete: (results) => {
        if (results.errors.length > 0) {
          // Filter out "too many fields" errors as they're expected with trailing commas
          const criticalErrors = results.errors.filter(error => 
            !error.message.includes('Too many fields')
          );
          
          if (criticalErrors.length > 0) {
            reject(new Error(`CSV parsing errors: ${criticalErrors.map(e => e.message).join(', ')}`));
            return;
          }
        }
        
        const validTransactions = results.data.filter((row: any) => {
          return row && 
                 row.Details && 
                 row['Posting Date'] && 
                 row.Description !== undefined &&
                 row.Description !== '';
        }) as RawTransaction[];
        
        resolve(validTransactions);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};

export const parseDate = (dateString: string): Date => {
  // Try different date formats
  const formats = [
    'MM/dd/yyyy',
    'M/d/yyyy', 
    'MM/dd/yy',
    'M/d/yy',
    'yyyy-MM-dd',
    'dd/MM/yyyy',
    'd/M/yyyy'
  ];
  
  for (const format of formats) {
    const parsedDate = parse(dateString, format, new Date());
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }
  
  // Fallback to native Date parsing
  const fallbackDate = new Date(dateString);
  if (isValid(fallbackDate)) {
    return fallbackDate;
  }
  
  throw new Error(`Unable to parse date: ${dateString}`);
};

export const validateCSVStructure = (data: any[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const requiredHeaders = ['Details', 'Posting Date', 'Description', 'Amount', 'Type', 'Balance'];
  
  if (!data || data.length === 0) {
    errors.push('CSV file is empty');
    return { isValid: false, errors };
  }
  
  const firstRow = data[0];
  const headers = Object.keys(firstRow);
  
  // Check for required headers
  requiredHeaders.forEach(header => {
    if (!headers.includes(header)) {
      errors.push(`Missing required header: ${header}`);
    }
  });
  
  // Validate data types in sample rows
  const sampleSize = Math.min(5, data.length);
  for (let i = 0; i < sampleSize; i++) {
    const row = data[i];
    
    if (row.Details && !['CREDIT', 'DEBIT'].includes(row.Details)) {
      errors.push(`Invalid Details value at row ${i + 1}: ${row.Details}`);
    }
    
    if (row.Amount && isNaN(parseFloat(String(row.Amount)))) {
      errors.push(`Invalid Amount value at row ${i + 1}: ${row.Amount}`);
    }
    
    if (row['Posting Date']) {
      try {
        parseDate(row['Posting Date']);
      } catch {
        errors.push(`Invalid date format at row ${i + 1}: ${row['Posting Date']}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const convertToTransaction = (rawTransaction: RawTransaction): Transaction => {
  const amount = Math.abs(rawTransaction.Amount);
  const isInflow = rawTransaction.Details === 'CREDIT' || rawTransaction.Amount > 0;
  
  return {
    id: `${rawTransaction['Posting Date']}-${rawTransaction.Description.substring(0, 20)}-${Math.random().toString(36).substring(2, 9)}`,
    hash: createTransactionHashFromRaw(rawTransaction),
    date: parseDate(rawTransaction['Posting Date']),
    description: rawTransaction.Description,
    amount: amount,
    type: isInflow ? 'inflow' : 'outflow',
    category: '', // Will be set by categorization logic
    balance: rawTransaction.Balance,
    originalData: rawTransaction
  };
};

export const getTransactionSummary = (transactions: RawTransaction[]) => {
  const summary = {
    totalTransactions: transactions.length,
    totalInflows: 0,
    totalOutflows: 0,
    netCashflow: 0,
    dateRange: {
      start: null as Date | null,
      end: null as Date | null
    },
    categories: {
      inflow: new Set<string>(),
      outflow: new Set<string>()
    }
  };
  
  transactions.forEach(transaction => {
    const amount = Math.abs(transaction.Amount);
    const date = parseDate(transaction['Posting Date']);
    
    if (transaction.Details === 'CREDIT' || transaction.Amount > 0) {
      summary.totalInflows += amount;
    } else {
      summary.totalOutflows += amount;
    }
    
    // Track date range
    if (!summary.dateRange.start || date < summary.dateRange.start) {
      summary.dateRange.start = date;
    }
    if (!summary.dateRange.end || date > summary.dateRange.end) {
      summary.dateRange.end = date;
    }
  });
  
  summary.netCashflow = summary.totalInflows - summary.totalOutflows;
  
  return summary;
};