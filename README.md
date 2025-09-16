# Coder CashFlow - 13-Week Cashflow Management Application

A comprehensive React application for managing and projecting 13-week cashflow data with CSV import, automatic categorization, and interactive estimate management.

## 🚀 Features

### Core Functionality
- **CSV Data Import**: Upload and parse Chase bank transaction CSV files with drag-and-drop interface
- **Automatic Categorization**: Intelligent transaction categorization based on business rules
- **13-Week Projections**: Interactive table showing weekly inflows, outflows, and running balances
- **Estimate Management**: Add, edit, and delete cashflow estimates for any week
- **Drag-and-Drop**: Move estimates between weeks with intuitive drag-and-drop functionality
- **Notes System**: Detailed notes and descriptions for each estimate

### Transaction Categories

#### Inflow Categories
- Payment Processing Revenue (Stripe)
- Client Payments (Anthropic, Canva, Splunk, Wayve, SixWorks, CGI IT)
- Expense Reimbursement
- Investment/Banking
- Other Income

#### Outflow Categories  
- Reimbursement (RMPR transactions)
- Ramp CC Payment
- Payroll (Deel, People Center, Rippling)
- Vendor Bill Payment (RAMP TRN)
- Tax Payments
- Other Operating Expenses

## 🛠️ Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: NextUI/HeroUI (deprecated but functional)
- **Drag & Drop**: @hello-pangea/dnd
- **CSV Parsing**: PapaParse
- **Date Handling**: date-fns
- **Build Tool**: Create React App
- **Deployment**: Vercel

## 📦 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd coder-cashflow
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📊 Usage

### 1. Import Transaction Data
- Navigate to the "Import Data" page
- Drag and drop your Chase bank CSV file or click to select
- Review the data preview and click "Import Data"

### 2. View Cashflow Dashboard
- Automatic categorization of all transactions
- 13-week projection table with:
  - Weekly date ranges
  - Actual inflows and outflows
  - Estimated amounts
  - Net cashflow calculations
  - Running balance

### 3. Manage Estimates
- Click any cell in the Inflows or Outflows columns
- Add estimates with:
  - Amount
  - Category (predefined or custom)
  - Description
  - Notes
  - Recurring options (weekly, bi-weekly, monthly)

### 4. Drag and Drop
- Drag estimates between different weeks
- Visual feedback during drag operations
- Automatic recalculation of totals

## 📁 Project Structure

```
src/
├── components/
│   ├── CashflowTable/        # Main 13-week table component
│   ├── DataImport/           # CSV upload and processing
│   ├── EstimateManager/      # Estimate modal and management
│   └── common/               # Shared components
├── hooks/
│   └── useCashflowData.ts    # Main application state management
├── types/
│   └── index.ts              # TypeScript interfaces
├── utils/
│   ├── csvParser.ts          # CSV parsing and validation
│   ├── transactionCategorizer.ts  # Business logic for categorization
│   └── dateUtils.ts          # Date handling and cashflow calculations
└── App.tsx                   # Main application component
```

## 🔧 Configuration

### CSV File Format
Expected Chase bank CSV format:
- `Details`: CREDIT/DEBIT
- `Posting Date`: MM/dd/yyyy
- `Description`: Transaction description
- `Amount`: Transaction amount (negative for debits)
- `Type`: Transaction type
- `Balance`: Account balance after transaction
- `Check or Slip #`: Reference number

### Categorization Rules
Edit `src/utils/transactionCategorizer.ts` to customize:
- Transaction categorization logic
- Category keywords and patterns
- Business-specific rules

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect it's a React app
3. Deploy with default settings

### Manual Build
```bash
npm run build
```
Deploy the `build` folder to any static hosting service.

## 🔮 Future Enhancements

- Firebase integration for data persistence
- User authentication and multi-user support
- Real-time collaboration
- Advanced reporting and analytics
- Export functionality (PDF, Excel)
- Mobile app development
- API integrations with banking services

## 🐛 Known Issues

- NextUI components show deprecation warnings (functionality not affected)
- Some ESLint warnings for unused variables (non-critical)
- Date parsing may need adjustment for different CSV formats

## 📄 License

MIT License - feel free to use this project for your own cashflow management needs.

## 🤝 Contributing

Contributions welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

<!-- Test push access - temporary line -->

---

**Built for Coder Technologies, Inc.** - Professional cashflow management made simple.