
import type { User } from '../../types';
import { signJWT, nodeTooManyRequests } from '../../lib/auth';
import { loginLimiter, getClientIPNode } from '../../lib/rateLimit';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Rate limit by IP
        const ip = getClientIPNode(req);
        const rl = await loginLimiter(ip);
        if (!rl.allowed) {
            return nodeTooManyRequests(res, 'Too many login attempts. Please try again in a minute.');
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const url = process.env.KV_REST_API_URL;
        const token = process.env.KV_REST_API_TOKEN;

        if (!url || !token) {
            throw new Error('Database configuration missing');
        }

        const fetchFromUpstash = async (key: string) => {
            const response = await fetch(`${url}/get/${key}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (!data.result) return null;
            return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        };

        const KEY_USERS = 'med_russia:users';
        const KEY_ADMINS = 'admin.json';

        // 1. Check Admins
        const admins: User[] = (await fetchFromUpstash(KEY_ADMINS)) || [];
        for (const admin of admins) {
            if (
                (admin.email.toLowerCase() === email.toLowerCase() || admin.name === email) &&
                admin.password
            ) {
                if (password === admin.password) {
                    const jwt = await signJWT({
                        userId: admin.id,
                        email: admin.email,
                        role: 'admin',
                        adminRole: admin.adminRole,
                    });
                    const { password: _, ...safeAdmin } = admin;
                    return res.status(200).json({ user: safeAdmin, token: jwt });
                }
            }
        }

        // 2. Check Users
        const users: User[] = (await fetchFromUpstash(KEY_USERS)) || [];
        for (const user of users) {
            if (
                (user.email.toLowerCase() === email.toLowerCase() || user.name === email) &&
                user.password
            ) {
                if (password === user.password) {
                    const jwt = await signJWT({
                        userId: user.id,
                        email: user.email,
                        role: 'student',
                    });
                    const { password: _, ...safeUser } = user;
                    return res.status(200).json({ user: safeUser, token: jwt });
                }
            }
        }

        return res.status(401).json({ error: 'Invalid credentials' });

    } catch (error: any) {
        console.error('Login Error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
