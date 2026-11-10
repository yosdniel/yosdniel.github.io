import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS Handling yang mengizinkan GET, POST, dan OPTIONS dari origin manapun
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Menangani Method POST untuk Pengiriman Email Verifikasi via SMTP
  if (req.method === 'POST') {
    try {
      const { action, to, code, username } = req.body || {};

      if (action === 'send_verification_email') {
        if (!to || !code) {
          return res.status(400).json({ success: false, error: 'Email tujuan (to) dan kode (code) wajib diisi.' });
        }

        // Konfigurasi transporter menggunakan SMTP login.masuk.email (SSL Port 465)
        const transporter = nodemailer.createTransport({
          host: 'login.masuk.email',
          port: 465,
          secure: true, // true untuk port 465 SSL
          auth: {
            user: process.env.EMAIL_ID || process.env.SMTP_USER,
            pass: process.env.EMAIL_PASS || process.env.SMTP_PASS
          }
        });

        const mailOptions = {
          from: '"MindHUB Portal" <no-reply@minduniverse.id>',
          to: to,
          subject: 'Kode Verifikasi Akun MindHUB Anda',
          html: `
            <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #020617; color: #f8fafc; padding: 30px; border-radius: 16px;">
              <div style="max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; padding: 25px; border-radius: 12px;">
                <h2 style="color: #818cf8; margin-top: 0;">Verifikasi Akun MindHUB</h2>
                <p style="color: #94a3b8; font-size: 14px;">Halo <b>${username || 'Pengguna'}</b>,</p>
                <p style="color: #94a3b8; font-size: 14px;">Gunakan kode 6-angka di bawah ini untuk memverifikasi dan mengaktifkan akun Anda:</p>
                <div style="background: #1e293b; color: #38bdf8; font-size: 28px; font-weight: bold; text-align: center; padding: 15px; border-radius: 8px; letter-spacing: 6px; margin: 20px 0;">
                  ${code}
                </div>
                <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 25px;">Official Mailer: no-reply@minduniverse.id | Mindspace Studio &copy; 2026</p>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true, message: 'Email verifikasi berhasil dikirim via SMTP.' });
      }

      return res.status(400).json({ success: false, error: 'Action API tidak dikenal.' });
    } catch (error) {
      console.error('SMTP Mail Dispatch Error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Gagal mengirim email via SMTP server.' });
    }
  }

  // Menangani Method GET untuk Mengembalikan Config Supabase & SMTP info
  if (req.method === 'GET') {
    return res.status(200).json({
      supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      smtp: {
        host: 'login.masuk.email',
        portSmtp: 465,
        portImap: 993,
        portPop3: 995,
        sender: 'no-reply@minduniverse.id'
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
