
import * as cryptoModule from 'crypto';
const crypto = (cryptoModule as any).default || cryptoModule;
import { extractAuthNode, nodeUnauthorized } from '../lib/auth';

export default async function handler(request: any, response: any) {
    // SECURITY: Require auth for all upload/delete operations
    const auth = await extractAuthNode(request);
    if (!auth) {
        return nodeUnauthorized(response);
    }

    // Helper to get credentials from either individual vars or CLOUDINARY_URL
    const getCreds = () => {
        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            return {
                cloudName: process.env.CLOUDINARY_CLOUD_NAME,
                apiKey: process.env.CLOUDINARY_API_KEY,
                apiSecret: process.env.CLOUDINARY_API_SECRET,
                uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
            };
        }
        if (process.env.CLOUDINARY_URL) {
            try {
                const regex = /cloudinary:\/\/([^:]+):([^@]+)@(.+)/;
                const match = process.env.CLOUDINARY_URL.match(regex);
                if (match) {
                    return {
                        apiKey: match[1],
                        apiSecret: match[2],
                        cloudName: match[3],
                        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
                    };
                }
            } catch (e) { console.error("Failed to parse CLOUDINARY_URL"); }
        }
        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET) {
            return {
                cloudName: process.env.CLOUDINARY_CLOUD_NAME,
                uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET,
                apiKey: null,
                apiSecret: null
            };
        }
        return null;
    };

    const creds = getCreds();
    if (!creds) {
        return response.status(500).json({ error: 'Storage configuration missing on server' });
    }

    // --- DELETE FILE (Signed) ---
    if (request.method === 'DELETE') {
        // SECURITY: Only admins can delete files
        if (auth.role !== 'admin') {
            return response.status(403).json({ error: 'Only admins can delete files' });
        }

        if (!creds.apiKey || !creds.apiSecret) {
            return response.status(500).json({ error: 'API Key/Secret required for deletion' });
        }

        const { public_id, resource_type = 'image' } = request.body;

        if (!public_id || typeof public_id !== 'string') {
            return response.status(400).json({ error: 'Valid public_id is required' });
        }

        const timestamp = Math.round(new Date().getTime() / 1000).toString();

        const paramsToSign = `public_id=${public_id}&timestamp=${timestamp}`;
        const signature = crypto.createHash('sha1').update(paramsToSign + creds.apiSecret).digest('hex');

        const formData = new FormData();
        formData.append('public_id', public_id);
        formData.append('api_key', creds.apiKey);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);

        const url = `https://api.cloudinary.com/v1_1/${creds.cloudName}/${resource_type}/destroy`;

        try {
            const res = await fetch(url, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.result !== 'ok' && data.result !== 'not found') {
                throw new Error(data.error?.message || 'Cloudinary delete failed');
            }
            console.log(`File deleted by admin ${auth.email}: ${public_id}`);
            return response.status(200).json({ success: true, result: data });
        } catch (error: any) {
            console.error('Delete Proxy Error:', error);
            return response.status(500).json({ error: 'Delete failed' });
        }
    }

    // --- UPLOAD FILE (Unsigned) ---
    if (request.method === 'POST') {
        try {
            const { fileData } = request.body;

            if (!fileData || typeof fileData !== 'string') {
                return response.status(400).json({ error: 'No file data provided' });
            }

            // SECURITY: Validate file type via data URL prefix
            const allowedPrefixes = [
                'data:image/jpeg', 'data:image/jpg', 'data:image/png',
                'data:image/webp', 'data:application/pdf'
            ];
            const isAllowedType = allowedPrefixes.some(prefix => fileData.startsWith(prefix));
            if (!isAllowedType) {
                return response.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.' });
            }

            // SECURITY: Validate file size (base64 is ~33% larger than binary, so 7MB base64 ≈ 5MB file)
            if (fileData.length > 7 * 1024 * 1024) {
                return response.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
            }

            const url = `https://api.cloudinary.com/v1_1/${creds.cloudName}/auto/upload`;

            const formData = new FormData();
            formData.append('file', fileData);
            formData.append('upload_preset', creds.uploadPreset);

            const res = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error?.message || 'Upload failed');
            }

            const data = await res.json();
            console.log(`File uploaded by user ${auth.email}: ${data.public_id}`);
            return response.status(200).json({
                secure_url: data.secure_url,
                public_id: data.public_id,
                format: data.format,
                resource_type: data.resource_type
            });

        } catch (error: any) {
            console.error('Upload Proxy Error:', error);
            return response.status(500).json({ error: 'Upload failed' });
        }
    }

    return response.status(405).json({ error: 'Method Not Allowed' });
}
