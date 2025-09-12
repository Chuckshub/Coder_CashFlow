# Campfire AR Integration Guide

This document explains how to set up and use the Campfire API integration to automatically import Accounts Receivable (AR) data into your 13-week cashflow projections.

## Overview

The Campfire AR integration allows you to:
- Automatically import outstanding invoices from Campfire
- Project when invoices will be collected based on payment terms and historical data
- Include AR estimates in your weekly cashflow projections
- View detailed AR aging and collection forecasts
- Configure collection assumptions to fine-tune projections

## Setup

### 1. Get Your Campfire API Key

1. Log into your Campfire account
2. Go to Settings > API Keys
3. Generate a new API key with read permissions for invoices
4. Copy the API key for configuration

### 2. Configure AR Integration

1. In the cashflow application, navigate to the "Accounts Receivable" tab
2. Click "Enable AR Integration"
3. Enter your Campfire API key in the configuration modal
4. Click "Test Connection" to verify the API key works
5. Adjust collection assumptions if needed (see Configuration section)
6. Save the configuration

### 3. Enable AR in Cashflow Projections

1. Go to the "Cashflow Projections" tab
2. Check the "Include AR Estimates" checkbox
3. Your cashflow table will now show an additional "AR Inflow" column
4. AR estimates will be included in the total inflow calculations

## Features

### AR Summary Dashboard
- **Total Outstanding**: Total amount of unpaid invoices
- **Current vs Overdue**: Breakdown of invoice status
- **Aging Buckets**: Standard 30/60/90+ day aging analysis
- **Collection Forecasts**: Estimated collections for next 4 and 13 weeks

### Weekly Cashflow Integration
- AR estimates are distributed across weeks based on estimated collection dates
- Each AR estimate shows confidence level (high/medium/low)
- Hover over AR amounts to see detailed invoice breakdowns
- Click on weeks to expand and see individual AR invoices

### Collection Estimation Logic

The system estimates collection timing based on:
1. **Payment Terms**: Net 30, Net 15, Due on Receipt
2. **Current Status**: Current, Overdue, or in Collections
3. **Historical Patterns**: Configurable assumptions about collection rates
4. **Days Overdue**: Adjustments for overdue invoices

#### Default Estimation Rules:
- **Net 30**: Estimate collection 35 days from invoice date (5 days late average)
- **Net 15**: Estimate collection 18 days from invoice date
- **Due on Receipt**: Estimate collection 7 days from invoice date
- **Overdue Invoices**: Reduce estimated collection rate and add delay

### Confidence Levels

- **High** (🟢): Current invoices with short payment terms from reliable customers
- **Medium** (🟡): Standard invoices with normal payment terms
- **Low** (🔴): Overdue invoices or those in collections

## Configuration

### Collection Assumptions

You can configure these assumptions to match your business:

1. **Current On-Time Rate** (Default: 90%)
   - Percentage of current invoices collected on time
   - Higher values = more optimistic projections

2. **Overdue Collection Rate** (Default: 75%)
   - Percentage of overdue invoices eventually collected
   - Accounts for bad debt and collection challenges

3. **Average Delay Days** (Default: 14)
   - Average number of days customers pay late
   - Used to adjust collection timing

### Auto-Refresh Settings

- **Refresh Interval**: How often to pull new data from Campfire (default: 60 minutes)
- Data is cached locally and refreshed automatically
- Manual refresh available via "Refresh" button

## Data Flow

```
Campfire API → Outstanding Invoices → Collection Estimation → Weekly Distribution → Cashflow Integration
```

1. **Fetch Invoices**: Get all unpaid invoices from Campfire
2. **Apply Business Logic**: Calculate estimated collection dates and amounts
3. **Distribute by Week**: Assign each invoice to the appropriate cashflow week
4. **Apply Assumptions**: Adjust amounts based on collection assumptions
5. **Integrate**: Include in weekly cashflow totals

## Troubleshooting

### Common Issues

1. **Connection Test Fails**
   - Verify API key is correct and has proper permissions
   - Check network connectivity
   - Ensure Campfire account is active

2. **No Invoices Showing**
   - Confirm there are outstanding invoices in Campfire
   - Check date filters and status filters
   - Verify invoices have due dates set

3. **Incorrect Collection Dates**
   - Review payment terms in Campfire invoices
   - Adjust collection assumptions in settings
   - Check if invoices are marked as overdue correctly

### Error Messages

- **"Invalid API Key"**: Check your Campfire API key configuration
- **"No Access to Invoices"**: API key needs invoice read permissions
- **"Rate Limit Exceeded"**: Too many requests - wait and try again
- **"Network Error"**: Check internet connection

## Best Practices

### Accuracy Improvements
1. **Regular Updates**: Keep payment terms accurate in Campfire
2. **Customer Patterns**: Adjust assumptions based on actual collection data
3. **Review Regularly**: Check AR projections against actual collections
4. **Status Updates**: Mark invoices as paid promptly in Campfire

### Workflow Integration
1. **Daily Review**: Check AR tab daily for overdue invoices
2. **Weekly Planning**: Use AR projections for cash management decisions
3. **Monthly Analysis**: Compare projected vs actual collections
4. **Quarterly Tuning**: Adjust collection assumptions based on performance

## API Reference

The integration uses these Campfire API endpoints:
- `GET /api/accounts-receivable/invoices` - List outstanding invoices
- `GET /api/accounts-receivable/invoices/{id}` - Get invoice details
- Query parameters for filtering by date, status, and amount

## Security

- API keys are stored locally in browser localStorage
- No sensitive data is transmitted to external servers
- All Campfire communication uses HTTPS encryption
- API keys can be revoked in Campfire at any time

## Limitations

1. **Read-Only**: Integration only reads data, cannot modify Campfire invoices
2. **Outstanding Invoices Only**: Only shows unpaid or partially paid invoices
3. **Estimation Based**: Collection dates are estimates, not guarantees
4. **13-Week Horizon**: AR projections limited to 13-week cashflow period
5. **Single Entity**: Currently supports one Campfire entity per configuration

## Support

For issues with:
- **Campfire API**: Contact Campfire support
- **Integration Features**: Check this documentation and troubleshooting guide
- **Data Accuracy**: Review configuration and collection assumptions

---

## Quick Start Checklist

- [ ] Get Campfire API key
- [ ] Enable AR integration in settings
- [ ] Test connection
- [ ] Configure collection assumptions
- [ ] Enable AR in cashflow projections
- [ ] Review AR estimates and projections
- [ ] Set up regular refresh schedule
- [ ] Monitor accuracy and adjust as needed
