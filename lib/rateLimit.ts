// Simple in-memory rate limiter for Vercel serverless functions
// Each function invocation may start fresh, so this is best-effort

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function createLimiter(windowMs: number, maxRequests: number) {
    return async (key: string): Promise<{ allowed: boolean; remaining: number }> => {
        const now = Date.now();
        const entry = rateLimitStore.get(key);

        if (!entry || now > entry.resetTime) {
            rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
            return { allowed: true, remaining: maxRequests - 1 };
        }

        entry.count++;

        if (entry.count > maxRequests) {
            return { allowed: false, remaining: 0 };
        }

        return { allowed: true, remaining: maxRequests - entry.count };
    };
}

// Rate limiters for different endpoints
export const loginLimiter = createLimiter(60_000, 10); // 10 attempts per minute
export const registerLimiter = createLimiter(60_000, 5); // 5 registrations per minute
export const aiLimiter = createLimiter(60_000, 20); // 20 AI calls per minute
export const emailLimiter = createLimiter(60_000, 5); // 5 emails per minute

// Extract client IP from request
export function getClientIPNode(req: any): string {
    return (
        req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers?.['x-real-ip'] ||
        req.socket?.remoteAddress ||
        'unknown'
    );
}
