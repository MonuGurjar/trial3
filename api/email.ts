
import * as nodemailerModule from 'nodemailer';
const nodemailer = (nodemailerModule as any).default || nodemailerModule;
import { extractAuthNode, nodeUnauthorized, nodeForbidden, nodeTooManyRequests } from '../lib/auth';
import { emailLimiter } from '../lib/rateLimit';

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // SECURITY: Require admin JWT — only admins can send emails
  const auth = await extractAuthNode(request);
  if (!auth) {
    return nodeUnauthorized(response);
  }
  if (auth.role !== 'admin') {
    return nodeForbidden(response, 'Only admins can send emails');
  }

  // Rate limit by user ID
  const rl = await emailLimiter(auth.userId);
  if (!rl.allowed) {
    return nodeTooManyRequests(response, 'Email rate limit exceeded. Please wait a moment.');
  }

  // Get Credentials from env
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return response.status(500).json({ error: 'Server Error: Gmail credentials not configured.' });
  }

  const {
    to_email,
    student_email,
    subject,
    html,
    text,
    student_name,
    counsellor_name,
    university_name,
    reply_message,
    neet_score,
    pcb_percentage
  } = request.body;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass,
      },
    });

    let emailHtml = html;
    let emailSubject = subject || 'MedRussia Update';
    let recipient = to_email || student_email;

    // Validate email format
    if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return response.status(400).json({ error: 'Invalid recipient email format' });
    }

    if (!html) {
      if (reply_message) {
        emailSubject = `Response from MedRussia Counsellor: ${counsellor_name || 'Team'}`;
        emailHtml = `<p>Dear ${student_name || 'Student'},</p><p>${reply_message}</p><p>Regards,<br>${counsellor_name || 'MedRussia Team'}</p>`;
      } else if (student_name) {
        emailSubject = `New Inquiry from ${student_name}`;
        emailHtml = `
               <h3>New Student Inquiry</h3>
               <p><strong>Name:</strong> ${student_name}</p>
               <p><strong>Email:</strong> ${student_email}</p>
               <p><strong>NEET Score:</strong> ${neet_score || 'N/A'}</p>
               <p><strong>PCB %:</strong> ${pcb_percentage || 'N/A'}</p>
               <p><strong>University:</strong> ${university_name || 'N/A'}</p>
             `;
        if (!recipient) recipient = user;
      }
    }

    if (!recipient) {
      return response.status(400).json({ error: 'No recipient email provided' });
    }

    const mailOptions = {
      from: `"MedRussia Bot" <${user}>`,
      to: recipient,
      subject: emailSubject,
      text: text || 'Please view this email in an HTML client.',
      html: emailHtml,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent by admin ${auth.email} to ${recipient}: ${info.messageId}`);
    return response.status(200).json({ success: true, messageId: info.messageId });

  } catch (error: any) {
    console.error('Gmail Send Error:', error);
    return response.status(500).json({ error: 'Failed to send email' });
  }
}
