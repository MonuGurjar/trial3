
import type { User } from '../../types';
import { signJWT, validatePasswordStrength, nodeTooManyRequests } from '../../lib/auth';
import { registerLimiter, getClientIPNode } from '../../lib/rateLimit';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Rate limit by IP
        const ip = getClientIPNode(req);
        const rl = await registerLimiter(ip);
        if (!rl.allowed) {
            return nodeTooManyRequests(res, 'Too many registration attempts. Please try again in a minute.');
        }

        const { name, email, password, phone } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate password strength
        const passError = validatePasswordStrength(password);
        if (passError) {
            return res.status(400).json({ error: passError });
        }

        const url = process.env.KV_REST_API_URL;
        const token = process.env.KV_REST_API_TOKEN;
        if (!url || !token) throw new Error('Database configuration missing');

        const KEY_USERS = 'med_russia:users';

        const fetchFromUpstash = async (key: string) => {
            const response = await fetch(`${url}/get/${key}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (!data.result) return null;
            return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        };

        const saveToUpstash = async (key: string, value: any) => {
            await fetch(`${url}/set/${key}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify(value),
            });
        };

        // Fetch existing users to check duplicates
        const collection: User[] = (await fetchFromUpstash(KEY_USERS)) || [];

        if (collection.find((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // SECURITY: Always create as student
        const newUser: User = {
            id: crypto.randomUUID(),
            name,
            email,
            password,
            phone: phone || '',
            role: 'student',  // HARDCODED: never trust client
            shortlistedUniversities: [],
            documents: {},
            notifications: []
        };

        collection.push(newUser);
        await saveToUpstash(KEY_USERS, collection);

        // Generate JWT
        const jwt = await signJWT({
            userId: newUser.id,
            email: newUser.email,
            role: 'student',
        });

        const { password: _, ...safeUser } = newUser;
        return res.status(201).json({ user: safeUser, token: jwt });

    } catch (error: any) {
        console.error('Register Error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
