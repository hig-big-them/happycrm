/**
 * 🔐 Enterprise Webhook Security & Signature Verification
 * 
 * WhatsApp, Twilio ve diğer webhook providers için güvenlik
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

// 🎯 Webhook Provider Configurations
export const WEBHOOK_CONFIGS = {
  whatsapp: {
    signatureHeader: 'x-hub-signature-256',
    algorithm: 'sha256',
    encoding: 'hex' as BufferEncoding,
    prefix: 'sha256=',
    secretEnvVar: 'WHATSAPP_WEBHOOK_SECRET'
  },
  twilio: {
    signatureHeader: 'x-twilio-signature',
    algorithm: 'sha1',
    encoding: 'base64' as BufferEncoding,
    prefix: '',
    secretEnvVar: 'TWILIO_AUTH_TOKEN'
  },
  stripe: {
    signatureHeader: 'stripe-signature',
    algorithm: 'sha256',
    encoding: 'hex' as BufferEncoding,
    prefix: 'v1=',
    secretEnvVar: 'STRIPE_WEBHOOK_SECRET'
  }
};

// 🛡️ Webhook Security Class
export class WebhookSecurity {
  private config: typeof WEBHOOK_CONFIGS.whatsapp;
  private secret: string;

  constructor(provider: keyof typeof WEBHOOK_CONFIGS) {
    this.config = WEBHOOK_CONFIGS[provider];
    this.secret = process.env[this.config.secretEnvVar] || '';
    
    if (!this.secret) {
      console.warn(`⚠️ Webhook secret not configured for ${provider}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifySignature(rawBody: string | Buffer, signature: string): boolean {
    if (!this.secret) {
      console.warn('⚠️ No webhook secret configured, skipping verification');
      return true; // In development, allow without verification
    }

    try {
      const body = typeof rawBody === 'string' ? rawBody : rawBody.toString();
      const expectedSignature = this.generateSignature(body);
      
      // Remove prefix if present
      const cleanSignature = signature.startsWith(this.config.prefix) 
        ? signature.substring(this.config.prefix.length)
        : signature;
      
      // Timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, this.config.encoding),
        Buffer.from(cleanSignature, this.config.encoding)
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Generate signature for comparison
   */
  private generateSignature(body: string): string {
    const hmac = crypto.createHmac(this.config.algorithm, this.secret);
    hmac.update(body, 'utf8');
    return hmac.digest(this.config.encoding);
  }

  /**
   * Verify timestamp to prevent replay attacks
   */
  verifyTimestamp(timestamp: string | number, toleranceSeconds: number = 300): boolean {
    const now = Math.floor(Date.now() / 1000);
    const webhookTime = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    
    return Math.abs(now - webhookTime) <= toleranceSeconds;
  }

  /**
   * Extract and verify Twilio signature with URL
   */
  verifyTwilioSignature(url: string, params: Record<string, any>, signature: string): boolean {
    if (!this.secret) return true;

    try {
      // Use Twilio's built-in validation
      return twilio.validateRequest(this.secret, signature, url, params);
    } catch (error) {
      console.error('Twilio signature verification failed:', error);
      return false;
    }
  }
}

// 🔒 Security Middleware Factory
export function createWebhookSecurityMiddleware(provider: keyof typeof WEBHOOK_CONFIGS) {
  const security = new WebhookSecurity(provider);

  return {
    verifyRequest: async (req: NextRequest, rawBody: string | Buffer) => {
      const signature = req.headers.get(security.config.signatureHeader);
      
      if (!signature) {
        return {
          valid: false,
          error: 'Missing webhook signature',
          statusCode: 401
        };
      }

      // Special handling for Twilio
      if (provider === 'twilio') {
        const url = req.url;
        const body = typeof rawBody === 'string' ? rawBody : rawBody.toString();
        const params = new URLSearchParams(body);
        const paramsObj = Object.fromEntries(params.entries());
        
        const isValid = security.verifyTwilioSignature(url, paramsObj, signature);
        
        return {
          valid: isValid,
          error: isValid ? null : 'Invalid Twilio signature',
          statusCode: isValid ? 200 : 401
        };
      }

      // Standard signature verification
      const isValid = security.verifySignature(rawBody, signature);
      
      return {
        valid: isValid,
        error: isValid ? null : 'Invalid webhook signature',
        statusCode: isValid ? 200 : 401
      };
    },

    // Additional security checks
    additionalChecks: {
      verifyUserAgent: (req: NextRequest, expectedPattern: RegExp) => {
        const userAgent = req.headers.get('user-agent') || '';
        return expectedPattern.test(userAgent);
      },

      verifyContentType: (req: NextRequest, expectedType: string) => {
        const contentType = req.headers.get('content-type') || '';
        return contentType.includes(expectedType);
      },

      checkIPWhitelist: (req: NextRequest, allowedIPs: string[]) => {
        const clientIP = req.headers.get('x-forwarded-for') || 
                        req.headers.get('x-real-ip') || 
                        'unknown';
        
        if (allowedIPs.length === 0) return true; // No restriction
        
        return allowedIPs.some(ip => {
          if (ip.includes('/')) {
            // CIDR notation support
            return isIPInCIDR(clientIP, ip);
          }
          return clientIP === ip;
        });
      }
    }
  };
}

// 🌐 WhatsApp Specific Security
export const whatsappSecurity = createWebhookSecurityMiddleware('whatsapp');

// 📱 Twilio Specific Security
export const twilioSecurity = createWebhookSecurityMiddleware('twilio');

// 💳 Stripe Specific Security (if needed)
export const stripeSecurity = createWebhookSecurityMiddleware('stripe');

// Original Twilio webhook security function (backward compatibility)
export function withWebhookSecurity(
  handler: (req: NextRequest, body: any) => Promise<NextResponse>
) {
  return async function(req: NextRequest): Promise<NextResponse> {
    try {
      // CORS headers for Twilio
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
        'Content-Type': 'text/plain; charset=utf-8',
      };

      // Handle OPTIONS request
      if (req.method === 'OPTIONS') {
        return new NextResponse(null, { status: 200, headers });
      }

      // Parse body based on content type
      let body: any = {};
      const contentType = req.headers.get('content-type');
      
      if (contentType?.includes('application/x-www-form-urlencoded')) {
        const text = await req.text();
        const params = new URLSearchParams(text);
        params.forEach((value, key) => {
          body[key] = value;
        });
      } else if (contentType?.includes('application/json')) {
        body = await req.json();
      } else {
        // Try to parse as text and then as form data
        const text = await req.text();
        try {
          body = JSON.parse(text);
        } catch {
          // If JSON parse fails, try as form data
          const params = new URLSearchParams(text);
          params.forEach((value, key) => {
            body[key] = value;
          });
        }
      }

      // Enhanced Twilio signature validation
      const validateSignature = process.env.VALIDATE_TWILIO_SIGNATURE === 'true';
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (validateSignature && twilioAuthToken) {
        const signature = req.headers.get('x-twilio-signature');
        if (!signature) {
          console.warn('No Twilio signature provided');
          return new NextResponse('Unauthorized', { status: 403, headers });
        }

        // Get the full URL
        const url = new URL(req.url);
        const fullUrl = `${url.protocol}//${url.host}${url.pathname}`;
        
        // Convert body to params format for signature validation
        const params: Record<string, string> = {};
        Object.keys(body).sort().forEach(key => {
          params[key] = String(body[key]);
        });

        // Validate signature using enhanced security
        const security = new WebhookSecurity('twilio');
        const isValid = security.verifyTwilioSignature(fullUrl, params, signature);

        if (!isValid) {
          console.warn('Invalid Twilio signature');
          return new NextResponse('Forbidden', { status: 403, headers });
        }
      }

      // Call the actual handler
      const response = await handler(req, body);
      
      // Add CORS headers to response
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
      
    } catch (error) {
      console.error('Webhook security error:', error);
      return new NextResponse('Internal Server Error', { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain; charset=utf-8',
        }
      });
    }
  };
}

// 🔧 Utility Functions
function isIPInCIDR(ip: string, cidr: string): boolean {
  // Simplified CIDR check - in production use a proper library
  const [network, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  
  return (ipNum & mask) === (networkNum & mask);
}

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

// 🎯 Provider-Specific IP Ranges
export const WEBHOOK_IP_RANGES = {
  whatsapp: [
    '31.13.24.0/21',
    '31.13.64.0/18',
    '66.220.144.0/20',
    '69.63.176.0/20',
    '69.171.224.0/19',
    '74.119.76.0/22',
    '103.4.96.0/22',
    '129.134.0.0/17',
    '157.240.0.0/17',
    '173.252.64.0/18',
    '179.60.192.0/22',
    '185.60.216.0/22',
    '204.15.20.0/22'
  ],
  twilio: [
    '54.172.60.0/23',
    '54.244.51.0/24',
    '54.171.127.192/27',
    '35.156.191.128/25',
    '54.65.63.192/27',
    '54.169.127.128/27',
    '54.252.254.64/27',
    '177.71.206.192/27'
  ]
};

// 🔐 Enhanced Security Validator
export class EnhancedWebhookValidator {
  private provider: keyof typeof WEBHOOK_CONFIGS;
  private security: ReturnType<typeof createWebhookSecurityMiddleware>;
  
  constructor(provider: keyof typeof WEBHOOK_CONFIGS) {
    this.provider = provider;
    this.security = createWebhookSecurityMiddleware(provider);
  }

  async validateRequest(req: NextRequest, rawBody: string | Buffer): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Signature verification
    const signatureResult = await this.security.verifyRequest(req, rawBody);
    if (!signatureResult.valid) {
      errors.push(signatureResult.error || 'Signature verification failed');
    }

    // 2. Content-Type check
    const expectedContentType = this.provider === 'whatsapp' ? 'application/json' : 'application/x-www-form-urlencoded';
    if (!this.security.additionalChecks.verifyContentType(req, expectedContentType)) {
      warnings.push(`Unexpected content-type. Expected: ${expectedContentType}`);
    }

    // 3. User-Agent check (WhatsApp specific)
    if (this.provider === 'whatsapp') {
      const userAgent = req.headers.get('user-agent') || '';
      if (!userAgent.includes('facebookexternalua')) {
        warnings.push('Unexpected User-Agent for WhatsApp webhook');
      }
    }

    // 4. IP whitelist check
    const allowedIPs = WEBHOOK_IP_RANGES[this.provider] || [];
    if (allowedIPs.length > 0) {
      if (!this.security.additionalChecks.checkIPWhitelist(req, allowedIPs)) {
        warnings.push('Request from non-whitelisted IP address');
      }
    }

    // 5. Rate limiting check (basic)
    const timestamp = req.headers.get('x-timestamp');
    if (timestamp) {
      const webhookTime = parseInt(timestamp);
      if (Date.now() - webhookTime > 5 * 60 * 1000) { // 5 minutes
        warnings.push('Webhook timestamp is older than 5 minutes');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// 🚀 Export Enhanced Validators
export const whatsappValidator = new EnhancedWebhookValidator('whatsapp');
export const twilioValidator = new EnhancedWebhookValidator('twilio');

// 🔧 Utility for raw body extraction
export async function getRawBody(req: NextRequest): Promise<{ body: string; buffer: Buffer }> {
  const chunks: Uint8Array[] = [];
  const reader = req.body?.getReader();
  
  if (!reader) {
    throw new Error('No request body');
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const buffer = Buffer.concat(chunks);
  const body = buffer.toString('utf8');
  
  return { body, buffer };
}