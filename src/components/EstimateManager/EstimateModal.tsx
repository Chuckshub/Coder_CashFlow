import React, { useState, useEffect } from 'react';
import { Estimate } from '../../types';
import { formatRollingWeekRange } from '../../utils/rollingTimeline';

interface EstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
  weekDate: Date;
  type: 'inflow' | 'outflow' | null;
  estimate?: Estimate;
  scenario?: string;
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
  weekDate,
  type,
  estimate,
  scenario = 'base'
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    description: '',
    notes: '',
    isRecurring: false,
    recurringType: 'weekly' as 'weekly' | 'bi-weekly' | 'monthly'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (estimate) {
      setFormData({
        amount: estimate.amount.toString(),
        category: estimate.category,
        description: estimate.description,
        notes: estimate.notes || '',
        isRecurring: estimate.isRecurring,
        recurringType: estimate.recurringType || 'weekly'
      });
    } else {
      setFormData({
        amount: '',
        category: '',
        description: '',
        notes: '',
        isRecurring: false,
        recurringType: 'weekly'
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !type) return;

    const estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'> = {
      amount: parseFloat(formData.amount),
      type,
      category: formData.category.trim(),
      description: formData.description.trim(),
      notes: formData.notes.trim() || undefined,
      weekDate,
      scenario,
      isRecurring: formData.isRecurring,
      recurringType: formData.isRecurring ? formData.recurringType : undefined
    };

    onSave(estimateData);
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
              {formatRollingWeekRange(weekDate)} • {type === 'inflow' ? 'Income' : 'Expense'}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className={`w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.amount ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
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

            {/* Recurring options */}
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
                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-between pt-4">
              <div>
                {estimate && onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
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
                  {estimate ? 'Update' : 'Add'} Estimate
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