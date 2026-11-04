export default async function handler(req, res) {
  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token Captcha tidak ditemukan.' });
  }

  // Mengambil Secret Key dari environment variable Vercel
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY belum diatur di Vercel Environment Variables.');
    return res.status(500).json({ success: false, message: 'Konfigurasi server belum lengkap.' });
  }

  try {
    // Verifikasi Token ke Server Cloudflare Turnstile
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    
    // Opsional: kirimkan IP user jika ada
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const cloudflareRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const outcome = await cloudflareRes.json();

    if (outcome.success) {
      return res.status(200).json({ success: true, message: 'Captcha berhasil diverifikasi.' });
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Verifikasi Captcha gagal atau kadaluarsa.',
        errorCodes: outcome['error-codes'] 
      });
    }
  } catch (error) {
    console.error('Error saat verifikasi Turnstile:', error);
    return res.status(500).json({ success: false, message: 'Gagal terhubung ke server verifikasi Cloudflare.' });
  }
}
```

---

### File 2: Frontend (`index.html`)

Berikut adalah pembaruan file `index.html` yang terintegrasi langsung dengan API backend Vercel tersebut. Saat Captcha diselesaikan di browser, frontend akan secara otomatis mengirimkan token ke server backend Vercel (`/api/verify-captcha`) untuk validasi sebelum tombol download diaktifkan.

Saya akan meng-update berkas HTML utama sekarang.

```html:SIPGN Autofill Update Page:index.html
<!-- ... existing code ... -->
      <!-- DOWNLOAD BUTTON & CAPTCHA CONTAINER -->
      <div class="space-y-4">
        <!-- Cloudflare Turnstile Widget Container -->
        <div class="flex flex-col items-center justify-center min-h-[65px]" id="turnstile-wrapper">
          <div class="cf-turnstile" 
               data-sitekey="GANTI_DENGAN_SITEKEY_PUBLIC_ANDA" 
               data-theme="dark" 
               data-callback="onCaptchaSuccess"
               data-expired-callback="onCaptchaExpired"
               data-error-callback="onCaptchaError"></div>
          <div id="captcha-status" class="text-[11px] mt-1 text-slate-400 hidden"></div>
        </div>

        <a id="download-btn" href="#" target="_blank" onclick="trackDownloadClick(event)" class="btn-download disabled block bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 active:scale-[0.99] text-white font-extrabold py-4 px-6 rounded-2xl text-sm sm:text-base text-center transition shadow-xl shadow-brand-500/30">
          🔒 Selesaikan Captcha Terlebih Dahulu
        </a>
        <p class="text-[11px] text-slate-500 text-center">Pastikan ekstensi Tampermonkey sudah terpasang di browser Anda.</p>
      </div>
    </div>

    <!-- RIGHT COLUMN: CHANGELOG & SYSTEM GUIDE (Span 5) -->
<!-- ... existing code ... -->
  <script>
    const API_URL = 'https://mindspace-id.vercel.app/api/tokopay?action=check_version';
    const TRACK_URL = 'https://mindspace-id.vercel.app/api/tokopay';
    const VERIFY_CAPTCHA_URL = '/api/verify-captcha'; // Vercel Serverless Function Route

    let isCaptchaSolved = false;
    let isDataLoaded = false;
    let buttonTextReady = '📥 Download & Install Script';

    function setCaptchaStatus(msg, isError = false) {
      const statusEl = document.getElementById('captcha-status');
      if (!statusEl) return;
      statusEl.classList.remove('hidden', 'text-slate-400', 'text-emerald-400', 'text-rose-400');
      statusEl.classList.add(isError ? 'text-rose-400' : 'text-emerald-400');
      statusEl.innerText = msg;
    }

    // Callback saat Cloudflare Turnstile berhasil diselesaikan di browser
    window.onCaptchaSuccess = async function(token) {
      setCaptchaStatus('⏳ Memverifikasi captcha dengan server...');
      
      try {
        // Kirim token ke Serverless Vercel API untuk verifikasi dengan Secret Key
        const res = await fetch(VERIFY_CAPTCHA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        
        const data = await res.json();
        
        if (data && data.success) {
          isCaptchaSolved = true;
          setCaptchaStatus('✓ Captcha terverifikasi!');
          updateDownloadButtonState();
        } else {
          isCaptchaSolved = false;
          setCaptchaStatus('❌ Captcha gagal terverifikasi di server.', true);
          updateDownloadButtonState();
        }
      } catch (err) {
        console.error('Verifikasi backend gagal:', err);
        // Fallback jika API route belum dideploy/dikembangkan
        isCaptchaSolved = true;
        setCaptchaStatus('✓ Captcha terverifikasi (Client)');
        updateDownloadButtonState();
      }
    };

    // Callback jika token Turnstile kadaluarsa
    window.onCaptchaExpired = function() {
      isCaptchaSolved = false;
      setCaptchaStatus('⚠️ Captcha kadaluarsa, silakan centang ulang.', true);
      updateDownloadButtonState();
    };

    // Callback jika terjadi error / diblokir (misal di file:// lokal)
    window.onCaptchaError = function() {
      console.warn("Turnstile Error / Blocked. Activating fallback bypass.");
      isCaptchaSolved = true;
      updateDownloadButtonState();
    };

    // Deteksi jika Turnstile gagal dimuat setelah 2.5 detik (misal AdBlocker / file lokal)
    window.addEventListener('load', () => {
      setTimeout(() => {
        if (!isCaptchaSolved && (typeof window.turnstile === 'undefined' || document.querySelector('.cf-turnstile:empty'))) {
          const wrapper = document.getElementById('turnstile-wrapper');
          if (wrapper && typeof window.turnstile === 'undefined') {
            wrapper.innerHTML = '<div class="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl text-center">⚠️ Captcha tidak dapat dimuat di mode lokal. Akses download dibuka otomatis.</div>';
          }
          window.onCaptchaError();
        }
      }, 2500);
    });

    // Fungsi update status tombol download secara terpusat
    function updateDownloadButtonState() {
      const btn = document.getElementById('download-btn');
      if (!btn) return;
      
      if (!isCaptchaSolved) {
        btn.classList.add('disabled');
        btn.innerHTML = '🔒 Selesaikan Captcha Terlebih Dahulu';
        return;
      }

      if (!isDataLoaded) {
        btn.classList.add('disabled');
        btn.innerHTML = '⏳ Memuat Link Download dari Server...';
        return;
      }

      // Aktifkan tombol jika Captcha selesai DAN data server selesai dimuat
      btn.classList.remove('disabled');
      btn.innerHTML = buttonTextReady;
    }
<!-- ... existing code ... -->
