/**
 * Admin Seed Script
 * 
 * Creates the initial super_admin account directly in Upstash.
 * Run once after deploying, then delete this script.
 * 
 * Usage:
 *   node scripts/seed-admin.mjs
 * 
 * Environment:
 *   Reads from .env automatically.
 */

import { readFileSync } from 'fs';

// Load .env
const envFile = readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/);
    if (match) env[match[1].trim()] = match[2];
});

const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;
const KEY_ADMINS = 'admin.json';

if (!KV_URL || !KV_TOKEN) {
    console.error('❌ Missing KV_REST_API_URL or KV_REST_API_TOKEN in .env');
    process.exit(1);
}

// ========== CONFIGURE YOUR ADMIN HERE ==========
const ADMIN_NAME = 'Super Admin';
const ADMIN_EMAIL = 'admin@medrussia.com';
const ADMIN_PASSWORD = 'Admin@123';  // Change this!
const ADMIN_ROLE = 'super_admin';
// ================================================

async function fetchFromUpstash(key) {
    const response = await fetch(`${KV_URL}/get/${key}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.result) return null;
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
}

async function saveToUpstash(key, value) {
    const response = await fetch(`${KV_URL}/set/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        body: JSON.stringify(value),
    });
    if (!response.ok) {
        throw new Error(`Failed to save to Upstash: ${response.status}`);
    }
}

async function main() {
    console.log('🔑 Creating super admin account...\n');

    // Check existing admins
    const admins = (await fetchFromUpstash(KEY_ADMINS)) || [];
    console.log(`  Found ${admins.length} existing admin(s)`);

    // Check if email already exists
    if (admins.find(a => a.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())) {
        console.log(`  ⚠️  Admin with email "${ADMIN_EMAIL}" already exists.`);
        console.log('  Updating password (plain text)...\n');

        const admin = admins.find(a => a.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        admin.password = ADMIN_PASSWORD;
        admin.role = 'admin';
        admin.adminRole = ADMIN_ROLE;

        await saveToUpstash(KEY_ADMINS, admins);
        console.log('  ✅ Admin password updated!');
        console.log(`  📧 Email: ${ADMIN_EMAIL}`);
        console.log(`  👑 Role: ${ADMIN_ROLE}`);
        return;
    }

    // Create new admin (plain text password)
    const newAdmin = {
        id: crypto.randomUUID(),
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: 'admin',
        adminRole: ADMIN_ROLE,
        shortlistedUniversities: [],
        documents: {},
        notifications: [],
    };

    admins.push(newAdmin);
    await saveToUpstash(KEY_ADMINS, admins);

    console.log('  ✅ Super admin created successfully!\n');
    console.log(`  📧 Email:    ${ADMIN_EMAIL}`);
    console.log(`  🔑 Password: ${ADMIN_PASSWORD}`);
    console.log(`  👑 Role:     ${ADMIN_ROLE}`);
    console.log(`  🆔 ID:       ${newAdmin.id}`);
    console.log('\n  ⚠️  Change the password after first login!');
    console.log('  ⚠️  Delete this script after use!');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
