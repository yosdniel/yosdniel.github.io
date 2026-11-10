/**
 * ============================================================
 * MINDHUB PORTAL - SUPABASE & SMTP API
 * ============================================================
 * Provider : IDCloudHost Zimbra
 * Runtime  : Vercel Serverless Functions
 * File     : api/config.js
 *
 * Dependencies:
 * npm install nodemailer
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
// GENERIC SMTP MAIL TRANSMITTER
// ============================================================

async function sendSmtpMail({ to, subject, text, html }) {
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
    await transporter.verify();

    const result = await transporter.sendMail({
      from: `"MindHUB Portal" <${smtp.sender}>`,
      to: String(to).trim(),
      subject,
      text: text.trim(),
      html
    });

    console.log('SMTP SEND RESULT:', {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
      envelope: result.envelope
    });

    return result;
  } finally {
    transporter.close();
  }
}

// ============================================================
// EMAIL TEMPLATES (VERIFICATION & RESET PASSWORD)
// ============================================================

async function sendVerificationEmail({ to, code, username }) {
  const safeName = escapeHtml(username || 'Pengguna');
  const safeCode = escapeHtml(code);
  const logoUrl = 'https://raw.githubusercontent.com/yosdniel/yosdniel.github.io/refs/heads/main/assets/favicon512.png';

  const subject = 'Kode Verifikasi Akun MindHUB Anda';
  const text = `
Halo ${username || 'Pengguna'},

Kode verifikasi akun MindHUB Anda adalah: ${code}

Kode ini berlaku selama 5 menit. Masukkan kode ini untuk menyelesaikan pendaftaran akun Anda.

Jika Anda tidak mendaftar di MindHUB, abaikan email ini.

Mindspace Studio © 2026
  `;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifikasi Akun MindHUB</title>
</head>
<body style="margin:0;padding:0;background-color:#020617;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#020617;padding:40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#0f172a;border:1px solid #1e293b;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
          
          <!-- Top Accent Bar (Brand Gradient) -->
          <tr>
            <td style="background:linear-gradient(90deg, #6366f1 0%, #a855f7 100%);height:4px;width:100%;"></td>
          </tr>

          <!-- Header Section with Mindspace Logo -->
          <tr>
            <td style="padding:32px 32px 20px 32px;text-align:center;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                <tr>
                  <td style="padding-right:12px;vertical-align:middle;">
                    <img src="${logoUrl}" alt="Mindspace Logo" width="44" height="44" style="display:block;border-radius:12px;border:1px solid rgba(99,102,241,0.3);box-shadow:0 4px 12px rgba(99,102,241,0.25);">
                  </td>
                  <td style="vertical-align:middle;text-align:left;">
                    <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;display:block;line-height:1.2;">MindHUB</span>
                    <span style="font-size:11px;font-weight:700;color:#818cf8;letter-spacing:1px;text-transform:uppercase;display:block;">Mindspace Studio</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Section -->
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <div style="background-color:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:6px 14px;display:inline-block;margin-bottom:20px;">
                <span style="color:#818cf8;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">📩 Verifikasi Akun Baru</span>
              </div>

              <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 12px 0;letter-spacing:-0.3px;line-height:1.3;">
                Selamat datang, ${safeName}! 👋
              </h1>

              <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
                Terima kasih telah bergabung di portal <strong style="color:#f8fafc;">MindHUB</strong>. Gunakan 6-digit kode keamanan berikut (berlaku selama <strong style="color:#38bdf8;">5 menit</strong>) untuk menyelesaikan verifikasi alamat email Anda:
              </p>

              <!-- OTP Code Display Box -->
              <div style="background:#020617;border:1px solid #334155;border-radius:16px;padding:22px 16px;text-align:center;margin-bottom:24px;">
                <span style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:8px;">Kode OTP Verifikasi (Berlaku 5 Menit)</span>
                <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;color:#38bdf8;letter-spacing:10px;display:inline-block;padding-left:10px;">${safeCode}</span>
                <span style="font-size:11px;color:#94a3b8;display:block;margin-top:10px;">⏱️ Berkas verifikasi aman • Jangan bagikan kode ini kepada siapa pun.</span>
              </div>

              <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0;">
                Jika Anda tidak melakukan pendaftaran akun ini, silakan abaikan email ini secara aman.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="border-top:1px solid #1e293b;"></div>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding:24px 32px 32px 32px;text-align:center;">
              <p style="color:#64748b;font-size:11px;line-height:1.6;margin:0 0 6px 0;">
                Email ini dikirim secara otomatis oleh <strong style="color:#94a3b8;">Mindspace Studio SMTP Gateway</strong>.
              </p>
              <p style="color:#475569;font-size:11px;margin:0;">
                © 2026 <strong style="color:#64748b;">Mindspace Studio</strong>. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return await sendSmtpMail({ to, subject, text, html });
}

async function sendResetPasswordEmail({ to, code, username }) {
  const safeName = escapeHtml(username || 'Pengguna');
  const safeCode = escapeHtml(code);
  const logoUrl = 'https://raw.githubusercontent.com/yosdniel/yosdniel.github.io/refs/heads/main/assets/favicon512.png';

  const subject = 'Kode Reset Password Akun MindHUB Anda';
  const text = `
Halo ${username || 'Pengguna'},

Permintaan reset password akun MindHUB Anda telah diterima.

Kode OTP reset password Anda adalah: ${code} (Berlaku 5 menit).

Masukkan kode tersebut pada portal untuk membuat password baru.

Jika Anda tidak meminta reset password ini, abaikan email ini.

Mindspace Studio © 2026
  `;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password Akun MindHUB</title>
</head>
<body style="margin:0;padding:0;background-color:#020617;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#020617;padding:40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#0f172a;border:1px solid #1e293b;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
          
          <!-- Top Accent Bar (Amber Warning Gradient) -->
          <tr>
            <td style="background:linear-gradient(90deg, #f59e0b 0%, #ea580c 100%);height:4px;width:100%;"></td>
          </tr>

          <!-- Header Section with Mindspace Logo -->
          <tr>
            <td style="padding:32px 32px 20px 32px;text-align:center;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                <tr>
                  <td style="padding-right:12px;vertical-align:middle;">
                    <img src="${logoUrl}" alt="Mindspace Logo" width="44" height="44" style="display:block;border-radius:12px;border:1px solid rgba(245,158,11,0.3);box-shadow:0 4px 12px rgba(245,158,11,0.25);">
                  </td>
                  <td style="vertical-align:middle;text-align:left;">
                    <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;display:block;line-height:1.2;">MindHUB</span>
                    <span style="font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:1px;text-transform:uppercase;display:block;">Mindspace Studio</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Section -->
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <div style="background-color:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:6px 14px;display:inline-block;margin-bottom:20px;">
                <span style="color:#fbbf24;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">🔑 Reset Password</span>
              </div>

              <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 12px 0;letter-spacing:-0.3px;line-height:1.3;">
                Halo, ${safeName}!
              </h1>

              <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
                Kami menerima permintaan pemulihan kata sandi akun <strong style="color:#f8fafc;">MindHUB</strong> Anda.</br></br>Gunakan kode 6-digit OTP berikut (berlaku selama <strong style="color:#f59e0b;">5 menit</strong>) untuk membuat password baru:
              </p>

              <!-- OTP Code Display Box -->
              <div style="background:#020617;border:1px solid #334155;border-radius:16px;padding:22px 16px;text-align:center;margin-bottom:24px;">
                <span style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:8px;">Kode OTP Reset Password (Berlaku 5 Menit)</span>
                <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;color:#f59e0b;letter-spacing:10px;display:inline-block;padding-left:10px;">${safeCode}</span>
              </div>

              <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0;">
                Jika Anda tidak merasa meminta reset password ini, tidak perlu khawatir. Abaikan saja email ini dan kata sandi Anda akan tetap aman.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="border-top:1px solid #1e293b;"></div>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding:24px 32px 32px 32px;text-align:center;">
              <p style="color:#64748b;font-size:11px;line-height:1.6;margin:0 0 6px 0;">
                Email ini dikirim secara otomatis.</br><strong style="color:#94a3b8;">Mindspace Studio Security Gateway</strong>.
              </p>
              <p style="color:#475569;font-size:11px;margin:0;">
                ©2026 <strong style="color:#64748b;">Mindspace Studio</strong>. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return await sendSmtpMail({ to, subject, text, html });
}

// ============================================================
// VERCEL SERVERLESS HANDLER
// ============================================================

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: SUPABASE CONFIGURATION
  if (req.method === 'GET') {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return json(res, 405, {
      success: false,
      error: 'Method not allowed.'
    });
  }

  // POST HANDLER (SEND EMAILS)
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { action, to, code, username } = body;

    const validActions = ['send_verification_email', 'send_reset_password_email'];

    if (!validActions.includes(action)) {
      return json(res, 400, {
        success: false,
        error: 'Action API tidak dikenal. Gunakan "send_verification_email" atau "send_reset_password_email".'
      });
    }

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to).trim())) {
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

    let result;
    if (action === 'send_reset_password_email') {
      result = await sendResetPasswordEmail({ to, code, username });
    } else {
      result = await sendVerificationEmail({ to, code, username });
    }

    return json(res, 200, {
      success: true,
      message: 'SMTP server accepted the email.',
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
      envelope: result.envelope
    });

  } catch (error) {
    console.error('SMTP ERROR:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });

    return json(res, 500, {
      success: false,
      error: error.message || 'Gagal mengirim email.',
      smtpCode: error.code || null,
      smtpResponse: error.response || null,
      smtpResponseCode: error.responseCode || null
    });
  }
}
