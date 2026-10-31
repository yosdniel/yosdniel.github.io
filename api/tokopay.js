/**
 * ============================================================
 * SPPG BANTAENG GANTARANGKEKE 1 - UNIFIED SUPABASE API SERVER
 * ============================================================
 * Menggabungkan:
 * - API Menu & Nutrisi SPPG (/api/menu)
 * - Sistem Lisensi, QRIS Tokopay, Voucher, & Backup Cloud
 */

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('ERROR: SUPABASE_URL atau SUPABASE_KEY belum diatur di .env!');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

// Middleware
app.use(cors());
app.use(express.json());

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

/**
 * ============================================================
 * ROUTE 1: GET /api/menu (PENGELOLAAN MENU & NUTRISI SPPG)
 * ============================================================
 */
app.get('/api/menu', async (req, res) => {
    try {
        const { tanggal } = req.query;

        let query = supabase
            .from('menu')
            .select(`
                id,
                nama_sppg,
                yayasan,
                tanggal,
                makanan_pokok,
                lauk_hewani,
                lauk_nabati,
                sayur,
                buah,
                pelengkap,
                foto,
                foto_list,
                catatan,
                gizi (
                    porsi_tipe,
                    energi,
                    protein,
                    lemak,
                    karbohidrat,
                    serat
                )
            `)
            .order('tanggal', { ascending: true });

        if (tanggal) {
            query = query.eq('tanggal', tanggal);
        }

        const { data: menuData, error: menuError } = await query;
        if (menuError) throw menuError;

        const formattedMenu = (menuData || []).map(item => {
            const giziObj = { pk: {}, pb: {} };
            if (item.gizi && Array.isArray(item.gizi)) {
                item.gizi.forEach(g => {
                    if (g.porsi_tipe === 'pk' || g.porsi_tipe === 'pb') {
                        giziObj[g.porsi_tipe] = {
                            energi: g.energi,
                            protein: g.protein,
                            lemak: g.lemak,
                            karbohidrat: g.karbohidrat,
                            serat: g.serat
                        };
                    }
                });
            }

            return {
                id: item.id,
                nama_sppg: item.nama_sppg || 'SPPG Bantaeng Gantarangkeke 1',
                yayasan: item.yayasan || 'Yayasan Tunas Ilmu Bantaeng',
                tanggal: item.tanggal,
                makanan_pokok: item.makanan_pokok,
                lauk_hewani: item.lauk_hewani,
                lauk_nabati: item.lauk_nabati,
                sayur: item.sayur,
                buah: item.buah,
                pelengkap: item.pelengkap,
                foto: item.foto,
                foto_list: item.foto_list || [],
                catatan: item.catatan,
                gizi: giziObj
            };
        });

        const { data: himbauanData, error: himbauanError } = await supabase
            .from('himbauan')
            .select('ikon, judul, isi')
            .eq('is_active', true)
            .order('urutan', { ascending: true });

        if (himbauanError) throw himbauanError;

        const todayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        return res.json({
            ok: true,
            today: todayStr,
            minggu: formattedMenu,
            himbauan: himbauanData || []
        });

    } catch (error) {
        console.error('Fetch Menu Error:', error.message);
        return res.status(500).json({
            ok: false,
            message: 'Gagal mengambil data menu dari Supabase',
            error: error.message
        });
    }
});

/**
 * ============================================================
 * ROUTE 2: POST /api/menu (INPUT / UPDATE MENU SPPG)
 * ============================================================
 */
app.post('/api/menu', async (req, res) => {
    try {
        const { 
            nama_sppg, 
            yayasan, 
            tanggal, 
            makanan_pokok, 
            lauk_hewani, 
            lauk_nabati, 
            sayur, 
            buah, 
            pelengkap, 
            foto, 
            foto_list, 
            catatan, 
            gizi 
        } = req.body;

        if (!tanggal) {
            return res.status(400).json({ ok: false, message: 'Tanggal wajib diisi!' });
        }

        const { data: newMenu, error: menuError } = await supabase
            .from('menu')
            .upsert({
                nama_sppg: nama_sppg || 'SPPG Bantaeng Gantarangkeke 1',
                yayasan: yayasan || 'Yayasan Tunas Ilmu Bantaeng',
                tanggal,
                makanan_pokok,
                lauk_hewani,
                lauk_nabati,
                sayur,
                buah,
                pelengkap,
                foto,
                foto_list: foto_list || [],
                catatan
            }, { onConflict: 'tanggal' })
            .select()
            .single();

        if (menuError) throw menuError;

        if (gizi) {
            const giziRecords = [];
            if (gizi.pk) {
                giziRecords.push({ menu_id: newMenu.id, porsi_tipe: 'pk', ...gizi.pk });
            }
            if (gizi.pb) {
                giziRecords.push({ menu_id: newMenu.id, porsi_tipe: 'pb', ...gizi.pb });
            }

            if (giziRecords.length > 0) {
                const { error: giziError } = await supabase
                    .from('gizi')
                    .upsert(giziRecords, { onConflict: 'menu_id,porsi_tipe' });

                if (giziError) throw giziError;
            }
        }

        return res.json({
            ok: true,
            message: 'Data menu berhasil disimpan ke database Supabase!',
            data: newMenu
        });

    } catch (error) {
        console.error('Insert Menu Error:', error.message);
        return res.status(500).json({
            ok: false,
            message: 'Gagal menyimpan data menu',
            error: error.message
        });
    }
});

/**
 * ============================================================
 * ROUTE 3: HANDLER UTAMA LISENSI & OTOMATISASI (ALL-IN-ONE)
 * ============================================================
 */
app.all('*', async (req, res) => {
    // Lewatkan jika path adalah /api/menu (karena sudah ditangani route di atas)
    if (req.path === '/api/menu' || req.path === '/menu') {
        return;
    }

    const { query, body = {} } = req;
    const action = query.action || body?.action;
    const reff_id = query.reff_id || query.ref_id || body?.reff_id || body?.ref_id;
    const device_id = query.device_id || body?.device_id;
    const sppg_name = body?.sppg_name || query?.sppg_name;
    let paket_hari = query.paket_hari || body?.paket_hari;

    // Cek Maintenance Mode
    if (action !== 'save_setting' || body.key !== 'maintenance_mode') {
        try {
            const maintRes = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.maintenance_mode&select=*`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
                cache: 'no-store'
            });
            const maintData = await maintRes.json();
            if (Array.isArray(maintData) && maintData.length > 0) {
                const val = maintData[0].value;
                if (val === true || val === 'true' || val === 1 || val === '1') {
                    let maintenanceMsg = 'Sistem saat ini sedang dalam pemeliharaan (maintenance). Silakan coba beberapa saat lagi.';
                    return res.status(200).json({ valid: false, status: 'maintenance', success: false, msg: maintenanceMsg });
                }
            }
        } catch (e) {}
    }

    // Action: Get Settings
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

    // Action: Register SPPG
    if (action === 'register_sppg' && req.method === 'POST') {
        const targetDevId = body.device_id || device_id;
        const targetSppgName = body.sppg_name || sppg_name;
        if (!targetDevId || !targetSppgName) {
            return res.status(400).json({ error: 'Device ID dan Nama SPPG wajib disertakan.' });
        }
        try {
            const timestampWIB = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');
            await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(targetDevId)}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sppg_name: targetSppgName, updated_at: timestampWIB })
            });
            return res.status(200).json({ success: true, message: 'Nama SPPG berhasil disinkronkan.' });
        } catch (err) {
            return res.status(500).json({ error: 'Gagal mengupdate nama SPPG.' });
        }
    }

    // Action: Check Version
    if (action === 'check_version') {
        return res.status(200).json(globalReleaseCache);
    }

    // Action: Get All Licenses
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

    // Action: Check License
    if (action === 'check_license') {
        if (!device_id) return res.status(200).json({ valid: false, msg: 'Device ID tidak ditemukan.' });
        try {
            const getRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?device_id=eq.${encodeURIComponent(device_id)}`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
                cache: 'no-store'
            });
            const licenses = await getRes.json();
            const lic = Array.isArray(licenses) && licenses.length > 0 ? licenses[0] : null;

            if (!lic) return res.status(200).json({ valid: false, status: 'unregistered', msg: 'Device ID belum terdaftar.' });
            
            const hariIniWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
            if (lic.exp_date && lic.exp_date < hariIniWIB) {
                return res.status(200).json({ valid: false, status: 'expired', exp_date: lic.exp_date, sppg_name: lic.sppg_name || '', msg: 'Masa aktif lisensi telah habis.' });
            }

            return res.status(200).json({ valid: true, status: 'active', exp_date: lic.exp_date, sppg_name: lic.sppg_name || '' });
        } catch (e) {
            return res.status(200).json({ valid: false, msg: 'Gagal verifikasi lisensi.' });
        }
    }

    // Default Fallback
    return res.status(404).json({ error: 'Endpoint atau Action tidak ditemukan.' });
});

// Jalankan Server untuk penggunaan Lokal
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Unified API Server SPPG berjalan di http://localhost:${PORT}`);
    });
}

// Ekspor app untuk Vercel Serverless Function
module.exports = app;
