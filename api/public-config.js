// Only public Supabase configuration is returned to the browser.
// Deliberately reject secret keys, including legacy JWTs with service_role.
// All application data is protected by Supabase Auth and PostgreSQL RLS.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ configured: false, error: 'method_not_allowed' });
  }
  const environment = process.env.VERCEL_ENV || 'unknown';
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const missing = [
    ...(!url ? ['SUPABASE_URL'] : []),
    ...(!key ? ['SUPABASE_PUBLISHABLE_KEY'] : [])
  ];
  if (missing.length) {
    return res.status(503).json({ configured: false, environment, error: 'missing_variables', missing });
  }
  let parsed;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') ||
        parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
      return res.status(500).json({ configured: false, environment, error: 'invalid_url' });
    }
  } catch {
    return res.status(500).json({ configured: false, environment, error: 'invalid_url' });
  }
  let publicKey = key.startsWith('sb_publishable_') && key.length > 'sb_publishable_'.length;
  if (!publicKey && key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
      publicKey = payload.role === 'anon';
    } catch { publicKey = false; }
  }
  if (!publicKey) {
    return res.status(500).json({ configured: false, environment, error: 'invalid_publishable_key' });
  }
  return res.status(200).json({ configured: true, environment, url: parsed.origin, key });
}
