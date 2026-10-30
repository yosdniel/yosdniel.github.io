/**
 * MindLink Cloud URL Shortener Backend API
 * Domain: minduniverse.id
 * Handles shortlink creation, storage, alias resolution, click tracking, and stats.
 */

// In-memory fallback cache when Vercel KV is initializing
let memoryStorage = [
  {
    id: 'lnk_sample_1',
    title: 'MindHUB Admin Portal',
    long_url: 'https://minduniverse.id/',
    alias: 'admin',
    short_url: 'https://minduniverse.id/admin',
    clicks: 142,
    created_at: new Date().toISOString()
  },
  {
    id: 'lnk_sample_2',
    title: 'Payment Gateway',
    long_url: 'https://minduniverse.id/payment',
    alias: 'pay',
    short_url: 'https://minduniverse.id/pay',
    clicks: 89,
    created_at: new Date().toISOString()
  }
];

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const urlObj = new URL(req.url, `https://${req.headers.host || 'minduniverse.id'}`);
  const action = urlObj.searchParams.get('action');
  const aliasQuery = urlObj.searchParams.get('alias') || urlObj.searchParams.get('r');

  // 1. Resolve / Redirect Shortlink (?r=alias or ?action=resolve)
  if (aliasQuery || action === 'resolve') {
    const targetAlias = aliasQuery || urlObj.searchParams.get('alias');
    const found = memoryStorage.find(l => l.alias.toLowerCase() === (targetAlias || '').toLowerCase());
    
    if (found) {
      found.clicks = (found.clicks || 0) + 1;
      // HTTP 302 Redirect to destination URL
      res.writeHead(302, { Location: found.long_url });
      res.end();
      return;
    } else {
      res.status(404).json({ error: 'Shortlink tidak ditemukan', alias: targetAlias });
      return;
    }
  }

  // 2. Get All Links (?action=get_all)
  if (req.method === 'GET' && action === 'get_all') {
    return res.status(200).json({ success: true, links: memoryStorage });
  }

  // 3. Create Shortlink (POST)
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }

      if (body.action === 'create_shortlink' || body.long_url) {
        const longUrl = body.long_url;
        let alias = (body.alias || '').trim().replace(/[^a-zA-Z0-9-_]/g, '');
        const title = (body.title || 'Tautan Pendek').trim();

        if (!longUrl) {
          return res.status(400).json({ success: false, error: 'URL tujuan (long_url) wajib diisi' });
        }

        // Generate random alias if empty or taken
        if (!alias) {
          alias = Math.random().toString(36).substring(2, 8);
        } else {
          const exists = memoryStorage.some(l => l.alias.toLowerCase() === alias.toLowerCase());
          if (exists) {
            alias = alias + '-' + Math.random().toString(36).substring(2, 5);
          }
        }

        const newLink = {
          id: 'lnk_' + Date.now(),
          title: title,
          long_url: longUrl,
          alias: alias,
          short_url: `https://minduniverse.id/${alias}`,
          clicks: 0,
          created_at: new Date().toISOString()
        };

        memoryStorage.unshift(newLink);

        return res.status(200).json({
          success: true,
          message: 'Shortlink berhasil dibuat di minduniverse.id',
          link: newLink
        });
      }

      return res.status(400).json({ success: false, error: 'Aksi atau payload tidak valid' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Default response
  return res.status(200).json({
    name: 'MindLink Cloud API',
    domain: 'minduniverse.id',
    status: 'active',
    endpoints: [
      'GET /api/shortlink?action=get_all',
      'POST /api/shortlink (action: create_shortlink)',
      'GET /api/shortlink?r=ALIAS'
    ]
  });
          }
