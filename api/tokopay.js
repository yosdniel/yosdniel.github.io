import crypto from 'crypto';

// In-Memory Fallback Release Data
let globalReleaseCache = {
  version: '1.5.59',
  download_url: 'https://mindspace-id.vercel.app/sipgn-autofill.user.js',
  changelog: 'Pembaruan fitur sinkronisasi nama SPPG & penambahan dukungan Maintenance Mode.'
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BACKUP_BYTES = 1_000_000; // batas ukuran backup cloud (~1 MB)

/* ============================================================================
 * HELPER UMUM
 * ============================================================================ */
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

function hitungHargaFinalPaket(pkg) {
  if (!pkg) return 0;
  const hargaNormal = Number(pkg.harga || pkg.price || 0);
  const discType = pkg.discount_type || 'none';
  const discVal = Number(pkg.discount_value || 0);
  const discUntil = pkg.discount_until || null;

  if (discUntil && /^\d{4}-\d{2}-\d{2}$/.test(discUntil)) {
    const hariIniWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    if (hariIniWIB > discUntil) {
      return hargaNormal;
    }
  }

  if (discType === 'percent' && discVal > 0) {
    const potongan = Math.round((hargaNormal * discVal) / 100);
    return Math.max(0, hargaNormal - potongan);
  } else if (discType === 'nominal' && discVal > 0) {
    return Math.max(0, hargaNormal - discVal);
  } else if (pkg.final_price !== undefined && pkg.final_price !== null) {
    return Number(pkg.final_price);
  }

  return hargaNormal;
}

function nowWIBTimestamp() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');
}

/* ============================================================================
 * JWT: verifikasi tanda tangan HS256 jika JWT_SECRET diset di Vercel.
 * Jika JWT_SECRET belum diset, payload tetap dibaca (tanpa verifikasi) seperti
 * sebelumnya. Sangat disarankan mengisi JWT_SECRET sama dengan /api/config.
 * ============================================================================ */
function extractToken(req, body = {}, query = {}) {
  const authHeader = String(req.headers?.authorization || '');
  return authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : String(body?.token || query?.token || '').trim();
}

function parseJwt(req, body = {}, query = {}) {
  const token = extractToken(req, body, query);
  if (!token || token.split('.').length !== 3) return { payload: null, verified: false };

  try {
    const [h, p, s] = token.split('.');
    const payload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

    if (payload.exp && typeof payload.exp === 'number' && payload.exp <= Math.floor(Date.now() / 1000)) {
      return { payload: null, verified: false };
    }

    const secret = process.env.JWT_SECRET;
    if (secret) {
      const header = JSON.parse(Buffer.from(h.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      if (header.alg !== 'HS256') return { payload: null, verified: false };
      const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
      const a = Buffer.from(expected);
      const b = Buffer.from(String(s));
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { payload: null, verified: false };
      return { payload, verified: true };
    }

    return { payload, verified: false };
  } catch {
    return { payload: null, verified: false };
  }
}

function jwtUserId(payload) {
  if (!payload) return null;
  return String(payload.sub || payload.user_id || payload.userId || payload.id || '').trim() || null;
}

/* ============================================================================
 * ADMIN GUARD: aktif jika env ADMIN_API_KEY diisi. Dashboard admin harus
 * mengirim header "X-Admin-Key". Jika env kosong, akses tetap terbuka (kompatibel
 * dengan versi lama) namun muncul peringatan di log Vercel.
 * ============================================================================ */
function requireAdmin(req, res, actionName) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) {
    console.warn(`[SECURITY] ADMIN_API_KEY belum diset. Action admin "${actionName}" terbuka untuk publik.`);
    return true;
  }
  const given = String(req.headers?.['x-admin-key'] || '');
  const a = Buffer.from(key);
  const b = Buffer.from(given);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  res.status(401).json({ success: false, error: 'Akses admin ditolak.' });
  return false;
}

/* ============================================================================
 * DEVICE / AKUN
 * ============================================================================ */
function normalizeDeviceArray(raw) {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [raw];
    } catch {
      list = [raw];
    }
  }
  return [...new Set(list.map(v => String(v || '').trim().toUpperCase()).filter(Boolean))];
}

async function resolveOwnerAccountByDevice(supabaseUrl, supabaseKey, cleanDeviceId, candidateUserId = null) {
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  // 1. Jika ada kandidat user_id (UUID dari user_accounts.id atau sub JWT), cek langsung barisnya
  if (candidateUserId && UUID_RE.test(candidateUserId)) {
    try {
      const uRes = await fetch(
        `${supabaseUrl}/rest/v1/user_accounts?id=eq.${encodeURIComponent(candidateUserId)}&select=id,uid,uuid,username,email,device_id,device_ids`,
        { headers, cache: 'no-store' }
      );
      const uData = await uRes.json();
      if (Array.isArray(uData) && uData.length > 0) {
        const acc = uData[0];
        const devList = normalizeDeviceArray(acc.device_ids ?? acc.device_id);
        if (devList.includes(cleanDeviceId)) {
          return acc;
        }
      }
    } catch {}
  }

  // 2. Fallback: cari akun yang memiliki cleanDeviceId di device_ids (jsonb) atau device_id
  try {
    const jsonFilter = encodeURIComponent(JSON.stringify([cleanDeviceId]));
    const searchRes = await fetch(
      `${supabaseUrl}/rest/v1/user_accounts?or=(device_ids.cs.${jsonFilter},device_id.eq.${encodeURIComponent(cleanDeviceId)})&select=id,uid,uuid,username,email,device_id,device_ids&limit=1`,
      { headers, cache: 'no-store' }
    );
    const searchData = await searchRes.json();
    if (Array.isArray(searchData) && searchData.length > 0) {
      return searchData[0];
    }
  } catch {}

  return null;
}

async function userOwnsDevice(supabaseUrl, supabaseKey, cleanDeviceId, uid) {
  if (!uid) return false;
  const owner = await resolveOwnerAccountByDevice(supabaseUrl, supabaseKey, cleanDeviceId, uid);
  return Boolean(owner && (String(owner.id) === String(uid) || String(owner.uid) === String(uid)));
}

/* ============================================================================
 * TRANSAKSI + LISENSI (idempotent jika reffId diberikan)
 * Idempotensi butuh kolom transactions.reff_id UNIQUE (lihat SQL di bawah).
 * Tanpa kolom itu, perilaku kembali seperti versi lama.
 * ============================================================================ */
async function catatTransaksiDanLisensi(supabaseUrl, supabaseKey, deviceId, paketHari, nominal = 0, clientName = 'User QRIS / Voucher', sppgName = '', candidateUserId = null, reffId = null) {
  if (!supabaseUrl || !supabaseKey || !deviceId) return null;
  const cleanDevId = String(deviceId).trim().toUpperCase();
  const H = (extra = {}) => ({ apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, ...extra });

  try {
    let finalNominal = Number(nominal);
    if (!finalNominal || finalNominal <= 0) {
      const pRes = await fetch(`${supabaseUrl}/rest/v1/packages?hari=eq.${Number(paketHari)}&select=*`, {
        headers: H(),
        cache: 'no-store'
      });
      const pData = await pRes.json();
      if (Array.isArray(pData) && pData.length > 0) {
        finalNominal = hitungHargaFinalPaket(pData[0]);
      } else {
        finalNominal = Number(paketHari) === 30 ? 50000 : 25000;
      }
    }

    // 1. Catat Transaksi (409 = reff_id sudah pernah diproses -> jangan tambah masa aktif lagi)
    const trxBody = {
      device_id: cleanDevId,
      amount: finalNominal,
      paket_hari: Number(paketHari),
      status: 'success'
    };

    let trxRes = await fetch(`${supabaseUrl}/rest/v1/transactions`, {
      method: 'POST',
      headers: H({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(reffId ? { ...trxBody, reff_id: reffId } : trxBody)
    });

    if (reffId && trxRes.status === 409) {
      const dupRes = await fetch(`${supabaseUrl}/rest/v1/licenses?device_id=eq.${encodeURIComponent(cleanDevId)}`, {
        headers: H(), cache: 'no-store'
      });
      const dupLic = await dupRes.json();
      return Array.isArray(dupLic) && dupLic.length > 0 ? { ...dupLic[0], duplicate: true } : { duplicate: true };
    }

    // Kolom reff_id belum ada -> catat tanpa reff_id (perilaku lama)
    if (reffId && !trxRes.ok) {
      trxRes = await fetch(`${supabaseUrl}/rest/v1/transactions`, {
        method: 'POST',
        headers: H({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(trxBody)
      });
    }

    // 2. Cek Lisensi Eksisting & Pemilik Akun (user_accounts.id)
    const getRes = await fetch(`${supabaseUrl}/rest/v1/licenses?device_id=eq.${encodeURIComponent(cleanDevId)}`, {
      method: 'GET',
      headers: H(),
      cache: 'no-store'
    });

    const existing = await getRes.json();
    const activeLicense = Array.isArray(existing) && existing.length > 0 ? existing[0] : null;
    const ownerAccount = await resolveOwnerAccountByDevice(supabaseUrl, supabaseKey, cleanDevId, candidateUserId);
    const resolvedUserId = activeLicense?.user_id || ownerAccount?.id || null;

    const expDateNew = calculateExpiryDate(activeLicense?.exp_date, paketHari);
    const nonce = Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
    const payload = `${expDateNew}|${cleanDevId}|AutoPayment|MINDSTUDIO2026|${nonce}`;
    const licenseKeyNew = `MIND-${btoa(payload).split('').reverse().join('')}`;

    const bodyPayload = {
      exp_date: expDateNew,
      license_key: licenseKeyNew,
      status: 'active',
      updated_at: nowWIBTimestamp()
    };

    if (resolvedUserId) bodyPayload.user_id = resolvedUserId;
    if (sppgName) bodyPayload.sppg_name = sppgName;

    if (activeLicense) {
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/licenses?device_id=eq.${encodeURIComponent(cleanDevId)}`, {
        method: 'PATCH',
        headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(bodyPayload),
        cache: 'no-store'
      });
      const updatedData = await updateRes.json();
      return Array.isArray(updatedData) && updatedData.length > 0 ? updatedData[0] : { exp_date: expDateNew, user_id: resolvedUserId };
    } else {
      bodyPayload.device_id = cleanDevId;
      bodyPayload.client_name = ownerAccount?.username || clientName;

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/licenses`, {
        method: 'POST',
        headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(bodyPayload),
        cache: 'no-store'
      });
      const insertedData = await insertRes.json();
      return Array.isArray(insertedData) && insertedData.length > 0 ? insertedData[0] : { exp_date: expDateNew, user_id: resolvedUserId };
    }
  } catch (err) {
    console.error('[Catat Transaksi Error]:', err);
    return null;
  }
}

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

async function fetchTokopayStatus(merchantId, secretKey, reffId) {
  const signature = crypto.createHash('md5').update(`${merchantId}${secretKey}${reffId}`).digest('hex');
  const r = await fetch(`https://api.tokopay.id/v1/order/status?merchant=${merchantId}&secret=${secretKey}&reff_id=${encodeURIComponent(reffId)}&ref_id=${encodeURIComponent(reffId)}&signature=${signature}`, { cache: 'no-store' });
  const data = await r.json();
  const inner = data?.data?.data || data?.data || data;
  const status = String(inner?.status || inner?.raw_status || data?.status || '').toLowerCase();
  const paid = status === 'success' || status === 'paid' || status === 'completed' || data?.is_paid === true;
  return { paid, inner, raw: data, nominal: Number(inner?.total_bayar || inner?.nominal || 0) };
}

/* ============================================================================
 * HANDLER
 * ============================================================================ */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Admin-Key, X-MS-Integrity');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Konfigurasi Supabase URL atau Service Key belum diatur di server Vercel.' });
  }

  const H = (extra = {}) => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...extra });

  const { query = {}, body = {} } = req;
  const action = query.action || body?.action;
  const reff_id = query.reff_id || query.ref_id || body?.reff_id || body?.ref_id;
  const device_id = query.device_id || body?.device_id;
  const sppg_name = body?.sppg_name || query?.sppg_name;
  let paket_hari = query.paket_hari || body?.paket_hari;

  // User ID: prioritas dari JWT (terverifikasi bila JWT_SECRET diset), baru fallback body/query
  const { payload: jwtPayload, verified: jwtVerified } = parseJwt(req, body, query);
  const jwtUid = jwtUserId(jwtPayload);
  const candidateUserId = jwtUid || String(body?.user_id || query?.user_id || '').trim() || null;

  // ==========================================
  // GET RELEASE METADATA / CHECK VERSION
  // ==========================================
  if (action === 'get_release' || action === 'check_version') {
    let releaseData = globalReleaseCache;
    try {
      const relRes = await fetch(`${SUPABASE_URL}/rest/v1/releases?select=*&order=created_at.desc&limit=1`, {
        headers: H(),
        cache: 'no-store'
      });
      const relData = await relRes.json();
      if (Array.isArray(relData) && relData.length > 0 && relData[0]?.version) {
        releaseData = {
          ...relData[0],
          version: String(relData[0].version).trim(),
          download_url: String(relData[0].download_url || globalReleaseCache.download_url).trim(),
          changelog: String(relData[0].changelog || '').trim()
        };
        globalReleaseCache = releaseData;
      }
    } catch (e) {}

    return res.status(200).json({
      success: true,
      version: releaseData.version,
      download_url: releaseData.download_url,
      changelog: releaseData.changelog,
      release: releaseData
    });
  }

  // ==========================================
  // GET ALL LICENSES (ADMIN)
  // ==========================================
  if (action === 'get_all_licenses') {
    if (!requireAdmin(req, res, action)) return;
    try {
      const licRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?select=*`, {
        headers: H(),
        cache: 'no-store'
      });
      const licenses = await licRes.json();
      return res.status(200).json({ licenses: Array.isArray(licenses) ? licenses : [] });
    } catch (e) {
      return res.status(200).json({ licenses: [] });
    }
  }

  // ==========================================
  // GET PACKAGES
  // ==========================================
  if (action === 'get_packages') {
    const defaultPackages = [
      { hari: 7, harga: 25000, nama: 'Paket 7 Hari', discount_type: 'none', discount_value: 0, discount_until: null, final_price: 25000 },
      { hari: 30, harga: 50000, nama: 'Paket 30 Hari', discount_type: 'none', discount_value: 0, discount_until: null, final_price: 50000 }
    ];

    try {
      const pkgRes = await fetch(`${SUPABASE_URL}/rest/v1/packages?select=*`, {
        headers: H(),
        cache: 'no-store'
      });
      const dbPackages = await pkgRes.json();

      if (Array.isArray(dbPackages) && dbPackages.length > 0) {
        dbPackages.sort((a, b) => Number(a.hari || a.days || 0) - Number(b.hari || b.days || 0));
        const formattedPkgs = dbPackages.map(p => ({
          ...p,
          hari: p.hari || p.days,
          harga: p.harga || p.price,
          nama: p.nama || p.name,
          final_price: hitungHargaFinalPaket(p)
        }));
        return res.status(200).json({ packages: formattedPkgs });
      }
    } catch (e) {}

    return res.status(200).json({ packages: defaultPackages });
  }

  // ==========================================
  // GET STATS (ADMIN)
  // ==========================================
  if (action === 'get_stats') {
    if (!requireAdmin(req, res, action)) return;
    try {
      const resTrans = await fetch(`${SUPABASE_URL}/rest/v1/transactions?select=*`, {
        headers: H(),
        cache: 'no-store'
      });
      const transactions = await resTrans.json();
      const listTrans = Array.isArray(transactions) ? transactions : [];

      const nowWIB = new Date();
      const hariIniStr = nowWIB.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

      let harian = 0, mingguan = 0, bulanan = 0;
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

      return res.status(200).json({ harian, mingguan, bulanan, chart_harian: chartHarian });
    } catch (e) {
      return res.status(200).json({ harian: 0, mingguan: 0, bulanan: 0, chart_harian: [0, 0, 0, 0, 0, 0, 0] });
    }
  }

  // ==========================================
  // CHECK LICENSE / CHECK STATUS (alias) & DEVICE LINK STATUS
  // ==========================================
  if (action === 'check_license' || action === 'check_status') {
    if (!device_id) return res.status(200).json({ valid: false, msg: 'Device ID tidak ditemukan.', message: 'Device ID tidak ditemukan.' });
    const cleanDevId = String(device_id).trim().toUpperCase();

    try {
      // Ambil baris licenses + relasi user_accounts(id, uid, uuid, username, email)
      const getRes = await fetch(
        `${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(cleanDevId)}&select=*,user_accounts(id,uid,uuid,username,email)`,
        { method: 'GET', headers: H(), cache: 'no-store' }
      );
      const licenses = await getRes.json();
      const lic = Array.isArray(licenses) && licenses.length > 0 ? licenses[0] : null;

      // Cek apakah perangkat sudah tertaut di user_accounts
      const ownerAccount = await resolveOwnerAccountByDevice(SUPABASE_URL, SUPABASE_KEY, cleanDevId, candidateUserId);
      let resolvedUserId = lic?.user_id || ownerAccount?.id || null;

      // Auto-heal: jika baris lisensi ada tapi user_id belum terisi padahal sudah ditautkan di user_accounts
      if (lic && !lic.user_id && ownerAccount?.id) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/licenses?id=eq.${lic.id}`, {
            method: 'PATCH',
            headers: H({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ user_id: ownerAccount.id, updated_at: nowWIBTimestamp() })
          });
          resolvedUserId = ownerAccount.id;
        } catch {}
      }

      const ownerProfile = lic?.user_accounts || (ownerAccount ? {
        id: ownerAccount.id,
        uid: ownerAccount.uid,
        uuid: ownerAccount.uuid,
        username: ownerAccount.username,
        email: ownerAccount.email
      } : null);

      const isLinked = Boolean(resolvedUserId);
      const isLinkedToCurrentUser = Boolean(
        candidateUserId &&
        (resolvedUserId === candidateUserId || ownerProfile?.uid === candidateUserId)
      );

      const linkPayload = {
        registered: Boolean(lic),
        user_id: resolvedUserId,
        is_linked: candidateUserId ? isLinkedToCurrentUser : isLinked,
        is_linked_any: isLinked,
        owner: ownerProfile,
        linked_username: ownerProfile?.username || null
      };

      const reply = (payload) => res.status(200).json({ ...payload, message: payload.msg, ...linkPayload });

      if (!lic) {
        return reply({ valid: false, status: 'unregistered', msg: 'Device ID belum terdaftar.' });
      }
      if (lic.status === 'revoked') {
        return reply({ valid: false, status: 'revoked', exp_date: lic.exp_date || null, msg: 'Akses perangkat dicabut.' });
      }
      if (lic.status === 'hold') {
        return reply({ valid: false, status: 'hold', exp_date: lic.exp_date || null, msg: 'Akses ditangguhkan.' });
      }

      const hariIniWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      if (lic.exp_date && lic.exp_date < hariIniWIB) {
        return reply({ valid: false, status: 'expired', exp_date: lic.exp_date, msg: 'Masa aktif habis.' });
      }

      return reply({
        valid: true,
        status: 'active',
        exp_date: lic.exp_date,
        sppg_name: lic.sppg_name || '',
        msg: ''
      });
    } catch (e) {
      return res.status(200).json({ valid: false, msg: 'Gagal verifikasi lisensi.', message: 'Gagal verifikasi lisensi.' });
    }
  }

  // ==========================================
  // GET BACKUP (cloud)
  // ==========================================
  if (action === 'get_backup') {
    if (!device_id) return res.status(400).json({ success: false, error: 'Device ID wajib diisi.' });
    const isAdminReq = !!process.env.ADMIN_API_KEY && String(req.headers?.['x-admin-key'] || '') === process.env.ADMIN_API_KEY;
    if (!isAdminReq && !jwtUid) return res.status(401).json({ success: false, error: 'Sesi login tidak valid.' });
    const cleanDevId = String(device_id).trim().toUpperCase();

    if (!isAdminReq && !(await userOwnsDevice(SUPABASE_URL, SUPABASE_KEY, cleanDevId, jwtUid))) {
      return res.status(403).json({ success: false, error: 'Perangkat ini tidak tertaut ke akun Anda.' });
    }

    try {
      const bRes = await fetch(
        `${SUPABASE_URL}/rest/v1/backups?device_id=eq.${encodeURIComponent(cleanDevId)}&select=backup_data,expires_at,updated_at&limit=1`,
        { headers: H(), cache: 'no-store' }
      );
      const rows = await bRes.json();
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

      if (!row) return res.status(404).json({ success: false, error: 'Backup cloud kosong atau sudah kadaluarsa.' });

      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        fetch(`${SUPABASE_URL}/rest/v1/backups?device_id=eq.${encodeURIComponent(cleanDevId)}`, {
          method: 'DELETE', headers: H({ Prefer: 'return=minimal' })
        }).catch(() => {});
        return res.status(404).json({ success: false, error: 'Backup cloud kosong atau sudah kadaluarsa.' });
      }

      return res.status(200).json({
        success: true,
        backup_data: row.backup_data,
        updated_at: row.updated_at,
        expires_at: row.expires_at
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Gagal membaca backup dari database.' });
    }
  }

  // ==========================================
  // POST REQUEST HANDLERS
  // ==========================================
  if (req.method === 'POST') {
    // 0a. LINK DEVICE KE AKUN
    if (body.action === 'link_device') {
      const devId = String(body.device_id || '').trim().toUpperCase();
      if (!devId) return res.status(400).json({ success: false, error: 'Device ID wajib diisi.' });
      if (!jwtUid) return res.status(401).json({ success: false, error: 'Sesi login tidak valid. Silakan login ulang.' });

      try {
        const filter = UUID_RE.test(jwtUid) ? `id=eq.${encodeURIComponent(jwtUid)}` : `uid=eq.${encodeURIComponent(jwtUid)}`;
        const accRes = await fetch(
          `${SUPABASE_URL}/rest/v1/user_accounts?${filter}&select=id,uid,uuid,username,email,device_id,device_ids&limit=1`,
          { headers: H(), cache: 'no-store' }
        );
        const accData = await accRes.json();
        const acc = Array.isArray(accData) && accData.length > 0 ? accData[0] : null;
        if (!acc) return res.status(404).json({ success: false, error: 'Akun MindHUB tidak ditemukan.' });

        // Tolak jika perangkat sudah tertaut ke akun LAIN
        const currentOwner = await resolveOwnerAccountByDevice(SUPABASE_URL, SUPABASE_KEY, devId, null);
        if (currentOwner && String(currentOwner.id) !== String(acc.id)) {
          return res.status(409).json({ success: false, error: 'Device ID ini sudah tertaut ke akun lain.' });
        }

        const devList = normalizeDeviceArray(acc.device_ids ?? acc.device_id);
        if (!devList.includes(devId)) devList.push(devId);

        let patchRes = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?id=eq.${encodeURIComponent(acc.id)}`, {
          method: 'PATCH',
          headers: H({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify({ device_ids: devList })
        });
        if (!patchRes.ok) {
          // Skema lama: kolom tunggal device_id
          patchRes = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?id=eq.${encodeURIComponent(acc.id)}`, {
            method: 'PATCH',
            headers: H({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
            body: JSON.stringify({ device_id: devId })
          });
        }
        if (!patchRes.ok) {
          return res.status(500).json({ success: false, error: 'Gagal menyimpan tautan perangkat ke akun.' });
        }

        // Sinkronkan ke baris lisensi bila sudah ada
        const licPatch = { user_id: acc.id, updated_at: nowWIBTimestamp() };
        const sppg = String(body.sppg_name || '').trim().slice(0, 120);
        if (sppg) licPatch.sppg_name = sppg;
        await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(devId)}`, {
          method: 'PATCH',
          headers: H({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify(licPatch)
        });

        return res.status(200).json({ success: true, linked: true, user_id: acc.id, account_id: acc.id, message: 'Perangkat berhasil ditautkan.' });
      } catch (err) {
        return res.status(500).json({ success: false, error: 'Gagal menautkan perangkat.' });
      }
    }

    // 0b. REGISTER NAMA SPPG
    if (body.action === 'register_sppg') {
      const devId = String(body.device_id || '').trim().toUpperCase();
      const nama = String(body.sppg_name || '').trim().slice(0, 120);
      if (!devId || !nama) return res.status(400).json({ success: false, error: 'Device ID dan nama SPPG wajib diisi.' });
      if (!jwtUid) return res.status(401).json({ success: false, error: 'Sesi login tidak valid.' });

      if (!(await userOwnsDevice(SUPABASE_URL, SUPABASE_KEY, devId, jwtUid))) {
        return res.status(403).json({ success: false, error: 'Perangkat ini tidak tertaut ke akun Anda.' });
      }

      try {
        const upd = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(devId)}`, {
          method: 'PATCH',
          headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
          body: JSON.stringify({ sppg_name: nama, updated_at: nowWIBTimestamp() })
        });
        const rows = await upd.json();
        return res.status(200).json({ success: true, sppg_name: nama, registered: Array.isArray(rows) && rows.length > 0 });
      } catch (err) {
        return res.status(500).json({ success: false, error: 'Gagal menyimpan nama SPPG.' });
      }
    }

    // 0c. SAVE BACKUP (cloud)
    if (body.action === 'save_backup') {
      const devId = String(body.device_id || '').trim().toUpperCase();
      if (!devId) return res.status(400).json({ success: false, error: 'Device ID wajib diisi.' });
      if (!jwtUid) return res.status(401).json({ success: false, error: 'Sesi login tidak valid.' });
      if (!body.backup_data || typeof body.backup_data !== 'object') {
        return res.status(400).json({ success: false, error: 'Data backup tidak valid.' });
      }

      const serialized = JSON.stringify(body.backup_data);
      if (serialized.length > MAX_BACKUP_BYTES) {
        return res.status(413).json({ success: false, error: 'Ukuran backup terlalu besar.' });
      }

      if (!(await userOwnsDevice(SUPABASE_URL, SUPABASE_KEY, devId, jwtUid))) {
        return res.status(403).json({ success: false, error: 'Perangkat ini tidak tertaut ke akun Anda.' });
      }

      const days = Math.min(30, Math.max(1, Number(body.auto_delete_days) || 3));
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

      try {
        const up = await fetch(`${SUPABASE_URL}/rest/v1/backups?on_conflict=device_id`, {
          method: 'POST',
          headers: H({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify({
            device_id: devId,
            user_id: jwtUid,
            backup_data: body.backup_data,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          })
        });
        if (!up.ok) {
          return res.status(500).json({ success: false, error: 'Gagal menyimpan backup. Pastikan tabel "backups" sudah dibuat.' });
        }
        return res.status(200).json({ success: true, expires_at: expiresAt, message: `Backup tersimpan selama ${days} hari.` });
      } catch (err) {
        return res.status(500).json({ success: false, error: 'Gagal menyimpan backup ke database.' });
      }
    }

    // 1. UPDATE RELEASE (ADMIN)
    if (body.action === 'update_release') {
      if (!requireAdmin(req, res, 'update_release')) return;
      const { version, download_url, changelog } = body;
      if (!version || !download_url) {
        return res.status(400).json({ error: 'Versi dan URL Download wajib diisi.' });
      }

      globalReleaseCache = {
        version: String(version).trim(),
        download_url: String(download_url).trim(),
        changelog: String(changelog || '').trim()
      };

      try {
        await fetch(`${SUPABASE_URL}/rest/v1/releases`, {
          method: 'POST',
          headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
          body: JSON.stringify({
            version: globalReleaseCache.version,
            download_url: globalReleaseCache.download_url,
            changelog: globalReleaseCache.changelog,
            created_at: nowWIBTimestamp()
          })
        });

        return res.status(200).json({
          success: true,
          message: `Release versi ${globalReleaseCache.version} berhasil diterbitkan!`
        });
      } catch (err) {
        return res.status(500).json({ error: 'Gagal menyimpan rilis ke database.' });
      }
    }

    // 2. GENERATE VOUCHER (ADMIN)
    if (body.action === 'generate_voucher') {
      if (!requireAdmin(req, res, 'generate_voucher')) return;
      const targetDevId = body.device_id;
      const durationDays = Number(body.duration_days || 7);

      if (!targetDevId) return res.status(400).json({ error: 'Device ID wajib disertakan.' });

      const randomCodePart = crypto.randomBytes(4).toString('hex').toUpperCase();
      const voucherCode = `MIND-${durationDays}D-${randomCodePart}`;

      try {
        await fetch(`${SUPABASE_URL}/rest/v1/vouchers`, {
          method: 'POST',
          headers: H({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            code: voucherCode,
            days_value: durationDays,
            max_uses: 1,
            used_count: 0,
            used_devices: [],
            device_id: targetDevId,
            created_at: nowWIBTimestamp()
          })
        });

        return res.status(200).json({ success: true, code: voucherCode, message: 'Voucher berhasil dibuat' });
      } catch (err) {
        return res.status(500).json({ error: 'Gagal membuat kode voucher.' });
      }
    }

    // 3. CLAIM VOUCHER
    if (body.action === 'claim_voucher' || body.action === 'redeem_voucher') {
      const voucherCode = body.code || body.voucher_code;
      const devIdTarget = String(body.device_id || '').trim().toUpperCase();
      const cleanVoucher = (voucherCode || '').trim().toUpperCase();

      if (!cleanVoucher || !devIdTarget) return res.status(400).json({ error: 'Kode voucher dan Device ID wajib diisi.' });

      try {
        const vRes = await fetch(`${SUPABASE_URL}/rest/v1/vouchers?code=eq.${encodeURIComponent(cleanVoucher)}&select=*`, {
          headers: H(),
          cache: 'no-store'
        });
        const vData = await vRes.json();

        if (!Array.isArray(vData) || vData.length === 0) return res.status(400).json({ error: 'Kode voucher tidak valid.' });

        const voucher = vData[0];
        const usedDevices = Array.isArray(voucher.used_devices) ? voucher.used_devices : [];

        if (usedDevices.includes(devIdTarget)) return res.status(400).json({ error: 'Device ID Anda sudah pernah menggunakan voucher ini.' });

        // Batas pemakaian voucher (sebelumnya tidak dicek)
        if (voucher.max_uses && Number(voucher.used_count || 0) >= Number(voucher.max_uses)) {
          return res.status(400).json({ error: 'Voucher sudah habis digunakan.' });
        }

        usedDevices.push(devIdTarget);
        await fetch(`${SUPABASE_URL}/rest/v1/vouchers?id=eq.${voucher.id}`, {
          method: 'PATCH',
          headers: H({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ used_count: (voucher.used_count || 0) + 1, used_devices: usedDevices })
        });

        const savedInfo = await catatTransaksiDanLisensi(SUPABASE_URL, SUPABASE_KEY, devIdTarget, voucher.days_value, 0, 'Voucher Claim', '', candidateUserId);
        return res.status(200).json({
          success: true,
          message: 'Voucher berhasil diklaim!',
          exp_date: savedInfo?.exp_date,
          user_id: savedInfo?.user_id || null
        });
      } catch (err) {
        return res.status(500).json({ error: 'Gagal memproses klaim voucher.' });
      }
    }

    // 4. SAVE LICENSE (ADMIN MANUAL)
    if (body.action === 'save_license') {
      if (!requireAdmin(req, res, 'save_license')) return;
      const sppgTarget = body.sppg_name || sppg_name || '';

      const patchPayload = {
        exp_date: body.exp_date,
        status: body.status,
        updated_at: nowWIBTimestamp()
      };
      if (body.license_key) patchPayload.license_key = body.license_key;
      if (sppgTarget) patchPayload.sppg_name = sppgTarget;
      if (body.user_id !== undefined) patchPayload.user_id = body.user_id || null;

      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(body.device_id)}`, {
        method: 'PATCH',
        headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(patchPayload)
      });

      if (!updateRes.ok) {
        return res.status(500).json({ success: false, error: 'Gagal memperbarui lisensi di database.' });
      }

      return res.status(200).json({ success: true, message: 'Lisensi berhasil diperbarui.' });
    }

    // DELETE LICENSE (ADMIN)
    if (body.action === 'delete_license') {
      if (!requireAdmin(req, res, 'delete_license')) return;
      if (!body.device_id) return res.status(400).json({ success: false, error: 'Device ID wajib diisi.' });
      const dev = encodeURIComponent(String(body.device_id).trim());
      const dRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${dev}`, {
        method: 'DELETE', headers: H({ Prefer: 'return=minimal' })
      });
      if (!dRes.ok) return res.status(500).json({ success: false, error: 'Gagal menghapus lisensi.' });
      fetch(`${SUPABASE_URL}/rest/v1/backups?device_id=eq.${dev}`, { method: 'DELETE', headers: H({ Prefer: 'return=minimal' }) }).catch(() => {});
      return res.status(200).json({ success: true, message: 'Lisensi dihapus.' });
    }

    // 5. SAVE PACKAGES (ADMIN)
    if (body.action === 'save_packages') {
      if (!requireAdmin(req, res, 'save_packages')) return;
      const pkgs = body.packages;
      if (!Array.isArray(pkgs)) return res.status(400).json({ error: 'Data paket tidak valid.' });

      try {
        await fetch(`${SUPABASE_URL}/rest/v1/packages`, {
          method: 'DELETE',
          headers: H({ Prefer: 'return=minimal' })
        });

        for (const p of pkgs) {
          await fetch(`${SUPABASE_URL}/rest/v1/packages`, {
            method: 'POST',
            headers: H({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              name: p.name,
              hari: p.days,
              harga: p.price,
              discount_type: p.discount_type,
              discount_value: p.discount_value,
              discount_until: p.discount_until || null
            })
          });
        }
        return res.status(200).json({ success: true, message: 'Paket berhasil disimpan.' });
      } catch (err) {
        return res.status(500).json({ error: 'Gagal menyimpan paket ke database.' });
      }
    }

    // 6. TOKOPAY / PAYMENT GATEWAY ORDER
    const merchantId = process.env.TOKOPAY_MERCHANT_ID;
    const secretKey = process.env.TOKOPAY_SECRET_KEY;
    const isWebhookTokopay = body && (body.tr_id || (body.status && !body.paket_hari));

    if (isWebhookTokopay) {
      // Webhook TIDAK dipercaya mentah-mentah: status diverifikasi ulang langsung ke Tokopay.
      const refIdCallback = body.reff_id || body.ref_id || body.custom_int;

      if (refIdCallback && merchantId && secretKey) {
        try {
          const st = await fetchTokopayStatus(merchantId, secretKey, refIdCallback);
          if (st.paid) {
            const { deviceId: targetDevId, paketHari: targetPaketHari } = parseReffId(refIdCallback);
            if (targetDevId) {
              await catatTransaksiDanLisensi(SUPABASE_URL, SUPABASE_KEY, targetDevId, targetPaketHari, st.nominal, 'User QRIS / Voucher', '', null, refIdCallback);
              return res.status(200).json({ status: true, message: 'Webhook processed successfully' });
            }
          }
        } catch (e) {
          console.error('[Webhook verify error]:', e);
        }
      }
      return res.status(200).json({ status: true, message: 'Callback received' });
    }

    if (!merchantId || !secretKey) return res.status(500).json({ error: 'Kunci API Tokopay belum diatur.' });

    const cleanDevId = (body.device_id || device_id || 'UNKNOWN').replace(/[^a-zA-Z0-9]/g, '');
    const paketHariFix = Number(body.paket_hari || paket_hari || 7);

    let nominal = Number(body.nominal || 0);
    if (!nominal || nominal <= 0) {
      try {
        const pkgRes = await fetch(`${SUPABASE_URL}/rest/v1/packages?hari=eq.${paketHariFix}&select=*`, {
          headers: H(),
          cache: 'no-store'
        });
        const pkgData = await pkgRes.json();
        if (Array.isArray(pkgData) && pkgData.length > 0) {
          nominal = hitungHargaFinalPaket(pkgData[0]);
        }
      } catch (err) {}
    }

    if (!nominal || nominal <= 0) {
      nominal = paketHariFix === 30 ? 50000 : 25000;
    }

    const refIdOrder = reff_id || `SIPGN__${cleanDevId}__${paketHariFix}__${Date.now()}`;
    const signature = crypto.createHash('md5').update(`${merchantId}${secretKey}${refIdOrder}`).digest('hex');
    const metodeChannel = body.metode || body.kode_channel || 'QRISREALTIME';

    try {
      const tokopayRes = await fetch(`https://api.tokopay.id/v1/order?merchant=${merchantId}&secret=${secretKey}&reff_id=${encodeURIComponent(refIdOrder)}&ref_id=${encodeURIComponent(refIdOrder)}&nominal=${nominal}&metode=${encodeURIComponent(metodeChannel)}&kode_channel=${encodeURIComponent(metodeChannel)}&signature=${signature}`, { cache: 'no-store' });
      const tokopayData = await tokopayRes.json();

      const innerData = tokopayData?.data?.data || tokopayData?.data || tokopayData;
      const qr_link = innerData?.qr_link || innerData?.qr_url || innerData?.pay_url || null;
      const qr_string = innerData?.qr_string || innerData?.qr_code || innerData?.qr_content || null;
      const total_bayar = innerData?.total_bayar || innerData?.nominal || innerData?.total || nominal;

      return res.status(200).json({
        success: true,
        reff_id: refIdOrder,
        ref_id: refIdOrder,
        qr_link,
        qr_string,
        total_bayar,
        raw: tokopayData
      });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal membuat order ke Tokopay.' });
    }
  }

  // ==========================================
  // POLLING STATUS PEMBAYARAN TOKOPAY
  // ==========================================
  if (reff_id) {
    const merchantId = process.env.TOKOPAY_MERCHANT_ID;
    const secretKey = process.env.TOKOPAY_SECRET_KEY;
    if (!merchantId || !secretKey) return res.status(200).json({ is_paid: false, error: 'Kunci Tokopay belum diatur.' });

    try {
      const st = await fetchTokopayStatus(merchantId, secretKey, reff_id);

      if (st.paid) {
        let { deviceId: targetDevId, paketHari: targetPaketHari } = parseReffId(reff_id);
        if (!targetDevId) targetDevId = device_id;
        if (!paket_hari && targetPaketHari) paket_hari = targetPaketHari;

        if (!targetDevId) return res.status(200).json({ is_paid: false, error: 'Device ID tidak terdeteksi.' });

        // reff_id dikirim agar polling berulang/webhook tidak menambah masa aktif dua kali
        const savedInfo = await catatTransaksiDanLisensi(SUPABASE_URL, SUPABASE_KEY, targetDevId, targetPaketHari, st.nominal, 'User QRIS / Voucher', '', candidateUserId, reff_id);

        return res.status(200).json({
          is_paid: true,
          status: 'Success',
          exp_date: savedInfo?.exp_date || null,
          user_id: savedInfo?.user_id || null
        });
      }

      return res.status(200).json({ is_paid: false, raw_status: st.inner?.status || 'Unpaid' });
    } catch (err) {
      return res.status(200).json({ is_paid: false, error: 'Gagal mengecek status Tokopay.' });
    }
  }

  return res.status(400).json({ error: 'Permintaan tidak valid.' });
}
