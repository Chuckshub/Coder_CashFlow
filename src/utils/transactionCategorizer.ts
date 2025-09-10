import { Transaction, InflowCategory, OutflowCategory } from '../types';

export const categorizeTransaction = (transaction: Transaction): Transaction => {
  const desc = transaction.description.toUpperCase();
  
  let category: string;
  let subcategory: string | undefined;
  
  if (transaction.type === 'inflow') {
    // Inflow categorization based on data analysis
    if (desc.includes('STRIPE')) {
      category = InflowCategory.PAYMENT_PROCESSING_REVENUE;
    } else if (
      desc.includes('ANTHROPIC') || 
      desc.includes('CANVA') || 
      desc.includes('SPLUNK') || 
      desc.includes('WAYVE') || 
      desc.includes('SIXWORKS') || 
      desc.includes('CGI IT')
    ) {
      category = InflowCategory.CLIENT_PAYMENTS;
      // Extract client name for subcategory
      if (desc.includes('ANTHROPIC')) subcategory = 'Anthropic';
      else if (desc.includes('CANVA')) subcategory = 'Canva';
      else if (desc.includes('SPLUNK')) subcategory = 'Splunk';
      else if (desc.includes('WAYVE')) subcategory = 'Wayve';
      else if (desc.includes('SIXWORKS')) subcategory = 'SixWorks';
      else if (desc.includes('CGI IT')) subcategory = 'CGI IT';
    } else if (desc.includes('REPAYMENT') || desc.includes('REIMBURSEMENT') || desc.includes('EXPENSES REPAYMENT')) {
      category = InflowCategory.EXPENSE_REIMBURSEMENT;
    } else if (desc.includes('PICTET') || desc.includes('BANQUE') || desc.includes('CITIBANK')) {
      category = InflowCategory.INVESTMENT_BANKING;
    } else {
      category = InflowCategory.OTHER_INCOME;
    }
  } else {
    // Outflow categorization based on requirements + data analysis
    if (desc.includes('RMPR')) {
      category = OutflowCategory.REIMBURSEMENT;
      // Extract person name if available
      const names = ['WEATHERFORD', 'BAYS', 'AHR', 'KRAMER', 'BRUHN'];
      const foundName = names.find(name => desc.includes(name));
      if (foundName) {
        subcategory = foundName.toLowerCase().replace(/^\w/, c => c.toUpperCase());
      }
    } else if (desc.includes('RAMP STATEMENT')) {
      category = OutflowCategory.RAMP_CC_PAYMENT;
    } else if (
      desc.includes('DEEL') || 
      desc.includes('PEOPLE CENTER') || 
      desc.includes('RIPPLING') ||
      desc.includes('PAYROLL')
    ) {
      category = OutflowCategory.PAYROLL;
      if (desc.includes('RIPPLING')) subcategory = 'Rippling';
      else if (desc.includes('DEEL')) subcategory = 'Deel';
    } else if (desc.includes('RAMP TRN')) {
      category = OutflowCategory.VENDOR_BILL_PAYMENT;
      
      // Extract vendor name for subcategory
      const vendors = [
        'OUTREACH', 'PINNACLE', 'ANTHROPIC', 'CBIZ', 'IT METHODS', 
        'LEADRABBIT', 'CANVA', 'SPLUNK', 'SIXWORKS'
      ];
      const foundVendor = vendors.find(vendor => desc.includes(vendor));
      if (foundVendor) {
        subcategory = foundVendor.toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    } else if (desc.includes('TAX') || desc.includes('IRS')) {
      category = OutflowCategory.TAX_PAYMENTS;
    } else {
      category = OutflowCategory.OTHER_OPERATING_EXPENSES;
    }
  }
  
  return {
    ...transaction,
    category,
    subcategory
  };
};

export const getCategoryRules = () => {
  return {
    inflow: {
      [InflowCategory.PAYMENT_PROCESSING_REVENUE]: ['STRIPE'],
      [InflowCategory.CLIENT_PAYMENTS]: [
        'ANTHROPIC', 'CANVA', 'SPLUNK', 'WAYVE', 'SIXWORKS', 'CGI IT'
      ],
      [InflowCategory.EXPENSE_REIMBURSEMENT]: [
        'REPAYMENT', 'REIMBURSEMENT', 'EXPENSES REPAYMENT'
      ],
      [InflowCategory.INVESTMENT_BANKING]: [
        'PICTET', 'BANQUE', 'CITIBANK'
      ]
    },
    outflow: {
      [OutflowCategory.REIMBURSEMENT]: ['RMPR'],
      [OutflowCategory.RAMP_CC_PAYMENT]: ['RAMP STATEMENT'],
      [OutflowCategory.PAYROLL]: ['DEEL', 'PEOPLE CENTER', 'RIPPLING', 'PAYROLL'],
      [OutflowCategory.VENDOR_BILL_PAYMENT]: ['RAMP TRN'],
      [OutflowCategory.TAX_PAYMENTS]: ['TAX', 'IRS']
    }
  };
};

export const categorizeTransactions = (transactions: Transaction[]): Transaction[] => {
  return transactions.map(categorizeTransaction);
};

export const getTransactionsByCategory = (transactions: Transaction[]) => {
  const categorized = {
    inflow: {} as Record<string, Transaction[]>,
    outflow: {} as Record<string, Transaction[]>
  };
  
  transactions.forEach(transaction => {
    const type = transaction.type;
    const category = transaction.category;
    
    if (!categorized[type][category]) {
      categorized[type][category] = [];
    }
    
    categorized[type][category].push(transaction);
  });
  
  return categorized;
};

export const getCategorySummary = (transactions: Transaction[]) => {
  const summary = {
    inflow: {} as Record<string, { count: number; total: number; subcategories: Record<string, number> }>,
    outflow: {} as Record<string, { count: number; total: number; subcategories: Record<string, number> }>
  };
  
  transactions.forEach(transaction => {
    const type = transaction.type;
    const category = transaction.category;
    const subcategory = transaction.subcategory || 'Other';
    
    if (!summary[type][category]) {
      summary[type][category] = {
        count: 0,
        total: 0,
        subcategories: {}
      };
    }
    
    summary[type][category].count += 1;
    summary[type][category].total += transaction.amount;
    
    if (!summary[type][category].subcategories[subcategory]) {
      summary[type][category].subcategories[subcategory] = 0;
    }
    summary[type][category].subcategories[subcategory] += transaction.amount;
  });
  
  return summary;
};

// Helper function to suggest category based on description
export const suggestCategory = (description: string, type: 'inflow' | 'outflow'): string[] => {
  const suggestions: string[] = [];
  const desc = description.toUpperCase();
  const rules = getCategoryRules();
  
  Object.entries(rules[type]).forEach(([category, keywords]) => {
    const matchCount = keywords.filter(keyword => desc.includes(keyword.toUpperCase())).length;
    if (matchCount > 0) {
      suggestions.push(category);
    }
  });
  
  return suggestions;
};