export default async function handler(req, res) {
  // Atur header CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, error: 'Method Not Allowed' });
  }

  try {
    const { password } = req.body || {};
    const correctPassword = process.env.GENERATOR_PASSWORD;

    if (!correctPassword) {
      return res.status(500).json({
        status: false,
        error: 'Konfigurasi Vercel Belum Lengkap: GENERATOR_PASSWORD belum diatur di ENV.'
      });
    }

    if (password === correctPassword) {
      return res.status(200).json({ status: true, message: 'Akses Diterima' });
    } else {
      return res.status(401).json({ status: false, error: 'Password salah!' });
    }
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
}
