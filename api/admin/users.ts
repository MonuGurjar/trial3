
import type { User } from '../../types';
import { extractAuthNode, nodeUnauthorized, nodeForbidden } from '../../lib/auth';

const KEY_USERS = 'med_russia:users';
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

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // SECURITY: Verify admin JWT
        const auth = await extractAuthNode(req);
        if (!auth) return nodeUnauthorized(res);
        if (auth.role !== 'admin') return nodeForbidden(res);

        const { type } = req.body;

        const targetKey = type === 'admins' ? KEY_ADMINS : KEY_USERS;
        const users: User[] = (await fetchFromUpstash(targetKey)) || [];

        const safeUsers = users.map(({ password, ...u }: any) => u);

        return res.status(200).json(safeUsers);

    } catch (error: any) {
        console.error('Admin API Error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
