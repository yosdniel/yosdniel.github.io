import crypto from 'crypto';

// In-memory fallback storage
const orderMemory = new Map();

// Helper perhitungan tanggal kadaluarsa
function calculateExpiryDate(currentExpStr, daysToAdd) {
  const hariIniWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  let baseDate = new Date(hariIniWIB + 'T00:00:00');

  if (currentExpStr && /^\d{4}-\d{2}-\d{2}$/.test(currentExpStr)) {
    const curDate = new Date(currentExpStr + 'T00:00:00');
    if (curDate > baseDate) {
      baseDate = curDate;
    }
  }

  baseDate.setDate(baseDate.getDate() + Number(daysToAdd));
  const yyyy = baseDate.getFullYear();
  const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
  const dd = String(baseDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Simpan/Perbarui Lisensi ke Supabase
async function simpanLisensiOtomatis(supabaseUrl, supabaseKey, deviceId, paketHari) {
  if (!supabaseUrl || !supabaseKey || !deviceId) {
    console.error('[SUPABASE CONFIG ERROR] Missing credentials or deviceId');
    return null;
  }

  try {
    // 1. Cek Lisensi Eksisting
    const getRes = await fetch(`${supabaseUrl}/rest/v1/licenses?device_id=eq.${encodeURIComponent(deviceId)}`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      cache: 'no-store'
    });

    const existing = await getRes.json();
    const activeLicense = Array.isArray(existing) && existing.length > 0 ? existing[0] : null;

    const expDateNew = calculateExpiryDate(activeLicense?.exp_date, paketHari);
    const nonce = Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
    const payload = `${expDateNew}|${deviceId}|AutoPayment|MINDSTUDIO2026|${nonce}`;
    const licenseKeyNew = `MIND-${btoa(payload).split('').reverse().join('')}`;

    if (activeLicense) {
      // 2. Update Lisensi (PATCH)
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/licenses?device_id=eq.${encodeURIComponent(deviceId)}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          exp_date: expDateNew,
          license_key: licenseKeyNew,
          status: 'active',
          updated_at: new Date().toISOString()
        }),
        cache: 'no-store'
      });

      const updatedData = await updateRes.json();
      return Array.isArray(updatedData) && updatedData.length > 0 ? updatedData[0] : { exp_date: expDateNew };
    } else {
      // 3. Insert Lisensi Baru (POST)
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/licenses`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          device_id: deviceId,
          license_key: licenseKeyNew,
          exp_date: expDateNew,
          status: 'active',
          client_name: 'User QRIS'
        }),
        cache: 'no-store'
      });

      const insertedData = await insertRes.json();
      return Array.isArray(insertedData) && insertedData.length > 0 ? insertedData[0] : { exp_date: expDateNew };
    }
  } catch (err) {
    console.error('[SUPABASE TRANSACTION ERROR]:', err);
    return null;
  }
}

export default async function handler(req, res) {
  // Anti-Cache HTTP Headers (Mencegah Respon HTTP 304)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  const { query, body } = req;
  const action = query.action || body?.action;
  const ref_id = query.ref_id || body?.ref_id;
  const device_id = query.device_id || body?.device_id;
  const paket_hari = query.paket_hari || body?.paket_hari;

  // CHECK VERSION
  if (action === 'check_version') {
    return res.status(200).json({ version: '1.5.21', download_url: 'https://mindspace-id.vercel.app/sipgn-autofill.user.js' });
  }

  // GET PACKAGES
  if (action === 'get_packages') {
    return res.status(200).json({
      packages: [
        { hari: 7, harga: 100, nama: 'Paket 7 Hari' },
        { hari: 30, harga: 50000, nama: 'Paket 30 Hari' }
      ]
    });
  }

  // CHECK LICENSE STATUS
  if (action === 'check_license') {
    if (!device_id) return res.status(200).json({ valid: false, msg: 'Device ID tidak ditemukan.' });

    try {
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(device_id)}`, {
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const licenses = await getRes.json();
      const lic = Array.isArray(licenses) && licenses.length > 0 ? licenses[0] : null;

      if (!lic) return res.status(200).json({ valid: false, status: 'unregistered', msg: 'Device ID belum terdaftar.' });
      if (lic.status === 'revoked') return res.status(200).json({ valid: false, status: 'revoked', msg: 'Akses dicabut oleh Admin.' });
      if (lic.status === 'hold') return res.status(200).json({ valid: false, status: 'hold', msg: 'Lisensi dalam penangguhan.' });

      const hariIniWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      if (lic.exp_date && lic.exp_date < hariIniWIB) {
        return res.status(200).json({ valid: false, status: 'expired', exp_date: lic.exp_date, msg: 'Lisensi Anda telah kadaluarsa.' });
      }

      return res.status(200).json({ valid: true, status: 'active', exp_date: lic.exp_date });
    } catch (e) {
      return res.status(200).json({ valid: false, msg: 'Gagal verifikasi lisensi.' });
    }
  }

  // MANUAL SAVE LICENSE
  if (action === 'save_license') {
    const saved = await simpanLisensiOtomatis(SUPABASE_URL, SUPABASE_KEY, device_id, paket_hari || 0);
    return res.status(200).json({ success: true, data: saved });
  }

  // POST ORDER TO TOKOPAY
  if (req.method === 'POST') {
    const merchantId = process.env.TOKOPAY_MERCHANT_ID;
    const secretKey = process.env.TOKOPAY_SECRET_KEY;
    if (!merchantId || !secretKey) return res.status(500).json({ error: 'Kunci API Tokopay belum diatur.' });

    const nominal = body.nominal || 100;
    const refIdOrder = body.ref_id || `SIPGN-${device_id}-${Date.now()}`;
    const signature = crypto.createHash('md5').update(`${merchantId}:${secretKey}:${refIdOrder}`).digest('hex');

    try {
      const tokopayRes = await fetch(`https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${encodeURIComponent(refIdOrder)}&nominal=${nominal}&metode=${body.metode || 'QRISREALTIME'}&signature=${signature}`, { cache: 'no-store' });
      const tokopayData = await tokopayRes.json();

      orderMemory.set(refIdOrder, { device_id: device_id, paket_hari: body.paket_hari || 7 });

      return res.status(200).json({ ref_id: refIdOrder, data: tokopayData });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal membuat order ke Tokopay.' });
    }
  }

  // POLLING STATUS PEMBAYARAN TOKOPAY
  if (ref_id) {
    const merchantId = process.env.TOKOPAY_MERCHANT_ID;
    const secretKey = process.env.TOKOPAY_SECRET_KEY;
    if (!merchantId || !secretKey) return res.status(200).json({ is_paid: false, error: 'Kunci Tokopay belum diatur.' });

    const signature = crypto.createHash('md5').update(`${merchantId}${secretKey}${ref_id}`).digest('hex');

    try {
      const tokopayRes = await fetch(`https://api.tokopay.id/v1/order/status?merchant=${merchantId}&secret=${secretKey}&ref_id=${encodeURIComponent(ref_id)}&signature=${signature}`, { cache: 'no-store' });
      const tokopayData = await tokopayRes.json();

      // Ekstraksi data berdasarkan JSON resmi Tokopay
      const innerData = tokopayData?.data?.data;
      const statusTransaksi = innerData?.status; // Menerima "Success"
      const reffIdTokopay = innerData?.reff_id || ref_id;

      // Kriteria Lunas
      const isLunas = tokopayData?.status === true && String(statusTransaksi).toLowerCase() === 'success';

      if (isLunas) {
        let orderInfo = orderMemory.get(ref_id) || orderMemory.get(reffIdTokopay);
        let targetPaketHari = paket_hari || orderInfo?.paket_hari || 7;
        let targetDevId = device_id || orderInfo?.device_id;

        // Fallback ekstraksi Device ID dari ref_id / reff_id (SIPGN-DEV-XXXX-XXXX-HASH)
        const checkRef = ref_id || reffIdTokopay || '';
        if (!targetDevId && checkRef.startsWith('SIPGN-DEV-')) {
          const parts = checkRef.split('-');
          if (parts.length >= 3) {
            targetDevId = `DEV-${parts[1]}-${parts[2]}`;
          }
        }

        if (!targetDevId) {
          return res.status(200).json({ is_paid: false, error: 'Device ID tidak terdeteksi.' });
        }

        // Simpan pembaruan lisensi ke Supabase
        const savedInfo = await simpanLisensiOtomatis(SUPABASE_URL, SUPABASE_KEY, targetDevId, targetPaketHari);

        return res.status(200).json({
          is_paid: true,
          status: 'Success',
          exp_date: savedInfo?.exp_date || null
        });
      }

      return res.status(200).json({ is_paid: false, raw_status: statusTransaksi || 'Unpaid' });
    } catch (err) {
      return res.status(200).json({ is_paid: false, error: 'Gagal mengecek status Tokopay.' });
    }
  }

  return res.status(400).json({ error: 'Permintaan tidak valid.' });
}
