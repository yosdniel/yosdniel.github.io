const crypto = require('crypto');

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
  changelog: 'Fix total validasi status QRIS dan bypass serverless stateless cache.'
};

const orderCache = new Map();

function buatLicenseKeyServer(expDate, deviceId) {
  const nonce = Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
  const payload = `${expDate}|${deviceId}|AutoPayment|MINDSTUDIO2026|${nonce}`;
  const encoded = Buffer.from(payload).toString('base64');
  const reversed = encoded.split('').reverse().join('');
  return `MIND-${reversed}`;
}

async function simpanLisensiOtomatis(SUPABASE_URL, SUPABASE_KEY, deviceId, paketHari) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !deviceId || !paketHari) return null;

  try {
    let expDateObj = new Date();
    
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(deviceId)}&select=*`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0 && existing[0].exp_date) {
      const currentExp = new Date(existing[0].exp_date + 'T00:00:00');
      if (currentExp > expDateObj) {
        expDateObj = currentExp;
      }
    }

    expDateObj.setDate(expDateObj.getDate() + Number(paketHari));
    
    const yyyy = expDateObj.getFullYear();
    const mm = String(expDateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(expDateObj.getDate()).padStart(2, '0');
    const expDateTarget = `${yyyy}-${mm}-${dd}`;

    const licenseKey = buatLicenseKeyServer(expDateTarget, deviceId);

    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?on_conflict=device_id`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        device_id: deviceId,
        license_key: licenseKey,
        exp_date: expDateTarget,
        status: 'active',
        updated_at: new Date().toISOString()
      })
    });

    if (saveRes.ok) {
      return { exp_date: expDateTarget, license_key: licenseKey };
    }
  } catch (err) {
    console.error('[SUPABASE AUTO-SAVE ERROR]', err);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (req.method === 'GET') {
      const { action, device_id, ref_id } = req.query || {};

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
        return res.status(200).json({ status: true, packages: packages });
      }

      if (action === 'check_license') {
        if (!device_id) {
          return res.status(200).json({ valid: false, msg: 'Parameter device_id wajib diisi.' });
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
            return res.status(200).json({ valid: false, msg: 'Lisensi telah dicabut Admin.', status: 'revoked', exp_date: lisensi.exp_date });
          }
          if (lisensi.status === 'hold') {
            return res.status(200).json({ valid: false, msg: 'Lisensi ditangguhkan.', status: 'hold', exp_date: lisensi.exp_date });
          }
          if (hariIniWIB > lisensi.exp_date) {
            return res.status(200).json({ valid: false, msg: `Lisensi kadaluarsa (${lisensi.exp_date})`, exp_date: lisensi.exp_date, status: 'expired' });
          }

          return res.status(200).json({ valid: true, status: lisensi.status || 'active', exp_date: lisensi.exp_date, license_key: lisensi.license_key });
        } catch (err) {
          return res.status(200).json({ valid: false, msg: 'Gagal terhubung ke Supabase.' });
        }
      }

      // CEK STATUS PEMBAYARAN KE TOKOPAY
      if (ref_id) {
        const merchantId = process.env.TOKOPAY_MERCHANT_ID;
        const secretKey = process.env.TOKOPAY_SECRET_KEY;

        if (!merchantId || !secretKey) {
          return res.status(200).json({ is_paid: false, error: 'Kunci Tokopay belum dikonfigurasi.' });
        }

        try {
          // Format Signature standar Tokopay v1 (md5 merchant + secret + ref_id)
          const rawSignature = `${merchantId}${secretKey}${ref_id}`;
          const signature = crypto.createHash('md5').update(rawSignature).digest('hex');
          
          const endpointUrl = `https://api.tokopay.id/v1/order/status?merchant=${merchantId}&key=${secretKey}&ref_id=${ref_id}&signature=${signature}&_t=${Date.now()}`;

          const response = await fetch(endpointUrl, { cache: 'no-store' });
          const responseText = await response.text();
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseErr) {
            return res.status(200).json({ is_paid: false, raw_response: responseText });
          }

          // Tangkap seluruh kemungkinan struktur status lunas dari Tokopay
          const statusVal = data?.data?.status ?? data?.status ?? data?.status_text;
          const isPaidVal = data?.is_paid ?? data?.data?.is_paid;

          const isLunas = 
            isPaidVal === true ||
            statusVal === 1 || 
            statusVal === '1' || 
            statusVal === 'Success' || 
            statusVal === 'success' || 
            statusVal === 'Paid' || 
            statusVal === 'paid' || 
            statusVal === 'Settlement' || 
            statusVal === 'settlement';

          if (isLunas) {
            let cachedOrder = orderCache.get(ref_id);
            let paketHariTarget = cachedOrder?.paket_hari;
            let targetDevId = cachedOrder?.device_id || device_id;

            if (!paketHariTarget) {
              const nominalBayar = Number(data?.data?.total_bayar || data?.total_bayar || data?.data?.nominal || 0);
              for (const [hari, harga] of Object.entries(HARGA_PAKET)) {
                if (Math.abs(harga - nominalBayar) < 1500) {
                  paketHariTarget = Number(hari);
                  break;
                }
              }
              if (!paketHariTarget) paketHariTarget = 7; // Default fallback 7 hari
            }

            let savedInfo = null;
            if (targetDevId && paketHariTarget) {
              savedInfo = await simpanLisensiOtomatis(SUPABASE_URL, SUPABASE_KEY, targetDevId, paketHariTarget);
            }

            return res.status(200).json({
              is_paid: true,
              status: 'Success',
              exp_date: savedInfo?.exp_date || null,
              raw: data
            });
          }

          return res.status(200).json({ is_paid: false, status: 'Unpaid', raw: data });
        } catch (err) {
          return res.status(200).json({ is_paid: false, error: err.message });
        }
      }
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { action, device_id, license_key, exp_date, status = 'active', paket_hari, ref_id, channel = 'QRISREALTIME' } = body;

      if (action === 'save_license') {
        if (!device_id || !license_key || !exp_date) {
          return res.status(400).json({ success: false, message: 'Parameter kurang lengkap.' });
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
            return res.status(200).json({ success: true });
          }
          return res.status(200).json({ success: false });
        } catch (err) {
          return res.status(200).json({ success: false });
        }
      }

      if (paket_hari || ref_id) {
        const merchantId = process.env.TOKOPAY_MERCHANT_ID;
        const secretKey = process.env.TOKOPAY_SECRET_KEY;

        if (!merchantId || !secretKey) {
          return res.status(200).json({ status: false, error: 'Konfigurasi Tokopay Vercel belum lengkap.' });
        }

        try {
          const nominal = HARGA_PAKET[Number(paket_hari)] || 25000;
          
          if (ref_id && device_id) {
            orderCache.set(ref_id, { device_id, paket_hari });
          }

          const rawSignature = `${merchantId}:${secretKey}:${ref_id}`;
          const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

          const apiUrl = `https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&metode=${channel}&signature=${signature}`;

          const response = await fetch(apiUrl, { cache: 'no-store' });
          const data = await response.json();

          const st = data?.status;
          if (st === 1 || st === '1' || st === true || st === 'Success' || st === 'success') {
            return res.status(200).json({ status: true, data: data.data });
          }

          return res.status(200).json({ status: false, error: data?.error_msg || 'Gagal membuat QRIS.' });
        } catch (err) {
          return res.status(200).json({ status: false, error: err.message });
        }
      }
    }

    return res.status(200).json({ status: false, error: 'Method Not Allowed' });

  } catch (globalErr) {
    return res.status(200).json({ valid: false, status: false, error_detail: globalErr.message });
  }
}
