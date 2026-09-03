const crypto = require('crypto');

export default async function handler(req, res) {
  // 1. Izinkan akses CORS agar Userscript Tampermonkey tidak terblokir
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Tangani Preflight Options Request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Ambil Kredensial dari Environment Variables Vercel
  const merchantId = process.env.TOKOPAY_MERCHANT_ID;
  const secretKey = process.env.TOKOPAY_SECRET_KEY;

  if (!merchantId || !secretKey) {
    console.error('[TOKOPAY ERROR] Environment variable TOKOPAY_MERCHANT_ID atau TOKOPAY_SECRET_KEY belum dipasang di Vercel!');
    return res.status(500).json({
      status: false,
      error: 'Konfigurasi Server Belum Lengkap: Merchant ID / Secret Key tidak ditemukan di Vercel Environment Variables.'
    });
  }

  // =========================================================================
  // METODE 1: POST (Membuat Order QRIS Baru)
  // =========================================================================
  if (req.method === 'POST') {
    try {
      const { nominal, ref_id, channel = 'QRIS', produk = 'Topup Lisensi SIPGN' } = req.body || {};

      if (!nominal || !ref_id) {
        return res.status(400).json({ status: false, error: 'Parameter nominal dan ref_id wajib diisi.' });
      }

      // Rumus Signature Tokopay Create Order: MD5(merchant_id + secret_key + ref_id)
      const rawSignature = `${merchantId}${secretKey}${ref_id}`;
      const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

      // Endpoint Resmi Tokopay Create Order
      const apiUrl = `https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&metode=${channel}&signature=${signature}`;

      console.log(`[TOKOPAY INFO] Membuat Order QRIS: RefID=${ref_id}, Nominal=${nominal}`);

      const response = await fetch(apiUrl);
      const data = await response.json();

      console.log('[TOKOPAY RESPONSE CREATE]:', JSON.stringify(data));

      if (data && data.status === 1) {
        return res.status(200).json({
          status: true,
          data: data.data
        });
      } else {
        return res.status(400).json({
          status: false,
          error: data.error_msg || data.message || 'Gagal membuat order QRIS di Tokopay.',
          raw: data
        });
      }
    } catch (err) {
      console.error('[TOKOPAY EXCEPTION CREATE]:', err.message);
      return res.status(500).json({ status: false, error: err.message });
    }
  }

  // =========================================================================
  // METODE 2: GET (Cek Status Pembayaran / Polling)
  // =========================================================================
  if (req.method === 'GET') {
    try {
      const { ref_id, nominal } = req.query;

      if (!ref_id || !nominal) {
        return res.status(400).json({ status: false, error: 'Parameter query ref_id dan nominal wajib diisi.' });
      }

      // Rumus Signature Tokopay Check Status: MD5(merchant_id + secret_key + ref_id)
      const rawSignature = `${merchantId}${secretKey}${ref_id}`;
      const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

      // Endpoint Resmi Tokopay Cek Status Order
      const apiUrl = `https://api.tokopay.id/v1/order/status?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&signature=${signature}`;

      const response = await fetch(apiUrl);
      const data = await response.json();

      console.log(`[TOKOPAY STATUS CHECK] RefID=${ref_id}:`, JSON.stringify(data));

      return res.status(200).json(data);
    } catch (err) {
      console.error('[TOKOPAY EXCEPTION STATUS]:', err.message);
      return res.status(500).json({ status: false, error: err.message });
    }
  }

  return res.status(405).json({ status: false, error: 'Method Not Allowed' });
}
