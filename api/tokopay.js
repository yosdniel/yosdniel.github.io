const crypto = require('crypto');

export default async function handler(req, res) {
  // 1. Header CORS untuk mendukung panggilan dari Userscript Tampermonkey
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Penanganan HTTP Preflight Options
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Ambil Kredensial Merchant dari Environment Variables Vercel
  const merchantId = process.env.TOKOPAY_MERCHANT_ID;
  const secretKey = process.env.TOKOPAY_SECRET_KEY;

  if (!merchantId || !secretKey) {
    console.error('[TOKOPAY CONFIG ERROR] TOKOPAY_MERCHANT_ID atau TOKOPAY_SECRET_KEY belum dikonfigurasi di Environment Variables Vercel!');
    return res.status(500).json({
      status: false,
      error: 'Konfigurasi Server Belum Lengkap: TOKOPAY_MERCHANT_ID / TOKOPAY_SECRET_KEY tidak ditemukan.'
    });
  }

  // =========================================================================
  // METODE POST: Membuat Order QRIS Realtime
  // =========================================================================
  if (req.method === 'POST') {
    try {
      const { nominal, ref_id, channel, produk = 'Topup Lisensi SIPGN' } = req.body || {};

      if (!nominal || !ref_id) {
        return res.status(400).json({ status: false, error: 'Parameter nominal dan ref_id wajib diisi.' });
      }

      // Daftar variasi penulisan channel QRIS Realtime di Tokopay
      // Urutan pertama diutamakan sesuai input atau default QRISREALTIME
      const targetChannel = channel || 'QRISREALTIME';
      const daftarChannel = Array.from(new Set([targetChannel, 'QRISREALTIME', 'QRIS_REALTIME', 'QRIS2', 'QRIS']));

      let lastResponse = null;

      for (const channelCode of daftarChannel) {
        // Rumus Signature Tokopay: MD5(merchant_id + secret_key + ref_id)
        const rawSignature = `${merchantId}${secretKey}${ref_id}`;
        const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

        const apiUrl = `https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&metode=${channelCode}&signature=${signature}`;

        console.log(`[TOKOPAY CREATE] Mencoba Order RefID=${ref_id}, Nominal=${nominal}, Channel=${channelCode}`);

        const response = await fetch(apiUrl);
        const data = await response.json();

        console.log(`[TOKOPAY RESPONSE ${channelCode}]:`, JSON.stringify(data));

        if (data && data.status === 1) {
          return res.status(200).json({
            status: true,
            channel_used: channelCode,
            data: data.data
          });
        }

        lastResponse = data;
      }

      // Jika seluruh pilihan channel di atas ditolak oleh Tokopay
      return res.status(400).json({
        status: false,
        error: lastResponse?.error_msg || lastResponse?.message || 'Gagal membuat QRIS. Pastikan channel QRIS Realtime di Tokopay sudah diaktifkan.',
        raw: lastResponse
      });

    } catch (err) {
      console.error('[TOKOPAY EXCEPTION CREATE]:', err.message);
      return res.status(500).json({ status: false, error: err.message });
    }
  }

  // =========================================================================
  // METODE GET: Polling Status Pembayaran Order
  // =========================================================================
  if (req.method === 'GET') {
    try {
      const { ref_id, nominal } = req.query;

      if (!ref_id || !nominal) {
        return res.status(400).json({ status: false, error: 'Parameter query ref_id dan nominal wajib diisi.' });
      }

      // Rumus Signature Cek Status: MD5(merchant_id + secret_key + ref_id)
      const rawSignature = `${merchantId}${secretKey}${ref_id}`;
      const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

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
