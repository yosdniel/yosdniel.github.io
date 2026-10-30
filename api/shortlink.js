/**
 * MindLink Cloud URL Shortener Backend API
 * Domain: minduniverse.id
 * Handles shortlink creation, cloud memory persistence, click tracking, and auto-redirection.
 */

// Memory Database
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
  // 1. Set Universal CORS & Access Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle Preflight Request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'minduniverse.id';
    const reqUrl = req.url || '';
    const fullUrl = `${protocol}://${host}${reqUrl}`;
    const urlObj = new URL(fullUrl);
    
    // Extrak Parameter
    const action = urlObj.searchParams.get('action');
    let aliasQuery = urlObj.searchParams.get('alias') || urlObj.searchParams.get('r');

    // Detector Path Otomatis jika URL diakses langsung (contoh: minduniverse.id/pay)
    if (!aliasQuery && !action) {
      const pathname = urlObj.pathname.replace(/^\/+|\/+$/g, '');
      if (pathname && !pathname.startsWith('api') && !pathname.includes('.')) {
        aliasQuery = pathname;
      }
    }

    // 2. Auto-Redirect / Resolve Shortlink (contoh: /pay -> Destination URL)
    if (aliasQuery && aliasQuery !== 'shortlink') {
      const found = memoryStorage.find(l => l.alias.toLowerCase() === aliasQuery.toLowerCase());
      
      if (found) {
        found.clicks = (found.clicks || 0) + 1;
        res.writeHead(302, { Location: found.long_url });
        return res.end();
      } else {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head><title>404 Shortlink Tidak Ditemukan</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
          <body style="background:#020617;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;">
            <div>
              <h1 style="color:#f43f5e;font-size:32px;">404 Not Found</h1>
              <p style="color:#94a3b8;">Shortlink <b>minduniverse.id/${aliasQuery}</b> tidak ditemukan atau telah dihapus.</p>
              <a href="https://minduniverse.id" style="color:#818cf8;text-decoration:none;font-weight:bold;">← Kembali ke Halaman Utama</a>
            </div>
          </body>
          </html>
        `);
      }
    }

    // 3. Get All Saved Shortlinks (GET ?action=get_all)
    if (req.method === 'GET' && action === 'get_all') {
      return res.status(200).json({ success: true, links: memoryStorage });
    }

    // 4. Create New Shortlink (POST)
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
        message: 'Shortlink berhasil disimpan ke minduniverse.id cloud database',
        link: newLink
      });
    }

    // Default API Status Response
    return res.status(200).json({
      name: 'MindLink Cloud API Engine',
      domain: 'minduniverse.id',
      status: 'online',
      total_links: memoryStorage.length
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
                                                        }
