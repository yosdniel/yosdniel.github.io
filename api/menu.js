import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
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

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(500).json({
            ok: false,
            message: 'Server Error: SUPABASE_URL atau SUPABASE_ANON_KEY belum diatur di environment variables Vercel!'
        });
    }

    try {
        // ==========================================
        // METHOD: GET /api/menu
        // ==========================================
        if (req.method === 'GET') {
            const { tanggal } = req.query;

            // 1. Ambil data menu utama
            let query = supabase
                .from('menu')
                .select('*')
                .order('tanggal', { ascending: true });

            if (tanggal) {
                query = query.eq('tanggal', tanggal);
            }

            const { data: menuData, error: menuError } = await query;
            if (menuError) throw menuError;

            // 2. Ambil data gizi secara terpisah untuk menghindari konflik relasi ganda
            const menuIds = (menuData || []).map(m => m.id);
            let giziData = [];
            
            if (menuIds.length > 0) {
                const { data: giziRes, error: giziError } = await supabase
                    .from('gizi')
                    .select('*')
                    .in('menu_id', menuIds);

                if (!giziError) {
                    giziData = giziRes || [];
                }
            }

            // 3. Gabungkan data menu dan gizi secara manual di JavaScript
            const formattedMenu = (menuData || []).map(item => {
                const giziObj = { pk: {}, pb: {} };
                const itemGizi = giziData.filter(g => g.menu_id === item.id);

                itemGizi.forEach(g => {
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

            // 4. Ambil data himbauan aktif
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

            return res.status(200).json({
                ok: true,
                today: todayStr,
                minggu: formattedMenu,
                himbauan: himbauanData || []
            });
        }

        // ==========================================
        // METHOD: POST /api/menu
        // ==========================================
        else if (req.method === 'POST') {
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
            } = req.body || {};

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
                    giziRecords.push({
                        menu_id: newMenu.id,
                        porsi_tipe: 'pk',
                        ...gizi.pk
                    });
                }
                if (gizi.pb) {
                    giziRecords.push({
                        menu_id: newMenu.id,
                        porsi_tipe: 'pb',
                        ...gizi.pb
                    });
                }

                if (giziRecords.length > 0) {
                    const { error: giziError } = await supabase
                        .from('gizi')
                        .upsert(giziRecords, { onConflict: 'menu_id,porsi_tipe' });

                    if (giziError) throw giziError;
                }
            }

            return res.status(200).json({
                ok: true,
                message: 'Data menu berhasil disimpan ke database Supabase!',
                data: newMenu
            });
        }

        else {
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).json({ ok: false, message: `Method ${req.method} Not Allowed` });
        }

    } catch (error) {
        console.error('API Error:', error.message);
        return res.status(500).json({
            ok: false,
            message: 'Gagal memproses data dari server',
            error: error.message
        });
    }
}
