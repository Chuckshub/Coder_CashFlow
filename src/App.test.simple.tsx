import React from 'react';

function SimpleApp() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Coder CashFlow
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          13-Week Cashflow Management Application
        </p>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-4">Application Status</h2>
          <p className="text-green-600 font-medium">✅ Application loaded successfully!</p>
          <p className="text-sm text-gray-500 mt-4">
            This is a test deployment to verify the build process.
          </p>
        </div>
        <div className="mt-8 text-sm text-gray-500">
          <p>Built with React + TypeScript + Tailwind CSS</p>
          <p>Deployed on Vercel</p>
        </div>
      </div>
    </div>
  );
}

export default SimpleApp;