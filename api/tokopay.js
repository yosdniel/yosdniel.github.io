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

  // Variabel Supabase dari Environment Variables Vercel
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // =========================================================================
  // 1. METODE GET ENDPOINTS
  // =========================================================================
  if (req.method === 'GET') {
    const { action, device_id, ref_id, metode = 'QRISREALTIME' } = req.query;

    // A. Endpoint Cek Versi Terbaru Userscript
    if (action === 'check_version') {
      return res.status(200).json({
        status: true,
        version: VERSIONS.latest_version,
        download_url: VERSIONS.download_url,
        changelog: VERSIONS.changelog
      });
    }

    // B. Endpoint Ambil Daftar Paket
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

    // C. Endpoint Cek Status Lisensi dari Supabase (Online Check)
    if (action === 'check_license') {
      if (!device_id) {
        return res.status(400).json({ valid: false, msg: 'Parameter device_id wajib diisi.' });
      }

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ valid: false, msg: 'Konfigurasi Supabase di Vercel belum lengkap.' });
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
          return res.status(200).json({ valid: false, msg: 'Lisensi tidak ditemukan atau belum terdaftar.' });
        }

        const lisensi = data[0];
        const hariIni = new Date().toISOString().split('T')[0];

        if (lisensi.status === 'revoked') {
          return res.status(200).json({ valid: false, msg: 'Lisensi Anda telah dicabut oleh Admin.', status: 'revoked', exp_date: lisensi.exp_date, license_key: lisensi.license_key });
        }

        if (lisensi.status === 'hold') {
          return res.status(200).json({ valid: false, msg: 'Lisensi Anda sedang ditangguhkan (Hold).', status: 'hold', exp_date: lisensi.exp_date, license_key: lisensi.license_key });
        }

        if (hariIni > lisensi.exp_date) {
          return res.status(200).json({ valid: false, msg: `Lisensi telah kadaluarsa pada (${lisensi.exp_date})`, exp_date: lisensi.exp_date, status: lisensi.status || 'active', license_key: lisensi.license_key });
        }

        return res.status(200).json({
          valid: true,
          status: lisensi.status || 'active',
          exp_date: lisensi.exp_date,
          license_key: lisensi.license_key
        });
      } catch (err) {
        console.error('[SUPABASE CHECK ERROR]:', err.message);
        return res.status(500).json({ valid: false, msg: 'Gagal terhubung ke database.' });
      }
    }

    // D. Cek Status Pembayaran QRIS Tokopay
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
  }

  // =========================================================================
  // 2. METODE POST ENDPOINTS
  // =========================================================================
  if (req.method === 'POST') {
    const { action, device_id, license_key, exp_date, status = 'active', admin_secret, paket_hari, ref_id, channel = 'QRISREALTIME' } = req.body || {};

    // A. Simpan / Topup Lisensi ke Supabase
    if (action === 'save_license') {
      if (!device_id || !license_key || !exp_date) {
        return res.status(400).json({ success: false, message: 'Parameter device_id, license_key, dan exp_date wajib diisi.' });
      }

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ success: false, message: 'Konfigurasi Supabase di Vercel belum lengkap.' });
      }

      try {
        // query on_conflict=device_id wajib disertakan untuk PostgreSQL Upsert
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
          return res.status(200).json({ success: true, message: 'Lisensi berhasil disimpan ke Supabase!' });
        } else {
          const errData = await response.json();
          return res.status(500).json({ success: false, message: errData.message || 'Gagal menyimpan ke Supabase.' });
        }
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan koneksi ke Supabase.' });
      }
    }

    // B. Hapus Lisensi dari Admin Dashboard
    if (action === 'delete_license') {
      // Prioritaskan GENERATOR_PASSWORD agar sama dengan endpoint verify-pass
      const ADMIN_SECRET = process.env.GENERATOR_PASSWORD || process.env.ADMIN_SECRET_KEY;

      if (!admin_secret || admin_secret !== ADMIN_SECRET) {
        return res.status(403).json({ success: false, message: 'Akses Ditolak! Secret key admin salah.' });
      }

      if (!device_id) {
        return res.status(400).json({ success: false, message: 'Parameter device_id wajib diisi.' });
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
          return res.status(200).json({ success: true, message: `Device ID ${device_id} berhasil dihapus dari Supabase!` });
        } else {
          return res.status(500).json({ success: false, message: 'Gagal menghapus lisensi dari Supabase.' });
        }
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat menghapus data.' });
      }
    }

    // C. Membuat Order QRIS Tokopay (Bila order QRIS)
    if (paket_hari || ref_id) {
      const merchantId = process.env.TOKOPAY_MERCHANT_ID;
      const secretKey = process.env.TOKOPAY_SECRET_KEY;

      if (!merchantId || !secretKey) {
        return res.status(500).json({
          status: false,
          error: 'Konfigurasi Vercel Belum Lengkap: TOKOPAY_MERCHANT_ID / TOKOPAY_SECRET_KEY kosong.'
        });
      }

      try {
        const nominal = HARGA_PAKET[Number(paket_hari)];
        if (!nominal) {
          return res.status(400).json({ status: false, error: 'Pilihan paket tidak valid.' });
        }

        const daftarChannel = Array.from(new Set([channel, 'QRISREALTIME', 'QRIS_REALTIME', 'QRIS2', 'QRIS']));
        let lastResponse = null;

        for (const channelCode of daftarChannel) {
          const rawSignature = `${merchantId}:${secretKey}:${ref_id}`;
          const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

          const apiUrl = `https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&metode=${channelCode}&signature=${signature}`;

          console.log(`[TOKOPAY CREATE] RefID=${ref_id}, Paket=${paket_hari} Hari, Nominal=${nominal}, Channel=${channelCode}`);

          const response = await fetch(apiUrl);
          const data = await response.json();

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
  }

  return res.status(405).json({ status: false, error: 'Method Not Allowed' });
}
