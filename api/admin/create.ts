
import type { User } from '../../types';
import { extractAuthNode, validatePasswordStrength, nodeUnauthorized, nodeForbidden } from '../../lib/auth';

const KEY_ADMINS = 'admin.json';

async function fetchFromUpstash(key: string) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) throw new Error('Database configuration missing');

    const response = await fetch(`${url}/get/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.result) return null;
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
}

async function saveToUpstash(key: string, value: any) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    await fetch(`${url}/set/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(value),
    });
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // SECURITY: Only super_admin can create other admins
        const auth = await extractAuthNode(req);
        if (!auth) return nodeUnauthorized(res);
        if (auth.role !== 'admin' || auth.adminRole !== 'super_admin') {
            return nodeForbidden(res, 'Only super admins can create admin accounts');
        }

        const { name, email, password, adminRole } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const passError = validatePasswordStrength(password);
        if (passError) {
            return res.status(400).json({ error: passError });
        }

        const admins: User[] = (await fetchFromUpstash(KEY_ADMINS)) || [];

        if (admins.find((a: any) => a.email.toLowerCase() === email.toLowerCase())) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const newAdmin: User = {
            id: crypto.randomUUID(),
            name,
            email,
            password,
            role: 'admin',
            adminRole: adminRole || 'support',
            shortlistedUniversities: [],
            documents: {},
            notifications: [],
        };

        admins.push(newAdmin);
        await saveToUpstash(KEY_ADMINS, admins);

        const { password: _, ...safeAdmin } = newAdmin;
        return res.status(201).json(safeAdmin);

    } catch (error: any) {
        console.error('Admin Create Error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
