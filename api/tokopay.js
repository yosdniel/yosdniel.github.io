import crypto from 'crypto';

// In-Memory Fallback Release Data
let globalReleaseCache = {
  version: '1.5.46',
  download_url: 'https://mindspace-id.vercel.app/sipgn-autofill.user.js',
  changelog: 'Pembaruan fitur sinkronisasi nama SPPG, format license key ringkas 14 karakter & perbaikan tata letak UI.'
};

// ------------------------------------------------------------------
// HELPER FORMAT TANGGAL & JAM WIB (ASIA/JAKARTA)
// ------------------------------------------------------------------
function getWIBDateString(dateObj = new Date()) {
  return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function getWIBTimestamp(dateObj = new Date()) {
  const dateStr = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const timeStr = dateObj.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' });
  return `${dateStr}T${timeStr}`;
}

function calculateExpiryDate(currentExpStr, daysToAdd) {
  const hariIniWIB = getWIBDateString();
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

function generateCompactLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomBytes = crypto.randomBytes(10);
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return `MIND-${result}`;
}

function generateClean14CharReffId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomBytes = crypto.randomBytes(10);
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return `MIND-${result}`;
}

// ------------------------------------------------------------------
// PENYIMPANAN TRANSAKSI & PEMBARUAN LISENSI
// ------------------------------------------------------------------
async function catatTransaksiDanLisensi(supabaseUrl, supabaseKey, deviceId, paketHari, nominal = 0, clientName = 'User QRIS / Voucher', sppgName = '') {
  if (!supabaseUrl || !supabaseKey || !deviceId) return null;

  try {
    let finalNominal = Number(nominal);
    if (!finalNominal || finalNominal <= 0) {
      try {
        const pRes = await fetch(`${supabaseUrl}/rest/v1/packages?hari=eq.${Number(paketHari)}&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
          cache: 'no-store'
        });
        const pData = await pRes.json();
        if (Array.isArray(pData) && pData.length > 0) {
          finalNominal = Number(pData[0].harga || 0);
        } else {
          finalNominal = Number(paketHari) === 30 ? 50000 : 100;
        }
      } catch (e) {
        finalNominal = Number(paketHari) === 30 ? 50000 : 100;
      }
    }

    // 1. Catat Transaksi
    await fetch(`${supabaseUrl}/rest/v1/transactions`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        device_id: deviceId,
        amount: finalNominal,
        paket_hari: Number(paketHari),
        status: 'success'
      })
    });

    // 2. Cek Lisensi Eksisting
    const getRes = await fetch(`${supabaseUrl}/rest/v1/licenses?device_id=eq.${encodeURIComponent(deviceId)}`, {
      method: 'GET',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      cache: 'no-store'
    });

    const existing = await getRes.json();
    const activeLicense = Array.isArray(existing) && existing.length > 0 ? existing[0] : null;

    const expDateNew = calculateExpiryDate(activeLicense?.exp_date, paketHari);
    const licenseKeyNew = activeLicense?.license_key || generateCompactLicenseKey();
    const timestampWIB = getWIBTimestamp();

    const bodyPayload = {
      exp_date: expDateNew,
      license_key: licenseKeyNew,
      status: 'active',
      updated_at: timestampWIB
    };

    // Pertahankan nama SPPG jika dikirim atau gunakan nama SPPG lama dari DB
    if (sppgName) {
      bodyPayload.sppg_name = sppgName;
    } else if (activeLicense?.sppg_name) {
      bodyPayload.sppg_name = activeLicense.sppg_name;
    }

    if (activeLicense) {
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/licenses?device_id=eq.${encodeURIComponent(deviceId)}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(bodyPayload),
        cache: 'no-store'
      });
      const updatedData = await updateRes.json();
      const resItem = Array.isArray(updatedData) && updatedData.length > 0 ? updatedData[0] : null;
      return { exp_date: resItem?.exp_date || expDateNew, license: resItem };
    } else {
      bodyPayload.device_id = deviceId;
      bodyPayload.client_name = clientName;

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/licenses`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(bodyPayload),
        cache: 'no-store'
      });
      const insertedData = await insertRes.json();
      const resItem = Array.isArray(insertedData) && insertedData.length > 0 ? insertedData[0] : null;
      return { exp_date: resItem?.exp_date || expDateNew, license: resItem };
    }
  } catch (err) {
    console.error('[Catat Transaksi Error]:', err);
    return null;
  }
}

// Helper Parser Device ID dari reff_id (Cadangan untuk format lama)
function parseReffId(reffId) {
  if (!reffId || typeof reffId !== 'string' || !reffId.includes('__')) {
    return { deviceId: null, paketHari: 7 };
  }
  const parts = reffId.split('__');
  let deviceId = null;
  let paketHari = 7;

  if (parts.length >= 3) {
    const rawDev = parts[1];
    if (rawDev.startsWith('DEV-')) {
      deviceId = rawDev;
    } else if (rawDev.startsWith('DEV')) {
      deviceId = `DEV-${rawDev.substring(3, 7)}-${rawDev.substring(7)}`;
    } else {
      deviceId = rawDev;
    }

    if (!isNaN(parts[2])) {
      paketHari = Number(parts[2]);
    }
  }
  return { deviceId, paketHari };
}

// ------------------------------------------------------------------
// HANDLER UTAMA SERVERLESS VERCEL
// ------------------------------------------------------------------
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

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Database Supabase belum dikonfigurasi di Environment Variables Vercel.' });
  }

  // Parse body secara aman jika berupa JSON string
  let parsedBody = req.body || {};
  if (typeof parsedBody === 'string') {
    try {
      parsedBody = JSON.parse(parsedBody);
    } catch (e) {
      parsedBody = {};
    }
  }

  const query = req.query || {};
  const action = query.action || parsedBody?.action;
  const reff_id = query.reff_id || query.ref_id || parsedBody?.reff_id || parsedBody?.ref_id;
  const device_id = query.device_id || parsedBody?.device_id;
  const sppg_name = parsedBody?.sppg_name || query?.sppg_name;
  let paket_hari = query.paket_hari || parsedBody?.paket_hari;

  // ==========================================
  // SINKRONISASI / REGISTRASI NAMA SPPG
  // ==========================================
  if (action === 'register_sppg' && req.method === 'POST') {
    const targetDevId = parsedBody.device_id || device_id;
    const targetSppgName = parsedBody.sppg_name || sppg_name;

    if (!targetDevId || !targetSppgName) {
      return res.status(400).json({ error: 'Device ID dan Nama SPPG wajib disertakan.' });
    }

    try {
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(targetDevId)}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const licData = await getRes.json();
      const timestampWIB = getWIBTimestamp();

      if (Array.isArray(licData) && licData.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(targetDevId)}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sppg_name: targetSppgName,
            updated_at: timestampWIB
          })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/licenses`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            device_id: targetDevId,
            sppg_name: targetSppgName,
            license_key: generateCompactLicenseKey(),
            status: 'unregistered',
            client_name: 'Registrasi Awal Userscript',
            updated_at: timestampWIB
          })
        });
      }

      return res.status(200).json({ success: true, message: 'Nama SPPG berhasil disinkronkan.' });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal mengupdate nama SPPG ke database.' });
    }
  }

  // ==========================================
  // 1. CHECK VERSION & SAVE RELEASE
  // ==========================================
  if (action === 'check_version') {
    try {
      const relRes = await fetch(`${SUPABASE_URL}/rest/v1/releases?select=*&order=created_at.desc&limit=1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const relData = await relRes.json();

      if (Array.isArray(relData) && relData.length > 0) {
        return res.status(200).json({
          version: relData[0].version || globalReleaseCache.version,
          download_url: relData[0].download_url || globalReleaseCache.download_url,
          changelog: relData[0].changelog || globalReleaseCache.changelog
        });
      }
    } catch (e) {
      console.error('[Check Version DB Error]:', e);
    }
    return res.status(200).json(globalReleaseCache);
  }

  if (action === 'save_release' && req.method === 'POST') {
    const { version, download_url, changelog } = parsedBody;

    if (!version || !download_url) {
      return res.status(400).json({ error: 'Versi dan URL download wajib diisi.' });
    }

    globalReleaseCache = {
      version: String(version).trim(),
      download_url: String(download_url).trim(),
      changelog: String(changelog || '').trim()
    };

    try {
      const timestampWIB = getWIBTimestamp();

      await fetch(`${SUPABASE_URL}/rest/v1/releases`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          version: globalReleaseCache.version,
          download_url: globalReleaseCache.download_url,
          changelog: globalReleaseCache.changelog,
          created_at: timestampWIB
        })
      });

      return res.status(200).json({ 
        success: true, 
        message: `Release versi ${globalReleaseCache.version} berhasil diperbarui!` 
      });
    } catch (err) {
      return res.status(200).json({ 
        success: true, 
        message: `Release versi ${globalReleaseCache.version} berhasil diperbarui di memori server.` 
      });
    }
  }

  // ==========================================
  // 2. GET ALL LICENSES (DASHBOARD ADMIN)
  // ==========================================
  if (action === 'get_all_licenses') {
    try {
      const licRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const licenses = await licRes.json();
      return res.status(200).json({ licenses: Array.isArray(licenses) ? licenses : [] });
    } catch (e) {
      return res.status(200).json({ licenses: [] });
    }
  }

  // ==========================================
  // 3. GET & SAVE PACKAGES
  // ==========================================
  if (action === 'get_packages') {
    const defaultPackages = [
      { hari: 7, harga: 100, nama: 'Paket 7 Hari' },
      { hari: 30, harga: 50000, nama: 'Paket 30 Hari' }
    ];

    try {
      const pkgRes = await fetch(`${SUPABASE_URL}/rest/v1/packages?select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const dbPackages = await pkgRes.json();

      if (Array.isArray(dbPackages) && dbPackages.length > 0) {
        dbPackages.sort((a, b) => Number(a.hari || 0) - Number(b.hari || 0));
        return res.status(200).json({ packages: dbPackages });
      }
    } catch (e) {
      console.error('[Get Packages Error]:', e);
    }

    return res.status(200).json({ packages: defaultPackages });
  }

  if (action === 'save_packages' && req.method === 'POST') {
    const newPackages = parsedBody.packages;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/packages?id=neq.0`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (Array.isArray(newPackages) && newPackages.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/packages`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(newPackages)
        });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal menyimpan paket.' });
    }
  }

  // ==========================================
  // 4. GET & SAVE VOUCHERS
  // ==========================================
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

  if (action === 'save_vouchers' && req.method === 'POST') {
    const newVouchers = parsedBody.vouchers;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/vouchers?id=neq.0`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (Array.isArray(newVouchers) && newVouchers.length > 0) {
        const formattedVouchers = newVouchers.map(v => ({
          code: String(v.code || '').trim().toUpperCase(),
          days_value: Number(v.days_value || v.days || 7),
          max_uses: Number(v.max_uses || 10),
          used_count: Number(v.used_count || 0),
          used_devices: Array.isArray(v.used_devices) ? v.used_devices : []
        }));

        await fetch(`${SUPABASE_URL}/rest/v1/vouchers`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(formattedVouchers)
        });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal menyimpan voucher.' });
    }
  }

  // ==========================================
  // 5. STATISTIK PENDAPATAN
  // ==========================================
  if (action === 'get_stats') {
    try {
      const resTrans = await fetch(`${SUPABASE_URL}/rest/v1/transactions?select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const transactions = await resTrans.json();
      const listTrans = Array.isArray(transactions) ? transactions : [];

      const hariIniStr = getWIBDateString();

      let harian = 0;
      let mingguan = 0;
      let bulanan = 0;
      let chartHarian = [0, 0, 0, 0, 0, 0, 0];

      const datesArray = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        datesArray.push(getWIBDateString(d));
      }

      listTrans.forEach(t => {
        const tDate = (t.created_at || '').slice(0, 10);
        const amount = Number(t.amount || 0);

        if (tDate === hariIniStr) harian += amount;
        if (tDate.slice(0, 7) === hariIniStr.slice(0, 7)) bulanan += amount;

        if (datesArray.includes(tDate)) {
          mingguan += amount;
          const idx = datesArray.indexOf(tDate);
          chartHarian[idx] += amount;
        }
      });

      return res.status(200).json({
        harian: harian,
        mingguan: mingguan,
        bulanan: bulanan,
        chart_harian: chartHarian
      });
    } catch (e) {
      return res.status(200).json({ harian: 0, mingguan: 0, bulanan: 0, chart_harian: [0,0,0,0,0,0,0] });
    }
  }

  // ==========================================
  // 6. BACKUP KPM CLOUD
  // ==========================================
  if (action === 'save_backup' && req.method === 'POST') {
    const devIdBackup = parsedBody.device_id || device_id;
    const backupData = parsedBody.backup_data;
    if (!devIdBackup || !backupData) {
      return res.status(400).json({ error: 'Device ID dan data backup wajib diisi.' });
    }
    try {
      const nowWIB = new Date();
      nowWIB.setDate(nowWIB.getDate() + 3);
      const expiresAtWIB = getWIBTimestamp(nowWIB);
      const timestampWIB = getWIBTimestamp();

      const resUpsert = await fetch(`${SUPABASE_URL}/rest/v1/backups`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          device_id: devIdBackup,
          backup_data: backupData,
          expires_at: expiresAtWIB,
          updated_at: timestampWIB
        })
      });
      const dataResp = await resUpsert.json();
      return res.status(200).json({ success: true, data: dataResp });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal menyimpan backup ke database.' });
    }
  }

  if (action === 'delete_backup' && req.method === 'POST') {
    const devIdBackup = parsedBody.device_id || device_id;
    if (!devIdBackup) {
      return res.status(400).json({ error: 'Device ID wajib disertakan.' });
    }
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/backups?device_id=eq.${encodeURIComponent(devIdBackup)}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      return res.status(200).json({ success: true, message: 'Data backup berhasil dihapus.' });
    } catch (e) {
      return res.status(500).json({ error: 'Gagal menghapus data backup.' });
    }
  }

  if (action === 'get_backup') {
    const devIdBackup = query.device_id || parsedBody?.device_id;
    if (!devIdBackup) {
      return res.status(400).json({ error: 'Device ID wajib disertakan.' });
    }
    try {
      const bRes = await fetch(`${SUPABASE_URL}/rest/v1/backups?device_id=eq.${encodeURIComponent(devIdBackup)}&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const bData = await bRes.json();
      if (Array.isArray(bData) && bData.length > 0) {
        const backupRecord = bData[0];

        if (backupRecord.expires_at) {
          const nowWIBStr = getWIBTimestamp();
          if (nowWIBStr > backupRecord.expires_at) {
            await fetch(`${SUPABASE_URL}/rest/v1/backups?device_id=eq.${encodeURIComponent(devIdBackup)}`, {
              method: 'DELETE',
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            return res.status(404).json({ error: 'Data backup cloud sudah kedaluwarsa (lebih dari 3 hari) dan telah dihapus otomatis.' });
          }
        }

        return res.status(200).json({ success: true, backup_data: backupRecord.backup_data, created_at: backupRecord.updated_at });
      }
      return res.status(404).json({ error: 'Data backup tidak ditemukan di database.' });
    } catch (e) {
      return res.status(500).json({ error: 'Gagal mengambil data backup dari cloud.' });
    }
  }

  // ==========================================
  // 7. OPER / TRANSFER DEVICE ID
  // ==========================================
  if (action === 'transfer_device' && req.method === 'POST') {
    const sourceId = parsedBody.source_device_id;
    const targetId = parsedBody.target_device_id;

    if (!sourceId || !targetId) {
      return res.status(400).json({ error: 'Device ID Asal dan Tujuan wajib diisi.' });
    }
    if (sourceId === targetId) {
      return res.status(400).json({ error: 'Device ID Asal dan Tujuan tidak boleh sama.' });
    }

    try {
      const srcLicRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(sourceId)}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const srcLicData = await srcLicRes.json();
      if (!Array.isArray(srcLicData) || srcLicData.length === 0) {
        return res.status(404).json({ error: 'Device ID Asal tidak ditemukan di database.' });
      }
      const sourceLicense = srcLicData[0];

      const srcBackupRes = await fetch(`${SUPABASE_URL}/rest/v1/backups?device_id=eq.${encodeURIComponent(sourceId)}&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const srcBackupData = await srcBackupRes.json();
      let backupPayloadToTransfer = null;
      let expiresAtToTransfer = null;
      if (Array.isArray(srcBackupData) && srcBackupData.length > 0) {
        backupPayloadToTransfer = srcBackupData[0].backup_data;
        expiresAtToTransfer = srcBackupData[0].expires_at;
      }

      const timestampWIB = getWIBTimestamp();

      await fetch(`${SUPABASE_URL}/rest/v1/licenses`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          device_id: targetId,
          sppg_name: sourceLicense.sppg_name || '',
          license_key: sourceLicense.license_key || generateCompactLicenseKey(),
          exp_date: sourceLicense.exp_date,
          status: sourceLicense.status,
          client_name: sourceLicense.client_name || 'Migrasi Oper Device',
          updated_at: timestampWIB
        })
      });

      if (backupPayloadToTransfer) {
        await fetch(`${SUPABASE_URL}/rest/v1/backups`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            device_id: targetId,
            backup_data: backupPayloadToTransfer,
            expires_at: expiresAtToTransfer,
            updated_at: timestampWIB
          })
        });

        await fetch(`${SUPABASE_URL}/rest/v1/backups?device_id=eq.${encodeURIComponent(sourceId)}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
      }

      await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(sourceId)}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });

      return res.status(200).json({ success: true, message: `Berhasil mengoper lisensi dari ${sourceId} ke ${targetId}.` });
    } catch (e) {
      return res.status(500).json({ error: 'Gagal melakukan proses oper device.' });
    }
  }

  // ==========================================
  // 8. CHECK LICENSE
  // ==========================================
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

      const hariIniWIB = getWIBDateString();
      if (lic.exp_date && lic.exp_date < hariIniWIB) {
        return res.status(200).json({ valid: false, status: 'expired', exp_date: lic.exp_date, sppg_name: lic.sppg_name || '', msg: 'Lisensi Anda telah kadaluarsa.' });
      }

      const timestampWIB = getWIBTimestamp();
      await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(device_id)}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ updated_at: timestampWIB })
      });

      return res.status(200).json({ valid: true, status: 'active', exp_date: lic.exp_date, sppg_name: lic.sppg_name || '' });
    } catch (e) {
      return res.status(200).json({ valid: false, msg: 'Gagal verifikasi lisensi.' });
    }
  }

  // ==========================================
  // 9. POST ACTION HANDLERS (LISENSI & PEMBAYARAN)
  // ==========================================
  if (req.method === 'POST') {

    // PROSES HANDLER WEBHOOK TOKOPAY RESMI
    const isWebhookTokopay = parsedBody && (parsedBody.status || parsedBody.reference || (parsedBody.data && parsedBody.data.merchant_id));

    if (isWebhookTokopay) {
      const statusCallback = String(parsedBody.status || parsedBody.data?.status || parsedBody.raw_status || '').toLowerCase();
      const refIdCallback = parsedBody.reff_id || parsedBody.ref_id || parsedBody.data?.reff_id || parsedBody.custom_int;
      const isLunasCallback = statusCallback === 'success' || statusCallback === 'paid' || statusCallback === 'completed';

      if (isLunasCallback && refIdCallback) {
        let { deviceId: targetDevId, paketHari: targetPaketHari } = parseReffId(refIdCallback);

        if (!targetDevId) {
          targetDevId = parsedBody.device_id || device_id;
        }

        let nominalBayar = Number(parsedBody.data?.total_diterima || parsedBody.data?.total_dibayar || parsedBody.total_bayar || parsedBody.nominal || 0);

        if (targetDevId) {
          await catatTransaksiDanLisensi(SUPABASE_URL, SUPABASE_KEY, targetDevId, targetPaketHari, nominalBayar, 'Webhook Tokopay', sppg_name || '');
          return res.status(200).json({ status: true, message: 'Webhook processed successfully' });
        }
      }
      return res.status(200).json({ status: true, message: 'Callback received' });
    }

    if (parsedBody.action === 'record_successful_payment') {
      const devIdTarget = parsedBody.device_id || device_id;
      const paketHariTarget = Number(parsedBody.paket_hari || 7);
      const amountTarget = Number(parsedBody.amount || 0);
      const sppgTarget = parsedBody.sppg_name || sppg_name || '';

      if (!devIdTarget) {
        return res.status(400).json({ error: 'Device ID wajib disertakan.' });
      }

      try {
        const savedInfo = await catatTransaksiDanLisensi(
          SUPABASE_URL,
          SUPABASE_KEY,
          devIdTarget,
          paketHariTarget,
          amountTarget,
          'AutoPayment Frontend',
          sppgTarget
        );
        return res.status(200).json({ success: true, exp_date: savedInfo?.exp_date });
      } catch (err) {
        return res.status(500).json({ error: 'Gagal mencatat pembayaran.' });
      }
    }

    if (parsedBody.action === 'claim_trial') {
      const devIdTarget = parsedBody.device_id || device_id;
      const sppgTarget = parsedBody.sppg_name || sppg_name || '';

      if (!devIdTarget) {
        return res.status(400).json({ error: 'Device ID wajib disertakan.' });
      }

      try {
        const licRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(devIdTarget)}`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
          cache: 'no-store'
        });
        const licData = await licRes.json();

        if (Array.isArray(licData) && licData.length > 0 && licData[0].status === 'active') {
          return res.status(400).json({ error: 'Perangkat Anda sudah pernah terdaftar/mengklaim Free Trial.' });
        }

        const savedInfo = await catatTransaksiDanLisensi(
          SUPABASE_URL,
          SUPABASE_KEY,
          devIdTarget,
          1,
          0,
          'User Free Trial 24 Jam',
          sppgTarget
        );

        return res.status(200).json({
          success: true,
          message: 'Free Trial 24 jam berhasil diklaim!',
          exp_date: savedInfo?.exp_date
        });
      } catch (err) {
        return res.status(500).json({ error: 'Gagal memproses klaim trial.' });
      }
    }

    if (parsedBody.action === 'claim_voucher') {
      const { voucher_code, device_id: devIdTarget, sppg_name: sppgTarget } = parsedBody;
      const cleanVoucher = (voucher_code || '').trim().toUpperCase();

      if (!cleanVoucher || !devIdTarget) {
        return res.status(400).json({ error: 'Kode voucher dan Device ID wajib diisi.' });
      }

      try {
        const vRes = await fetch(`${SUPABASE_URL}/rest/v1/vouchers?code=eq.${encodeURIComponent(cleanVoucher)}&select=*`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
          cache: 'no-store'
        });
        const vData = await vRes.json();

        if (!Array.isArray(vData) || vData.length === 0) {
          return res.status(400).json({ error: 'Kode voucher tidak valid.' });
        }

        const voucher = vData[0];
        const usedDevices = Array.isArray(voucher.used_devices) ? voucher.used_devices : [];

        if (usedDevices.includes(devIdTarget)) {
          return res.status(400).json({ error: 'Device ID Anda sudah pernah menggunakan voucher ini.' });
        }

        if (voucher.used_count >= voucher.max_uses) {
          return res.status(400).json({ error: 'Kuota penggunaan voucher ini sudah habis.' });
        }

        usedDevices.push(devIdTarget);
        const newUsedCount = voucher.used_count + 1;

        await fetch(`${SUPABASE_URL}/rest/v1/vouchers?id=eq.${voucher.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            used_count: newUsedCount,
            used_devices: usedDevices
          })
        });

        const savedInfo = await catatTransaksiDanLisensi(SUPABASE_URL, SUPABASE_KEY, devIdTarget, voucher.days_value, 0, 'Voucher Claim', sppgTarget || '');

        return res.status(200).json({
          success: true,
          message: `Voucher berhasil diklaim! Durasi aktif ditambah ${voucher.days_value} hari.`,
          exp_date: savedInfo?.exp_date
        });

      } catch (err) {
        return res.status(500).json({ error: 'Gagal memproses klaim voucher.' });
      }
    }

    if (parsedBody.action === 'save_license') {
      const sppgTarget = parsedBody.sppg_name || sppg_name || '';
      await catatTransaksiDanLisensi(SUPABASE_URL, SUPABASE_KEY, parsedBody.device_id, parsedBody.paket_hari || 7, parsedBody.nominal || 0, 'Admin Manual', sppgTarget);

      const timestampWIB = getWIBTimestamp();
      const patchPayload = {
        exp_date: parsedBody.exp_date,
        status: parsedBody.status,
        license_key: parsedBody.license_key || generateCompactLicenseKey(),
        updated_at: timestampWIB
      };

      if (sppgTarget) patchPayload.sppg_name = sppgTarget;

      await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(parsedBody.device_id)}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload)
      });
      return res.status(200).json({ success: true });
    }

    if (parsedBody.action === 'delete_license') {
      await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(parsedBody.device_id)}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      return res.status(200).json({ success: true });
    }

    const merchantId = process.env.TOKOPAY_MERCHANT_ID;
    const secretKey = process.env.TOKOPAY_SECRET_KEY;
    if (!merchantId || !secretKey) return res.status(500).json({ error: 'Kunci API Tokopay belum diatur.' });

    const paketHariFix = Number(parsedBody.paket_hari || paket_hari || 7);

    let nominal = Number(parsedBody.nominal || 0);
    if (!nominal || nominal <= 0) {
      try {
        const pkgRes = await fetch(`${SUPABASE_URL}/rest/v1/packages?hari=eq.${paketHariFix}&select=*`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
          cache: 'no-store'
        });
        const pkgData = await pkgRes.json();
        if (Array.isArray(pkgData) && pkgData.length > 0) {
          nominal = Number(pkgData[0].harga || 0);
        }
      } catch (err) {}
    }

    if (!nominal || nominal <= 0) {
      nominal = paketHariFix === 30 ? 50000 : 100;
    }

    let refIdOrder = parsedBody.reff_id || parsedBody.ref_id || query.reff_id || query.ref_id;
    if (!refIdOrder || typeof refIdOrder !== 'string') {
      refIdOrder = generateClean14CharReffId();
    }

    const signature = crypto.createHash('md5').update(`${merchantId}:${secretKey}:${refIdOrder}`).digest('hex');

    try {
      const tokopayRes = await fetch(`https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&reff_id=${encodeURIComponent(refIdOrder)}&ref_id=${encodeURIComponent(refIdOrder)}&nominal=${nominal}&metode=${parsedBody.metode || 'QRISREALTIME'}&signature=${signature}`, { cache: 'no-store' });
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

  // ==========================================
  // 10. GET: POLLING STATUS PEMBAYARAN
  // ==========================================
  if (reff_id) {
    const merchantId = process.env.TOKOPAY_MERCHANT_ID;
    const secretKey = process.env.TOKOPAY_SECRET_KEY;
    if (!merchantId || !secretKey) return res.status(200).json({ is_paid: false, error: 'Kunci Tokopay belum diatur.' });

    const cleanReffId = String(reff_id).trim();
    const signature = crypto.createHash('md5').update(`${merchantId}:${secretKey}:${cleanReffId}`).digest('hex');

    try {
      const tokopayRes = await fetch(`https://api.tokopay.id/v1/order/status?merchant=${merchantId}&secret=${secretKey}&reff_id=${encodeURIComponent(cleanReffId)}&ref_id=${encodeURIComponent(cleanReffId)}&signature=${signature}`, { cache: 'no-store' });
      const tokopayData = await tokopayRes.json();

      const innerData = tokopayData?.data?.data || tokopayData?.data || tokopayData;

      // Status Pengecekan Sesuai Struktur Payload Tokopay Resmi
      const statusTransaksi = String(tokopayData?.status || innerData?.status || innerData?.raw_status || '').toLowerCase();

      const isLunas = statusTransaksi === 'success' || statusTransaksi === 'paid' || statusTransaksi === 'completed' || tokopayData?.is_paid === true;

      if (isLunas) {
        let { deviceId: parsedDevId, paketHari: parsedPaketHari } = parseReffId(cleanReffId);

        // Ambil Device ID langsung dari parameter request client polling
        let targetDevId = device_id || query.device_id || parsedBody?.device_id || parsedDevId;
        let targetPaketHari = Number(paket_hari || query.paket_hari || parsedBody?.paket_hari || parsedPaketHari || 7);
        let targetSppgName = sppg_name || query.sppg_name || parsedBody?.sppg_name || '';

        let nominalBayar = Number(tokopayData?.data?.total_diterima || tokopayData?.data?.total_dibayar || innerData?.total_bayar || innerData?.nominal || 0);

        if (!targetDevId) return res.status(200).json({ is_paid: false, error: 'Device ID tidak terdeteksi dari request browser.' });

        const savedInfo = await catatTransaksiDanLisensi(SUPABASE_URL, SUPABASE_KEY, targetDevId, targetPaketHari, nominalBayar, 'User QRIS Realtime', targetSppgName);

        return res.status(200).json({
          is_paid: true,
          success: true,
          status: 'Success',
          exp_date: savedInfo?.exp_date || null
        });
      }

      return res.status(200).json({ is_paid: false, success: false, raw_status: tokopayData?.status || innerData?.status || 'Unpaid' });
    } catch (err) {
      return res.status(200).json({ is_paid: false, success: false, error: 'Gagal mengecek status Tokopay.' });
    }
  }

  return res.status(400).json({ error: 'Permintaan tidak valid.' });
}
