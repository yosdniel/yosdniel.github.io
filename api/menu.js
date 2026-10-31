/**
 * api/menu.js
 * SPPG Bantaeng Gantarangkeke 1 - API Menu (Vercel Serverless)
 */
const { createClient } = require('@supabase/supabase-js');

// Helper format gizi
function formatGizi(giziData) {
  const result = { pk: {}, pb: {} };
  if (!giziData) return result;

  const list = Array.isArray(giziData) ? giziData : [giziData];
  list.forEach((g) => {
    if (g && (g.porsi_tipe === 'pk' || g.porsi_tipe === 'pb')) {
      result[g.porsi_tipe] = {
        energi: Number(g.energi) || 0,
        protein: Number(g.protein) || 0,
        lemak: Number(g.lemak) || 0,
        karbohidrat: Number(g.karbohidrat) || 0,
        serat: Number(g.serat) || 0
      };
    }
  });
  return result;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({
        ok: false,
        message: 'SUPABASE_URL atau SUPABASE_ANON_KEY belum di-set di Environment Variables Vercel'
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ===================== GET /api/menu =====================
    if (req.method === 'GET') {
      const tanggal = req.query?.tanggal;

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

      let { data: menuData, error: menuError } = await query;

      // Fallback jika nested select gagal
      if (menuError) {
        console.warn('Nested select gagal:', menuError.message);

        let fallbackQuery = supabase
          .from('menu')
          .select('*')
          .order('tanggal', { ascending: true });

        if (tanggal) fallbackQuery = fallbackQuery.eq('tanggal', tanggal);

        const { data: menuOnly, error: menuOnlyError } = await fallbackQuery;
        if (menuOnlyError) throw menuOnlyError;

        const { data: allGizi } = await supabase.from('gizi').select('*');

        menuData = (menuOnly || []).map((item) => ({
          ...item,
          gizi: (allGizi || []).filter((g) => g.menu_id === item.id)
        }));
      }

      const formattedMenu = (menuData || []).map((item) => ({
        id: item.id,
        nama_sppg: item.nama_sppg || 'SPPG Bantaeng Gantarangkeke 1',
        yayasan: item.yayasan || 'Yayasan Tunas Ilmu Bantaeng',
        tanggal: item.tanggal,
        makanan_pokok: item.makanan_pokok || '',
        lauk_hewani: item.lauk_hewani || '',
        lauk_nabati: item.lauk_nabati || '',
        sayur: item.sayur || '',
        buah: item.buah || '',
        pelengkap: item.pelengkap || '',
        foto: item.foto || null,
        foto_list: Array.isArray(item.foto_list) ? item.foto_list : [],
        catatan: item.catatan || '',
        gizi: formatGizi(item.gizi)
      }));

      // Ambil himbauan
      const { data: himbauanData } = await supabase
        .from('himbauan')
        .select('ikon, judul, isi')
        .eq('is_active', true)
        .order('urutan', { ascending: true });

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

    // ===================== POST /api/menu =====================
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const {
        nama_sppg, yayasan, tanggal,
        makanan_pokok, lauk_hewani, lauk_nabati,
        sayur, buah, pelengkap, foto, foto_list, catatan, gizi
      } = body || {};

      if (!tanggal) {
        return res.status(400).json({ ok: false, message: 'Tanggal wajib diisi!' });
      }

      const { data: newMenu, error: menuError } = await supabase
        .from('menu')
        .upsert({
          nama_sppg: nama_sppg || 'SPPG Bantaeng Gantarangkeke 1',
          yayasan: yayasan || 'Yayasan Tunas Ilmu Bantaeng',
          tanggal,
          makanan_pokok: makanan_pokok || null,
          lauk_hewani: lauk_hewani || null,
          lauk_nabati: lauk_nabati || null,
          sayur: sayur || null,
          buah: buah || null,
          pelengkap: pelengkap || null,
          foto: foto || null,
          foto_list: Array.isArray(foto_list) ? foto_list : [],
          catatan: catatan || null
        }, { onConflict: 'tanggal' })
        .select()
        .single();

      if (menuError) throw menuError;

      // Upsert gizi
      if (gizi && newMenu?.id) {
        const giziRecords = [];

        if (gizi.pk) {
          giziRecords.push({
            menu_id: newMenu.id,
            porsi_tipe: 'pk',
            energi: Number(gizi.pk.energi) || 0,
            protein: Number(gizi.pk.protein) || 0,
            lemak: Number(gizi.pk.lemak) || 0,
            karbohidrat: Number(gizi.pk.karbohidrat) || 0,
            serat: Number(gizi.pk.serat) || 0
          });
        }

        if (gizi.pb) {
          giziRecords.push({
            menu_id: newMenu.id,
            porsi_tipe: 'pb',
            energi: Number(gizi.pb.energi) || 0,
            protein: Number(gizi.pb.protein) || 0,
            lemak: Number(gizi.pb.lemak) || 0,
            karbohidrat: Number(gizi.pb.karbohidrat) || 0,
            serat: Number(gizi.pb.serat) || 0
          });
        }

        if (giziRecords.length > 0) {
          await supabase
            .from('gizi')
            .upsert(giziRecords, { onConflict: 'menu_id,porsi_tipe' });
        }
      }

      return res.status(200).json({
        ok: true,
        message: 'Data menu berhasil disimpan!',
        data: newMenu
      });
    }

    // ===================== DELETE /api/menu/:id =====================
    if (req.method === 'DELETE') {
      // Ambil id dari query atau path
      const id = req.query?.id || (req.url || '').split('/').pop();

      if (!id || id === 'menu') {
        return res.status(400).json({ ok: false, message: 'ID menu wajib diisi' });
      }

      const { error } = await supabase
        .from('menu')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({
        ok: true,
        message: `Menu dengan ID ${id} berhasil dihapus.`
      });
    }

    return res.status(405).json({ ok: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      ok: false,
      message: 'Terjadi kesalahan pada server',
      error: error.message || 'Unknown error'
    });
  }
};
