import crypto from 'crypto';

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
  changelog: 'Stabilitas sinkronisasi lisensi Supabase & perbaikan penanganan status QRIS Tokopay.'
};

// Memory cache sementara untuk order & tracking order yang sudah diproses (mencegah double topup)
const orderMemory = new Map();
const processedOrders = new Map();

async function simpanLisensiOtomatis(SUPABASE_URL, SUPABASE_KEY, deviceId, paketHari, refId) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !deviceId || !paketHari) return null;

  // Jika ref_id ini sudah pernah diproses sebelumnya, kembalikan data yang tersimpan (cegah double add)
  if (refId && processedOrders.has(refId)) {
    return { exp_date: processedOrders.get(refId) };
  }

  try {
    let expDateObj = new Date();
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(deviceId)}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const existing = await checkRes.json();
    
    if (Array.isArray(existing) && existing.length > 0 && existing[0].exp_date) {
      const currentExp = new Date(existing[0].exp_date + 'T00:00:00');
      if (currentExp > expDateObj) expDateObj = currentExp;
    }

    expDateObj.setDate(expDateObj.getDate() + Number(paketHari));
    
    const expDateTarget = expDateObj.toISOString().slice(0, 10);
    const nonce = Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
    const licenseKey = `MIND-${Buffer.from(`${expDateTarget}|${deviceId}|AutoPayment|MINDSTUDIO2026|${nonce}`).toString('base64').split('').reverse().join('')}`;

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
      if (refId) processedOrders.set(refId, expDateTarget);
      return { exp_date: expDateTarget, license_key: licenseKey };
    }
  } catch (err) {
    console.error('[SUPABASE ERROR]', err);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ status: false, error: 'Konfigurasi environment Supabase belum lengkap.' });
  }

  try {
    if (req.method === 'GET') {
      const { action, device_id, ref_id, paket_hari } = req.query || {};

      if (action === 'check_version') {
        return res.status(200).json({ status: true, version: VERSIONS.latest_version, download_url: VERSIONS.download_url, changelog: VERSIONS.changelog });
      }

      if (action === 'get_packages') {
        const packages = Object.entries(HARGA_PAKET).map(([hari, harga]) => ({
          hari: Number(hari),
          harga,
          nama: `Paket ${hari} Hari`
        }));
        return res.status(200).json({ status: true, packages });
      }

      if (action === 'check_license') {
        if (!device_id) return res.status(200).json({ valid: false, msg: 'Device ID kosong.' });
        const response = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(device_id)}&select=*`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) return res.status(200).json({ valid: false, msg: 'Lisensi belum terdaftar.' });

        const lisensi = data[0];
        const hariIniWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        
        if (lisensi.status === 'revoked') return res.status(200).json({ valid: false, status: 'revoked', msg: 'Akses lisensi telah dicabut.' });
        if (lisensi.status === 'hold') return res.status(200).json({ valid: false, status: 'hold', msg: 'Lisensi sedang ditangguhkan.' });
        if (lisensi.status !== 'active') return res.status(200).json({ valid: false, msg: `Lisensi berstatus: ${lisensi.status}` });
        if (hariIniWIB > lisensi.exp_date) return res.status(200).json({ valid: false, msg: 'Lisensi telah kadaluarsa.' });

        return res.status(200).json({ valid: true, exp_date: lisensi.exp_date });
      }

      // CEK STATUS PEMBAYARAN KE TOKOPAY API
      if (ref_id) {
        const merchantId = process.env.TOKOPAY_MERCHANT_ID;
        const secretKey = process.env.TOKOPAY_SECRET_KEY;
        if (!merchantId || !secretKey) return res.status(200).json({ is_paid: false, error: 'Kunci Tokopay belum diatur.' });

        const signature = crypto.createHash('md5').update(`${merchantId}${secretKey}${ref_id}`).digest('hex');
        const tokopayRes = await fetch(`https://api.tokopay.id/v1/order/status?merchant=${merchantId}&key=${secretKey}&ref_id=${ref_id}&signature=${signature}`, { cache: 'no-store' });
        const tokopayData = await tokopayRes.json();

        // Pengecekan status transaksi yang ultra-aman & tahan terhadap variasi tipe data Tokopay
        const rawDataStatus = tokopayData?.data?.status ?? tokopayData?.data?.status_pembayaran ?? tokopayData?.status;
        const stringStatus = String(rawDataStatus || '').toLowerCase();
        const isPaidBool = tokopayData?.data?.is_paid === true || tokopayData?.is_paid === true;

        const isLunas = 
          isPaidBool ||
          rawDataStatus === 1 || 
          rawDataStatus === '1' ||
          ['success', 'dibayar', 'paid', 'settlement', 'completed'].includes(stringStatus);

        if (isLunas) {
          let orderInfo = orderMemory.get(ref_id);
          let targetPaketHari = orderInfo?.paket_hari || paket_hari || 7;
          let targetDevId = orderInfo?.device_id || device_id;

          if (!targetDevId) {
            return res.status(200).json({ is_paid: false, error: 'Device ID tidak ditemukan untuk pembaruan lisensi.' });
          }

          let savedInfo = await simpanLisensiOtomatis(SUPABASE_URL, SUPABASE_KEY, targetDevId, targetPaketHari, ref_id);
          return res.status(200).json({ is_paid: true, exp_date: savedInfo?.exp_date });
        }

        return res.status(200).json({ is_paid: false, raw_status: rawDataStatus });
      }
    }

    if (req.method === 'POST') {
      const { action, device_id, license_key, exp_date, status = 'active', paket_hari, ref_id } = req.body || {};

      if (action === 'save_license') {
        if (!device_id) return res.status(400).json({ success: false, error: 'Device ID wajib diisi.' });
        const response = await fetch(`${SUPABASE_URL}/rest/v1/licenses?on_conflict=device_id`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({ device_id, license_key, exp_date, status, updated_at: new Date().toISOString() })
        });
        return res.status(200).json({ success: response.ok });
      }

      if (paket_hari || ref_id) {
        const merchantId = process.env.TOKOPAY_MERCHANT_ID;
        const secretKey = process.env.TOKOPAY_SECRET_KEY;
        const nominal = HARGA_PAKET[Number(paket_hari)] || 25000;

        if (ref_id && device_id) {
          orderMemory.set(ref_id, { device_id, paket_hari });
        }

        const signature = crypto.createHash('md5').update(`${merchantId}${secretKey}${ref_id}`).digest('hex');
        const apiUrl = `https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${ref_id}&nominal=${nominal}&metode=QRISREALTIME&signature=${signature}`;

        const resp = await fetch(apiUrl, { cache: 'no-store' });
        const data = await resp.json();

        const isSuccess = data?.status === 1 || data?.status === '1' || data?.status === true || String(data?.status).toLowerCase() === 'success';

        if (isSuccess) {
          return res.status(200).json({ status: true, data: data.data || data });
        }
        return res.status(200).json({ status: false, error: data?.error_msg || data?.message || 'Gagal membuat QRIS.' });
      }
    }

    return res.status(405).json({ status: false, error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[API HANDLER ERROR]', err);
    return res.status(500).json({ status: false, error: err.message });
  }
}
