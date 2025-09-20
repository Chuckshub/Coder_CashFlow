import React, { useState, useEffect } from 'react';
import { NumericFormat } from 'react-number-format';
import { Estimate } from '../../types';

interface EstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
  weekNumber: number;
  type: 'inflow' | 'outflow' | null;
  estimate?: Estimate;
  isPastWeek?: boolean; // New prop to indicate if this is a past week
  onSaveActualTransaction?: (transaction: any) => void; // New prop for saving actual transactions
}

const commonCategories = {
  inflow: [
    'Client Payment',
    'Recurring Revenue', 
    'Investment Income',
    'Expense Reimbursement',
    'Other Income'
  ],
  outflow: [
    'Payroll',
    'Vendor Payment',
    'Office Expenses',
    'Marketing',
    'Software/Tools', 
    'Travel',
    'Taxes',
    'Other Expenses'
  ]
};

const EstimateModal: React.FC<EstimateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  weekNumber,
  type,
  estimate,
  isPastWeek,
  onSaveActualTransaction
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    description: '',
    notes: '',
    isRecurring: false,
    recurringType: 'weekly' as 'weekly' | 'bi-weekly' | 'monthly',
    monthlyDayOfMonth: 1 // Default to 1st of month
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isActualTransaction, setIsActualTransaction] = useState(false); // Toggle for actual vs estimate

  useEffect(() => {
    if (estimate) {
      setFormData({
        amount: estimate.amount.toString(),
        category: estimate.category,
        description: estimate.description,
        notes: estimate.notes || '',
        isRecurring: estimate.isRecurring,
        recurringType: estimate.recurringType || 'weekly',
        monthlyDayOfMonth: estimate.monthlyDayOfMonth || 1
      });
    } else {
      setFormData({
        amount: '',
        category: '',
        description: '',
        notes: '',
        isRecurring: false,
        recurringType: 'weekly',
        monthlyDayOfMonth: 1
      });
    }
    setErrors({});
  }, [estimate, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm() || !type) {
      console.error('Cannot save: validation failed or type is null');
      return;
    }

    if (isPastWeek && isActualTransaction && onSaveActualTransaction) {
      // Handle actual transaction for past weeks
      const transactionData = {
        amount: parseFloat(formData.amount),
        type,
        category: formData.category.trim(),
        description: formData.description.trim(),
        notes: formData.notes.trim() || undefined,
        weekNumber,
        date: new Date() // For now, use current date - could be made more specific
      };
      
      console.log('💰 Creating actual transaction data:', transactionData);
      onSaveActualTransaction(transactionData);
      return;
    }

    // Handle estimate (existing logic)
    const estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'> = {
      amount: parseFloat(formData.amount),
      type, // TypeScript now knows this is not null
      category: formData.category.trim(),
      description: formData.description.trim(),
      weekNumber,
      isRecurring: formData.isRecurring
    };

    // Only add notes if it has a value
    const trimmedNotes = formData.notes.trim();
    if (trimmedNotes) {
      estimateData.notes = trimmedNotes;
    }
    // If no notes, don't add the field at all (leave it undefined in the type, but don't explicitly set it)

    // Only add recurringType if recurring is enabled
    if (formData.isRecurring && formData.recurringType) {
      estimateData.recurringType = formData.recurringType;
    }
    // If not recurring, don't add the field at all

    // Add monthlyDayOfMonth if recurring type is monthly
    if (formData.isRecurring && formData.recurringType === 'monthly') {
      estimateData.monthlyDayOfMonth = formData.monthlyDayOfMonth;
    }

    console.log('📄 EstimateModal - Creating estimate data:', {
      ...estimateData,
      hasNotes: 'notes' in estimateData,
      hasRecurringType: 'recurringType' in estimateData
    });

    onSave(estimateData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const handleDelete = () => {
    if (onDelete && estimate) {
      console.log('🗑️ Deleting estimate:', estimate.id);
      onDelete();
      onClose();
    }
  };

  const handleCategorySelect = (category: string) => {
    setFormData(prev => ({ ...prev, category }));
  };

  if (!isOpen || !type) return null;

  const categories = commonCategories[type];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {estimate ? 'Edit' : 'Add'} {type === 'inflow' ? 'Income' : 'Expense'} Estimate
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">
              {weekNumber === -1 ? 'Last Week' : 
               weekNumber === 0 ? 'Current Week' : 
               weekNumber > 0 ? `Week +${weekNumber}` : 
               `Week ${weekNumber}`} • {type === 'inflow' ? 'Income' : 'Expense'}
            </div>
            
            {/* Toggle for past weeks between estimate and actual */}
            {isPastWeek && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="text-sm font-medium text-amber-800 mb-2">Data Type</div>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="dataType"
                      checked={!isActualTransaction}
                      onChange={() => setIsActualTransaction(false)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-amber-700">
                      📊 Estimate (projected)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="dataType"
                      checked={isActualTransaction}
                      onChange={() => setIsActualTransaction(true)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-amber-700">
                      💰 Actual (completed transaction)
                    </span>
                  </label>
                </div>
                <div className="text-xs text-amber-600 mt-1">
                  {isActualTransaction 
                    ? 'This will be added as a completed transaction to your records' 
                    : 'This will be saved as an estimate for planning purposes'}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">$</span>
                </div>
                <NumericFormat
                  thousandSeparator=","
                  prefix="$"
                  value={formData.amount}
                  onValueChange={(values) => setFormData(prev => ({ ...prev, amount: values.value || '' }))}
                  className={`w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.amount ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="$0"
                  allowNegative={false}
                />
              </div>
              {errors.amount && (
                <p className="text-sm text-red-600 mt-1">{errors.amount}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        formData.category === category
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.category ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Or enter custom category"
                />
              </div>
              {errors.category && (
                <p className="text-sm text-red-600 mt-1">{errors.category}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Brief description"
              />
              {errors.description && (
                <p className="text-sm text-red-600 mt-1">{errors.description}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Additional details or context"
              />
            </div>

            {/* Recurring Options - only show for estimates */}
            {!isActualTransaction && (
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Recurring estimate</span>
                </label>
                
                {formData.isRecurring && (
                  <div className="mt-2 ml-6">
                    <select
                      value={formData.recurringType}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        recurringType: e.target.value as 'weekly' | 'bi-weekly' | 'monthly'
                      }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="bi-weekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    
                    {/* Monthly day selector */}
                    {formData.recurringType === 'monthly' && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Day of Month
                        </label>
                        <select
                          value={formData.monthlyDayOfMonth}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            monthlyDayOfMonth: parseInt(e.target.value)
                          }))}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>
                              {day === 1 ? '1st' : 
                               day === 2 ? '2nd' : 
                               day === 3 ? '3rd' : 
                               day === 21 ? '21st' : 
                               day === 22 ? '22nd' : 
                               day === 23 ? '23rd' : 
                               day === 31 ? '31st' : 
                               `${day}th`} of the month
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          For months with fewer days, the estimate will appear on the last day of that month.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-between pt-4">
              <div>
                {estimate && onDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  {estimate ? 'Update' : 'Add'} {isPastWeek && isActualTransaction ? 'Transaction' : 'Estimate'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EstimateModal;