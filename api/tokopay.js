const crypto = require('crypto');

// Pemetaan Paket & Harga di Sisi Server
const HARGA_PAKET = {
  1: 100,
  7: 25000,
  14: 40000,
  30: 70000,
  60: 100000
};

const VERSIONS = {
  latest_version: '1.5.21',
  download_url: 'https://mindspace-id.vercel.app/files/sipgn-autofill.user.js',
  changelog: 'Peningkatan stabilitas integrity check & auto-update checker.'
};

export default async function handler(req, res) {
  // Setup Header CORS Safety
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // WRAPPER UTAMA SUPAYA FUNCTION TIDAK CRASH (500 ERROR PREVENTER)
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    // =========================================================================
    // 1. METODE GET ENDPOINTS
    // =========================================================================
    if (req.method === 'GET') {
      const { action, device_id, ref_id, metode = 'QRISREALTIME' } = req.query || {};

      // A. CHECK VERSION
      if (action === 'check_version') {
        return res.status(200).json({
          status: true,
          version: VERSIONS.latest_version,
          download_url: VERSIONS.download_url,
          changelog: VERSIONS.changelog
        });
      }

      // B. GET PACKAGES
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

      // C. CHECK LICENSE
      if (action === 'check_license') {
        if (!device_id) {
          return res.status(200).json({ valid: false, msg: 'Parameter device_id wajib diisi.' });
        }

        if (!SUPABASE_URL || !SUPABASE_KEY) {
          return res.status(200).json({ 
            valid: false, 
            msg: 'Environment Variables Supabase belum terpasang di Vercel.' 
          });
        }

        try {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(device_id)}&select=*`, {
            method: 'GET',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          });

          const data = await response.json();

          if (!response.ok || !Array.isArray(data) || data.length === 0) {
            return res.status(200).json({ valid: false, msg: 'Lisensi tidak ditemukan.' });
          }

          const lisensi = data[0];
          const hariIniWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

          if (lisensi.status === 'revoked') {
            return res.status(200).json({ valid: false, msg: 'Lisensi Anda telah dicabut oleh Admin.', status: 'revoked', exp_date: lisensi.exp_date });
          }

          if (lisensi.status === 'hold') {
            return res.status(200).json({ valid: false, msg: 'Lisensi Anda sedang ditangguhkan.', status: 'hold', exp_date: lisensi.exp_date });
          }

          if (hariIniWIB > lisensi.exp_date) {
            return res.status(200).json({ valid: false, msg: `Lisensi telah kadaluarsa pada (${lisensi.exp_date})`, exp_date: lisensi.exp_date, status: 'expired' });
          }

          return res.status(200).json({ valid: true, status: lisensi.status || 'active', exp_date: lisensi.exp_date, license_key: lisensi.license_key });
        } catch (err) {
          return res.status(200).json({ valid: false, msg: 'Gagal terhubung ke database Supabase.' });
        }
      }

      // D. CEK STATUS TOKOPAY
      if (ref_id) {
        const merchantId = process.env.TOKOPAY_MERCHANT_ID;
        const secretKey = process.env.TOKOPAY_SECRET_KEY;

        if (!merchantId || !secretKey) {
          return res.status(200).json({ is_paid: false, status: 'Unpaid', error: 'Merchant ID / Secret Key Tokopay belum diset.' });
        }

        try {
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
                const statusVal = data?.data?.status ?? data?.status;

                if (statusVal === 'Success' || statusVal === 1 || statusVal === '1' || statusVal === true || String(statusVal).toLowerCase() === 'paid') {
                  return res.status(200).json({
                    is_paid: true,
                    status: 'Success',
                    raw: data
                  });
                }
              }
            } catch (innerErr) {
              console.warn(`[TOKOPAY WARN] ${endpointUrl}:`, innerErr.message);
            }
          }

          return res.status(200).json({ is_paid: false, status: 'Unpaid', raw: hasilData });
        } catch (err) {
          return res.status(200).json({ is_paid: false, error: err.message });
        }
      }
    }

    // =========================================================================
    // 2. METODE POST ENDPOINTS
    // =========================================================================
    if (req.method === 'POST') {
      const body = req.body || {};
      const { action, device_id, license_key, exp_date, status = 'active', admin_secret, paket_hari, ref_id, channel = 'QRISREALTIME' } = body;

      // A. CALLBACK WEBHOOK DARI TOKOPAY
      if (action === 'webhook_tokopay' || body?.status === 'Completed' || body?.status === 'Paid') {
        return res.status(200).json({ status: true });
      }

      // B. SAVE LICENSE TO SUPABASE
      if (action === 'save_license') {
        if (!device_id || !license_key || !exp_date) {
          return res.status(400).json({ success: false, message: 'Parameter wajib diisi.' });
        }

        if (!SUPABASE_URL || !SUPABASE_KEY) {
          return res.status(200).json({ success: false, message: 'Supabase Config belum lengkap.' });
        }

        try {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/licenses?on_conflict=device_id`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              device_id: device_id,
              license_key: license_key,
              exp_date: exp_date,
              status: status,
              updated_at: new Date().toISOString()
            })
          });

          if (response.ok) {
            return res.status(200).json({ success: true, message: 'Lisensi disimpan.' });
          }
          return res.status(200).json({ success: false, message: 'Gagal menyimpan ke Supabase.' });
        } catch (err) {
          return res.status(200).json({ success: false, message: 'Error koneksi Supabase.' });
        }
      }

      // C. CREATE QRIS ORDER
      if (paket_hari || ref_id) {
        const merchantId = process.env.TOKOPAY_MERCHANT_ID;
        const secretKey = process.env.TOKOPAY_SECRET_KEY;

        if (!merchantId || !secretKey) {
          return res.status(200).json({ status: false, error: 'TOKOPAY_MERCHANT_ID / SECRET_KEY belum dikonfigurasi di Vercel.' });
        }

        try {
          const nominal = HARGA_PAKET[Number(paket_hari)];
          if (!nominal) {
            return res.status(200).json({ status: false, error: 'Paket tidak valid.' });
          }

          const rawSignature = `${merchantId}:${secretKey}:${ref_id}`;
          const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

          const apiUrl = `https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&metode=${channel}&signature=${signature}`;

          const response = await fetch(apiUrl);
          const data = await response.json();

          if (data && (data.status === 1 || data.status === true || data.status === 'Success')) {
            return res.status(200).json({
              status: true,
              data: data.data
            });
          }

          return res.status(200).json({ status: false, error: data?.error_msg || 'Gagal membuat QRIS Tokopay.' });
        } catch (err) {
          return res.status(200).json({ status: false, error: err.message });
        }
      }
    }

    return res.status(200).json({ status: false, error: 'Method Not Allowed' });

  } catch (globalErr) {
    // TANGKAP SEMUA ERROR CRASH & KEMBALIKAN RESPON JSON AGAR USERSCRIPT TIDAK PECAH
    console.error('[FATAL VERCEL ERROR]', globalErr);
    return res.status(200).json({ 
      valid: false, 
      status: false, 
      msg: 'Server Vercel mengalami kendala.', 
      error_detail: globalErr.message 
    });
  }
}
