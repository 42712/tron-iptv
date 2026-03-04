// netlify/functions/proxy.js
// Função serverless para fazer proxy de listas M3U sem bloqueio CORS

exports.handler = async (event, context) => {
  const url = event.queryStringParameters?.url;

  if (!url) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'URL parameter is required' })
    };
  }

  // Validação básica de segurança
  try {
    const parsed = new URL(url);
    const allowed = ['http:', 'https:'];
    if (!allowed.includes(parsed.protocol)) {
      return {
        statusCode: 403,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Protocol not allowed' })
      };
    }
  } catch {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Invalid URL' })
    };
  }

  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
      body: ''
    };
  }

  try {
    const fetch = require('node-fetch');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux) AppleWebKit/537.36',
        'Accept': '*/*',
      },
      timeout: 15000
    });

    const contentType = response.headers.get('content-type') || 'text/plain';
    const body = await response.text();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      },
      body
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Proxy error: ' + err.message })
    };
  }
};
