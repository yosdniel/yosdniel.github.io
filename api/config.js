
import nodemailer from 'nodemailer';

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: Supabase Configuration
  if (req.method === 'GET') {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL || '';

    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return json(res, 500, {
        success: false,
        error: 'Environment variable Supabase belum lengkap.'
      });
    }

    return json(res, 200, {
      success: true,
      supabaseUrl,
      supabaseAnonKey,
      smtp: {
        host: process.env.SMTP_HOST || 'login.masuk.email',
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        sender:
          process.env.SMTP_FROM ||
          process.env.EMAIL_ID ||
          process.env.SMTP_USER ||
          'no-reply@minduniverse.id'
      }
    });
  }

  // POST: SMTP Email Verification
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');

    return json(res, 405, {
      success: false,
      error: 'Method not allowed.'
    });
  }

  try {
    const body = req.body || {};
    const { action, to, code, username } = body;

    if (action !== 'send_verification_email') {
      return json(res, 400, {
        success: false,
        error: 'Action API tidak dikenal.'
      });
    }

    if (!to || !code || !/^\d{6}$/.test(String(code))) {
      return json(res, 400, {
        success: false,
        error: 'Email tujuan dan kode verifikasi 6 digit wajib diisi.'
      });
    }

    // SMTP Environment
    const smtpUser =
      process.env.EMAIL_ID ||
      process.env.SMTP_USER;

    const smtpPass =
      process.env.EMAIL_PASS ||
      process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      return json(res, 500, {
        success: false,
        error: 'EMAIL_ID/SMTP_USER atau EMAIL_PASS/SMTP_PASS belum diatur di Vercel.'
      });
    }

    const smtpHost =
      process.env.SMTP_HOST || 'login.masuk.email';

    const smtpPort =
      Number(process.env.SMTP_PORT || 465);

    const sender =
      process.env.SMTP_FROM || smtpUser;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });

    // Send Email
    await transporter.sendMail({
      from: `"MindHUB Portal" <${sender}>`,
      to: String(to).trim(),
      subject: 'Kode Verifikasi Akun MindHUB Anda',

      text: `Halo ${username || 'Pengguna'}, kode verifikasi akun MindHUB Anda adalah ${code}.`,

      html: `
        <div style="font-family:Arial,sans-serif;background:#020617;color:#f8fafc;padding:30px;border-radius:16px">
          <div style="max-width:500px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;padding:25px;border-radius:12px">

            <h2 style="color:#818cf8;margin-top:0">
              Verifikasi Akun MindHUB
            </h2>

            <p style="color:#cbd5e1">
              Halo <b>${escapeHtml(username || 'Pengguna')}</b>,
            </p>

            <p style="color:#cbd5e1">
              Gunakan kode 6 digit berikut untuk memverifikasi akun Anda:
            </p>

            <div style="background:#1e293b;color:#38bdf8;font-size:28px;font-weight:bold;text-align:center;padding:15px;border-radius:8px;letter-spacing:6px;margin:20px 0">
              ${escapeHtml(code)}
            </div>

            <p style="color:#94a3b8;font-size:12px;text-align:center">
              Jika Anda tidak meminta kode ini, abaikan email ini.
            </p>

            <p style="color:#64748b;font-size:12px;text-align:center">
              Mindspace Studio &copy; 2026
            </p>

          </div>
        </div>
      `
    });

    return json(res, 200, {
      success: true,
      message: 'Email verifikasi berhasil dikirim.'
    });

  } catch (error) {
    console.error('SMTP Mail Dispatch Error:', error);

    return json(res, 500, {
      success: false,
      error: error.message || 'Gagal mengirim email melalui SMTP.'
    });
  }
}
