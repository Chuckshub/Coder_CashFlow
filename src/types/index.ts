// Transaction data from CSV
export interface RawTransaction {
  Details: 'CREDIT' | 'DEBIT' | 'DSLIP';
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
  hash?: string; // Unique hash for duplicate detection
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
  weekNumber: number; // Week number this estimate applies to
  isRecurring: boolean;
  recurringType?: 'weekly' | 'bi-weekly' | 'monthly';
  monthlyDayOfMonth?: number; // For monthly recurring: day of month (1-31)
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
  actualBankBalance?: number; // User-entered actual bank balance for reconciliation
  estimates: Estimate[];
  transactions: Transaction[];
}

// Bank balance data for Firebase storage
export interface BankBalance {
  id: string; // Composite key: userId-weekNumber
  userId: string;
  weekNumber: number;
  actualBalance: number;
  createdAt: Date;
  updatedAt: Date;
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

// Accounts Receivable (AR) Integration Types
export interface AREstimate {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  dueDate: Date;
  estimatedCollectionDate: Date;
  confidence: 'high' | 'medium' | 'low';
  status: 'current' | 'overdue' | 'collections';
  paymentTerms: string;
  daysOverdue: number;
  weekNumber: number; // Which cashflow week this is expected to be collected
  source: 'campfire' | 'manual';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// AR Summary for dashboard display
export interface ARSummary {
  totalOutstanding: number;
  totalCurrent: number;
  totalOverdue: number;
  agingBuckets: {
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_over_90: number;
  };
  estimatedCollections: {
    thisWeek: number;
    next4Weeks: number;
    next13Weeks: number;
  };
  lastUpdated: Date;
}

// AR Configuration
export interface ARConfig {
  campfireApiKey?: string;
  autoRefreshInterval?: number; // minutes
  collectionAssumptions: {
    currentOnTime: number; // percentage collected on time
    overdueCollectionRate: number; // percentage of overdue that gets collected
    averageDelayDays: number; // average days late for collections
  };
  enabled: boolean;
}

// Enhanced Weekly Cashflow with AR data
export interface WeeklyCashflowWithAR extends WeeklyCashflow {
  arEstimates: AREstimate[];
  estimatedARInflow: number;
}

// Campfire API Types
export interface CampfireInvoiceLine {
  id: number;
  product_name: string;
  service_date: string;
  description: string;
  quantity: number;
  rate: number;
  currency: string;
  amount: number;
  tax: number;
  discount: number;
  discount_percentage: number;
  discount_amount: number;
  created_at: string;
  last_modified_at: string;
  product: number;
}

export interface CampfirePayment {
  id: number;
  credit_memo: any;
  payment_transaction_bank_description: string;
  payment_journal_entry_order: string;
  currency: string;
  amount: number;
  payment_date: string;
  created_at: string;
  voided_date: string | null;
  source: string;
  last_modified_at: string;
}

export interface CampfireInvoice {
  id: number;
  lines: CampfireInvoiceLine[];
  payments: CampfirePayment[];
  client_name: string;
  client_email: string | null;
  status: 'open' | 'paid' | 'past_due' | 'voided';
  past_due_days: number | null;
  entity_name: string;
  entity_currency: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  contract_name: string;
  invoice_number: string;
  item_date: string;
  invoice_date: string;
  due_date: string;
  paid_date: string | null;
  terms: string;
  currency: string;
  payment_status: 'open' | 'paid';
  created_at: string;
  last_modified_at: string;
}

export interface CampfireApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CampfireInvoice[];
}

// Client Payment Projection Types
export interface ClientPaymentProjection {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  expectedAmount: number;
  clientName: string;
  invoiceNumbers: string[];
  originalDueDate: Date;
  daysUntilDue: number; // Negative for overdue, positive for future due dates
  invoiceCount: number;
}

export interface WeeklyCashflowWithProjections extends WeeklyCashflow {
  projectedClientPayments?: number;
  clientPaymentProjections?: ClientPaymentProjection[];
}

// Enhanced Weekly Cashflow for Campfire integration
export interface CashflowProjections {
  clientPayments: ClientPaymentProjection[];
  totalProjectedAmount: number;
  invoiceCount: number;
  lastUpdated: Date;
}

// Client Payment Management Types (for Campfire integration)
export interface ClientPayment {
  id: string; // Firebase document ID
  campfireInvoiceId?: number; // Original Campfire invoice ID (if imported)
  clientName: string;
  invoiceNumber: string;
  originalAmount: number;
  amountDue: number;
  originalDueDate: Date;
  expectedPaymentDate: Date; // User can modify this
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
  daysUntilDue: number; // Negative for overdue, positive for future due dates
  description?: string;
  notes?: string;
  paymentTerms?: string;
  isImported: boolean; // Whether this came from Campfire or was manually created
  lastCampfireSync?: Date; // When this was last synced from Campfire
  createdAt: Date;
  updatedAt: Date;
}

// For the import process
export interface CampfireImportSummary {
  totalInvoices: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
  importedPayments: ClientPayment[];
}

// Status for the import process
export interface ImportStatus {
  isImporting: boolean;
  progress: number;
  message: string;
  lastImport?: Date;
}

// Beginning Balance Management
export interface BeginningBalance {
  id: string;
  userId: string;
  balance: number;
  isLocked: boolean;
  lastModified: Date;
  lastModifiedBy: string;
  notes?: string;
}