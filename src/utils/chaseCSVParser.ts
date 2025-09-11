import Papa from 'papaparse';

interface ChaseTransaction {
  Details: string;        // CREDIT or DEBIT
  'Posting Date': string; // MM/DD/YYYY
  Description: string;    // Transaction description
  Amount: string;         // Dollar amount as string
  Type: string;          // Transaction type
  Balance: string;       // Account balance as string
  'Check or Slip #': string; // Check number
}

export interface ParsedTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  balance: number;
  category: string;
  originalData: any; // Flexible for compatibility
}

export const parseChaseCSV = async (file: File): Promise<ParsedTransaction[]> => {
  console.log('📄 Starting Chase CSV parse for file:', file.name, file.size, 'bytes');
  
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        try {
          console.log('📊 CSV parse completed, raw data rows:', results.data.length);
          
          if (results.errors.length > 0) {
            console.warn('⚠️ CSV parse warnings:', results.errors);
          }
          
          const rawData = results.data as ChaseTransaction[];
          const transactions: ParsedTransaction[] = [];
          
          rawData.forEach((row, index) => {
            try {
              // Skip empty or invalid rows
              if (!row.Details || !row['Posting Date'] || !row.Description) {
                console.log(`⏭️ Skipping invalid row ${index + 1}:`, row);
                return;
              }
              
              // Parse date
              const dateParts = row['Posting Date'].split('/');
              if (dateParts.length !== 3) {
                console.warn(`⚠️ Invalid date format in row ${index + 1}:`, row['Posting Date']);
                return;
              }
              
              const month = parseInt(dateParts[0]) - 1; // JS months are 0-based
              const day = parseInt(dateParts[1]);
              const year = parseInt(dateParts[2]);
              const date = new Date(year, month, day);
              
              // Parse amount - remove commas and convert to number
              const amountStr = row.Amount.replace(/,/g, '');
              const amount = Math.abs(parseFloat(amountStr));
              
              if (isNaN(amount)) {
                console.warn(`⚠️ Invalid amount in row ${index + 1}:`, row.Amount);
                return;
              }
              
              // Parse balance
              const balanceStr = row.Balance.replace(/,/g, '');
              const balance = parseFloat(balanceStr) || 0;
              
              // Determine transaction type
              const type: 'inflow' | 'outflow' = row.Details === 'CREDIT' ? 'inflow' : 'outflow';
              
              // Generate unique ID
              const id = `${row['Posting Date']}-${row.Description.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substring(2, 9)}`;
              
              // Basic categorization
              let category = 'Other';
              const desc = row.Description.toUpperCase();
              
              if (type === 'inflow') {
                if (desc.includes('WAYVE') || desc.includes('CANVA') || desc.includes('ANTHROPIC')) {
                  category = 'Client Payments';
                } else if (desc.includes('CHIPS CREDIT')) {
                  category = 'Wire Transfer';
                }
              } else {
                if (desc.includes('RAMP TRN')) {
                  category = 'Vendor Payment';
                } else if (desc.includes('RMPR')) {
                  category = 'Reimbursement';
                } else if (desc.includes('RIPPLING') || desc.includes('PAYROLL')) {
                  category = 'Payroll';
                }
              }
              
              const transaction: ParsedTransaction = {
                id,
                date,
                description: row.Description,
                amount,
                type,
                balance,
                category,
                originalData: row
              };
              
              transactions.push(transaction);
              
              if (index < 5) {
                console.log(`✅ Parsed transaction ${index + 1}:`, {
                  id: transaction.id,
                  date: transaction.date.toISOString().split('T')[0],
                  description: transaction.description.substring(0, 50) + '...',
                  amount: transaction.amount,
                  type: transaction.type,
                  category: transaction.category
                });
              }
              
            } catch (error) {
              console.error(`❌ Error parsing row ${index + 1}:`, error, row);
            }
          });
          
          console.log(`✅ Successfully parsed ${transactions.length} valid transactions`);
          resolve(transactions);
          
        } catch (error) {
          console.error('❌ Error in CSV parse completion:', error);
          reject(error);
        }
      },
      error: (error) => {
        console.error('❌ CSV parse error:', error);
        reject(error);
      }
    });
  });
};