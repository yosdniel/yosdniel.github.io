const crypto = require('crypto');

// Pemetaan Paket & Harga di Sisi Server (Harga Dasar)
const HARGA_PAKET = {
  1: 5000,
  7: 25000,
  14: 40000,
  30: 70000,
  60: 100000
};

// Versi Userscript Terbaru & URL Download untuk Auto Update Checker
const VERSIONS = {
  latest_version: '1.5.18',
  download_url: 'https://mindspace-id.vercel.app/files/sipgn-autofill.user.js',
  changelog: 'Peningkatan stabilitas integrity check & auto-update checker.'
};

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

  // =========================================================================
  // METODE GET: Public Endpoints (Tanpa Perlu Auth Merchant Key Tokopay)
  // =========================================================================
  if (req.method === 'GET') {
    const action = req.query.action;

    // 1. Endpoint Cek Versi Terbaru Userscript
    if (action === 'check_version') {
      return res.status(200).json({
        status: true,
        version: VERSIONS.latest_version,
        download_url: VERSIONS.download_url,
        changelog: VERSIONS.changelog
      });
    }

    // 2. Endpoint Ambil Daftar Paket
    if (action === 'get_packages') {
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
  }

  // =========================================================================
  // VALiDASI KONFIGURASI MERCHANTOKOPAY
  // =========================================================================
  const merchantId = process.env.TOKOPAY_MERCHANT_ID;
  const secretKey = process.env.TOKOPAY_SECRET_KEY;

  if (!merchantId || !secretKey) {
    return res.status(500).json({
      status: false,
      error: 'Konfigurasi Vercel Belum Lengkap: TOKOPAY_MERCHANT_ID / TOKOPAY_SECRET_KEY kosong.'
    });
  }

  // =========================================================================
  // METODE POST: Membuat Order QRIS Tokopay
  // =========================================================================
  if (req.method === 'POST') {
    try {
      const { paket_hari, ref_id, channel = 'QRISREALTIME' } = req.body || {};

      if (!paket_hari || !ref_id) {
        return res.status(400).json({ status: false, error: 'Parameter paket_hari dan ref_id wajib diisi.' });
      }

      const nominal = HARGA_PAKET[Number(paket_hari)];
      if (!nominal) {
        return res.status(400).json({ status: false, error: 'Pilihan paket tidak valid.' });
      }

      const daftarChannel = Array.from(new Set([channel, 'QRISREALTIME', 'QRIS_REALTIME', 'QRIS2', 'QRIS']));
      let lastResponse = null;

      for (const channelCode of daftarChannel) {
        // Generasi Signature Tokopay: md5(merchantId:secretKey:ref_id)
        const rawSignature = `${merchantId}:${secretKey}:${ref_id}`;
        const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

        const apiUrl = `https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&metode=${channelCode}&signature=${signature}`;

        console.log(`[TOKOPAY CREATE] RefID=${ref_id}, Paket=${paket_hari} Hari, Nominal=${nominal}, Channel=${channelCode}`);

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
        error: lastResponse?.error_msg || lastResponse?.message || 'Gagal membuat QRIS Tokopay.',
        raw: lastResponse
      });

    } catch (err) {
      console.error('[TOKOPAY EXCEPTION CREATE]:', err.message);
      return res.status(500).json({ status: false, error: err.message });
    }
  }

  // =========================================================================
  // METODE GET: Cek Status Pembayaran QRIS Tokopay
  // =========================================================================
  if (req.method === 'GET') {
    try {
      const { ref_id, metode = 'QRISREALTIME' } = req.query;

      if (!ref_id) {
        return res.status(400).json({ status: false, error: 'Parameter ref_id wajib diisi.' });
      }

      // Generasi Signature Tokopay: md5(merchantId:secretKey:ref_id)
      const rawSignature = `${merchantId}:${secretKey}:${ref_id}`;
      const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

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
            if (statusVal === 'Success' || statusVal === 1 || statusVal === true || statusVal === 'Paid') {
              break;
            }
          }
        } catch (innerErr) {
          console.warn(`[TOKOPAY STATUS WARN] ${endpointUrl}:`, innerErr.message);
        }
      }

      if (!hasilData) {
        return res.status(404).json({ status: false, error: 'Transaksi tidak ditemukan.' });
      }

      return res.status(200).json(hasilData);
    } catch (err) {
      console.error('[TOKOPAY EXCEPTION STATUS]:', err.message);
      return res.status(500).json({ status: false, error: err.message });
    }
  }

  return res.status(405).json({ status: false, error: 'Method Not Allowed' });
}
