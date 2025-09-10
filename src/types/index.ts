// Transaction data from CSV
export interface RawTransaction {
  Details: 'CREDIT' | 'DEBIT';
  'Posting Date': string;
  Description: string;
  Amount: number;
  Type: string;
  Balance: number;
  'Check or Slip #': string;
}

// Processed transaction with categorization
export interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  subcategory?: string;
  balance: number;
  originalData: RawTransaction;
}

// Transaction categories based on requirements
export enum OutflowCategory {
  REIMBURSEMENT = 'Reimbursement',
  RAMP_CC_PAYMENT = 'Ramp CC Payment', 
  PAYROLL = 'Payroll',
  VENDOR_BILL_PAYMENT = 'Vendor Bill Payment',
  TAX_PAYMENTS = 'Tax Payments',
  OTHER_OPERATING_EXPENSES = 'Other Operating Expenses'
}

export enum InflowCategory {
  PAYMENT_PROCESSING_REVENUE = 'Payment Processing Revenue',
  CLIENT_PAYMENTS = 'Client Payments',
  EXPENSE_REIMBURSEMENT = 'Expense Reimbursement',
  INVESTMENT_BANKING = 'Investment/Banking',
  OTHER_INCOME = 'Other Income'
}

// Weekly cashflow data
export interface WeeklyCashflow {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  actualInflow: number;
  actualOutflow: number;
  estimatedInflow: number;
  estimatedOutflow: number;
  netCashflow: number;
  runningBalance: number;
  estimates: Estimate[];
}

// Estimate for cashflow projections
export interface Estimate {
  id: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  description: string;
  notes?: string;
  weekNumber: number;
  isRecurring: boolean;
  recurringType?: 'weekly' | 'bi-weekly' | 'monthly';
  createdAt: Date;
  updatedAt: Date;
}

// Application state
export interface AppState {
  transactions: Transaction[];
  weeklyCashflows: WeeklyCashflow[];
  estimates: Estimate[];
  categories: {
    inflow: string[];
    outflow: string[];
  };
  currentWeek: number;
  startingBalance: number;
}

// CSV upload state
export interface CSVUploadState {
  isUploading: boolean;
  isProcessing: boolean;
  error: string | null;
  previewData: RawTransaction[];
  fileName: string | null;
}

// Drag and drop types for estimates
export interface DragDropResult {
  draggableId: string;
  type: string;
  source: {
    droppableId: string;
    index: number;
  };
  destination?: {
    droppableId: string;
    index: number;
  } | null;
  reason: 'DROP' | 'CANCEL';
}

// Chart data for visualizations
export interface ChartDataPoint {
  week: string;
  inflow: number;
  outflow: number;
  netCashflow: number;
  runningBalance: number;
}

// Export functionality
export interface ExportOptions {
  format: 'csv' | 'pdf';
  dateRange: {
    start: Date;
    end: Date;
  };
  includeEstimates: boolean;
  includeActuals: boolean;
}