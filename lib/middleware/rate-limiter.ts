/**
 * 🛡️ Enterprise Rate Limiting Middleware
 * 
 * IP-based ve user-based rate limiting with Redis-like memory store
 */

import { NextRequest, NextResponse } from 'next/server';

// 📊 Rate Limit Store Interface
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    blocked?: boolean;
    blockUntil?: number;
  };
}

// 🏪 In-memory store (production'da Redis kullanın)
class MemoryRateLimitStore {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  get(key: string) {
    return this.store[key];
  }

  set(key: string, value: any) {
    this.store[key] = value;
  }

  delete(key: string) {
    delete this.store[key];
  }

  cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      const entry = this.store[key];
      if (entry.resetTime < now && (!entry.blockUntil || entry.blockUntil < now)) {
        delete this.store[key];
      }
    });
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

const rateLimitStore = new MemoryRateLimitStore();

// 🎯 Rate Limit Configurations
export const RATE_LIMITS = {
  // Genel API limitleri
  general: {
    windowMs: 15 * 60 * 1000, // 15 dakika
    maxRequests: 100,
    blockDuration: 15 * 60 * 1000 // 15 dakika block
  },
  
  // Mesajlaşma limitleri
  messaging: {
    windowMs: 60 * 1000, // 1 dakika
    maxRequests: 10, // Dakikada 10 mesaj
    blockDuration: 5 * 60 * 1000 // 5 dakika block
  },
  
  // WhatsApp özel limitleri
  whatsapp: {
    windowMs: 60 * 1000, // 1 dakika
    maxRequests: 5, // Dakikada 5 WhatsApp mesajı
    blockDuration: 10 * 60 * 1000 // 10 dakika block
  },
  
  // Template işlemleri
  templates: {
    windowMs: 60 * 1000, // 1 dakika
    maxRequests: 3, // Dakikada 3 template işlemi
    blockDuration: 30 * 60 * 1000 // 30 dakika block
  },
  
  // Webhook limitleri
  webhooks: {
    windowMs: 60 * 1000, // 1 dakika
    maxRequests: 100, // Dakikada 100 webhook
    blockDuration: 1 * 60 * 1000 // 1 dakika block
  },
  
  // Login/Auth limitleri
  auth: {
    windowMs: 15 * 60 * 1000, // 15 dakika
    maxRequests: 5, // 15 dakikada 5 deneme
    blockDuration: 60 * 60 * 1000 // 1 saat block
  }
};

// 🔧 Rate Limiter Factory
export class RateLimiter {
  private config: {
    windowMs: number;
    maxRequests: number;
    blockDuration: number;
    keyGenerator?: (req: NextRequest) => string;
    skipIf?: (req: NextRequest) => boolean;
    onLimitReached?: (req: NextRequest, info: any) => void;
  };

  constructor(config: typeof RATE_LIMITS.general & {
    keyGenerator?: (req: NextRequest) => string;
    skipIf?: (req: NextRequest) => boolean;
    onLimitReached?: (req: NextRequest, info: any) => void;
  }) {
    this.config = config;
  }

  async check(req: NextRequest): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    // Skip check if condition met
    if (this.config.skipIf && this.config.skipIf(req)) {
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs
      };
    }

    const key = this.getKey(req);
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    // Initialize or reset if window expired
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs
      };
    }

    // Check if currently blocked
    if (entry.blocked && entry.blockUntil && entry.blockUntil > now) {
      return {
        allowed: false,
        limit: this.config.maxRequests,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.blockUntil - now) / 1000)
      };
    }

    // Clear block if expired
    if (entry.blocked && entry.blockUntil && entry.blockUntil <= now) {
      entry.blocked = false;
      entry.blockUntil = undefined;
      entry.count = 0;
      entry.resetTime = now + this.config.windowMs;
    }

    // Increment count
    entry.count++;
    
    // Check if limit exceeded
    if (entry.count > this.config.maxRequests) {
      // Block the key
      entry.blocked = true;
      entry.blockUntil = now + this.config.blockDuration;
      
      // Trigger callback
      if (this.config.onLimitReached) {
        this.config.onLimitReached(req, {
          key,
          count: entry.count,
          limit: this.config.maxRequests,
          blockUntil: entry.blockUntil
        });
      }
      
      rateLimitStore.set(key, entry);
      
      return {
        allowed: false,
        limit: this.config.maxRequests,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil(this.config.blockDuration / 1000)
      };
    }

    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }

  private getKey(req: NextRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }
    
    // Default: IP + User ID (if available)
    const ip = this.getClientIP(req);
    const userId = this.getUserId(req);
    
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  private getClientIP(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    const remoteAddress = req.headers.get('x-vercel-forwarded-for');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    if (remoteAddress) {
      return remoteAddress.split(',')[0].trim();
    }
    
    return 'unknown';
  }

  private getUserId(req: NextRequest): string | null {
    try {
      // Extract from JWT token or session
      const auth = req.headers.get('authorization');
      if (auth && auth.startsWith('Bearer ')) {
        // Parse JWT and extract user ID
        // Bu production'da JWT library kullanılmalı
        return null;
      }
      
      // Extract from cookie
      const sessionCookie = req.cookies.get('session');
      if (sessionCookie) {
        // Parse session and extract user ID
        return null;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}

// 🛠️ Pre-configured Rate Limiters
export const createMessagingLimiter = () => new RateLimiter({
  ...RATE_LIMITS.messaging,
  onLimitReached: (req, info) => {
    console.warn(`🚨 Messaging rate limit exceeded:`, {
      key: info.key,
      count: info.count,
      limit: info.limit,
      ip: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent')
    });
  }
});

export const createWhatsAppLimiter = () => new RateLimiter({
  ...RATE_LIMITS.whatsapp,
  onLimitReached: (req, info) => {
    console.warn(`🚨 WhatsApp rate limit exceeded:`, {
      key: info.key,
      count: info.count,
      limit: info.limit
    });
  }
});

export const createTemplateLimiter = () => new RateLimiter({
  ...RATE_LIMITS.templates,
  onLimitReached: (req, info) => {
    console.warn(`🚨 Template rate limit exceeded:`, {
      key: info.key,
      count: info.count,
      limit: info.limit
    });
  }
});

export const createWebhookLimiter = () => new RateLimiter({
  ...RATE_LIMITS.webhooks,
  skipIf: (req) => {
    // Skip rate limiting for verified webhook requests
    const signature = req.headers.get('x-hub-signature-256');
    return !!signature; // In production, verify the signature
  }
});

export const createAuthLimiter = () => new RateLimiter({
  ...RATE_LIMITS.auth,
  keyGenerator: (req) => {
    // Use IP for auth endpoints
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    return `auth:${ip}`;
  },
  onLimitReached: (req, info) => {
    console.error(`🚨 Auth rate limit exceeded:`, {
      key: info.key,
      count: info.count,
      limit: info.limit,
      ip: req.headers.get('x-forwarded-for')
    });
  }
});

// 🔧 Middleware Helper
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return async (req: NextRequest) => {
    const result = await limiter.check(req);
    
    if (!result.allowed) {
      const response = NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter
        },
        { status: 429 }
      );
      
      // Set rate limit headers
      response.headers.set('X-RateLimit-Limit', result.limit.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
      
      if (result.retryAfter) {
        response.headers.set('Retry-After', result.retryAfter.toString());
      }
      
      return response;
    }
    
    // Add rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
    
    return response;
  };
}

// 🧹 Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    rateLimitStore.destroy();
  });
  
  process.on('SIGINT', () => {
    rateLimitStore.destroy();
    process.exit(0);
  });
}