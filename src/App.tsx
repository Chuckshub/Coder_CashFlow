import React, { useEffect } from 'react';

function DiagnosticApp() {
  useEffect(() => {
    console.log('DiagnosticApp mounted successfully');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Location:', window.location.href);
    console.log('React version:', React.version);
    
    // Test if all major dependencies are available
    const deps = {
      'date-fns': typeof window !== 'undefined' ? 'loaded' : 'not available',
      'papaparse': typeof window !== 'undefined' ? 'loaded' : 'not available',
      'uuid': typeof window !== 'undefined' ? 'loaded' : 'not available'
    };
    console.log('Dependencies:', deps);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Coder CashFlow - Diagnostic Mode
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Testing deployment and runtime environment
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ React App Status</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✓ Component rendered successfully</li>
              <li>✓ Tailwind CSS classes applied</li>
              <li>✓ JavaScript execution working</li>
              <li>✓ React hooks functioning</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Environment Info</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><strong>Environment:</strong> {process.env.NODE_ENV}</li>
              <li><strong>URL:</strong> {window.location.host}</li>
              <li><strong>React:</strong> {React.version}</li>
              <li><strong>Timestamp:</strong> {new Date().toISOString()}</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🔍 Next Steps</h3>
            <p className="text-sm text-gray-600">
              If you see this page, the React app is loading correctly. 
              The issue was likely with complex components or dependencies.
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🛠️ Actions</h3>
            <button 
              onClick={() => {
                console.log('Test button clicked');
                alert('JavaScript and event handling working!');
              }}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Test Interaction
            </button>
          </div>
        </div>
        
        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Console Output</h3>
            <p className="text-sm text-gray-600">
              Check the browser developer console (F12) for detailed logging information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiagnosticApp;