import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'medrussia-default-secret-key-change-me');

// --- JWT ---

export async function signJWT(payload: Record<string, any>): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<Record<string, any> | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as Record<string, any>;
    } catch {
        return null;
    }
}

// --- Password Validation (no hashing) ---

export function validatePasswordStrength(password: string): string | null {
    if (!password || password.length < 6) {
        return 'Password must be at least 6 characters long';
    }
    return null;
}

// --- Auth Extraction for Node/Vercel handlers ---

export async function extractAuthNode(req: any): Promise<{ userId: string; email: string; role: string; adminRole?: string } | null> {
    try {
        const authHeader = req.headers?.authorization || req.headers?.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        const token = authHeader.slice(7);
        const payload = await verifyJWT(token);
        if (!payload) return null;
        return {
            userId: payload.userId as string,
            email: payload.email as string,
            role: payload.role as string,
            adminRole: payload.adminRole as string | undefined,
        };
    } catch {
        return null;
    }
}

// --- Response Helpers ---

export function nodeUnauthorized(res: any, message = 'Unauthorized') {
    return res.status(401).json({ error: message });
}

export function nodeForbidden(res: any, message = 'Forbidden') {
    return res.status(403).json({ error: message });
}

export function nodeTooManyRequests(res: any, message = 'Too many requests') {
    return res.status(429).json({ error: message });
}
