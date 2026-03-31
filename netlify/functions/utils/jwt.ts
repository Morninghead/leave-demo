import * as jwt from 'jsonwebtoken';

// CRITICAL: JWT_SECRET must be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// Debug: Show JWT_SECRET status (without revealing the secret)
console.log('🔍 [JWT DEBUG] JWT_SECRET check:', {
  isDefined: JWT_SECRET !== undefined,
  isEmpty: JWT_SECRET === '',
  length: JWT_SECRET ? JWT_SECRET.length : 0,
  type: typeof JWT_SECRET
});

// Development fallback - require JWT_SECRET in all environments for security
if (!JWT_SECRET || JWT_SECRET.trim() === '') {
  console.error('❌ JWT_SECRET environment variable is missing or empty');
  console.error('❌ Available environment variables:', Object.keys(process.env).filter(key => key.includes('JWT')));
  throw new Error('JWT_SECRET environment variable is required and cannot be empty. Please set it in your environment variables.');
}

// Token expiration - more secure for production (8 hours) while maintaining usability
// Reduced from 1d to 8h to minimize security exposure window
const JWT_EXPIRES_IN = process.env.NODE_ENV === 'production' ? '8h' : '8h';

export interface JWTPayload {
  userId: string;
  employeeCode: string;
  role: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Additional validation
    if (!decoded.userId || !decoded.employeeCode || !decoded.role) {
      throw new Error('Invalid token structure');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

export function getTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}
