import crypto from 'crypto';

// In-Memory Fallback Release Data
let globalReleaseCache = {
  version: '1.5.59',
  download_url: 'https://mindspace-id.vercel.app/sipgn-autofill.user.js',
  changelog: 'Pembaruan fitur sinkronisasi nama SPPG & penambahan dukungan Maintenance Mode.'
};

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

async function catatTransaksiDanLisensi(supabaseUrl, supabaseKey, deviceId, paketHari, nominal = 0, clientName = 'User QRIS / Voucher', sppgName = '') {
  if (!supabaseUrl || !supabaseKey || !deviceId) return null;

  try {
    let finalNominal = Number(nominal);
    if (!finalNominal || finalNominal <= 0) {
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
    const nonce = Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
    const payload = `${expDateNew}|${deviceId}|AutoPayment|MINDSTUDIO2026|${nonce}`;
    const licenseKeyNew = `MIND-${btoa(payload).split('').reverse().join('')}`;

    const timestampWIB = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');

    const bodyPayload = {
      exp_date: expDateNew,
      license_key: licenseKeyNew,
      status: 'active',
      updated_at: timestampWIB
    };

    if (sppgName) {
      bodyPayload.sppg_name = sppgName;
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
      return Array.isArray(updatedData) && updatedData.length > 0 ? updatedData[0] : { exp_date: expDateNew };
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
      return Array.isArray(insertedData) && insertedData.length > 0 ? insertedData[0] : { exp_date: expDateNew };
    }
  } catch (err) {
    console.error('[Catat Transaksi Error]:', err);
    return null;
  }
}

// Helper Parser Device ID dari reff_id
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

  const { query, body = {} } = req;
  const action = query.action || body?.action;
  const reff_id = query.reff_id || query.ref_id || body?.reff_id || body?.ref_id;
  const device_id = query.device_id || body?.device_id;
  const sppg_name = body?.sppg_name || query?.sppg_name;
  let paket_hari = query.paket_hari || body?.paket_hari;

  // ==========================================
  // PEMERIKSAAN GLOBAL MAINTENANCE MODE
  // ==========================================
  // Kecuali action untuk menyimpan setting maintenance itu sendiri (agar admin bisa mematikannya kembali)
  if (action !== 'save_setting' || body.key !== 'maintenance_mode') {
    try {
      const maintRes = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.maintenance_mode&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const maintData = await maintRes.json();
      
      if (Array.isArray(maintData) && maintData.length > 0) {
        const val = maintData[0].value;
        const isMaintenance = (val === true || val === 'true' || val === 1 || val === '1');

        if (isMaintenance) {
          // Ambil pesan kustom pemeliharaan jika ada
          let maintenanceMsg = 'Sistem SIPGN Autofill saat ini sedang dalam jadwal pemeliharaan (maintenance). Silakan coba beberapa saat lagi.';
          try {
            const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.maintenance_message&select=*`, {
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
              cache: 'no-store'
            });
            const msgData = await msgRes.json();
            if (Array.isArray(msgData) && msgData.length > 0 && msgData[0].value) {
              maintenanceMsg = String(msgData[0].value);
            }
          } catch (e) {}

          // Respon khusus untuk memberitahu userscript bahwa server sedang maintenance
          return res.status(200).json({
            valid: false,
            status: 'maintenance',
            success: false,
            msg: maintenanceMsg,
            message: maintenanceMsg
          });
        }
      }
    } catch (e) {
      console.error('[Maintenance Check Error]:', e);
    }
  }

  // ==========================================
  // GET GLOBAL SETTING (QRIS STATUS, DLL)
  // ==========================================
  if (action === 'get_setting' || (query.action === 'get_settings' && query.key)) {
    const targetKey = query.key || 'qris_enabled';
    try {
      const setRes = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.${targetKey}&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const setData = await setRes.json();
      if (Array.isArray(setData) && setData.length > 0) {
        const val = setData[0].value;
        const isEnabled = !(val === false || val === 'false' || val === 0 || val === '0');
        return res.status(200).json({ success: true, key: targetKey, value: isEnabled });
      }
      return res.status(200).json({ success: true, key: targetKey, value: true });
    } catch (e) {
      return res.status(200).json({ success: true, key: targetKey, value: true });
    }
  }

  // ==========================================
  // SINKRONISASI / REGISTRASI NAMA SPPG (NEW)
  // ==========================================
  if (action === 'register_sppg' && req.method === 'POST') {
    const targetDevId = body.device_id || device_id;
    const targetSppgName = body.sppg_name || sppg_name;

    if (!targetDevId || !targetSppgName) {
      return res.status(400).json({ error: 'Device ID dan Nama SPPG wajib disertakan.' });
    }

    try {
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(targetDevId)}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store'
      });
      const licData = await getRes.json();
      const timestampWIB = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');

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
    const { version, download_url, changelog } = body;

    if (!version || !download_url) {
      return res.status(400).json({ error: 'Versi dan URL download wajib diisi.' });
    }

    globalReleaseCache = {
      version: String(version).trim(),
      download_url: String(download_url).trim(),
      changelog: String(changelog || '').trim()
    };

    try {
      const timestampWIB = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');

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
    const newPackages = body.packages;
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
    const newVouchers = body.vouchers;
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

      const nowWIB = new Date();
      const hariIniStr = nowWIB.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

      let harian = 0;
      let mingguan = 0;
      let bulanan = 0;
      let chartHarian = [0, 0, 0, 0, 0, 0, 0];

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
    const devIdBackup = body.device_id || device_id;
    const backupData = body.backup_data;
    if (!devIdBackup || !backupData) {
      return res.status(400).json({ error: 'Device ID dan data backup wajib diisi.' });
    }
    try {
      const nowWIB = new Date();
      nowWIB.setDate(nowWIB.getDate() + 3);
      const expiresAtWIB = nowWIB.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');
      const timestampWIB = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');

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
    const devIdBackup = body.device_id || device_id;
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
    const devIdBackup = query.device_id || body?.device_id;
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
          const nowWIBStr = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');
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
    const sourceId = body.source_device_id;
    const targetId = body.target_device_id;

    if (!sourceId || !targetId) {
      return res.status(40
