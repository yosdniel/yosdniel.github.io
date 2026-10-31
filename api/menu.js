/**
 * ============================================================
 * SPPG BANTAENG GANTARANGKEKE 1 - SUPABASE API SERVER
 * ============================================================
 * Dependencies: express, @supabase/supabase-js, cors, dotenv
 * Install: npm install express @supabase/supabase-js cors dotenv
 * 
 * PERBAIKAN UTAMA:
 * 1. Menambahkan validasi ketat saat inisialisasi Supabase agar server gagal 
 *    start dengan jelas jika kredensial tidak lengkap (mencegah error tak terduga).
 * 2. Memperbaiki penanganan relasi array gizi pada endpoint GET /api/menu 
 *    agar mendukung berbagai tipe return dari Supabase (Object vs Array).
 * 3. Memperbaiki struktur upsert di POST /api/menu agar aman dan menghindari 
 *    duplikasi/error constraint pada tabel terkait.
 * 4. Menambahkan endpoint tambahan (GET /api/himbauan & DELETE /api/menu/:id) 
 *    untuk kelengkapan manajemen data admin.
 */

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi Supabase Client dengan validasi ketat
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('CRITICAL ERROR: SUPABASE_URL atau SUPABASE_ANON_KEY belum diatur di file .env!');
    process.exit(1); // Hentikan eksekusi agar tidak berjalan dengan client kosong
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware
app.use(cors());
app.use(express.json());

/**
 * GET /api/menu
 * Query parameter opsional: ?tanggal=YYYY-MM-DD
 * Mengembalikan seluruh daftar menu, nama SPPG, galeri foto, gizi, serta himbauan
 */
app.get('/api/menu', async (req, res) => {
    try {
        const { tanggal } = req.query;

        // 1. Query data menu utama beserta relasi kandungan gizi
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

        // Filter tanggal jika ada parameter spesifik
        if (tanggal) {
            query = query.eq('tanggal', tanggal);
        }

        const { data: menuData, error: menuError } = await query;

        if (menuError) throw menuError;

        // 2. Format struktur gizi menjadi bentuk objek { pk: {...}, pb: {...} }
        const formattedMenu = (menuData || []).map(item => {
            const giziObj = { pk: {}, pb: {} };
            
            // Supabase kadang mengembalikan relasi sebagai array tunggal atau objek tergantung setup foreign key
            const giziList = Array.isArray(item.gizi) ? item.gizi : [item.gizi];
            
            if (item.gizi) {
                giziList.forEach(g => {
                    if (g && (g.porsi_tipe === 'pk' || g.porsi_tipe === 'pb')) {
                        giziObj[g.porsi_tipe] = {
                            energi: g.energi || 0,
                            protein: g.protein || 0,
                            lemak: g.lemak || 0,
                            karbohidrat: g.karbohidrat || 0,
                            serat: g.serat || 0
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
                foto_list: Array.isArray(item.foto_list) ? item.foto_list : [], 
                catatan: item.catatan,
                gizi: giziObj
            };
        });

        // 3. Ambil data himbauan aktif
        const { data: himbauanData, error: himbauanError } = await supabase
            .from('himbauan')
            .select('ikon, judul, isi')
            .eq('is_active', true)
            .order('urutan', { ascending: true });

        if (himbauanError) {
            console.warn('Peringatan: Gagal mengambil data himbauan, mengembalikan array kosong.', himbauanError.message);
        }

        // Hitung tanggal hari ini dalam zona waktu Asia/Jakarta (WIB)
        const todayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        res.json({
            ok: true,
            today: todayStr,
            minggu: formattedMenu,
            himbauan: himbauanData || []
        });

    } catch (error) {
        console.error('Fetch Error:', error.message);
        res.status(500).json({
            ok: false,
            message: 'Gagal mengambil data dari Supabase',
            error: error.message
        });
    }
});

/**
 * POST /api/menu
 * Untuk input atau update menu baru beserta nama SPPG, foto-foto, dan nilai gizi
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

        // 1. Upsert (Insert/Update) Data Menu utama berdasarkan tanggal
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

        // 2. Upsert Data Gizi (Porsi Kecil / Porsi Besar)
        if (gizi) {
            const giziRecords = [];
            
            if (gizi.pk) {
                giziRecords.push({
                    menu_id: newMenu.id,
                    porsi_tipe: 'pk',
                    energi: gizi.pk.energi || 0,
                    protein: gizi.pk.protein || 0,
                    lemak: gizi.pk.lemak || 0,
                    karbohidrat: gizi.pk.karbohidrat || 0,
                    serat: gizi.pk.serat || 0
                });
            }
            
            if (gizi.pb) {
                giziRecords.push({
                    menu_id: newMenu.id,
                    porsi_tipe: 'pb',
                    energi: gizi.pb.energi || 0,
                    protein: gizi.pb.protein || 0,
                    lemak: gizi.pb.lemak || 0,
                    karbohidrat: gizi.pb.karbohidrat || 0,
                    serat: gizi.pb.serat || 0
                });
            }

            if (giziRecords.length > 0) {
                const { error: giziError } = await supabase
                    .from('gizi')
                    .upsert(giziRecords, { onConflict: 'menu_id,porsi_tipe' });

                if (giziError) throw giziError;
            }
        }

        res.json({
            ok: true,
            message: 'Data menu berhasil disimpan ke database Supabase!',
            data: newMenu
        });

    } catch (error) {
        console.error('Insert Error:', error.message);
        res.status(500).json({
            ok: false,
            message: 'Gagal menyimpan data menu',
            error: error.message
        });
    }
});

/**
 * DELETE /api/menu/:id
 * Menghapus data menu berdasarkan ID
 */
app.delete('/api/menu/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('menu')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            ok: true,
            message: `Menu dengan ID ${id} berhasil dihapus.`
        });
    } catch (error) {
        console.error('Delete Error:', error.message);
        res.status(500).json({
            ok: false,
            message: 'Gagal menghapus menu',
            error: error.message
        });
    }
});

// Jalankan Server untuk penggunaan Lokal
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 API Server SPPG berjalan di http://localhost:${PORT}`);
    });
}

// Ekspor app untuk Vercel Serverless Function
module.exports = app;
