import crypto from 'crypto';

export default async function handler(req, res) {
  // Setup CORS Header agar Userscript bisa akses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const MERCHANT_ID = process.env.TOKOPAY_MERCHANT_ID;
  const SECRET_KEY = process.env.TOKOPAY_SECRET_KEY;

  try {
    // 1. ENDPOINT: Buat Order
    if (req.method === 'POST') {
      const { nominal, ref_id, channel, produk } = req.body;

      if (!nominal || !ref_id) {
        return res.status(400).json({ status: false, msg: 'Missing parameters' });
      }

      // Hitung Signature MD5 menggunakan module crypto Node.js
      const signatureStr = `${MERCHANT_ID}${SECRET_KEY}${ref_id}`;
      const signature = crypto.createHash('md5').update(signatureStr).digest('hex');

      const payload = {
        merchant_id: MERCHANT_ID,
        secret: SECRET_KEY,
        ref_id: ref_id,
        nominal: parseInt(nominal, 10),
        channel: channel || 'QRIS',
        produk: produk || 'Topup Lisensi SIPGN',
        signature: signature,
      };

      const response = await fetch('https://api.tokopay.id/v1/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      return res.status(200).json(data);
    }

    // 2. ENDPOINT: Cek Status Order
    if (req.method === 'GET') {
      const { ref_id, nominal } = req.query;

      if (!ref_id || !nominal) {
        return res.status(400).json({ status: false, msg: 'Missing query parameters' });
      }

      const signatureStr = `${MERCHANT_ID}${SECRET_KEY}${ref_id}`;
      const signature = crypto.createHash('md5').update(signatureStr).digest('hex');

      const tokopayUrl = `https://api.tokopay.id/v1/order/status?merchant=${MERCHANT_ID}&secret=${SECRET_KEY}&ref_id=${ref_id}&nominal=${nominal}&signature=${signature}`;

      const response = await fetch(tokopayUrl);
      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
  }
