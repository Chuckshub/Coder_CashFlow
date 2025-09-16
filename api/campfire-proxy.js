// Vercel serverless function to proxy Campfire API requests
// This bypasses CORS restrictions

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get API key from environment variables
    const apiKey = process.env.CAMPFIRE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Campfire API key not configured',
        message: 'Please set CAMPFIRE_API_KEY environment variable in Vercel'
      });
    }

    // Extract path and query parameters
    const { path = 'invoice/', ...queryParams } = req.query;
    
    // Build the Campfire API URL
    const baseUrl = 'https://api.meetcampfire.com/coa/api/v1';
    const url = new URL(`${baseUrl}/${path}`);
    
    // Add query parameters
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key]) {
        url.searchParams.append(key, queryParams[key]);
      }
    });

    console.log(`🔥 Proxying request to: ${url.toString()}`);

    // Make request to Campfire API
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Campfire API error: ${response.status} ${response.statusText}`);
      console.error('Error body:', errorText);
      
      return res.status(response.status).json({
        error: `Campfire API error: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log(`✅ Successfully proxied Campfire request`);
    
    // Return the data with proper CORS headers
    res.status(200).json(data);
    
  } catch (error) {
    console.error('💥 Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
