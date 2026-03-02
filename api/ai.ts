
import { extractAuthNode, nodeUnauthorized, nodeTooManyRequests } from './lib/auth';
import { aiLimiter } from './lib/rateLimit';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // SECURITY: Require valid JWT
  const auth = await extractAuthNode(request);
  if (!auth) {
    return nodeUnauthorized(response);
  }

  // Rate limit by user ID
  const rl = await aiLimiter(auth.userId);
  if (!rl.allowed) {
    return nodeTooManyRequests(response, 'AI rate limit exceeded. Please wait a moment.');
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ error: 'Server Error: GROQ_API_KEY is not configured.' });
  }

  try {
    const { messages, model, jsonMode, temperature } = request.body;

    if (!messages || !Array.isArray(messages)) {
      return response.status(400).json({ error: 'Messages array required' });
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages,
        model: model || "llama-3.3-70b-versatile",
        response_format: jsonMode ? { type: "json_object" } : undefined,
        temperature: temperature || 0.7,
        max_tokens: 2048  // SECURITY: Limit tokens to prevent cost abuse
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      return response.status(groqResponse.status).json({ error: 'AI service error' });
    }

    const data = await groqResponse.json();
    return response.status(200).json(data);

  } catch (error: any) {
    console.error('AI Proxy Error:', error);
    return response.status(500).json({ error: 'Server error' });
  }
}
