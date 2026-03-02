
import { extractAuthNode, nodeUnauthorized, nodeForbidden } from './lib/auth';

const ALLOWED_KEYS = new Set([
    'med_russia:feedback',
    'med_russia:settings',
    'med_russia:chat_logs',
    'med_russia:platform_feedback'
]);

async function upstashRest(command: string, args: any[]) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        throw new Error('Database configuration missing');
    }

    const response = await fetch(`${url}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify([command, ...args]),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
    }

    const data = await response.json();
    return data.result;
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { command, key, value } = req.body;

        if (!command || !key) {
            return res.status(400).json({ error: 'Command and key required' });
        }

        if (!ALLOWED_KEYS.has(key)) {
            return res.status(403).json({ error: 'Access denied: Key not allowed' });
        }

        if (command !== 'GET' && command !== 'SET') {
            return res.status(403).json({ error: 'Access denied: Command not allowed' });
        }

        // Public keys that can be read without auth (settings, feedback for landing page)
        const PUBLIC_READ_KEYS = new Set([
            'med_russia:settings',
            'med_russia:feedback',
            'med_russia:platform_feedback'
        ]);

        const isPublicRead = command === 'GET' && PUBLIC_READ_KEYS.has(key);

        // If not a public read, require auth
        if (!isPublicRead) {
            const auth = await extractAuthNode(req);
            if (!auth) return nodeUnauthorized(res);

            // SET operations require admin role
            if (command === 'SET' && auth.role !== 'admin') {
                return nodeForbidden(res, 'Only admins can write data');
            }
        }

        const args = [key];
        if (command === 'SET') {
            args.push(typeof value === 'string' ? value : JSON.stringify(value));
        }

        const result = await upstashRest(command, args);
        return res.status(200).json({ result });

    } catch (error: any) {
        console.error('Data Proxy Error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
