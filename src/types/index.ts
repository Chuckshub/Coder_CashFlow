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
  hash: string; // Unique hash for duplicate detection
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

// Enhanced Cashflow Session with continuous timeline support
export interface CashflowSession {
  id: string;
  name: string;
  description: string;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  scenarios: string[];
  activeScenario: string;
  startingBalance: number;
  transactionCount: number;
  estimateCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Estimate for cashflow projections
export interface Estimate {
  id: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  description: string;
  notes?: string;
  weekDate: Date; // Date of the week this estimate applies to
  scenario: string; // Scenario identifier (e.g., 'base', 'optimistic', 'pessimistic')
  isRecurring: boolean;
  recurringType?: 'weekly' | 'bi-weekly' | 'monthly';
  createdAt: Date;
  updatedAt: Date;
}

// Rolling week status for continuous timeline
export type WeekStatus = 'past' | 'current' | 'future';

// Weekly cashflow data
export interface WeeklyCashflow {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  weekStatus: WeekStatus;
  actualInflow: number;
  actualOutflow: number;
  estimatedInflow: number;
  estimatedOutflow: number;
  totalInflow: number;
  totalOutflow: number;
  netCashflow: number;
  runningBalance: number;
  estimates: Estimate[];
  transactions: Transaction[];
}

// Rolling week structure
export interface RollingWeek {
  weekNumber: number; // -1, 0, 1, 2, ..., 13
  weekStart: Date;
  weekEnd: Date;
  status: WeekStatus;
  label: string; // "Last Week", "Current Week", "Week +1", etc.
}

// Scenario comparison data
export interface ScenarioComparison {
  weekDate: Date;
  scenarios: {
    [scenarioName: string]: {
      inflow: number;
      outflow: number;
      netCashflow: number;
      runningBalance: number;
    };
  };
}

// Rolling timeline configuration
export interface RollingTimelineConfig {
  pastWeeks: number; // how many past weeks to show
  futureWeeks: number; // how many future weeks to show
  currentDate: Date; // anchor date for the timeline
}

// Enhanced application state for continuous model
export interface AppState {
  transactions: Transaction[];
  estimates: Estimate[];
  weeklyCashflows: WeeklyCashflow[];
  activeScenario: string;
  availableScenarios: string[];
  rollingConfig: RollingTimelineConfig;
  categories: {
    inflow: string[];
    outflow: string[];
  };
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