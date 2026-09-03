const crypto = require('crypto');

export default async function handler(req, res) {
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

  const merchantId = process.env.TOKOPAY_MERCHANT_ID;
  const secretKey = process.env.TOKOPAY_SECRET_KEY;

  if (!merchantId || !secretKey) {
    return res.status(500).json({
      status: false,
      error: 'Konfigurasi Vercel Belum Lengkap: TOKOPAY_MERCHANT_ID / TOKOPAY_SECRET_KEY kosong.'
    });
  }

  // =========================================================================
  // METODE POST: Membuat Order QRIS
  // =========================================================================
  if (req.method === 'POST') {
    try {
      const { nominal, ref_id, channel = 'QRISREALTIME' } = req.body || {};

      if (!nominal || !ref_id) {
        return res.status(400).json({ status: false, error: 'Parameter nominal dan ref_id wajib diisi.' });
      }

      // Prioritaskan QRISREALTIME sesuai log Tokopay kamu
      const daftarChannel = Array.from(new Set([channel, 'QRISREALTIME', 'QRIS_REALTIME', 'QRIS2', 'QRIS']));
      let lastResponse = null;

      for (const channelCode of daftarChannel) {
        const rawSignature = `${merchantId}${secretKey}${ref_id}`;
        const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

        const apiUrl = `https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&metode=${channelCode}&signature=${signature}`;

        console.log(`[TOKOPAY CREATE] Mencoba Order RefID=${ref_id}, Nominal=${nominal}, Channel=${channelCode}`);

        const response = await fetch(apiUrl);
        const data = await response.json();

        console.log(`[TOKOPAY RESPONSE ${channelCode}]:`, JSON.stringify(data));

        // FIX: Cek status berupa angka 1 ATAU string "Success" / "Unpaid"
        const isSuccess = data && (data.status === 1 || data.status === 'Success' || data.status === 'Unpaid');

        if (isSuccess && data.data) {
          // LANGSUNG RETURN AGAR LOOP BERHENTI
          return res.status(200).json({
            status: true,
            channel_used: channelCode,
            data: data.data
          });
        }

        lastResponse = data;
      }

      return res.status(400).json({
        status: false,
        error: lastResponse?.error_msg || lastResponse?.message || 'Gagal membuat QRIS.',
        raw: lastResponse
      });

    } catch (err) {
      console.error('[TOKOPAY EXCEPTION CREATE]:', err.message);
      return res.status(500).json({ status: false, error: err.message });
    }
  }

  // =========================================================================
  // METODE GET: Cek Status Pembayaran (Polling)
  // =========================================================================
  if (req.method === 'GET') {
    try {
      const { ref_id, nominal } = req.query;

      if (!ref_id || !nominal) {
        return res.status(400).json({ status: false, error: 'Parameter ref_id & nominal wajib.' });
      }

      const rawSignature = `${merchantId}${secretKey}${ref_id}`;
      const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

      const apiUrl = `https://api.tokopay.id/v1/order/status?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&signature=${signature}`;

      const response = await fetch(apiUrl);
      const data = await response.json();

      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ status: false, error: err.message });
    }
  }

  return res.status(405).json({ status: false, error: 'Method Not Allowed' });
}
