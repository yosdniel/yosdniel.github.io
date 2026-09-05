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
  latest_version: '1.5.20',
  download_url: 'https://mindspace-id.vercel.app/files/sipgn-autofill.user.js',
  changelog: 'Peningkatan stabilitas integrity check & auto-update checker.'
};

const SECRET_SALT = 'MINDSTUDIO2026';

function buatLicenseKey(expDate, deviceId) {
  const nonce = Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
  const payload = `${expDate}|${deviceId}|AutoPayment|${SECRET_SALT}|${nonce}`;
  const encoded = btoa(payload).split('').reverse().join('');
  return `MIND-${encoded}`;
}

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

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // =========================================================================
  // 1. METODE GET ENDPOINTS
  // =========================================================================
  if (req.method === 'GET') {
    const { action, device_id, ref_id, metode = 'QRISREALTIME' } = req.query;

    if (action === 'check_version') {
      return res.status(200).json({
        status: true,
        version: VERSIONS.latest_version,
        download_url: VERSIONS.download_url,
        changelog: VERSIONS.changelog
      });
    }

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
      }));
    }

    if (action === 'check_license') {
      if (!device_id) {
        return res.status(400).json({ valid: false, msg: 'Parameter device_id wajib diisi.' });
      }

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ valid: false, msg: 'Konfigurasi Supabase belum lengkap.' });
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

        if (!response.ok || !data || data.length === 0) {
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
        return res.status(500).json({ valid: false, msg: 'Gagal terhubung ke database.' });
      }
    }

    // D. CEK STATUS PEMBAYARAN TOKOPAY (PERBAIKAN STRUKTUR RESPON)
    if (ref_id) {
      const merchantId = process.env.TOKOPAY_MERCHANT_ID;
      const secretKey = process.env.TOKOPAY_SECRET_KEY;

      if (!merchantId || !secretKey) {
        return res.status(500).json({ status: false, error: 'Konfigurasi Tokopay belum lengkap.' });
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
              
              // Tokopay mengembalikan 1, "Paid", "Success", atau true jika lunas
              if (statusVal === 'Success' || statusVal === 1 || statusVal === '1' || statusVal === true || String(statusVal).toLowerCase() === 'paid') {
                return res.status(200).json({
                  is_paid: true,
                  status: 'Success',
                  raw: data
                });
              }
            }
          } catch (innerErr) {
            console.warn(`[TOKOPAY STATUS WARN] ${endpointUrl}:`, innerErr.message);
          }
        }

        return res.status(200).json({ is_paid: false, status: 'Unpaid', raw: hasilData });
      } catch (err) {
        return res.status(500).json({ is_paid: false, error: err.message });
      }
    }
  }

  // =========================================================================
  // 2. METODE POST ENDPOINTS
  // =========================================================================
  if (req.method === 'POST') {
    const { action, device_id, license_key, exp_date, status = 'active', admin_secret, paket_hari, ref_id, channel = 'QRISREALTIME' } = req.body || {};

    // A. CALLBACK WEBHOOK DARI TOKOPAY (OTOMATIS SINKRON KE SUPABASE)
    if (action === 'webhook_tokopay' || req.body?.status === 'Completed' || req.body?.status === 'Paid') {
      const { ref_id: cbRefId, status: cbStatus, signature: cbSignature } = req.body;
      const merchantId = process.env.TOKOPAY_MERCHANT_ID;
      const secretKey = process.env.TOKOPAY_SECRET_KEY;

      const rawSig = `${merchantId}:${secretKey}:${cbRefId}`;
      const calcSig = crypto.createHash('md5').update(rawSig).digest('hex');

      if (cbSignature && cbSignature !== calcSig) {
        return res.status(403).json({ status: false, message: 'Invalid Signature' });
      }

      return res.status(200).json({ status: true });
    }

    if (action === 'save_license') {
      if (!device_id || !license_key || !exp_date) {
        return res.status(400).json({ success: false, message: 'Parameter wajib diisi.' });
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
        } else {
          return res.status(500).json({ success: false, message: 'Gagal menyimpan ke Supabase.' });
        }
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan koneksi.' });
      }
    }

    if (action === 'delete_license') {
      const ADMIN_SECRET = process.env.GENERATOR_PASSWORD || process.env.ADMIN_SECRET_KEY;

      if (!admin_secret || admin_secret !== ADMIN_SECRET) {
        return res.status(403).json({ success: false, message: 'Akses Ditolak!' });
      }

      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(device_id)}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });

        if (response.ok) {
          return res.status(200).json({ success: true, message: `Device ID ${device_id} dihapus.` });
        }
        return res.status(500).json({ success: false, message: 'Gagal menghapus.' });
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Error server.' });
      }
    }

    if (paket_hari || ref_id) {
      const merchantId = process.env.TOKOPAY_MERCHANT_ID;
      const secretKey = process.env.TOKOPAY_SECRET_KEY;

      try {
        const nominal = HARGA_PAKET[Number(paket_hari)];
        if (!nominal) {
          return res.status(400).json({ status: false, error: 'Paket tidak valid.' });
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

        return res.status(400).json({ status: false, error: data?.error_msg || 'Gagal membuat QRIS Tokopay.' });
      } catch (err) {
        return res.status(500).json({ status: false, error: err.message });
      }
    }
  }

  return res.status(405).json({ status: false, error: 'Method Not Allowed' });
}
