/**
 * MindLink Cloud URL Shortener Backend API
 * Domain: minduniverse.id
 * Handles shortlink creation, storage, alias resolution, and click tracking.
 */

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
  // CORS Headers untuk mengizinkan akses dari mana saja tanpa diblokir browser
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Penanganan HTTP Preflight OPTIONS Request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'minduniverse.id';
    const fullUrl = `${protocol}://${host}${req.url || ''}`;
    const urlObj = new URL(fullUrl);
    
    const action = urlObj.searchParams.get('action');
    const aliasQuery = urlObj.searchParams.get('alias') || urlObj.searchParams.get('r');

    // 1. Resolve / Redirect Shortlink (?r=alias)
    if (aliasQuery || action === 'resolve') {
      const targetAlias = aliasQuery || urlObj.searchParams.get('alias');
      const found = memoryStorage.find(l => l.alias.toLowerCase() === (targetAlias || '').toLowerCase());
      
      if (found) {
        found.clicks = (found.clicks || 0) + 1;
        res.writeHead(302, { Location: found.long_url });
        res.end();
        return;
      } else {
        return res.status(404).json({ error: 'Shortlink tidak ditemukan', alias: targetAlias });
      }
    }

    // 2. Get All Links (?action=get_all)
    if (req.method === 'GET' && action === 'get_all') {
      return res.status(200).json({ success: true, links: memoryStorage });
    }

    // 3. Create Shortlink (POST)
    if (req.method === 'POST') {
      let body = req.body;
      if (!body && req.readable) {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const rawBody = Buffer.concat(buffers).toString('utf8');
        if (rawBody) {
          try { body = JSON.parse(rawBody); } catch (e) { body = {}; }
        }
      }
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      body = body || {};

      const longUrl = body.long_url;
      let alias = (body.alias || '').trim().replace(/[^a-zA-Z0-9-_]/g, '');
      const title = (body.title || 'Tautan Pendek').trim();

      if (!longUrl) {
        return res.status(400).json({ success: false, error: 'URL tujuan (long_url) wajib diisi' });
      }

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

    // Default Status Response
    return res.status(200).json({
      name: 'MindLink Cloud API',
      domain: 'minduniverse.id',
      status: 'active',
      total_links: memoryStorage.length
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}
