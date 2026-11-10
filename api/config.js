// api/config.js (Vercel Serverless Function)
export default function handler(req, res) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Mengembalikan variabel env Supabase ke frontend
  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    smtp: {
      host: 'login.masuk.email',
      portSmtp: 465,
      portImap: 993,
      portPop3: 995,
      sender: 'no-reply@minduniverse.id',
      envUserKey: 'EMAIL_ID',
      envPassKey: 'EMAIL_PASS'
    }
  });
}
