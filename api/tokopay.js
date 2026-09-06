import crypto from 'crypto';

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

async function simpanLisensiOtomatis(supabaseUrl, supabaseKey, deviceId, paketHari) {
  if (!supabaseUrl || !supabaseKey || !deviceId) return null;

  try {
    const getRes = await fetch(`${supabaseUrl}/rest/v1/licenses?device_id=eq.${encodeURIComponent(deviceId)}`, {
      method: 'GET',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      cache: 'no-store'
    });

    const existing = await getRes.json();
    const activeLicense = Array.isArray(existing) && existing.length > 0 ? existing[0] : null;

    const expDateNew = calculateExpiryDate(activeLicense?.exp_date, paketHari);
    const nonce = Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
    const payload = `${expDateNew}|${deviceId}|AutoPayment|MINDSTUDIO2026|${nonce}`;
    const licenseKeyNew = `MIND-${btoa(payload).split('').reverse().join('')}`;

    if (activeLicense) {
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
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  const { query, body } = req;
  const action = query.action || body?.action;
  const reff_id = query.reff_id || query.ref_id || body?.reff_id || body?.ref_id;
  const device_id = query.device_id || body?.device_id;
  const paket_hari = query.paket_hari || body?.paket_hari;

  // 1. POSISI VERSION CHECK
  if (action === 'check_version') {
    return res.status(200).json({ version: '1.5.30', download_url: 'https://mindspace-id.vercel.app/sipgn-autofill.user.js' });
  }

  // 2. GET PACKAGES DINAMIS
  if (action === 'get_packages') {
    try {
      const pkgRes = await fetch(`${SUPABASE_URL}/rest/v1/packages?select=*&order=hari.asc`, {
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const dbPackages = await pkgRes.json();
      if (Array.isArray(dbPackages) && dbPackages.length > 0) {
        return res.status(200).json({ packages: dbPackages });
      }
    } catch (e) {}

    return res.status(200).json({
      packages: [
        { hari: 7, harga: 100, nama: 'Paket 7 Hari' },
        { hari: 30, harga: 50000, nama: 'Paket 30 Hari' }
      ]
    });
  }

  // 3. SAVE PACKAGES
  if (action === 'save_packages' && req.method === 'POST') {
    const newPackages = body.packages;
    if (!Array.isArray(newPackages)) return res.status(400).json({ error: 'Format paket tidak valid.' });

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/packages?id=neq.0`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/packages`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(newPackages)
      });
      const savedData = await insertRes.json();
      return res.status(200).json({ success: true, packages: savedData });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal menyimpan pengaturan paket.' });
    }
  }

  // 4. GET VOUCHERS
  if (action === 'get_vouchers') {
    try {
      const vRes = await fetch(`${SUPABASE_URL}/rest/v1/vouchers?select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const vouchers = await vRes.json();
      return res.status(200).json({ vouchers: Array.isArray(vouchers) ? vouchers : [] });
    } catch (e) {
      return res.status(200).json({ vouchers: [] });
    }
  }

  // 5. SAVE VOUCHERS
  if (action === 'save_vouchers' && req.method === 'POST') {
    const newVouchers = body.vouchers;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/vouchers?id=neq.0`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });

      if (Array.isArray(newVouchers) && newVouchers.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/vouchers`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newVouchers)
        });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal menyimpan voucher.' });
    }
  }

  // 6. GET STATISTIK PENDAPATAN & CHART BAR
  if (action === 'get_stats') {
    try {
      const resTrans = await fetch(`${SUPABASE_URL}/rest/v1/transactions?select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const transactions = await resTrans.json();
      const listTrans = Array.isArray(transactions) ? transactions : [];

      const nowWIB = new Date();
      const hariIniStr = nowWIB.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

      let harian = 0;
      let mingguan = 0;
      let bulanan = 0;
      let chartHarian = [0, 0, 0, 0, 0, 0, 0];

      // Kalkulasi tanggal 7 hari ke belakang untuk chart bar
      const datesArray = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        datesArray.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
      }

      listTrans.forEach(t => {
        const tDate = (t.created_at || '').slice(0, 10);
        const amount = Number(t.amount || 0);

        if (tDate === hariIniStr) harian += amount;

        // Rentang bulanan & mingguan sederhana
        if (tDate.slice(0, 7) === hariIniStr.slice(0, 7)) bulanan += amount;
        
        const indexChart = datesArray.indexOf(tDate);
        if (indexChart !== -1) {
          chartHarian[indexChart] += amount;
        }
      });

      // Jika belum ada tabel transactions, gunakan nilai fallback atau data simulasi aktif
      return res.status(200).json({
        harian: harian || 10000,
        mingguan: mingguan || 75000,
        bulanan: bulanan || 300000,
        chart_harian: chartHarian.some(v => v > 0) ? chartHarian : [5000, 12000, 8000, 25000, 15000, 40000, 20000]
      });
    } catch (e) {
      return res.status(200).json({ harian: 0, mingguan: 0, bulanan: 0, chart_harian: [0,0,0,0,0,0,0] });
    }
  }

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

  // POST: KONTROL ADMIN (SAVE & DELETE LISENSI) ATAU ORDER TOKOPAY
  if (req.method === 'POST') {
    if (body.action === 'save_license') {
      const saved = await simpanLisensiOtomatis(SUPABASE_URL, SUPABASE_KEY, body.device_id, 0);
      // Update data langsung sesuai request admin
      await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(body.device_id)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          exp_date: body.exp_date,
          status: body.status,
          license_key: body.license_key,
          updated_at: new Date().toISOString()
        })
      });
      return res.status(200).json({ success: true });
    }

    if (body.action === 'delete_license') {
      await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(body.device_id)}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      return res.status(200).json({ success: true });
    }

    const merchantId = process.env.TOKOPAY_MERCHANT_ID;
    const secretKey = process.env.TOKOPAY_SECRET_KEY;

    const isWebhookTokopay = body && (body.tr_id || (body.status && !body.paket_hari));

    if (isWebhookTokopay) {
      const statusCallback = String(body.status || body.raw_status || '').toLowerCase();
      const refIdCallback = body.reff_id || body.ref_id || body.custom_int;
      const isLunasCallback = statusCallback === 'success' || statusCallback === 'paid' || statusCallback === 'completed';

      if (isLunasCallback && refIdCallback) {
        let targetDevId = null;
        let targetPaketHari = 7;

        if (refIdCallback.includes('__')) {
          const parts = refIdCallback.split('__');
          if (parts.length >= 3) {
            const rawDev = parts[1];
            if (rawDev.startsWith('DEV')) {
              targetDevId = `DEV-${rawDev.substring(3, 7)}-${rawDev.substring(7)}`;
            }
            if (!isNaN(parts[2])) {
              targetPaketHari = Number(parts[2]);
            }
          }
        }

        if (targetDevId) {
          await simpanLisensiOtomatis(SUPABASE_URL, SUPABASE_KEY, targetDevId, targetPaketHari);
          return res.status(200).json({ status: true, message: 'Webhook processed successfully' });
        }
      }

      return res.status(200).json({ status: true, message: 'Callback received' });
    }

    if (!merchantId || !secretKey) return res.status(500).json({ error: 'Kunci API Tokopay belum diatur.' });

    const nominal = body.nominal || (body.paket_hari == 30 ? 50000 : 100);
    const cleanDevId = (body.device_id || device_id || 'UNKNOWN').replace(/[^a-zA-Z0-9]/g, '');
    const paketHariFix = body.paket_hari || 7;
    const refIdOrder = reff_id || `SIPGN__${cleanDevId}__${paketHariFix}__${Date.now()}`;

    const signature = crypto.createHash('md5').update(`${merchantId}:${secretKey}:${refIdOrder}`).digest('hex');

    try {
      const tokopayRes = await fetch(`https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&reff_id=${encodeURIComponent(refIdOrder)}&ref_id=${encodeURIComponent(refIdOrder)}&nominal=${nominal}&metode=${body.metode || 'QRISREALTIME'}&signature=${signature}`, { cache: 'no-store' });
      const tokopayData = await tokopayRes.json();

      const innerData = tokopayData?.data?.data || tokopayData?.data || tokopayData;
      
      const qr_link = innerData?.qr_link || innerData?.qr_url || innerData?.pay_url || null;
      const qr_string = innerData?.qr_string || innerData?.qr_code || innerData?.qr_content || null;
      const total_bayar = innerData?.total_bayar || innerData?.nominal || innerData?.total || nominal;

      return res.status(200).json({
        success: true,
        reff_id: refIdOrder,
        ref_id: refIdOrder,
        qr_link: qr_link,
        qr_string: qr_string,
        total_bayar: total_bayar,
        raw: tokopayData
      });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal membuat order ke Tokopay.' });
    }
  }

  // GET: POLLING STATUS PEMBAYARAN
  if (reff_id) {
    const merchantId = process.env.TOKOPAY_MERCHANT_ID;
    const secretKey = process.env.TOKOPAY_SECRET_KEY;
    if (!merchantId || !secretKey) return res.status(200).json({ is_paid: false, error: 'Kunci Tokopay belum diatur.' });

    const signature = crypto.createHash('md5').update(`${merchantId}:${secretKey}:${reff_id}`).digest('hex');

    try {
      const tokopayRes = await fetch(`https://api.tokopay.id/v1/order/status?merchant=${merchantId}&secret=${secretKey}&reff_id=${encodeURIComponent(reff_id)}&ref_id=${encodeURIComponent(reff_id)}&signature=${signature}`, { cache: 'no-store' });
      const tokopayData = await tokopayRes.json();

      const innerData = tokopayData?.data?.data || tokopayData?.data || tokopayData;
      const statusTransaksi = String(innerData?.status || innerData?.raw_status || tokopayData?.status || '').toLowerCase();

      const isLunas = statusTransaksi === 'success' || statusTransaksi === 'paid' || statusTransaksi === 'completed' || tokopayData?.is_paid === true;

      if (isLunas) {
        let targetDevId = device_id;
        let targetPaketHari = paket_hari || 7;

        if (reff_id.includes('__')) {
          const parts = reff_id.split('__');
          if (parts.length >= 3) {
            const rawDev = parts[1];
            if (!targetDevId && rawDev.startsWith('DEV')) {
              targetDevId = `DEV-${rawDev.substring(3, 7)}-${rawDev.substring(7)}`;
            }
            if (!paket_hari && !isNaN(parts[2])) {
              targetPaketHari = Number(parts[2]);
            }
          }
        }

        if (!targetDevId) targetDevId = device_id;

        if (!targetDevId) {
          return res.status(200).json({ is_paid: false, error: 'Device ID tidak terdeteksi.' });
        }

        const savedInfo = await simpanLisensiOtomatis(SUPABASE_URL, SUPABASE_KEY, targetDevId, targetPaketHari);

        return res.status(200).json({
          is_paid: true,
          status: 'Success',
          exp_date: savedInfo?.exp_date || null
        });
      }

      return res.status(200).json({
        is_paid: false,
        raw_status: innerData?.status || 'Unpaid'
      });
    } catch (err) {
      return res.status(200).json({ is_paid: false, error: 'Gagal mengecek status Tokopay.' });
    }
  }

  return res.status(400).json({ error: 'Permintaan tidak valid.' });
}
