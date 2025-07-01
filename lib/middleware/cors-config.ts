/**
 * 🌐 Enterprise CORS Configuration
 * 
 * Production-ready CORS ayarları ve güvenlik politikaları
 */

import { NextRequest, NextResponse } from 'next/server';

// 🎯 CORS Configuration Options
export interface CORSOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  optionsSuccessStatus?: number;
}

// 🔧 Default CORS Configuration
export const DEFAULT_CORS_CONFIG: CORSOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://yourdomain.com',
        'https://www.yourdomain.com',
        'https://app.yourdomain.com'
      ]
    : ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name',
    'X-File-Size',
    'X-File-Type'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Total-Count'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204
};

// 📱 Twilio Specific CORS
export const TWILIO_CORS_CONFIG: CORSOptions = {
  origin: '*', // Twilio webhooks can come from various IPs
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'X-Twilio-Signature',
    'User-Agent'
  ],
  credentials: false,
  maxAge: 3600 // 1 hour
};

// 🟢 WhatsApp Specific CORS
export const WHATSAPP_CORS_CONFIG: CORSOptions = {
  origin: (origin: string) => {
    // WhatsApp webhook IPs (Meta's IP ranges)
    const whatsappDomains = [
      'graph.facebook.com',
      'facebook.com',
      'whatsapp.com'
    ];
    
    if (!origin) return true; // Allow requests without origin (server-to-server)
    
    try {
      const url = new URL(origin);
      return whatsappDomains.some(domain => 
        url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'X-Hub-Signature-256',
    'User-Agent'
  ],
  credentials: false,
  maxAge: 3600
};

// 🛡️ CORS Middleware Class
export class CORSMiddleware {
  private config: CORSOptions;

  constructor(config: CORSOptions = DEFAULT_CORS_CONFIG) {
    this.config = { ...DEFAULT_CORS_CONFIG, ...config };
  }

  /**
   * Handle CORS for a request
   */
  handle(req: NextRequest): NextResponse | null {
    const origin = req.headers.get('origin');
    const method = req.method;

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return this.handlePreflight(req, origin);
    }

    // Add CORS headers to response
    return this.addCORSHeaders(new NextResponse(), origin);
  }

  /**
   * Handle preflight OPTIONS requests
   */
  private handlePreflight(req: NextRequest, origin: string | null): NextResponse {
    const requestMethod = req.headers.get('access-control-request-method');
    const requestHeaders = req.headers.get('access-control-request-headers');

    // Check if method is allowed
    if (requestMethod && this.config.methods && !this.config.methods.includes(requestMethod)) {
      return new NextResponse(null, { status: 405 });
    }

    // Check if headers are allowed
    if (requestHeaders && this.config.allowedHeaders) {
      const headers = requestHeaders.split(',').map(h => h.trim().toLowerCase());
      const allowedHeaders = this.config.allowedHeaders.map(h => h.toLowerCase());
      
      const hasDisallowedHeader = headers.some(h => !allowedHeaders.includes(h));
      if (hasDisallowedHeader) {
        return new NextResponse(null, { status: 400 });
      }
    }

    const response = new NextResponse(null, { 
      status: this.config.optionsSuccessStatus || 204 
    });

    return this.addCORSHeaders(response, origin, {
      includePreflightHeaders: true,
      requestMethod,
      requestHeaders
    });
  }

  /**
   * Add CORS headers to response
   */
  private addCORSHeaders(
    response: NextResponse, 
    origin: string | null,
    options: {
      includePreflightHeaders?: boolean;
      requestMethod?: string | null;
      requestHeaders?: string | null;
    } = {}
  ): NextResponse {
    // Handle origin
    if (this.isOriginAllowed(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
    } else if (this.config.origin === '*') {
      response.headers.set('Access-Control-Allow-Origin', '*');
    }

    // Handle credentials
    if (this.config.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // Handle methods
    if (this.config.methods && options.includePreflightHeaders) {
      response.headers.set('Access-Control-Allow-Methods', this.config.methods.join(', '));
    }

    // Handle allowed headers
    if (this.config.allowedHeaders && options.includePreflightHeaders) {
      response.headers.set('Access-Control-Allow-Headers', this.config.allowedHeaders.join(', '));
    }

    // Handle exposed headers
    if (this.config.exposedHeaders) {
      response.headers.set('Access-Control-Expose-Headers', this.config.exposedHeaders.join(', '));
    }

    // Handle max age
    if (this.config.maxAge && options.includePreflightHeaders) {
      response.headers.set('Access-Control-Max-Age', this.config.maxAge.toString());
    }

    // Add security headers
    this.addSecurityHeaders(response);

    return response;
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string | null): boolean {
    if (!origin || !this.config.origin) return false;

    if (typeof this.config.origin === 'string') {
      return this.config.origin === '*' || this.config.origin === origin;
    }

    if (Array.isArray(this.config.origin)) {
      return this.config.origin.includes(origin);
    }

    if (typeof this.config.origin === 'function') {
      return this.config.origin(origin);
    }

    return false;
  }

  /**
   * Add additional security headers
   */
  private addSecurityHeaders(response: NextResponse): void {
    // Prevent MIME sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    // XSS Protection
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // Frame options
    response.headers.set('X-Frame-Options', 'DENY');
    
    // Referrer policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy (basic)
    if (process.env.NODE_ENV === 'production') {
      response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
      );
    }
  }
}

// 🚀 Pre-configured Middleware Instances
export const defaultCORS = new CORSMiddleware(DEFAULT_CORS_CONFIG);
export const twilioCORS = new CORSMiddleware(TWILIO_CORS_CONFIG);
export const whatsappCORS = new CORSMiddleware(WHATSAPP_CORS_CONFIG);

// 🔧 Middleware Factory Functions
export function createCORSMiddleware(config: CORSOptions) {
  return new CORSMiddleware(config);
}

export function withCORS(
  handler: (req: NextRequest) => Promise<NextResponse> | NextResponse,
  corsConfig?: CORSOptions
) {
  const cors = corsConfig ? new CORSMiddleware(corsConfig) : defaultCORS;

  return async (req: NextRequest): Promise<NextResponse> => {
    // Handle CORS
    const corsResponse = cors.handle(req);
    
    // If it's a preflight request, return CORS response
    if (req.method === 'OPTIONS') {
      return corsResponse || new NextResponse(null, { status: 204 });
    }

    // Call the actual handler
    const response = await handler(req);

    // Add CORS headers to the response
    const origin = req.headers.get('origin');
    return cors.addCORSHeaders(response, origin);
  };
}

// 🌐 Domain Validation Utilities
export const domainValidators = {
  /**
   * Validate if domain is in whitelist
   */
  isWhitelisted: (domain: string, whitelist: string[]): boolean => {
    return whitelist.some(allowed => {
      if (allowed.startsWith('*.')) {
        const baseDomain = allowed.substring(2);
        return domain === baseDomain || domain.endsWith(`.${baseDomain}`);
      }
      return domain === allowed;
    });
  },

  /**
   * Extract domain from origin
   */
  extractDomain: (origin: string): string | null => {
    try {
      const url = new URL(origin);
      return url.hostname;
    } catch {
      return null;
    }
  },

  /**
   * Check if origin is localhost
   */
  isLocalhost: (origin: string): boolean => {
    try {
      const url = new URL(origin);
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }
};

// 📊 CORS Analytics Helper
export class CORSAnalytics {
  private static requests: Map<string, number> = new Map();
  private static rejections: Map<string, number> = new Map();

  static recordRequest(origin: string | null): void {
    const key = origin || 'no-origin';
    this.requests.set(key, (this.requests.get(key) || 0) + 1);
  }

  static recordRejection(origin: string | null, reason: string): void {
    const key = `${origin || 'no-origin'}:${reason}`;
    this.rejections.set(key, (this.rejections.get(key) || 0) + 1);
  }

  static getStats(): {
    totalRequests: number;
    totalRejections: number;
    topOrigins: Array<{ origin: string; count: number }>;
    topRejections: Array<{ key: string; count: number }>;
  } {
    const totalRequests = Array.from(this.requests.values()).reduce((a, b) => a + b, 0);
    const totalRejections = Array.from(this.rejections.values()).reduce((a, b) => a + b, 0);

    const topOrigins = Array.from(this.requests.entries())
      .map(([origin, count]) => ({ origin, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topRejections = Array.from(this.rejections.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests,
      totalRejections,
      topOrigins,
      topRejections
    };
  }
}

// 🔒 Environment-specific configurations
export const getEnvironmentCORS = (): CORSOptions => {
  const env = process.env.NODE_ENV;
  
  switch (env) {
    case 'development':
      return {
        origin: true, // Allow all origins in development
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['*']
      };
      
    case 'staging':
      return {
        origin: [
          'https://staging.yourdomain.com',
          'https://test.yourdomain.com'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
      };
      
    case 'production':
      return {
        origin: [
          'https://yourdomain.com',
          'https://www.yourdomain.com',
          'https://app.yourdomain.com'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        maxAge: 86400
      };
      
    default:
      return DEFAULT_CORS_CONFIG;
  }
};