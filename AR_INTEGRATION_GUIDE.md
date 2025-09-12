# Accounts Receivable (AR) Integration Guide

## Overview

The AR Integration feature connects your coder_Cashflow application to Campfire's accounting platform to automatically import outstanding invoices and project their collection timing into your 13-week cashflow forecasts.

## Features

### Automatic AR Data Import
- Fetches outstanding invoices from Campfire API
- Transforms invoice data into cashflow estimates
- Updates collection projections based on payment terms and aging
- Provides confidence levels for collection estimates

### Intelligent Collection Timing
- Analyzes payment terms (Net 30, Net 15, Due on Receipt, etc.)
- Factors in days overdue for realistic projections
- Applies configurable collection assumptions
- Distributes collections across your 13-week forecast

### Comprehensive AR Dashboard
- AR aging summary with current/overdue breakdowns
- Collection projections by week
- Invoice-level details with confidence indicators
- Grouping by status, week, or client

## Setup Instructions

### 1. Enable AR Integration

1. Navigate to the "Accounts Receivable" tab in the application
2. Click "Enable AR Integration"
3. This will open the AR Configuration modal

### 2. Configure Campfire API

1. **API Key**: Enter your Campfire API key
   - Obtain from your Campfire account settings
   - Ensure the key has read access to invoices

2. **Test Connection**: Click "Test Connection" to verify setup
   - Should display the number of outstanding invoices found
   - If failed, check your API key and network connection

3. **Auto-refresh Interval**: Set how often to refresh AR data (default: 60 minutes)
   - Minimum: 5 minutes
   - Maximum: 24 hours (1440 minutes)

### 3. Configure Collection Assumptions

Tune these settings based on your historical collection patterns:

- **Current Invoices On-Time Rate**: Percentage of current invoices collected on time (default: 90%)
- **Overdue Collection Rate**: Percentage of overdue invoices eventually collected (default: 75%)
- **Average Delay Days**: How many days late customers typically pay (default: 14 days)

### 4. Enable AR in Cashflow Projections

1. Go to the "Cashflow Projections" tab
2. Check the "Include AR Estimates" checkbox
3. Your weekly projections will now include AR-based inflow estimates

## Using AR Data

### Viewing AR Dashboard

- **Total Outstanding**: Sum of all unpaid invoices
- **Current vs Overdue**: Breakdown by invoice status
- **Aging Buckets**: Standard 30/60/90+ day aging analysis
- **Collection Projections**: Expected collections for next 4 and 13 weeks

### Understanding AR Estimates

Each AR estimate shows:
- **Invoice Number & Client**: Identity information
- **Amount**: Expected collection amount (after confidence adjustments)
- **Due Date**: Original invoice due date
- **Estimated Collection**: Projected collection date
- **Confidence Level**: 
  - 🟢 **High**: Current invoices with good payment terms
  - 🟡 **Medium**: Standard estimates with some risk
  - 🔴 **Low**: Overdue or collections items
- **Status**: Current, Overdue, or Collections

### Cashflow Integration

When enabled, AR estimates appear in your weekly cashflow table:
- **AR Inflow Column**: Shows expected AR collections for each week
- **Confidence Indicators**: Visual dots showing estimate reliability
- **Tooltips**: Hover for detailed invoice information
- **Total Inflow**: Includes AR projections in your overall cash position

## Best Practices

### 1. Regular Configuration Review
- Review collection assumptions monthly
- Adjust based on actual collection performance
- Update during seasonal changes in payment patterns

### 2. Monitoring and Alerts
- Check the "Last Updated" timestamp regularly
- Refresh AR data before important cashflow reviews
- Monitor for API connection issues

### 3. Scenario Planning
- Use confidence levels to create optimistic/pessimistic scenarios
- Consider impact of large overdue invoices
- Plan for seasonal collection variations

### 4. Data Quality
- Ensure Campfire invoices have accurate due dates
- Maintain proper payment terms in Campfire
- Regular cleanup of old or uncollectable invoices

## Troubleshooting

### Common Issues

**"Connection Failed" Error**
- Verify API key is correct and active
- Check network connectivity
- Ensure API key has invoice read permissions

**"No Outstanding Invoices Found"**
- Verify you have unpaid invoices in Campfire
- Check invoice status filters
- Ensure invoices have amounts due > $0

**AR Data Not Updating**
- Check auto-refresh interval setting
- Manually refresh using the "Refresh" button
- Verify API key hasn't expired

**Unrealistic Collection Projections**
- Review collection assumptions
- Adjust percentage rates based on historical data
- Consider adjusting average delay days

### Advanced Configuration

For power users, AR settings are stored in localStorage and can be exported/imported:

```javascript
// Export current settings
const settings = localStorage.getItem('arConfig');
console.log(JSON.parse(settings));

// Import settings
const newSettings = { /* your settings */ };
localStorage.setItem('arConfig', JSON.stringify(newSettings));
```

## API Rate Limits

Campfire API has standard rate limits:
- Respect the auto-refresh interval to avoid hitting limits
- Manual refreshes are throttled to prevent API overuse
- Large invoice datasets may take longer to process

## Data Privacy and Security

- API keys are stored locally in your browser
- No AR data is transmitted to external servers
- All calculations are performed client-side
- Clear browser data to remove stored API keys

## Future Enhancements

Planned features for future releases:
- Historical collection analysis
- Machine learning-based collection predictions
- Integration with additional accounting platforms
- Automated collection reminder workflows
- Advanced reporting and analytics

## Support

For technical issues:
1. Check this guide first
2. Verify Campfire API connectivity
3. Review browser console for error messages
4. Contact support with specific error details

---

*Last Updated: December 2024*
*Version: 1.0.0*
