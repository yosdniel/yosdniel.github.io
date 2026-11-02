import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const AUTH_SECRET = process.env.AUTH_SECRET || 'sppg-default-secret-key';

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

// --- HELPER FUNCTION: TOKEN/SESSION ENCODING & PARSING ---
function parseSessionCookie(cookies) {
    if (!cookies) return null;
    const match = cookies.match(/sppg_user_session=([^;]+)/);
    if (!match) return null;

    try {
        const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
        const [secret, id, username, role] = decoded.split('::');
        if (secret !== AUTH_SECRET) return null;
        return { id, username, role };
    } catch (e) {
        return null;
    }
}

function createSessionCookie(user) {
    const rawToken = `${AUTH_SECRET}::${user.id}::${user.username}::${user.role}`;
    const token = Buffer.from(rawToken).toString('base64');
    const maxAge = 1 * 24 * 60 * 60;
    return `sppg_user_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
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
        const urlPath = req.url || '';
        const queryAction = req.query?.action || req.body?.action || '';
        const currentUser = parseSessionCookie(req.headers.cookie);

        // ==========================================
        // 1. MANAJEMEN AUTENTIKASI (LOGIN, CHECK-AUTH, LOGOUT)
        // ==========================================

        if (queryAction === 'login' && req.method === 'POST') {
            const { pin } = req.body || {};
            if (!pin) {
                return res.status(400).json({ ok: false, message: 'PIN wajib diisi!' });
            }

            const { data: dbUser, error: userError } = await supabase
                .from('users')
                .select('id, username, pin, role')
                .eq('pin', String(pin))
                .maybeSingle();

            if (userError) throw userError;

            if (dbUser) {
                const cookieHeader = createSessionCookie(dbUser);
                res.setHeader('Set-Cookie', cookieHeader);
                return res.status(200).json({
                    ok: true,
                    message: 'Verifikasi PIN berhasil!',
                    user: { id: dbUser.id, username: dbUser.username, role: dbUser.role }
                });
            } else {
                return res.status(401).json({ ok: false, message: 'PIN yang Anda masukkan tidak terdaftar!' });
            }
        }

        if (queryAction === 'check-auth') {
            if (currentUser) {
                return res.status(200).json({ ok: true, authenticated: true, user: currentUser });
            } else {
                return res.status(401).json({ ok: false, authenticated: false, message: 'Sesi habis atau belum terautentikasi.' });
            }
        }

        if (queryAction === 'logout') {
            res.setHeader('Set-Cookie', `sppg_user_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`);
            return res.status(200).json({ ok: true, message: 'Logout berhasil' });
        }

        // ==========================================
        // 2. MANAJEMEN AKUN USER (KHUSUS ADMINISTRATOR)
        // ==========================================

        if (queryAction === 'get-users' && req.method === 'GET') {
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ ok: false, message: 'Akses ditolak: Hanya Administrator yang berhak melihat daftar user.' });
            }
            const { data: users, error } = await supabase
                .from('users')
                .select('id, username, role, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json({ ok: true, users: users || [] });
        }

        if (queryAction === 'create-user' && req.method === 'POST') {
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ ok: false, message: 'Akses ditolak: Hanya Administrator yang berhak menambah user baru.' });
            }
            const { username, role, pin } = req.body || {};

            if (!username || !role || !pin || !/^\d{6}$/.test(pin)) {
                return res.status(400).json({ ok: false, message: 'Nama, Role, dan PIN 6 Digit wajib diisi dengan benar!' });
            }

            const { data: newUser, error } = await supabase
                .from('users')
                .insert([{ username, role, pin: String(pin) }])
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return res.status(400).json({ ok: false, message: 'PIN ini sudah digunakan oleh user lain! Gunakan PIN unik.' });
                }
                throw error;
            }

            return res.status(200).json({ ok: true, message: 'User baru berhasil ditambahkan!', user: newUser });
        }

        if (queryAction === 'update-username' && req.method === 'POST') {
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ ok: false, message: 'Akses ditolak: Hanya Administrator yang berhak mengubah nama user.' });
            }
            const { userId, newUsername } = req.body || {};

            if (!userId || !newUsername || newUsername.trim() === '') {
                return res.status(400).json({ ok: false, message: 'User ID dan nama baru wajib diisi!' });
            }

            const { error } = await supabase
                .from('users')
                .update({ username: newUsername.trim() })
                .eq('id', userId);

            if (error) throw error;
            return res.status(200).json({ ok: true, message: 'Nama user berhasil diperbarui!' });
        }

        if (queryAction === 'update-user-pin' && req.method === 'POST') {
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ ok: false, message: 'Akses ditolak: Hanya Administrator yang berhak mengubah PIN user.' });
            }
            const { userId, newPin } = req.body || {};

            if (!userId || !newPin || !/^\d{6}$/.test(newPin)) {
                return res.status(400).json({ ok: false, message: 'User ID dan PIN 6 Digit baru wajib diisi!' });
            }

            const { error } = await supabase
                .from('users')
                .update({ pin: String(newPin) })
                .eq('id', userId);

            if (error) throw error;
            return res.status(200).json({ ok: true, message: 'PIN user berhasil diperbarui!' });
        }

        if (queryAction === 'delete-user' && req.method === 'POST') {
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ ok: false, message: 'Akses ditolak: Hanya Administrator yang berhak menghapus user.' });
            }
            const { userId } = req.body || {};

            if (userId === currentUser.id) {
                return res.status(400).json({ ok: false, message: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif login!' });
            }

            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userId);

            if (error) throw error;
            return res.status(200).json({ ok: true, message: 'User berhasil dihapus dari sistem.' });
        }

        // ==========================================
        // 3. MANAJEMEN FEEDBACK (GET & DELETE FEEDBACK)
        // ==========================================

        if (queryAction === 'feedback' && req.method === 'GET') {
            const { data: feedbacks, error } = await supabase
                .from('feedback')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return res.status(200).json({
                ok: true,
                feedbacks: feedbacks || []
            });
        }

        if (queryAction === 'delete-feedback' && req.method === 'POST') {
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ ok: false, message: 'Akses ditolak: Hanya Administrator yang berhak menghapus feedback!' });
            }
            const { feedbackId } = req.body || {};

            if (!feedbackId) {
                return res.status(400).json({ ok: false, message: 'ID feedback wajib diisi!' });
            }

            const { error } = await supabase
                .from('feedback')
                .delete()
                .eq('id', feedbackId);

            if (error) throw error;
            return res.status(200).json({ ok: true, message: 'Feedback berhasil dihapus dari database!' });
        }

        // ==========================================
        // 4. JALUR PUBLIC: GET MENU & HIMBAUAN
        // ==========================================

        if (req.method === 'GET') {
            const { tanggal } = req.query;

            let query = supabase.from('menu').select('*').order('tanggal', { ascending: true });
            if (tanggal) query = query.eq('tanggal', tanggal);

            const { data: menuData, error: menuError } = await query;
            if (menuError) throw menuError;

            const menuIds = (menuData || []).map(m => m.id);
            let giziData = [];

            if (menuIds.length > 0) {
                const { data: giziRes, error: giziError } = await supabase
                    .from('gizi')
                    .select('*')
                    .in('menu_id', menuIds);

                if (!giziError) giziData = giziRes || [];
            }

            const formattedMenu = (menuData || []).map(item => {
                const giziObj = { pb: {}, pk: {}, balita: {}, bumil: {}, busui: {} };
                const itemGizi = giziData.filter(g => g.menu_id === item.id);

                itemGizi.forEach(g => {
                    if (giziObj[g.porsi_tipe]) {
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
                    nama_sppg: item.nama_sppg || 'SPPG Deli Serdang Tanjung Gusta',
                    yayasan: item.yayasan || 'Yayasan Pendidikan Supardi Dharma Utama',
                    tanggal: item.tanggal,
                    makanan_pokok: item.makanan_pokok,
                    lauk_hewani: item.lauk_hewani,
                    lauk_nabati: item.lauk_nabati,
                    sayur: item.sayur,
                    buah: item.buah,
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

            return res.status(200).json({
                ok: true,
                today: todayStr,
                minggu: formattedMenu,
                himbauan: himbauanData || []
            });
        }

        // ==========================================
        // 5. JALUR PROTEKSI POST MENU (SIMPAN MENU BARU / UPDATE)
        // ==========================================

        if (req.method === 'POST') {
            if (!currentUser) {
                return res.status(401).json({ ok: false, message: 'Akses ditolak! Anda harus memverifikasi PIN sebelum menyimpan data.' });
            }

            const {
                nama_sppg,
                yayasan,
                tanggal,
                makanan_pokok,
                lauk_hewani,
                lauk_nabati,
                sayur,
                buah,
                foto,
                foto_list,
                catatan,
                gizi
            } = req.body || {};

            if (!tanggal) {
                return res.status(400).json({ ok: false, message: 'Tanggal wajib diisi!' });
            }

            // Proteksi backend: Staff tidak diizinkan edit menu tanggal lampau
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
            if (currentUser.role === 'staff' && tanggal < todayStr) {
                return res.status(403).json({ ok: false, message: 'Akses ditolak: Staff tidak diizinkan mengubah menu pada tanggal yang sudah lewat!' });
            }

            const { data: newMenu, error: menuError } = await supabase
                .from('menu')
                .upsert({
                    nama_sppg: nama_sppg || 'SPPG Deli Serdang Tanjung Gusta',
                    yayasan: yayasan || 'Yayasan Pendidikan Supardi Dharma Utama',
                    tanggal,
                    makanan_pokok,
                    lauk_hewani,
                    lauk_nabati,
                    sayur,
                    buah,
                    foto,
                    foto_list: foto_list || [],
                    catatan
                }, { onConflict: 'tanggal' })
                .select()
                .single();

            if (menuError) throw menuError;

            if (gizi) {
                const allowedTipes = ['pb', 'pk', 'balita', 'bumil', 'busui'];

                for (const tipe of allowedTipes) {
                    if (gizi[tipe]) {
                        const payloadGizi = {
                            menu_id: newMenu.id,
                            porsi_tipe: tipe,
                            energi: gizi[tipe].energi !== '' ? Number(gizi[tipe].energi) : null,
                            protein: gizi[tipe].protein !== '' ? Number(gizi[tipe].protein) : null,
                            lemak: gizi[tipe].lemak !== '' ? Number(gizi[tipe].lemak) : null,
                            karbohidrat: gizi[tipe].karbohidrat !== '' ? Number(gizi[tipe].karbohidrat) : null,
                            serat: gizi[tipe].serat !== '' ? Number(gizi[tipe].serat) : null
                        };

                        const { error: giziErr } = await supabase
                            .from('gizi')
                            .upsert(payloadGizi, { onConflict: 'menu_id,porsi_tipe' });

                        if (giziErr) {
                            throw new Error(`Gagal menyimpan gizi ${tipe}: ${giziErr.message}`);
                        }
                    }
                }
            }

            return res.status(200).json({
                ok: true,
                message: 'Data menu berhasil disimpan ke database Supabase!',
                data: newMenu
            });
        }

        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ ok: false, message: `Method ${req.method} Not Allowed` });

    } catch (error) {
        return res.status(500).json({
            ok: false,
            message: 'Gagal memproses data dari server',
            error: error.message
        });
    }
}
