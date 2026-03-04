// netlify/functions/proxy.js
// Proxy CORS para listas M3U - Node 18 fetch nativo (sem dependências)

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const url = event.queryStringParameters?.url;
  if (!url) return { statusCode: 400, headers: CORS, body: 'Missing url' };

  try { new URL(url); } catch {
    return { statusCode: 400, headers: CORS, body: 'Invalid URL' };
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });

    const body = await res.text();

    return {
      statusCode: res.status,
      headers: {
        ...CORS,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body
    };
  } catch (err) {
    return { statusCode: 502, headers: CORS, body: 'Error: ' + err.message };
  }
};
