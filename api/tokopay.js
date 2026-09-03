const crypto = require('crypto');

// Pemetaan Paket & Harga di Sisi Server (Harga Dasar sebelum hitung QRIS Fee)
const HARGA_PAKET = {
  1: 5000,
  7: 20000,
  14: 35000,
  30: 50000
};

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

  // =========================================================================
  // METODE GET: Ambil Daftar Paket (Tanpa Perlu Auth Tokopay)
  // =========================================================================
  if (req.method === 'GET' && req.query.action === 'get_packages') {
    const packages = Object.entries(HARGA_PAKET).map(([hari, harga]) => ({
      hari: Number(hari),
      harga: harga,
      nama: `Paket ${hari} Hari`,
      selected: Number(hari) === 7
    }));

    return res.status(200).json({
      status: true,
      packages: packages
    });
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
  // METODE POST: Membuat Order QRIS (Nominal Dikunci di Server)
  // =========================================================================
  if (req.method === 'POST') {
    try {
      const { paket_hari, ref_id, channel = 'QRISREALTIME' } = req.body || {};

      if (!paket_hari || !ref_id) {
        return res.status(400).json({ status: false, error: 'Parameter paket_hari dan ref_id wajib diisi.' });
      }

      // Validasi dan Ambil Nominal Langsung dari Mapping Server
      const nominal = HARGA_PAKET[Number(paket_hari)];
      if (!nominal) {
        return res.status(400).json({ status: false, error: 'Pilihan paket tidak valid.' });
      }

      const daftarChannel = Array.from(new Set([channel, 'QRISREALTIME', 'QRIS_REALTIME', 'QRIS2', 'QRIS']));
      let lastResponse = null;

      for (const channelCode of daftarChannel) {
        // Format signature umum Tokopay: merchant + secret + ref_id
        const rawSignature = `${merchantId}${secretKey}${ref_id}`;
        const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

        const apiUrl = `https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&metode=${channelCode}&signature=${signature}`;

        console.log(`[TOKOPAY CREATE] Mencoba Order RefID=${ref_id}, Paket=${paket_hari} Hari, Nominal=${nominal}, Channel=${channelCode}`);

        const response = await fetch(apiUrl);
        const data = await response.json();

        console.log(`[TOKOPAY RESPONSE ${channelCode}]:`, JSON.stringify(data));

        const isSuccess = data && (data.status === 1 || data.status === true || data.status === 'Success' || data.status === 'Unpaid');

        if (isSuccess && data.data) {
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
  // METODE GET: Cek Status Pembayaran (Tanpa Wajib Parameter Nominal Client)
  // =========================================================================
  if (req.method === 'GET') {
    try {
      const { ref_id, metode = 'QRISREALTIME' } = req.query;

      if (!ref_id) {
        return res.status(400).json({ status: false, error: 'Parameter ref_id wajib.' });
      }

      const rawSignature = `${merchantId}${secretKey}${ref_id}`;
      const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

      // Endpoint pencarian status order berdasarkan ref_id
      const endpointList = [
        `https://api.tokopay.id/v1/order/status?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&signature=${signature}`,
        `https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&metode=${metode}&signature=${signature}`
      ];

      let hasilData = null;

      for (const endpointUrl of endpointList) {
        try {
          const response = await fetch(endpointUrl);
          const data = await response.json();

          if (data && (data.status !== undefined || data.data)) {
            hasilData = data;
            const statusVal = data?.data?.status || data?.status;
            if (statusVal === 'Success' || statusVal === 1 || statusVal === true) {
              break;
            }
          }
        } catch (innerErr) {
          console.warn(`[TOKOPAY STATUS CHECK WARN] Gagal pada endpoint ${endpointUrl}:`, innerErr.message);
        }
      }

      if (!hasilData) {
        return res.status(404).json({ status: false, error: 'Transaksi tidak ditemukan atau gagal di-check.' });
      }

      return res.status(200).json(hasilData);
    } catch (err) {
      console.error('[TOKOPAY EXCEPTION STATUS]:', err.message);
      return res.status(500).json({ status: false, error: err.message });
    }
  }

  return res.status(405).json({ status: false, error: 'Method Not Allowed' });
}
