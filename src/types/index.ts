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

// Enhanced Estimate with scenario and specific week date
export interface Estimate {
  id: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  description: string;
  notes?: string;
  weekDate: Date; // specific week this estimate applies to
  scenario: string; // which scenario this estimate belongs to
  isRecurring: boolean;
  recurringType?: 'weekly' | 'bi-weekly' | 'monthly';
  createdAt: Date;
  updatedAt: Date;
}

// Rolling week status for continuous timeline
export type WeekStatus = 'past' | 'current' | 'future';

// Enhanced Weekly cashflow data with rolling timeline support
export interface WeeklyCashflow {
  weekNumber: number; // relative to current week (-4 to +8)
  weekStart: Date;
  weekEnd: Date;
  weekStatus: WeekStatus;
  
  // Actual data (for past/current weeks)
  actualInflow: number;
  actualOutflow: number;
  
  // Estimated data (for current/future weeks)
  estimatedInflow: number;
  estimatedOutflow: number;
  
  // Combined totals (actual OR estimated based on week status)
  totalInflow: number;
  totalOutflow: number;
  netCashflow: number;
  runningBalance: number;
  
  // Associated data
  transactions: Transaction[]; // actual transactions for this week
  estimates: Estimate[]; // estimates for this week in active scenario
  
  // Accuracy tracking (for past weeks)
  estimateAccuracy?: {
    inflowVariance: number; // % difference between estimated and actual
    outflowVariance: number;
  };
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