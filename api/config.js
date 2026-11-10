
/**
 * ============================================================
 * MINDHUB PORTAL - SUPABASE & SMTP API
 * Provider : IDCloudHost Zimbra
 * Runtime  : Vercel Serverless Functions
 * File     : api/config.js
 * ============================================================
 *
 * Dependencies:
 * npm install nodemailer @supabase/supabase-js
 */

import nodemailer from 'nodemailer';

// ============================================================
// HELPER
// ============================================================

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

// ============================================================
// SMTP CONFIGURATION
// ============================================================

function getSmtpConfig() {
  const user = process.env.EMAIL_ID || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  const host = process.env.SMTP_HOST || 'login.masuk.email';
  const port = Number(process.env.SMTP_PORT || 465);

  if (!user || !pass) {
    throw new Error(
      'EMAIL_ID/SMTP_USER atau EMAIL_PASS/SMTP_PASS belum dikonfigurasi.'
    );
  }

  if (![465, 587].includes(port)) {
    throw new Error('SMTP_PORT harus menggunakan 465 atau 587.');
  }

  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    sender: process.env.SMTP_FROM || user
  };
}

// ============================================================
// SEND VERIFICATION EMAIL
// ============================================================

async function sendVerificationEmail({ to, code, username }) {
  const smtp = getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,

    auth: {
      user: smtp.user,
      pass: smtp.pass
    },

    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,

    ...(smtp.port === 587 ? {
      requireTLS: true
    } : {})
  });

  try {
    // Memeriksa koneksi dan autentikasi SMTP.
    await transporter.verify();

    // Mengirim email verifikasi.
    const result = await transporter.sendMail({
      from: `"MindHUB Portal" <${smtp.sender}>`,
      to: String(to).trim(),

      subject: 'Kode Verifikasi Akun MindHUB Anda',

      text: `
Halo ${username || 'Pengguna'},

Kode verifikasi akun MindHUB Anda adalah:

${code}

Masukkan kode tersebut untuk menyelesaikan pendaftaran akun.

Jika Anda tidak meminta kode ini, abaikan email ini.

Mindspace Studio © 2026
      `.trim(),

      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:30px;background:#020617;font-family:Arial,sans-serif;color:#f8fafc">

  <div style="max-width:500px;margin:auto;background:#0f172a;border:1px solid #1e293b;padding:25px;border-radius:12px">

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

</body>
</html>
      `
    });

    console.log('SMTP email sent:', {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected
    });

    return result;

  } finally {
    transporter.close();
  }
}

// ============================================================
// VERCEL SERVERLESS HANDLER
// ============================================================

export default async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept'
  );
  res.setHeader('Cache-Control', 'no-store');

  // Preflight request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // ==========================================================
  // GET: SUPABASE CONFIGURATION
  // ==========================================================

  if (req.method === 'GET') {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      '';

    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return json(res, 500, {
        success: false,
        error: 'Environment Variable Supabase belum lengkap.'
      });
    }

    return json(res, 200, {
      success: true,
      supabaseUrl,
      supabaseAnonKey,

      smtp: {
        host: process.env.SMTP_HOST || 'login.masuk.email',
        port: Number(process.env.SMTP_PORT || 465),
        secure: Number(process.env.SMTP_PORT || 465) === 465
      }
    });
  }

  // ==========================================================
  // METHOD VALIDATION
  // ==========================================================

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');

    return json(res, 405, {
      success: false,
      error: 'Method not allowed.'
    });
  }

  // ==========================================================
  // POST: SEND VERIFICATION EMAIL
  // ==========================================================

  try {
    const body = req.body || {};

    const {
      action,
      to,
      code,
      username
    } = body;

    if (action !== 'send_verification_email') {
      return json(res, 400, {
        success: false,
        error: 'Action API tidak dikenal.'
      });
    }

    if (
      !to ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to).trim())
    ) {
      return json(res, 400, {
        success: false,
        error: 'Alamat email tidak valid.'
      });
    }

    if (!/^\d{6}$/.test(String(code || ''))) {
      return json(res, 400, {
        success: false,
        error: 'Kode verifikasi harus terdiri dari 6 digit.'
      });
    }

    // Kirim email melalui SMTP Zimbra.
    const result = await sendVerificationEmail({
      to,
      code,
      username
    });

    return json(res, 200, {
      success: true,
      message: 'Email verifikasi berhasil dikirim.',
      messageId: result.messageId
    });

  } catch (error) {

    console.error('SMTP ERROR:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });

    return json(res, 500, {
      success: false,
      error: error.message || 'Gagal mengirim email verifikasi.',
      smtpCode: error.code || null
    });
  }
}
