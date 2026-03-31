function getCorsOrigin() {
  return process.env.CORS_ALLOW_ORIGIN
    || process.env.APP_URL
    || process.env.VITE_APP_URL
    || process.env.URL
    || process.env.DEPLOY_PRIME_URL
    || '*';
}

export function successResponse(data: any, statusCode: number = 200, requestId?: string) {
  const headers: { [key: string]: string } = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': getCorsOrigin(),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };

  // Add request ID header for monitoring if provided
  if (requestId) {
    headers['X-Request-ID'] = requestId;
  }

  const responseBody = {
    success: true,
    ...data,
  };

  // Add request ID to response body for debugging
  if (requestId) {
    (responseBody as any).requestId = requestId;
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(responseBody),
  };
}

export function errorResponse(message: string, statusCode: number = 400, requestId?: string) {
  const headers: { [key: string]: string } = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': getCorsOrigin(),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };

  // Add request ID header for monitoring if provided
  if (requestId) {
    headers['X-Request-ID'] = requestId;
  }

  const responseBody = {
    success: false,
    message,
  };

  // Add request ID to response body for debugging
  if (requestId) {
    (responseBody as any).requestId = requestId;
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(responseBody),
  };
}

export function handleCORS(event: any) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': getCorsOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      },
      body: '',
    };
  }
  return null;
}
