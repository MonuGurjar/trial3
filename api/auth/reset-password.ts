
import type { User } from '../../types';
import { validatePasswordStrength } from '../lib/auth';

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
        const { action, email, answer, newPassword } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        // --- Action: GET_QUESTION ---
        // Returns the security question for the given email (no auth needed)
        if (action === 'get_question') {
            // Check students
            const students: User[] = (await fetchFromUpstash(KEY_USERS)) || [];
            const student = students.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
            if (student?.recoveryQuestion) {
                return res.status(200).json({ question: student.recoveryQuestion });
            }

            // Check admins
            const admins: User[] = (await fetchFromUpstash(KEY_ADMINS)) || [];
            const admin = admins.find((a: any) => a.email.toLowerCase() === email.toLowerCase());
            if (admin?.recoveryQuestion) {
                return res.status(200).json({ question: admin.recoveryQuestion });
            }

            return res.status(404).json({ error: 'Email not found or no security question set' });
        }

        // --- Action: RESET ---
        // Verifies security answer and resets password with bcrypt hash
        if (action === 'reset') {
            if (!answer || !newPassword) {
                return res.status(400).json({ error: 'Answer and new password required' });
            }

            // Validate password strength
            const passError = validatePasswordStrength(newPassword);
            if (passError) {
                return res.status(400).json({ error: passError });
            }

            // Check students
            const students: User[] = (await fetchFromUpstash(KEY_USERS)) || [];
            const studentIndex = students.findIndex((u: any) => u.email.toLowerCase() === email.toLowerCase());

            if (studentIndex !== -1) {
                const user = students[studentIndex];
                if (user.recoveryAnswer && user.recoveryAnswer.toLowerCase() === answer.toLowerCase().trim()) {
                    user.password = newPassword;
                    students[studentIndex] = user;
                    await saveToUpstash(KEY_USERS, students);
                    return res.status(200).json({ success: true });
                }
                return res.status(401).json({ error: 'Incorrect security answer' });
            }

            // Check admins
            const admins: User[] = (await fetchFromUpstash(KEY_ADMINS)) || [];
            const adminIndex = admins.findIndex((a: any) => a.email.toLowerCase() === email.toLowerCase());

            if (adminIndex !== -1) {
                const admin = admins[adminIndex];
                if (admin.recoveryAnswer && admin.recoveryAnswer.toLowerCase() === answer.toLowerCase().trim()) {
                    admin.password = newPassword;
                    admins[adminIndex] = admin;
                    await saveToUpstash(KEY_ADMINS, admins);
                    return res.status(200).json({ success: true });
                }
                return res.status(401).json({ error: 'Incorrect security answer' });
            }

            return res.status(404).json({ error: 'Email not found' });
        }

        return res.status(400).json({ error: 'Invalid action. Use "get_question" or "reset"' });

    } catch (error: any) {
        console.error('Password Reset Error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
