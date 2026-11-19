const crypto = require('crypto');

// Helper CORS agar userscript di domain pop-sipgn.bgn.go.id dapat mengakses API
function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  const allowedOrigins = [
    'https://pop-sipgn.bgn.go.id',
    'https://minduniverse.id',
    'https://www.minduniverse.id',
  ];

  if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-MS-Integrity');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Verifikasi JWT HS256 menggunakan Node.js crypto
function verifyMindHUBJwt(token, secret) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token tidak ditemukan.' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Format token JWT tidak valid.' };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') {
      return { valid: false, error: 'Algoritma JWT tidak didukung.' };
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    const sigBuf = Buffer.from(encodedSignature);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, error: 'Signature JWT tidak valid.' };
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);

    if (payload.exp && typeof payload.exp === 'number' && payload.exp <= nowSec) {
      return { valid: false, error: 'Sesi login MindHUB kamu sudah habis nih. Yuk login ulang dulu!' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Gagal mem-parsing token JWT.' };
  }
}

// Rate limiter sederhana per device_id
const rateLimitMap = new Map();
function checkRateLimit(deviceId, maxReq = 25, windowMs = 60000) {
  const key = deviceId || 'anonymous';
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + windowMs;
    rateLimitMap.set(key, entry);
    return true;
  }

  if (entry.count >= maxReq) return false;
  entry.count += 1;
  rateLimitMap.set(key, entry);
  return true;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!GEMINI_API_KEY || !JWT_SECRET) {
    return res.status(500).json({
      success: false,
      error: 'Konfigurasi server (GEMINI_API_KEY / JWT_SECRET) belum lengkap.',
    });
  }

  // Parsing body aman jika req.body masih berupa string
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Body JSON tidak valid.' });
    }
  }

  // 1. Verifikasi Bearer Token JWT MindHUB
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const bodyToken = typeof body.token === 'string' ? body.token.trim() : '';
  const token = headerToken || bodyToken;

  const authCheck = verifyMindHUBJwt(token, JWT_SECRET);

  if (!authCheck.valid) {
    return res.status(401).json({
      success: false,
      error: authCheck.error || 'Unauthorized',
    });
  }

  // 2. Validasi Input & Rate Limit
  const { prompt, context = {}, device_id = '' } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Prompt pertanyaan tidak boleh kosong.' });
  }

  if (!checkRateLimit(device_id || authCheck.payload.username)) {
    return res.status(429).json({
      success: false,
      error: 'Terlalu banyak permintaan dalam 1 menit. Tunggu beberapa detik ya!',
    });
  }

  // 3. System Instruction Super Friendly
  const systemInstruction = `Kamu adalah **Mindspace AI**, asisten virtual super ramah, hangat, dan sigap dari **Mindspace Studio** yang tertanam langsung di dalam userscript **SIPGN Autofill POP (v2.0.3)** untuk membantu operasional admin SPPG / MBG di portal \`pop-sipgn.bgn.go.id\`.

1. KEPRIBADIAN & GAYA BICARA:
- Gunakan bahasa Indonesia sehari-hari yang super friendly, santai, hangat, dan suportif ("kamu", "aku", "Siap!", "Tenang aja,", "Gampang banget kok!").
- Hindari bahasa kaku/robotik. Gunakan emoji secukupnya dan bold pada nama tombol/tab agar mudah dibaca.
- Jawab singkat, padat, dan langsung ke solusi (2–4 paragraf pendek).

2. PENGETAHUAN EKOSISTEM MINDHUB & SIPGN AUTOFILL POP:
- Aktivasi & Lisensi: Login pakai akun MindHUB (https://www.minduniverse.id/user). Device ID (format DEV-XXXX-XXXX) bisa dicek/disalin di tab ⚙️ Sistem. Perpanjangan lisensi bisa lewat QRIS otomatis di dashboard MindHUB atau klaim Kode Voucher saat pop-up Expired muncul.
- Update Skrip: Auto-check saat dibuka, atau manual lewat tab ⚙️ Sistem → 🔄 Cek Update → 🚀 Update Sekarang (mengarah ke https://minduniverse.id/files/sipgn-autofill.user.js).
- Tab ⚡ Kerja: Pemilih Target KPM, Stepper status (⚪ Belum → 🚚 Antar → 📦 Ambil → 🧼 Cuci), 4 Mode Cepat (🛵 Kurir MBG, 🎲 Jitter ±1-4m menambah variasi acak ±1–4 menit pada jam agar alami, ⏱️ Jam Live pakai waktu perangkat saat ini, 🚀 Auto-Submit otomatis klik Simpan dalam 3 detik), dan tombol aksi kontekstual / Auto-Sequence.
- Tab 📋 KPM: Cari/filter KPM, Quick-Edit (⚡), Edit Lengkap (✏️) 5 kategori porsi Sekolah & Posyandu + Pelacak Selisih Ompreng, Import/Export CSV.
- Tab ✨ AI: 💬 Parser Jadwal WA (ekstrak broadcast WA jadi data KPM) dan ✨ Optimasi Semua Jam.
- Tab ⚙️ Sistem: Kecepatan Ketik Otomatis (0–75, disarankan 50 Seimbang untuk form React SIPGN), ⏭️ Auto-Advance, 🧠 AI Fuzzy DOM Selector (Auto-Heal), ☁️ Auto-Save Cloud Sync (retensi 3 hari), Master Database Kurir & Armada.
- Fitur Ekstra: Fake Camera (ganti kamera jadi pemilih galeri foto), Pre-Flight Guard (🛡️ cek konflik urutan jam + ✨ Fix AI), dan Command Palette (Ctrl+K).

3. TELEMETRI SESI PENGGUNA:
- Akun MindHUB: @${authCheck.payload.username || 'User'}
- Device ID: ${device_id || '-'}
- Versi Skrip: v${context.version || '2.0.3'}
- Halaman Aktif: ${context.url || '-'}
- Unit SPPG: ${context.sppg || 'Belum diatur'}
- Statistik: ${context.totalKpm ?? 0} KPM | Total ${context.totalPorsi ?? 0} porsi | Selisih Ompreng: ${context.selisihCount ?? 0}
- KPM Aktif: ${context.kpmAktif ? JSON.stringify(context.kpmAktif) : 'Tidak ada'}
- Log Terakhir: ${Array.isArray(context.recentLogs) ? JSON.stringify(context.recentLogs) : '[]'}`;

  try {
    const modelName = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY.trim())}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt.trim().slice(0, 2000) }],
          },
        ],
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 800,
        },
      }),
    });

    const rawText = await geminiRes.text();
    let geminiData = {};
    try {
      geminiData = JSON.parse(rawText);
    } catch (parseErr) {
      return res.status(502).json({
        success: false,
        error: `Gemini mengembalikan respon non-JSON (HTTP ${geminiRes.status})`,
      });
    }

    if (!geminiRes.ok) {
      return res.status(502).json({
        success: false,
        error: geminiData?.error?.message || `Gemini API Error (HTTP ${geminiRes.status})`,
      });
    }

    const replyText =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || '')
        .join('')
        .trim() || 'Waduh, aku belum berhasil memproses pertanyaan itu nih. Coba tanya sekali lagi ya! 😊';

    return res.status(200).json({
      success: true,
      reply: replyText,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Server Exception: ${error.message}`,
    });
  }
};
