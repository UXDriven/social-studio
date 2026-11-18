// This endpoint exposes ONLY Supabase's public project URL and publishable key.
// Never return a service_role key, database password, secret key, or access token.
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return res.status(503).json({ configured: false, error: 'Supabase not configured' });
  }
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(500).json({ configured: false }); }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') ||
      !(key.startsWith('sb_publishable_') || key.startsWith('eyJ'))) {
    return res.status(500).json({ configured: false, error: 'Invalid Supabase public settings' });
  }
  return res.status(200).json({ configured: true, url: parsed.origin, key });
}
