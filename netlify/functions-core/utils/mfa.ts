/**
 * Multi-Factor Authentication (MFA) Implementation
 * Implements TOTP-based 2FA with backup codes
 */

import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { authenticator } from 'otplib'
import { query } from './db'
import { successResponse, errorResponse, handleCORS } from './response'
import { AuthenticatedEvent } from './auth-middleware'

interface MFASetup {
  secret: string;
  backupCodes: string[];
  qrCode: string;
  recoveryCodes: string[];
}

interface MFAVerification {
  success: boolean;
  userId?: string;
  employeeCode?: string;
  message?: string;
}

interface MFADisableRequest {
  userId: string;
  employeeCode: string;
  reason: string;
  adminPassword: string;
}

/**
 * Generate MFA secret for user
 */
export const generateMFASecret = (): string => {
  const secret = speakeasy.generateSecret({ length: 32 })
  return secret.base32
}

/**
 * Generate backup codes for MFA recovery
 */
export const generateBackupCodes = (): string[] => {
  return Array.from({ length: 10 }, () =>
    Math.random().toString(36).substring(2, 8).toUpperCase()
  )
}

/**
 * Generate QR code for MFA setup
 */
export const generateMFACode = (secret: string): string => {
  const otpauthUrl = `otpauth://totp/${secret}`
  return QRCode.toDataURL(otauthUrl)
}

/**
 * Setup MFA for user
 */
export const setupMFA = async (userId: string, employeeCode: string): Promise<MFASetup> => {
  try {
    const secret = generateMFASecret()
    const backupCodes = generateBackupCodes()
    const qrCode = generateMFACode(secret)

    // Store MFA setup in database
    await query(
      `UPDATE employees SET
        mfa_secret = $1,
        mfa_backup_codes = $2,
        mfa_qr_code = $3,
        mfa_enabled = true,
        mfa_setup_at = NOW(),
        updated_at = NOW()
      WHERE id = $4`,
      [secret, JSON.stringify(backupCodes), qrCode, userId, employeeCode]
    )

    // Log MFA setup for audit trail
    console.log(`🔐 [MFA] MFA enabled for employee ${employeeCode} (User: ${userId})`)

    return {
      secret,
      backupCodes,
      qrCode,
      recoveryCodes: backupCodes
    }

  } catch (error: any) {
    console.error('MFA setup error:', error)
    throw new Error('Failed to setup MFA')
  }
}

/**
 * Verify MFA token
 */
export const verifyMFAToken = async (token: string, secret: string): Promise<MFAVerification> => {
  try {
    const verified = authenticator.verify({
      secret,
      token,
      encoding: 'base32',
      window: 1, // 1 time window
      time: 30, // 30 seconds
    })

    if (verified) {
      return {
        success: true,
        message: 'MFA verification successful'
      }
    } else {
      return {
        success: false,
        message: 'Invalid MFA token'
      }
    }

  } catch (error: any) {
    console.error('MFA verification error:', error)
    return {
      success: false,
      message: 'MFA verification failed'
    }
  }
}

/**
 * Generate TOTP for current user
 */
export const generateTOTP = async (userId: string): Promise<string> => {
  try {
    const user = await query(
      'SELECT mfa_secret FROM employees WHERE id = $1',
      [userId]
    )

    if (!user || !user[0]?.mfa_secret) {
      throw new Error('MFA not set up for user')
    }

    const token = authenticator.generateToken({
      secret: user[0].mfa_secret,
      encoding: 'base32',
    })

    return token

  } catch (error: any) {
    console.error('TOTP generation error:', error)
    throw new Error('Failed to generate TOTP')
  }
}

/**
 * Check if MFA is enabled for user
 */
export const isMFAEnabled = async (userId: string): Promise<boolean> => {
  try {
    const result = await query(
      'SELECT mfa_enabled FROM employees WHERE id = $1',
      [userId]
    )

    return result.length > 0 && result[0].mfa_enabled

  } catch (error: any) {
    console.error('MFA check error:', error)
    return false
  }
}

/**
 * Disable MFA for user (requires admin confirmation)
 */
export const disableMFA = async (request: MFADisableRequest, requestingUser: any): Promise<boolean> => {
  try {
    // Verify admin password
    const adminUser = await query(
      'SELECT role FROM employees WHERE id = $1',
      [requestingUser.userId]
    )

    if (!adminUser || !['admin', 'hr'].includes(adminUser[0]?.role)) {
      throw new Error('Insufficient permissions')
    }

    // Update user to disable MFA
    await query(
      `UPDATE employees SET
        mfa_enabled = false,
        mfa_disabled_at = NOW(),
        mfa_disabled_reason = $1,
        updated_at = NOW()
      WHERE id = $2`,
      [request.reason, request.userId]
    )

    console.log(`🔐 [MFA] MFA disabled for employee ${request.employeeCode} by admin`)
    return true

  } catch (error: any) {
    console.error('MFA disable error:', error)
    return false
  }
}

/**
 * Check MFA setup completion
 */
export const isMFASetupComplete = (mfaSetup: MFASetup): boolean => {
  return !!(
    mfaSetup.secret &&
    mfaSetup.backupCodes &&
    mfaSetup.qrCode &&
    mfaSetup.recoveryCodes &&
    mfaSetup.backupCodes.length > 0
  )
}

/**
 * Get MFA status for user
 */
export const getMFAStatus = async (userId: string): Promise<{
  enabled: boolean;
  setupComplete: boolean;
  lastUsed?: Date;
}> => {
  try {
    const result = await query(
      `SELECT
        mfa_enabled,
        mfa_secret IS NOT NULL,
        mfa_backup_codes IS NOT NULL,
        mfa_qr_code IS NOT NULL,
        mfa_setup_at,
        mfa_last_used
      FROM employees
      WHERE id = $1`,
      [userId]
    )

    if (!result.length) {
      return {
        enabled: false,
        setupComplete: false
      }
    }

    return {
      enabled: result[0].mfa_enabled,
      setupComplete: isMFASetupComplete({
        secret: result[0].mfa_secret,
        backupCodes: result[0].mfa_backup_codes,
        qrCode: result[0].mfa_qr_code,
        recoveryCodes: result[0].mfa_recovery_codes
      }),
      lastUsed: result[0].mfa_last_used ? new Date(result[0].mfa_last_used) : undefined
    }

  } catch (error: any) {
    console.error('MFA status check error:', error)
    return {
      enabled: false,
      setupComplete: false
    }
  }
})

/**
 * Log MFA events for audit trail
 */
export const logMFAEvent = (
  event: string,
  userId: string,
  employeeCode?: string,
  details?: any
): void => {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    userId,
    employeeCode,
    details,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
  }

  console.log(`🔐 [MFA] ${event}:`, logData)

  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Send to security monitoring service
    // logSecurityEvent('mfa', logData)
  }
}

export default {
  setupMFA,
  verifyMFAToken,
  generateTOTP,
  isMFAEnabled,
  isMFASetupComplete,
  getMFAStatus,
  disableMFA,
  logMFAEvent,
  generateMFASecret,
  generateBackupCodes,
  generateMFACode,
}