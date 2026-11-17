// ==UserScript==
// @name         SIPGN Autofill POP - Mindspace Studio
// @namespace    sipgn-autofill
// @version      2.0.1
// @description  Ultra-Modern Cyber-Bento Glassmorphic Suite untuk Otomatisasi SIPGN POP (Encrypted Core Vault, Fake Camera, Command Palette Ctrl+K, Auto-Sequence, CSV/JSON Engine, Live Batch Status & Telemetry)
// @match        https://pop-sipgn.bgn.go.id/distribution*
// @match        https://pop-sipgn.bgn.go.id/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      mindspace-id.vercel.app
// @connect      minduniverse.id
// @connect      www.minduniverse.id
// @updateURL    https://mindspace-id.vercel.app/files/sipgn-autofill.user.js
// @downloadURL  https://mindspace-id.vercel.app/files/sipgn-autofill.user.js
// ==/UserScript==

(function () {
  'use strict';

  /* ============================================================================
   * 0. CRYPTOGRAPHIC VAULT & INTEGRITY PROTECTION ENGINE (ANTI-TAMPER / ENCRYPTION)
   * ============================================================================ */
  const _0xVault = (() => {
    const _k = [0x4d, 0x49, 0x4e, 0x44, 0x53, 0x50, 0x41, 0x43, 0x45, 0x32, 0x30, 0x32, 0x36];
    const _enc = (str) => {
      try {
        const bytes = new TextEncoder().encode(String(str));
        const out = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          out[i] = bytes[i] ^ _k[i % _k.length] ^ ((i * 7) & 0xff);
        }
        let bin = '';
        for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
        return 'MSV1:' + btoa(bin).split('').reverse().join('');
      } catch (e) {
        return String(str);
      }
    };
    const _dec = (cipher) => {
      try {
        if (!cipher || typeof cipher !== 'string' || !cipher.startsWith('MSV1:')) return cipher;
        const rev = cipher.slice(5).split('').reverse().join('');
        const bin = atob(rev);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          out[i] = bin.charCodeAt(i) ^ _k[i % _k.length] ^ ((i * 7) & 0xff);
        }
        return new TextDecoder().decode(out);
      } catch (e) {
        return '';
      }
    };
    const _sign = (payload) => {
      let h1 = 0x811c9dc5;
      const raw = `${payload}|${_k.join('.')}`;
      for (let i = 0; i < raw.length; i++) {
        h1 ^= raw.charCodeAt(i);
        h1 = Math.imul(h1, 0x01000193);
      }
      return (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0');
    };
    return Object.freeze({ enc: _enc, dec: _dec, sign: _sign });
  })();

  // Encrypted Endpoint & Salt Constants
  const _CFG_VAULT = Object.freeze({
    vApi: _0xVault.enc('https://mindspace-id.vercel.app/api/tokopay'),
    aApi: _0xVault.enc('https://www.minduniverse.id/api/config'),
    salt: _0xVault.enc('MINDSTUDIO2026')
  });

  const getVercelApiUrl = () => _0xVault.dec(_CFG_VAULT.vApi);
  const getAuthApiUrl = () => _0xVault.dec(_CFG_VAULT.aApi);
  const getSecretSalt = () => _0xVault.dec(_CFG_VAULT.salt);

  /* ============================================================================
   * 1. FAKE CAMERA ENGINE (GALERI KE KAMERA STREAM)
   * ============================================================================ */
  (function inisialisasiFakeCamera() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      let img = null;

      setInterval(() => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!img) return;
        const r = Math.max(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * r, h = img.height * r;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      }, 100);

      function pilihFile() {
        return new Promise((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = () => {
            const f = input.files[0];
            if (!f) return reject(new DOMException('Batal', 'NotAllowedError'));
            const i = new Image();
            i.onload = () => { img = i; resolve(); };
            i.src = URL.createObjectURL(f);
          };
          input.oncancel = () => reject(new DOMException('Batal', 'NotAllowedError'));
          input.click();
        });
      }

      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          await pilihFile();
          return canvas.captureStream(15);
        };
        navigator.mediaDevices.enumerateDevices = async () => [
          { kind: 'videoinput', deviceId: 'fake', label: 'Kamera Galeri Mindspace', groupId: 'fake' }
        ];
      }
    } catch (e) {
      console.warn('[Autofill] Gagal menginisialisasi Fake Camera:', e);
    }
  })();

  /* ============================================================================
   * 2. KONFIGURASI & ENCRYPTED STORAGE KEYS
   * ============================================================================ */
  const CURRENT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script)
    ? GM_info.script.version
    : '2.0.1';

  const LICENSE_STORAGE_KEY = 'sipgn_license_key';
  const DEVICE_STORAGE_KEY = 'sipgn_device_id';
  const SPPG_NAME_KEY = 'sipgn_sppg_name';
  const AUTH_TOKEN_KEY = 'sipgn_mindhub_jwt';
  const AUTH_USER_KEY = 'sipgn_mindhub_user';
  const DEVICE_LINKED_KEY = 'sipgn_device_linked_user';
  const STORAGE_KEY = 'sipgnAutofillData';
  const AUTO_KURIR_KEY = 'sipgn_auto_kurir_mbg';
  const MINIMIZE_KEY = 'sipgn_panel_minimized';
  const TYPING_SPEED_KEY = 'sipgn_typing_speed_level';
  const PANEL_POS_KEY = 'sipgn_panel_position_v3';

  let currentDatabaseExpDate = null;
  let cachedServerStatus = null;
  let intervalMonitorLisensi = null;
  let availableUpdateRelease = null;
  let mobilePanelOpen = false;
  let activeTab = 'aksi'; // 'aksi' | 'daftar' | 'pengaturan'
  let searchQuery = '';
  let filterStatus = 'semua';
  let sortMode = 'default'; // 'default' | 'nama' | 'porsi' | 'ritase'
  let activityLogs = [];

  function catatAktivitas(teks, tipe = 'info') {
    const waktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    activityLogs.unshift({ waktu, teks, tipe });
    if (activityLogs.length > 30) activityLogs.pop();
  }

  /* ============================================================================
   * 3. HELPER KEAMANAN, ENCRYPTED STORAGE, AUTH JWT & DEVICE LINKING
   * ============================================================================ */
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function bandingkanVersiSemver(vServer, vLokal) {
    const a = String(vServer || '0.0.0').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
    const b = String(vLokal || '0.0.0').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const numA = a[i] || 0;
      const numB = b[i] || 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }
    return 0;
  }

  function validasiUrlUpdateAman(rawUrl) {
    try {
      const parsed = new URL(String(rawUrl || ''));
      if (parsed.protocol !== 'https:') return null;
      const allowedHosts = ['mindspace-id.vercel.app', 'minduniverse.id', 'www.minduniverse.id'];
      if (!allowedHosts.includes(parsed.hostname)) return null;
      return parsed.href;
    } catch {
      return null;
    }
  }

  function cekUpdateAplikasiInApp() {
    return new Promise((resolve) => {
      const token = dapatkanAuthToken();
      const headers = { 'Cache-Control': 'no-cache, no-store' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      GM_xmlhttpRequest({
        method: 'GET',
        url: `${getVercelApiUrl()}?action=get_release&_t=${Date.now()}`,
        headers,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            const rel = data?.release || (data?.version ? data : null);
            if (rel && rel.version && bandingkanVersiSemver(rel.version, CURRENT_VERSION) > 0) {
              const safeUrl = validasiUrlUpdateAman(rel.download_url) || 'https://mindspace-id.vercel.app/files/sipgn-autofill.user.js';
              availableUpdateRelease = {
                version: String(rel.version).trim(),
                download_url: safeUrl,
                changelog: String(rel.changelog || 'Pembaruan stabilitas dan peningkatan performa otomatis.').trim()
              };
              catatAktivitas(`Pembaruan tersedia: v${availableUpdateRelease.version}`, 'info');
              tampilkanToast(`Pembaruan v${escapeHtml(availableUpdateRelease.version)} tersedia!`, 'info', 4500);

              setTimeout(() => {
                tampilkanModalDetailUpdate();
              }, 400);

              if (document.getElementById('sipgn-autofill-panel')) renderPanel();
              resolve(availableUpdateRelease);
              return;
            }
            availableUpdateRelease = null;
            if (document.getElementById('sipgn-autofill-panel')) renderPanel();
            resolve(null);
          } catch (e) {
            resolve(null);
          }
        },
        onerror: () => resolve(null)
      });
    });
  }

  // MODAL UPDATE VERSI BARU: DENGAN FORMAT BULLET POINTS OTOMATIS
  function tampilkanModalDetailUpdate() {
    const updateInfo = availableUpdateRelease || {
      version: '3.3',
      download_url: 'https://mindspace-id.vercel.app/files/sipgn-autofill.user.js',
      changelog: '✨ Peningkatan stabilitas sistem - Optimalisasi antarmuka Bento Glassmorphism - Pembaruan modul automasi penugasan KPM - Peningkatan performa secara menyeluruh.'
    };

    // Fungsi helper untuk mengubah teks changelog mentah menjadi list HTML (bullet points)
    const formatChangelogToHTML = (rawText) => {
      const text = String(rawText || '').trim();

      // Pisahkan teks berdasarkan pola "- " (minus diikuti spasi) yang diawali baris baru atau awal teks
      // Menggunakan regex /^[-\u2022]\s+|\n\s*[-\u2022]\s+/g
      const items = text.split(/(?:^[-\u2022]|\n\s*[-\u2022])\s+/).map(item => item.trim()).filter(Boolean);

      if (items.length <= 1) {
        return `<div style="line-height: 1.6;">${escapeHtml(text)}</div>`;
      }

      return `<ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px;">
        ${items.map(item => `<li style="line-height: 1.5; color: #cbd5e1;">${escapeHtml(item)}</li>`).join('')}
      </ul>`;
    };

    const overlay = buatOverlayModal('sipgn-update-modal');
    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box" style="padding: 28px 32px; border-radius: 28px; width: 660px; max-width: 95vw; text-align: left; box-shadow: 0 35px 90px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.25);">

        <!-- HEADER ATAS KECIL -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 10px #10b981;"></div>
            <span style="font-size:11px; font-weight:700; color:#34d399; font-family:var(--ms-font-mono); text-transform:uppercase; letter-spacing:0.5px;">Sistem Pembaruan Otomatis</span>
          </div>
          <button id="ms-close-update-modal" class="ms-btn ms-btn-ghost" style="width:30px; height:30px; padding:0; border-radius:50%;">✕</button>
        </div>

        <!-- KONTEN UTAMA: DUA KOLOM -->
        <div style="display:grid; grid-template-columns: 210px 1fr; gap: 20px; align-items: stretch; margin-bottom: 24px;">

          <!-- KOLOM KIRI: LOGO & VERSI -->
          <div class="ms-bento" style="padding: 20px 16px; display:flex; flex-direction:column; align-items:center; text-align:center; background:rgba(6,10,21,0.65);">
            <div style="margin-top: 14px; width: 72px; height: 72px; border-radius: 20px; background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.3); padding: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; box-shadow: 0 8px 24px rgba(56,189,248,0.2);">
              <img src="https://raw.githubusercontent.com/yosdniel/yosdniel.github.io/refs/heads/main/assets/favicon512.png" alt="Mindspace Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" />
            </div>
            <div style="font-size: 14px; font-weight: 800; color: #f8fafc; letter-spacing: -0.2px; margin-bottom: 2px;">SIPGN Autofill</div>
            <div style="font-size: 11.5px; font-weight: 700; color: var(--ms-cyan); font-family: var(--ms-font-mono); margin-bottom: 0px;">v.${escapeHtml(updateInfo.version)}</div>

            <div style="margin-top: 12px; font-size: 9.5px; color: var(--ms-text-muted); font-family: var(--ms-font-mono); line-height: 1.4;">
              Crafted by <strong style="color: #94a3b8; font-weight: 800; letter-spacing: 0.5px;">Mindspace Studio</strong>
            </div>
          </div>

          <!-- KOLOM KANAN: KOTAK CHANGELOGS -->
          <div class="ms-bento" style="padding: 16px 18px; display: flex; flex-direction: column; background: rgba(10,15,28,0.75);">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
              <span style="font-size:14px;">📋</span>
              <span style="font-size:11px; font-weight:700; color:var(--ms-cyan); text-transform:uppercase; letter-spacing:0.3px;">Catatan Perubahan (Changelogs)</span>
            </div>
            <div class="ms-scroll" style="flex: 1; max-height: 160px; overflow-y: auto; font-size: 11.5px; padding-right: 4px;">
              ${formatChangelogToHTML(updateInfo.changelog)}
            </div>
          </div>

        </div>

        <!-- BAGIAN BAWAH: DUA TOMBOL BERSAMPINGAN -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <button id="ms-later-update-btn" class="ms-btn ms-btn-ghost" style="padding: 12px; font-size: 12.5px; justify-content: center; border-radius: 14px;">Nanti Saja</button>
          <button id="ms-install-update-btn" class="ms-btn ms-btn-emerald" style="padding: 12px; font-size: 12.5px; justify-content: center; border-radius: 14px;">🚀 Update Sekarang</button>
        </div>

      </div>
    `;
    bantuAppendKeBody(overlay);

    document.getElementById('ms-close-update-modal').onclick = () => overlay.remove();
    document.getElementById('ms-later-update-btn').onclick = () => overlay.remove();
    document.getElementById('ms-install-update-btn').onclick = () => {
      catatAktivitas(`Memulai unduhan update v${updateInfo.version}`, 'success');
      window.open(updateInfo.download_url, '_blank', 'noopener,noreferrer');
      tampilkanToast('Tab instalasi Tampermonkey dibuka. Klik "Update / Reinstall" lalu muat ulang halaman.', 'info', 5500);
      overlay.remove();
    };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  function secureSetGM(key, rawValue) {
    try {
      const cipher = _0xVault.enc(rawValue);
      GM_setValue(key, cipher);
    } catch (e) {}
  }

  function secureGetGM(key, fallback = '') {
    try {
      const stored = GM_getValue(key, '');
      if (!stored) return fallback;
      const dec = _0xVault.dec(stored);
      return dec || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function dapatkanAuthToken() {
    return secureGetGM(AUTH_TOKEN_KEY, '');
  }

  function decodeJWTPayload(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      return JSON.parse(atob(padded));
    } catch (e) {
      return null;
    }
  }

  function simpanAuthSession(token, userData = null) {
    try {
      secureSetGM(AUTH_TOKEN_KEY, String(token || ''));
      const jwtPayload = decodeJWTPayload(token) || {};
      const mergedUser = { ...jwtPayload, ...(userData && typeof userData === 'object' ? userData : {}) };
      if (!mergedUser.id && (jwtPayload.sub || jwtPayload.user_id || jwtPayload.userId)) {
        mergedUser.id = jwtPayload.sub || jwtPayload.user_id || jwtPayload.userId;
      }
      if (Object.keys(mergedUser).length > 0) {
        secureSetGM(AUTH_USER_KEY, JSON.stringify(mergedUser));
      }
    } catch (e) {}
  }

  function dapatkanAuthUser() {
    try {
      const raw = secureGetGM(AUTH_USER_KEY, '');
      const parsed = raw ? JSON.parse(raw) : {};
      const token = dapatkanAuthToken();
      const jwtPayload = decodeJWTPayload(token) || {};
      const userObj = { ...jwtPayload, ...parsed };
      if (!userObj.id) userObj.id = userObj.user_id || userObj.userId || userObj.sub || null;
      return Object.keys(userObj).length > 0 ? userObj : null;
    } catch (e) {
      return null;
    }
  }

  function dapatkanUserIdAktif() {
    const user = dapatkanAuthUser();
    return user ? (user.id || user.user_id || user.userId || user.sub || null) : null;
  }

  function simpanStatusTautanLokal(userId, status = true) {
    try {
      const key = `${DEVICE_LINKED_KEY}_${dapatkanDeviceID()}`;
      if (status && userId) secureSetGM(key, String(userId));
      else if (typeof GM_deleteValue === 'function') GM_deleteValue(key);
      else GM_setValue(key, '');
    } catch (e) {}
  }

  function cekStatusTautanLokal(userId) {
    if (!userId) return false;
    try {
      const savedUserId = secureGetGM(`${DEVICE_LINKED_KEY}_${dapatkanDeviceID()}`, '');
      return savedUserId && String(savedUserId) === String(userId);
    } catch (e) {
      return false;
    }
  }

  function hapusAuthSession() {
    try {
      if (typeof GM_deleteValue === 'function') {
        GM_deleteValue(AUTH_TOKEN_KEY);
        GM_deleteValue(AUTH_USER_KEY);
      } else {
        GM_setValue(AUTH_TOKEN_KEY, '');
        GM_setValue(AUTH_USER_KEY, '');
      }
    } catch (e) {}
  }

  function cekValiditasJWT(token) {
    const payload = decodeJWTPayload(token);
    if (!payload) return false;
    if (payload.exp && typeof payload.exp === 'number') {
      if (payload.exp <= Math.floor(Date.now() / 1000)) return false;
    }
    return true;
  }

  function loginMindHUB(username, password) {
    return new Promise((resolve, reject) => {
      const devId = dapatkanDeviceID();
      const sig = _0xVault.sign(`${username}|${devId}`);
      GM_xmlhttpRequest({
        method: 'POST',
        url: getAuthApiUrl(),
        headers: {
          'Content-Type': 'application/json',
          'X-MS-Integrity': sig
        },
        data: JSON.stringify({
          action: 'login',
          username: username,
          password: password,
          device_id: devId,
          signature: sig
        }),
        onload: function (res) {
          try {
            const data = JSON.parse(res.responseText);
            if (data && data.token && cekValiditasJWT(data.token)) {
              const userPayload = data.user || data.account || {
                id: data.user_id || data.id || null,
                username: username
              };
              simpanAuthSession(data.token, userPayload);
              if (userPayload && userPayload.sppg_name) simpanNamaSPPG(userPayload.sppg_name);
              resolve({ success: true, data: data });
            } else {
              resolve({
                success: false,
                error: (data && (data.error || data.message || data.msg)) || 'Username atau password salah.'
              });
            }
          } catch (e) {
            reject('Respon autentikasi dari server tidak valid.');
          }
        },
        onerror: () => reject('Gagal menghubungi server autentikasi MindHUB.')
      });
    });
  }

  function linkDeviceKeAkun() {
    return new Promise((resolve, reject) => {
      const token = dapatkanAuthToken();
      const devId = dapatkanDeviceID();
      const authUser = dapatkanAuthUser();
      const userId = dapatkanUserIdAktif();

      if (!token) return resolve({ success: false, error: 'Sesi login tidak ditemukan. Silakan login ulang.' });

      const sig = _0xVault.sign(`${devId}|${userId || ''}`);
      const payload = {
        action: 'link_device',
        device_id: devId,
        user_id: userId,
        account_id: userId,
        username: authUser?.username || '',
        sppg_name: dapatkanNamaSPPG() || authUser?.sppg_name || '',
        signature: sig
      };

      const kirimRequestLink = (targetUrl) => new Promise((resReq, rejReq) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: targetUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-MS-Integrity': sig
          },
          data: JSON.stringify(payload),
          onload: (res) => {
            try { resReq({ status: res.status, data: JSON.parse(res.responseText) }); }
            catch (e) { resReq({ status: res.status, data: { success: false, error: 'Respon server tidak valid.' } }); }
          },
          onerror: () => rejReq('Gagal menghubungi server untuk menautkan perangkat.')
        });
      });

      (async () => {
        try {
          const [hasilVercel, hasilAuth] = await Promise.allSettled([
            kirimRequestLink(getVercelApiUrl()),
            kirimRequestLink(getAuthApiUrl())
          ]);
          const resVercel = hasilVercel.status === 'fulfilled' ? hasilVercel.value : null;
          const resAuth = hasilAuth.status === 'fulfilled' ? hasilAuth.value : null;
          const suksesVercel = Boolean(resVercel && resVercel.data && resVercel.data.success);
          const suksesAuth = Boolean(resAuth && resAuth.data && resAuth.data.success);

          if (suksesVercel || suksesAuth) {
            const dataUtama = suksesVercel ? resVercel.data : resAuth.data;
            const resolvedUserId = dataUtama.user_id || dataUtama.account_id || userId;
            if (resolvedUserId) simpanStatusTautanLokal(resolvedUserId, true);
            if (cachedServerStatus) {
              cachedServerStatus.is_linked = true;
              cachedServerStatus.linked = true;
              cachedServerStatus.user_id = resolvedUserId;
            }
            resolve({ ...dataUtama, success: true, user_id: resolvedUserId });
            return;
          }
          if (hasilVercel.status === 'rejected' && hasilAuth.status === 'rejected') {
            reject(hasilVercel.reason || 'Gagal menghubungi server.');
            return;
          }
          resolve((resVercel && resVercel.data) || (resAuth && resAuth.data) || { success: false, error: 'Gagal menautkan perangkat.' });
        } catch (err) {
          reject(err);
        }
      })();
    });
  }

  /* ============================================================================
   * 4. ULTRA-PREMIUM CYBER-AURORA BENTO DESIGN SYSTEM (v2.0.1)
   * ============================================================================ */
  function pasangDesignSystemCSS() {
    if (!document.getElementById('ms-font-jakarta')) {
      const link = document.createElement('link');
      link.id = 'ms-font-jakarta';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
      (document.head || document.documentElement).appendChild(link);
    }

    if (document.getElementById('ms-design-system-style')) return;
    const style = document.createElement('style');
    style.id = 'ms-design-system-style';
    style.textContent = `
      :root {
        --ms-bg-obsidian: rgba(5, 8, 17, 0.92);
        --ms-bg-bento: rgba(255, 255, 255, 0.028);
        --ms-bg-bento-elevated: rgba(15, 23, 42, 0.56);
        --ms-border: rgba(255, 255, 255, 0.08);
        --ms-border-highlight: rgba(56, 189, 248, 0.36);
        --ms-cyan: #38bdf8;
        --ms-indigo: #818cf8;
        --ms-violet: #a855f7;
        --ms-emerald: #10b981;
        --ms-amber: #f59e0b;
        --ms-rose: #f43f5e;
        --ms-text-main: #f8fafc;
        --ms-text-sub: #cbd5e1;
        --ms-text-muted: #94a3b8;
        --ms-font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        --ms-font-mono: 'JetBrains Mono', monospace;
      }

      .ms-ui-root, .ms-ui-root * {
        box-sizing: border-box;
        font-family: var(--ms-font-sans);
      }

      .ms-ui-root {
        -webkit-user-select: none !important;
        user-select: none !important;
      }

      .ms-ui-root input, .ms-ui-root textarea, .ms-ui-root select {
        -webkit-user-select: text !important;
        user-select: text !important;
      }

      @keyframes msAuroraGlow {
        0%, 100% {
          box-shadow: 0 32px 80px -16px rgba(0, 0, 0, 0.92),
                      inset 0 1px 0 rgba(255, 255, 255, 0.16),
                      0 0 0 1px rgba(56, 189, 248, 0.24),
                      0 0 42px rgba(56, 189, 248, 0.14);
        }
        50% {
          box-shadow: 0 32px 80px -16px rgba(0, 0, 0, 0.92),
                      inset 0 1px 0 rgba(255, 255, 255, 0.22),
                      0 0 0 1px rgba(168, 85, 247, 0.38),
                      0 0 54px rgba(99, 102, 241, 0.24);
        }
      }

      @keyframes msShimmerSweep {
        0% { transform: translateX(-140%) skewX(-20deg); }
        100% { transform: translateX(260%) skewX(-20deg); }
      }

      @keyframes msSlideIn {
        0% { opacity: 0; transform: translateY(14px) scale(0.96); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes msSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @keyframes msPulseRing {
        0% { transform: scale(0.95); opacity: 0.9; }
        70% { transform: scale(2.1); opacity: 0; }
        100% { transform: scale(2.1); opacity: 0; }
      }

      .ms-aurora-shell {
        background:
          radial-gradient(140% 90% at 100% 0%, rgba(56, 189, 248, 0.17) 0%, transparent 52%),
          radial-gradient(110% 90% at 0% 100%, rgba(168, 85, 247, 0.15) 0%, transparent 52%),
          radial-gradient(80% 60% at 50% 0%, rgba(16, 185, 129, 0.06) 0%, transparent 60%),
          linear-gradient(180deg, rgba(12, 18, 34, 0.88) 0%, rgba(5, 8, 17, 0.97) 100%);
        backdrop-filter: blur(30px) saturate(195%);
        -webkit-backdrop-filter: blur(30px) saturate(195%);
        border: 1px solid rgba(255, 255, 255, 0.11);
        color: var(--ms-text-main);
        animation: msSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards, msAuroraGlow 7.5s ease-in-out infinite;
      }

      .ms-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
      .ms-scroll::-webkit-scrollbar-track { background: transparent; }
      .ms-scroll::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.22); border-radius: 99px; }
      .ms-scroll::-webkit-scrollbar-thumb:hover { background: rgba(56, 189, 248, 0.55); }

      .ms-bento {
        background: var(--ms-bg-bento);
        border: 1px solid var(--ms-border);
        border-radius: 16px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055), 0 6px 20px rgba(0, 0, 0, 0.22);
        transition: border-color 0.22s ease, background 0.22s ease, transform 0.18s ease;
      }
      .ms-bento:hover {
        border-color: rgba(255, 255, 255, 0.15);
      }

      .ms-drag-grip {
        cursor: grab;
        touch-action: none;
      }
      .ms-drag-grip:active {
        cursor: grabbing;
      }

      .ms-btn {
        position: relative;
        overflow: hidden;
        border: 1px solid transparent;
        border-radius: 12px;
        font-weight: 700;
        font-size: 11.5px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        outline: none;
        letter-spacing: 0.15px;
      }
      .ms-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.12); }
      .ms-btn:active:not(:disabled) { transform: translateY(0.5px) scale(0.985); filter: brightness(0.95); }
      .ms-btn:disabled { opacity: 0.36; cursor: not-allowed; }

      .ms-btn-aurora {
        background: linear-gradient(135deg, #0284c7 0%, #4f46e5 50%, #7e22ce 100%);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.16);
        box-shadow: 0 10px 26px -6px rgba(99, 102, 241, 0.72), inset 0 1px 0 rgba(255,255,255,0.32);
      }
      .ms-btn-aurora::after {
        content: '';
        position: absolute;
        top: 0; left: 0; width: 45%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
        animation: msShimmerSweep 3.4s infinite ease-in-out;
        pointer-events: none;
      }
      .ms-btn-primary {
        background: linear-gradient(135deg, #2563eb, #4f46e5);
        color: #fff;
        box-shadow: 0 6px 18px -4px rgba(37, 99, 235, 0.55), inset 0 1px 0 rgba(255,255,255,0.22);
      }
      .ms-btn-cyan {
        background: linear-gradient(135deg, #0284c7, #2563eb);
        color: #fff;
        box-shadow: 0 6px 18px -4px rgba(2, 132, 199, 0.52);
      }
      .ms-btn-emerald {
        background: linear-gradient(135deg, #059669, #10b981);
        color: #fff;
        box-shadow: 0 6px 18px -4px rgba(16, 185, 129, 0.48);
      }
      .ms-btn-violet {
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        color: #fff;
        box-shadow: 0 6px 18px -4px rgba(124, 58, 237, 0.52);
      }
      .ms-btn-ghost {
        background: rgba(255, 255, 255, 0.042);
        border-color: var(--ms-border);
        color: #e2e8f0;
      }
      .ms-btn-ghost:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.09);
        border-color: rgba(56, 189, 248, 0.38);
      }
      .ms-btn-danger {
        background: rgba(244, 63, 94, 0.13);
        border-color: rgba(244, 63, 94, 0.32);
        color: #fda4af;
      }

      .ms-input, .ms-select {
        width: 100%;
        padding: 9px 12px;
        border-radius: 11px;
        border: 1px solid var(--ms-border);
        background: rgba(6, 10, 21, 0.78);
        color: #f8fafc;
        font-size: 12px;
        font-weight: 500;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .ms-input:focus, .ms-select:focus {
        border-color: var(--ms-cyan);
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.18);
      }
      .ms-select {
        appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2338bdf8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 10px center;
        background-size: 14px;
        padding-right: 30px;
        cursor: pointer;
      }
      .ms-select option { background: #060a15; color: #f8fafc; }

      .ms-dock-bar {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
        padding: 4px;
        background: rgba(6, 10, 21, 0.8);
        border: 1px solid var(--ms-border);
        border-radius: 14px;
        margin-bottom: 12px;
      }
      .ms-dock-btn {
        padding: 8px 6px;
        border-radius: 10px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--ms-text-muted);
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      .ms-dock-btn.active {
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.24), rgba(168, 85, 247, 0.24));
        color: #fff;
        border-color: rgba(56, 189, 248, 0.42);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.18);
      }

      .ms-range {
        -webkit-appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 99px;
        background: rgba(51, 65, 85, 0.85);
        outline: none;
      }
      .ms-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 17px;
        height: 17px;
        border-radius: 50%;
        background: linear-gradient(135deg, #38bdf8, #a855f7);
        cursor: pointer;
        box-shadow: 0 0 12px rgba(56, 189, 248, 0.8);
        border: 2px solid #fff;
      }

      .ms-kbd {
        font-family: var(--ms-font-mono);
        font-size: 9.5px;
        padding: 2px 6px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: var(--ms-text-sub);
      }

      #ms-toast-container {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      .ms-toast {
        pointer-events: auto;
        min-width: 265px;
        max-width: 350px;
        padding: 11px 14px;
        border-radius: 14px;
        background: rgba(8, 13, 26, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(56, 189, 248, 0.4);
        color: #f8fafc;
        font-size: 12px;
        font-weight: 600;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: msSlideIn 0.24s ease forwards;
      }

      @media (max-width: 640px) {
        .ms-modal-backdrop { align-items: flex-end !important; }
        .ms-modal-box {
          width: 100vw !important;
          max-width: 100vw !important;
          max-height: 88vh !important;
          border-radius: 26px 26px 0 0 !important;
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 20px) !important;
        }
        #ms-toast-container { left: 12px; right: 12px; bottom: 88px; }
        .ms-toast { max-width: 100%; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function tampilkanToast(pesan, tipe = 'info', durasi = 3200) {
    pasangDesignSystemCSS();
    let container = document.getElementById('ms-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ms-toast-container';
      container.className = 'ms-ui-root';
      bantuAppendKeBody(container);
    }

    const ikonMap = { success: '✅', error: '❌', warning: '⚠️', info: '⚡' };
    const warnaMap = {
      success: 'rgba(16, 185, 129, 0.48)',
      error: 'rgba(244, 63, 94, 0.48)',
      warning: 'rgba(245, 158, 11, 0.48)',
      info: 'rgba(56, 189, 248, 0.48)'
    };

    const toast = document.createElement('div');
    toast.className = 'ms-toast';
    toast.style.borderColor = warnaMap[tipe] || warnaMap.info;
    toast.innerHTML = `<span style="font-size:15px;">${ikonMap[tipe] || '⚡'}</span><span style="line-height:1.4;">${pesan}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, durasi);
  }

  function isMobileDevice() {
    return window.innerWidth <= 640 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function dapatkanTopZIndex() {
    let highest = 2147483640;
    document.querySelectorAll('body *').forEach((el) => {
      const z = parseInt(window.getComputedStyle(el).zIndex, 10);
      if (!isNaN(z) && z > highest) highest = z;
    });
    return highest + 10;
  }

  function bantuAppendKeBody(element) {
    if (!element) return;
    if (document.body) {
      document.body.appendChild(element);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) document.body.appendChild(element);
      });
    }
  }

  /* ============================================================================
   * 5. STATE, PREFERENCE & DRAGGABLE POSITION HELPERS
   * ============================================================================ */
  function dapatkanPosisiPanel() {
    try {
      const raw = GM_getValue(PANEL_POS_KEY, '') || localStorage.getItem(PANEL_POS_KEY);
      if (!raw) return null;
      const pos = JSON.parse(raw);
      if (typeof pos.top === 'number' && typeof pos.left === 'number') {
        const maxLeft = Math.max(10, window.innerWidth - 398);
        const maxTop = Math.max(10, window.innerHeight - 120);
        return {
          top: Math.min(Math.max(10, pos.top), maxTop),
          left: Math.min(Math.max(10, pos.left), maxLeft)
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function simpanPosisiPanel(top, left) {
    const data = JSON.stringify({ top, left });
    try { GM_setValue(PANEL_POS_KEY, data); } catch (e) {}
    localStorage.setItem(PANEL_POS_KEY, data);
  }

  function resetPosisiPanel() {
    try {
      if (typeof GM_deleteValue === 'function') GM_deleteValue(PANEL_POS_KEY);
      else GM_setValue(PANEL_POS_KEY, '');
    } catch (e) {}
    localStorage.removeItem(PANEL_POS_KEY);
  }

  function aktifkanDraggablePanel(panelEl, handleEl) {
    if (!panelEl || !handleEl || isMobileDevice()) return;
    let isDragging = false;
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    handleEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      const rect = panelEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      panelEl.style.right = 'auto';
      panelEl.style.left = `${initialLeft}px`;
      panelEl.style.top = `${initialTop}px`;
      e.preventDefault();
    });

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.min(Math.max(8, initialLeft + dx), window.innerWidth - panelEl.offsetWidth - 8);
      const newTop = Math.min(Math.max(8, initialTop + dy), window.innerHeight - 60);
      panelEl.style.left = `${newLeft}px`;
      panelEl.style.top = `${newTop}px`;
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      const rect = panelEl.getBoundingClientRect();
      simpanPosisiPanel(Math.round(rect.top), Math.round(rect.left));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function dapatkanTypingSpeedLevel() {
    try { return String(GM_getValue(TYPING_SPEED_KEY, '50') || '50'); }
    catch (e) { return localStorage.getItem(TYPING_SPEED_KEY) || '50'; }
  }

  function simpanTypingSpeedLevel(val) {
    try { GM_setValue(TYPING_SPEED_KEY, String(val)); } catch (e) {}
    localStorage.setItem(TYPING_SPEED_KEY, String(val));
  }

  function formatSpeedText(value) {
    const val = String(value);
    if (val === '0') return '⚡ Instant (Tanpa Jeda)';
    if (val === '25') return '🚀 Cepat (Jeda Minimal)';
    if (val === '75') return '👤 Human Realistis (Ketik Alami)';
    return '⚖️ Seimbang (Direkomendasikan)';
  }

  function dapatkanAutoKurirMBG() {
    try {
      const val = GM_getValue(AUTO_KURIR_KEY, true);
      return val === true || val === 'true';
    } catch (e) {
      const val = localStorage.getItem(AUTO_KURIR_KEY);
      return val === null ? true : val === 'true';
    }
  }

  function simpanAutoKurirMBG(val) {
    try { GM_setValue(AUTO_KURIR_KEY, val); } catch (e) {}
    localStorage.setItem(AUTO_KURIR_KEY, String(val));
  }

  function dapatkanPanelMinimized() {
    try {
      const val = GM_getValue(MINIMIZE_KEY, false);
      return val === true || val === 'true';
    } catch (e) {
      return localStorage.getItem(MINIMIZE_KEY) === 'true';
    }
  }

  function simpanPanelMinimized(val) {
    try { GM_setValue(MINIMIZE_KEY, val); } catch (e) {}
    localStorage.setItem(MINIMIZE_KEY, String(val));
  }

  function dapatkanNamaSPPG() {
    try {
      return secureGetGM(SPPG_NAME_KEY, '') || localStorage.getItem(SPPG_NAME_KEY) || '';
    } catch (e) {
      return localStorage.getItem(SPPG_NAME_KEY) || '';
    }
  }

  function simpanNamaSPPG(nama) {
    secureSetGM(SPPG_NAME_KEY, nama);
    localStorage.setItem(SPPG_NAME_KEY, nama);
    kirimNamaSPPGKeDatabase(nama);
  }

  function kirimNamaSPPGKeDatabase(nama) {
    const devId = dapatkanDeviceID();
    const token = dapatkanAuthToken();
    const userId = dapatkanUserIdAktif();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    GM_xmlhttpRequest({
      method: 'POST',
      url: getVercelApiUrl(),
      headers: headers,
      data: JSON.stringify({
        action: 'register_sppg',
        device_id: devId,
        user_id: userId,
        sppg_name: nama
      }),
      onerror: () => console.warn('[Autofill] Gagal sinkronisasi nama SPPG.')
    });
  }

  function dapatkanDeviceID() {
    try {
      let devId = secureGetGM(DEVICE_STORAGE_KEY, '');
      if (!devId) {
        const hashAcak = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
        devId = `DEV-${hashAcak.slice(0, 4)}-${hashAcak.slice(4)}`;
        secureSetGM(DEVICE_STORAGE_KEY, devId);
      }
      return devId;
    } catch (e) {
      return 'DEV-DEFAULT-KEY';
    }
  }

  function buatLicenseKey(expDate, deviceId, client = 'User') {
    const nonce = Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
    const salt = getSecretSalt();
    const sig = _0xVault.sign(`${expDate}|${deviceId}|${nonce}`);
    const payload = `${expDate}|${deviceId}|${client}|${salt}|${nonce}|${sig}`;
    return `MIND-${_0xVault.enc(payload).slice(5)}`;
  }

  function formatTanggalIndo(tanggalStr) {
    if (!tanggalStr || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalStr)) return tanggalStr || '-';
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const [yyyy, mm, dd] = tanggalStr.split('-');
    return `${dd} ${bulan[parseInt(mm, 10) - 1]} ${yyyy}`;
  }

  function hitungSisaHari(tanggalStr) {
    if (!tanggalStr || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalStr)) return null;
    const targetDate = new Date(tanggalStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
  }

  /* ============================================================================
   * 6. MODAL DIALOGS (LOGIN, WELCOME, STATUS, VOUCHER, KPM EDITOR, COMMAND PALETTE)
   * ============================================================================ */
  function buatOverlayModal(idModal) {
    pasangDesignSystemCSS();
    const lama = document.getElementById(idModal);
    if (lama) lama.remove();

    const overlay = document.createElement('div');
    overlay.id = idModal;
    overlay.className = 'ms-ui-root ms-modal-backdrop';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(3, 6, 13, 0.88);
      backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
      z-index: ${dapatkanTopZIndex()}; display: flex; align-items: center; justify-content: center;
    `;
    return overlay;
  }

  function tampilkanCommandPalette() {
    const existing = document.getElementById('sipgn-command-palette');
    if (existing) { existing.remove(); return; }

    const overlay = buatOverlayModal('sipgn-command-palette');
    const commands = [
      { ikon: '⚡', judul: 'Isi Otomatis Penugasan Baru', sub: 'Jalankan pengisian form KPM aktif sekarang', aksi: () => { if (indexTerpilih >= 0) isiPenugasan(indexTerpilih); } },
      { ikon: '🤖', judul: 'Auto-Sequence Semua Aksi Halaman Ini', sub: 'Deteksi & isi seluruh field waktu/ompreng aktif', aksi: () => jalankanAutoSequenceHalaman() },
      { ikon: '✨', judul: 'Tambah Data KPM Baru', sub: 'Buka editor formulir KPM lengkap', aksi: () => tampilkanModalFormKPM(null, null) },
      { ikon: '⏭️', judul: 'Lompat ke KPM Belum Diproses Berikutnya', sub: 'Pilih otomatis antrean KPM dengan status Belum', aksi: () => pilihKPMBelumBerikutnya() },
      { ikon: '🔄', judul: 'Cek Pembaruan Versi Skrip (In-App Update)', sub: `Versi terpasang saat ini: v${CURRENT_VERSION}`, aksi: () => {
        cekUpdateAplikasiInApp().then((rel) => {
          if (rel) tampilkanModalDetailUpdate();
          else tampilkanToast(`Anda sudah menggunakan versi terbaru (v${CURRENT_VERSION}).`, 'success');
        });
      }},
      { ikon: '📥', judul: 'Export Daftar KPM ke CSV', sub: 'Unduh seluruh jadwal & porsi KPM ke spreadsheet CSV', aksi: () => exportCSVData() },
      { ikon: '☁️', judul: 'Backup Data ke Cloud & Lokal', sub: 'Sinkronisasi terenkripsi database KPM sekarang', aksi: () => downloadBackupData() },
      { ikon: '📜', judul: 'Lihat Log Aktivitas Otomatisasi', sub: 'Riwayat eksekusi pengisian formulir sesi ini', aksi: () => tampilkanModalActivityLog() },
      { ikon: '🎯', judul: 'Reset Posisi Panel Melayang', sub: 'Kembalikan panel ke pojok kanan atas', aksi: () => { resetPosisiPanel(); renderPanel(); tampilkanToast('Posisi panel dikembalikan ke default.', 'info'); } },
      { ikon: '↺', judul: 'Reset Semua Status KPM', sub: 'Kembalikan status seluruh KPM ke Belum Diproses', aksi: () => {
        dataPenugasan.forEach((d) => { d.terpakai = false; d.statusProses = 'belum'; });
        simpanData(dataPenugasan);
        renderPanel();
        tampilkanToast('Semua status KPM berhasil direset.', 'success');
      }}
    ];

    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box" style="width: 490px; max-width: 94vw; border-radius: 22px; overflow: hidden; padding: 14px;">
        <div style="display:flex; align-items:center; gap:10px; padding: 4px 8px 12px; border-bottom: 1px solid var(--ms-border);">
          <span style="font-size:16px;">⌘</span>
          <input id="ms-cmd-input" class="ms-input" placeholder="Ketik perintah cepat atau nama KPM..." style="border:none; background:transparent; padding:4px; font-size:13.5px; box-shadow:none;" />
          <span class="ms-kbd">ESC</span>
        </div>
        <div id="ms-cmd-list" class="ms-scroll" style="max-height: 320px; overflow-y: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 5px;"></div>
      </div>
    `;
    bantuAppendKeBody(overlay);

    const inputEl = document.getElementById('ms-cmd-input');
    const listEl = document.getElementById('ms-cmd-list');

    const renderCmdItems = (filter = '') => {
      const q = filter.toLowerCase();
      listEl.innerHTML = '';

      const kpmItems = dataPenugasan
        .map((k, idx) => ({
          ikon: '🏫',
          judul: `Pilih KPM: ${k.sekolah}`,
          sub: `${hitungTotalPorsi(k)} porsi • Kurir: ${k.namaKurir || '-'}`,
          aksi: () => { indexTerpilih = idx; activeTab = 'aksi'; renderPanel(); tampilkanToast(`KPM aktif: ${escapeHtml(k.sekolah)}`, 'info'); }
        }))
        .filter((c) => !q || c.judul.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q));

      const matchedCmds = commands.filter((c) => !q || c.judul.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q));
      const all = [...matchedCmds, ...kpmItems];

      if (all.length === 0) {
        listEl.innerHTML = `<div style="padding:20px; text-align:center; font-size:12px; color:var(--ms-text-muted);">Perintah tidak ditemukan.</div>`;
        return;
      }

      all.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'ms-bento';
        row.style.cssText = 'padding: 10px 12px; cursor: pointer; display: flex; align-items: center; gap: 10px;';
        row.innerHTML = `
          <div style="width:32px; height:32px; border-radius:10px; background:rgba(56,189,248,0.14); display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0;">${item.ikon}</div>
          <div style="overflow:hidden;">
            <div style="font-size:12.5px; font-weight:700; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.judul)}</div>
            <div style="font-size:10.5px; color:var(--ms-text-muted);">${escapeHtml(item.sub)}</div>
          </div>
        `;
        row.onmouseenter = () => { row.style.background = 'rgba(56,189,248,0.14)'; row.style.borderColor = 'rgba(56,189,248,0.45)'; };
        row.onmouseleave = () => { row.style.background = 'var(--ms-bg-bento)'; row.style.borderColor = 'var(--ms-border)'; };
        row.onclick = () => { overlay.remove(); item.aksi(); };
        listEl.appendChild(row);
      });
    };

    renderCmdItems();
    inputEl.focus();
    inputEl.oninput = (e) => renderCmdItems(e.target.value);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  function tampilkanModalActivityLog() {
    const overlay = buatOverlayModal('sipgn-activity-log-modal');
    const logRows = activityLogs.length === 0
      ? `<div style="padding:24px; text-align:center; font-size:12px; color:var(--ms-text-muted);">Belum ada aktivitas tercatat pada sesi ini.</div>`
      : activityLogs.map((l) => `
          <div class="ms-bento" style="padding:9px 12px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span style="font-size:11.5px; color:#e2e8f0;">${escapeHtml(l.teks)}</span>
            <span style="font-size:10px; font-family:var(--ms-font-mono); color:var(--ms-cyan); flex-shrink:0;">${l.waktu}</span>
          </div>
        `).join('');

    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box" style="width: 440px; max-width: 92vw; border-radius: 22px; padding: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="margin:0; font-size:15px; font-weight:800;">📜 Telemetry Activity Log</h3>
            <div style="font-size:11px; color:var(--ms-text-muted);">Riwayat eksekusi otomatisasi real-time</div>
          </div>
          <button id="ms-close-log-modal" class="ms-btn ms-btn-ghost" style="width:28px; height:28px; padding:0; border-radius:50%;">✕</button>
        </div>
        <div class="ms-scroll" style="max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
          ${logRows}
        </div>
      </div>
    `;
    bantuAppendKeBody(overlay);
    document.getElementById('ms-close-log-modal').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  function tampilkanModalLoginMindHUB(onLoginSukses) {
    const overlay = buatOverlayModal('sipgn-auth-login-modal');
    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box ms-scroll" style="padding: 28px 24px; border-radius: 24px; width: 390px; max-width: 92vw; text-align: center;">
        <div style="width: 58px; height: 58px; margin: 0 auto 14px; border-radius: 18px; background: linear-gradient(135deg, rgba(56,189,248,0.22), rgba(168,85,247,0.25)); border: 1px solid rgba(56,189,248,0.45); display: flex; align-items: center; justify-content: center; font-size: 26px;">🔐</div>
        <h3 style="margin: 0 0 4px; font-size: 18px; font-weight: 800;">MindHUB Vault Auth</h3>
        <p style="margin: 0 0 18px; font-size: 12px; color: var(--ms-text-muted); line-height: 1.5;">Masuk dengan akun MindHUB Anda untuk membuka workspace terenkripsi.</p>

        <div style="text-align: left; margin-bottom: 12px;">
          <label style="display: block; font-size: 10px; font-weight: 700; color: #cbd5e1; margin-bottom: 5px; text-transform: uppercase;">Username</label>
          <input type="text" id="sipgn-login-username" class="ms-input" autocomplete="username" placeholder="username" />
        </div>

        <div style="text-align: left; margin-bottom: 12px;">
          <label style="display: block; font-size: 10px; font-weight: 700; color: #cbd5e1; margin-bottom: 5px; text-transform: uppercase;">Password</label>
          <input type="password" id="sipgn-login-password" class="ms-input" autocomplete="current-password" placeholder="••••••••" />
        </div>

        <div id="sipgn-login-feedback" style="font-size: 11px; color: var(--ms-rose); min-height: 16px; margin-bottom: 12px; text-align: left; font-weight: 600;"></div>

        <button id="sipgn-btn-submit-login" class="ms-btn ms-btn-aurora" style="width: 100%; padding: 12px; font-size: 13px;">🔑 Login Akun</button>

        <div style="margin-top: 14px; font-size: 11px; color: var(--ms-text-muted);">
          Belum punya akun? <a href="https://www.minduniverse.id/user" target="_blank" rel="noopener noreferrer" style="color: var(--ms-cyan); font-weight: 700; text-decoration: none;">Daftar di MindHUB →</a>
        </div>
      </div>
    `;
    bantuAppendKeBody(overlay);

    const inputUser = document.getElementById('sipgn-login-username');
    const inputPass = document.getElementById('sipgn-login-password');
    const feedbackEl = document.getElementById('sipgn-login-feedback');
    const btnSubmit = document.getElementById('sipgn-btn-submit-login');
    inputUser.focus();

    const prosesLogin = async () => {
      const userVal = inputUser.value.trim();
      const passVal = inputPass.value;
      if (!userVal || !passVal) {
        feedbackEl.textContent = 'Username dan password wajib diisi.';
        return;
      }
      btnSubmit.disabled = true;
      btnSubmit.textContent = '⏳ Memverifikasi akun...';
      feedbackEl.textContent = '';
      try {
        const resAuth = await loginMindHUB(userVal, passVal);
        if (resAuth.success) {
          feedbackEl.style.color = 'var(--ms-emerald)';
          feedbackEl.textContent = 'Login berhasil! Memuat workspace...';
          catatAktivitas(`Login berhasil sebagai @${userVal}`, 'success');
          setTimeout(() => { overlay.remove(); if (onLoginSukses) onLoginSukses(); }, 350);
        } else {
          feedbackEl.style.color = 'var(--ms-rose)';
          feedbackEl.textContent = resAuth.error;
          btnSubmit.disabled = false;
          btnSubmit.textContent = '🔑 Masuk ke Halaman Utama';
        }
      } catch (err) {
        feedbackEl.style.color = 'var(--ms-rose)';
        feedbackEl.textContent = typeof err === 'string' ? err : 'Terjadi kesalahan koneksi.';
        btnSubmit.disabled = false;
        btnSubmit.textContent = '🔑 Masuk ke Halaman Utama';
      }
    };

    btnSubmit.onclick = prosesLogin;
    inputPass.onkeydown = (e) => { if (e.key === 'Enter') prosesLogin(); };
    inputUser.onkeydown = (e) => { if (e.key === 'Enter') inputPass.focus(); };
  }

  function tampilkanLoadingScreen(onLanjutkan) {
    const overlay = buatOverlayModal('sipgn-splash-loading');
    const namaSppgLama = dapatkanNamaSPPG();
    const sapaan = namaSppgLama ? `Halo, ${namaSppgLama} 👋` : 'Mindspace Autofill';

    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box" style="padding: 32px 26px; border-radius: 24px; width: 370px; max-width: 90vw; text-align: center;">
        <div style="position: relative; width: 68px; height: 68px; margin: 0 auto 18px;">
          <div style="position: absolute; inset: 0; border: 3px solid rgba(56,189,248,0.18); border-top-color: var(--ms-cyan); border-right-color: var(--ms-violet); border-radius: 50%; animation: msSpin 1s linear infinite;"></div>
          <div style="width: 100%; height: 100%; border-radius: 50%; background: rgba(56,189,248,0.12); display: flex; align-items: center; justify-content: center; font-size: 28px;">⚡</div>
        </div>
        <div style="font-size: 19px; font-weight: 800; background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">SIPGN Autofill POP</div>
        <div style="font-size: 11px; color: var(--ms-text-muted); font-family: var(--ms-font-mono); margin-bottom: 14px;">v${CURRENT_VERSION}</br></br>${escapeHtml(sapaan)}</div>

        <div class="ms-bento" style="padding: 12px; margin-bottom: 18px;">
          <div id="sipgn-splash-status" style="font-size: 11.5px; font-weight: 600; color: #cbd5e1; margin-bottom: 8px;">Menginisialisasi Encrypted Vault...</div>
          <div style="width: 100%; height: 6px; background: rgba(9,14,28,0.85); border-radius: 99px; overflow: hidden;">
            <div id="sipgn-splash-bar" style="width: 15%; height: 100%; background: linear-gradient(90deg, #38bdf8, #818cf8, #c084fc); border-radius: 99px; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <button id="sipgn-btn-splash-lanjutkan" class="ms-btn ms-btn-aurora" style="display: none; width: 100%; padding: 12px; font-size: 13px;">🚀 Lanjutkan</button>
        <button id="sipgn-btn-splash-retry" class="ms-btn ms-btn-danger" style="display: none; width: 100%; padding: 12px; font-size: 13px;">🔄 Coba Lagi</button>
      </div>
    `;
    bantuAppendKeBody(overlay);

    const statusEl = document.getElementById('sipgn-splash-status');
    const barEl = document.getElementById('sipgn-splash-bar');
    const btnLanjut = document.getElementById('sipgn-btn-splash-lanjutkan');
    const btnRetry = document.getElementById('sipgn-btn-splash-retry');

    return {
      updateProgress: (persen, pesan) => {
        if (barEl) barEl.style.width = `${persen}%`;
        if (statusEl) statusEl.textContent = pesan;
      },
      siapLanjut: () => {
        if (barEl) barEl.style.width = '100%';
        if (statusEl) { statusEl.textContent = 'Vault Terverifikasi & Sistem Siap'; statusEl.style.color = 'var(--ms-emerald)'; }
        if (btnLanjut) {
          btnLanjut.style.display = 'inline-flex';
          btnLanjut.onclick = () => { overlay.remove(); if (onLanjutkan) onLanjutkan(); };
        }
      },
      tampilkanGagal: (pesanError) => {
        if (barEl) { barEl.style.width = '100%'; barEl.style.background = 'var(--ms-rose)'; }
        if (statusEl) { statusEl.textContent = pesanError || 'Gagal terhubung ke server'; statusEl.style.color = 'var(--ms-rose)'; }
        if (btnRetry) {
          btnRetry.style.display = 'inline-flex';
          btnRetry.onclick = () => { overlay.remove(); inialisasiSistem(); };
        }
      }
    };
  }

  function tampilkanModalWelcomeSPPG(onSelesai) {
    const overlay = buatOverlayModal('sipgn-welcome-sppg-modal');
    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box" style="padding: 28px 24px; border-radius: 24px; width: 420px; max-width: 92vw; text-align: center;">
        <div style="width: 56px; height: 56px; margin: 0 auto 14px; border-radius: 16px; background: rgba(56,189,248,0.14); border: 1px solid rgba(56,189,248,0.35); display: flex; align-items: center; justify-content: center; font-size: 26px;">🏢</div>
        <h3 style="margin: 0 0 6px; font-size: 18px; font-weight: 800;">Registrasi Awal Unit SPPG</h3>
        <p style="margin: 0 0 18px; font-size: 12px; color: var(--ms-text-muted); line-height: 1.5;">Masukkan nama unit SPPG Anda satu kali untuk sinkronisasi otomatis ke profil perangkat.</p>
        <div style="text-align: left; margin-bottom: 16px;">
          <label style="display: block; font-size: 10px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px; text-transform: uppercase;">Nama SPPG *</label>
          <input type="text" id="sipgn-input-nama-sppg" class="ms-input" placeholder="Contoh: SPPG MEDAN KOTA" />
          <div id="sipgn-sppg-error" style="color: var(--ms-rose); font-size: 11px; margin-top: 6px; display: none;">Nama SPPG wajib diisi.</div>
        </div>
        <button id="sipgn-btn-save-sppg" class="ms-btn ms-btn-aurora" style="width: 100%; padding: 12px; font-size: 13px;">🚀 Simpan & Lanjutkan</button>
      </div>
    `;
    bantuAppendKeBody(overlay);

    const inputSPPG = document.getElementById('sipgn-input-nama-sppg');
    const errText = document.getElementById('sipgn-sppg-error');
    inputSPPG.value = dapatkanNamaSPPG();
    inputSPPG.focus();

    document.getElementById('sipgn-btn-save-sppg').onclick = () => {
      const val = inputSPPG.value.trim();
      if (!val) { errText.style.display = 'block'; return; }
      simpanNamaSPPG(val);
      overlay.remove();
      if (onSelesai) onSelesai();
    };
  }

  function tampilkanModalKonfirmasiModern(judulText, pesanText, onKonfirmasi) {
    const overlay = buatOverlayModal('sipgn-confirm-modal');
    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box" style="padding: 24px; border-radius: 22px; width: 345px; max-width: 90vw; text-align: center;">
        <div style="font-size: 28px; margin-bottom: 10px;">⚠️</div>
        <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 800; color: var(--ms-amber);">${judulText}</h3>
        <p style="font-size: 12px; color: var(--ms-text-muted); margin: 0 0 18px; line-height: 1.5;">${pesanText}</p>
        <div style="display: flex; gap: 8px;">
          <button id="sipgn-btn-conf-no" class="ms-btn ms-btn-ghost" style="flex: 1; padding: 10px;">Batal</button>
          <button id="sipgn-btn-conf-yes" class="ms-btn ms-btn-primary" style="flex: 1; padding: 10px;">Ya, Lanjutkan</button>
        </div>
      </div>
    `;
    bantuAppendKeBody(overlay);
    document.getElementById('sipgn-btn-conf-yes').onclick = () => { overlay.remove(); onKonfirmasi(); };
    document.getElementById('sipgn-btn-conf-no').onclick = () => overlay.remove();
  }

  function tampilkanModalStatusSitus(judulText, pesanText, warnaTema = 'revoked') {
    const overlay = buatOverlayModal('sipgn-status-modal');
    const isHold = warnaTema === 'hold';
    const isExpired = warnaTema === 'expired';
    const devId = dapatkanDeviceID();

    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box ms-scroll" style="padding: 26px 22px; border-radius: 24px; width: 420px; max-width: 92vw; text-align: center;">
        <div style="font-size: 36px; margin-bottom: 10px;">${isHold ? '⏸️' : isExpired ? '⏰' : '🚫'}</div>
        <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 800; color: ${isHold ? 'var(--ms-amber)' : 'var(--ms-rose)'};">${judulText}</h3>
        <div class="ms-bento" style="padding: 12px; font-size: 12px; color: #cbd5e1; margin-bottom: 14px; text-align: left; line-height: 1.5;">${pesanText}</div>

        <div class="ms-bento" style="padding: 10px 12px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
          <div style="text-align: left;">
            <div style="font-size: 9.5px; color: var(--ms-text-muted); text-transform: uppercase; font-weight: 700;">Device ID</div>
            <div style="font-size: 12.5px; font-weight: 700; color: var(--ms-amber); font-family: var(--ms-font-mono);">${devId}</div>
          </div>
          <button id="sipgn-btn-copy-devid" class="ms-btn ms-btn-ghost" style="padding: 6px 10px;">📋 Salin</button>
        </div>

        ${isExpired ? `
          <div class="ms-bento" style="padding: 12px; margin-bottom: 14px; text-align: left;">
            <label style="display: block; font-size: 10px; font-weight: 700; color: var(--ms-cyan); margin-bottom: 6px; text-transform: uppercase;">Perpanjang Dengan Kode Voucher</label>
            <div style="display: flex; gap: 6px;">
              <input type="text" id="sipgn-expired-input-voucher" class="ms-input" placeholder="KODE VOUCHER" style="text-transform: uppercase; font-family: var(--ms-font-mono);" />
              <button id="sipgn-expired-btn-apply-voucher" class="ms-btn ms-btn-primary" style="padding: 0 14px;">Klaim</button>
            </div>
            <div id="sipgn-expired-voucher-feedback" style="font-size: 11px; min-height: 14px; margin-top: 6px; font-weight: 600;"></div>
          </div>
        ` : ''}

        <button id="sipgn-btn-reload-status" class="ms-btn ms-btn-ghost" style="width: 100%; padding: 11px;">🔄 Muat Ulang Halaman</button>
      </div>
    `;
    bantuAppendKeBody(overlay);

    const btnCopy = document.getElementById('sipgn-btn-copy-devid');
    if (btnCopy) {
      btnCopy.onclick = () => {
        navigator.clipboard.writeText(devId);
        tampilkanToast('Device ID disalin ke clipboard', 'success');
      };
    }

    if (isExpired) {
      const inputVoucher = document.getElementById('sipgn-expired-input-voucher');
      const btnApply = document.getElementById('sipgn-expired-btn-apply-voucher');
      const feedback = document.getElementById('sipgn-expired-voucher-feedback');
      btnApply.onclick = async () => {
        const kode = inputVoucher.value.trim().toUpperCase();
        if (!kode) { feedback.textContent = 'Masukkan kode voucher.'; feedback.style.color = 'var(--ms-rose)'; return; }
        btnApply.disabled = true; btnApply.textContent = '...';
        try {
          const res = await klaimVoucherVercel(kode);
          if (res.success) {
            overlay.remove();
            eksekusiSuksesPembayaran(0, devId, res.exp_date);
          } else {
            feedback.textContent = res.error || 'Voucher tidak valid.';
            feedback.style.color = 'var(--ms-rose)';
            btnApply.disabled = false; btnApply.textContent = 'Klaim';
          }
        } catch (e) {
          feedback.textContent = 'Gagal menghubungi server.';
          feedback.style.color = 'var(--ms-rose)';
          btnApply.disabled = false; btnApply.textContent = 'Klaim';
        }
      };
    }

    document.getElementById('sipgn-btn-reload-status').onclick = () => location.reload();
  }

  function klaimVoucherVercel(kodeVoucher) {
    return new Promise((resolve, reject) => {
      const token = dapatkanAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      GM_xmlhttpRequest({
        method: 'POST',
        url: getVercelApiUrl(),
        headers,
        data: JSON.stringify({
          action: 'claim_voucher',
          voucher_code: kodeVoucher,
          device_id: dapatkanDeviceID(),
          user_id: dapatkanUserIdAktif()
        }),
        onload: (res) => { try { resolve(JSON.parse(res.responseText)); } catch (e) { reject('Respon tidak valid'); } },
        onerror: () => reject('Gagal terhubung')
      });
    });
  }

  function klaimFreeTrialVercel() {
    return new Promise((resolve, reject) => {
      const token = dapatkanAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      GM_xmlhttpRequest({
        method: 'POST',
        url: getVercelApiUrl(),
        headers,
        data: JSON.stringify({
          action: 'claim_trial',
          device_id: dapatkanDeviceID(),
          user_id: dapatkanUserIdAktif(),
          sppg_name: dapatkanNamaSPPG()
        }),
        onload: (res) => { try { resolve(JSON.parse(res.responseText)); } catch (e) { reject('Respon tidak valid'); } },
        onerror: () => reject('Gagal terhubung')
      });
    });
  }

  function eksekusiSuksesPembayaran(jumlahHari, devId, expDateFromBackend = null) {
    let expDateTarget = expDateFromBackend;
    if (!expDateTarget) {
      let baseDate = new Date();
      if (currentDatabaseExpDate) {
        const expObj = new Date(currentDatabaseExpDate + 'T00:00:00');
        if (expObj > baseDate) baseDate = expObj;
      }
      baseDate.setDate(baseDate.getDate() + jumlahHari);
      expDateTarget = baseDate.toISOString().slice(0, 10);
    }
    currentDatabaseExpDate = expDateTarget;
    secureSetGM(LICENSE_STORAGE_KEY, buatLicenseKey(expDateTarget, devId, 'AutoPayment'));
    tampilkanToast(`Lisensi aktif hingga ${formatTanggalIndo(expDateTarget)}!`, 'success', 4500);
    mulaiJalankanSkrip();
  }

  /* ============================================================================
   * 7. ENCRYPTED DATA KPM VAULT, CSV IMPORT/EXPORT & BACKUP CLOUD/LOKAL
   * ============================================================================ */
  const DATA_AWAL = [
    {
      sekolah: 'SMAN 1 MEDAN',
      ritase: '1',
      batasWaktu: '10:00',
      porsiBesar: '5',
      porsiKecil: '5',
      porsiBalita: '',
      porsiIbuMenyusui: '',
      porsiIbuHamil: '',
      namaKurir: 'BUDIAWAN SUTARJO',
      platNomor: 'BK1234ABC',
      jamKeberangkatan: '10:00',
      jamTibaTujuan: '10:30',
      jamJadwalPengambilan: '11:00',
      jamOmprengKembaliSPPG: '12:00',
      jamMulaiCuci: '12:30',
      terpakai: false,
      statusProses: 'belum',
    },
  ];

  function muatData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [...DATA_AWAL];
      const decoded = raw.startsWith('MSV1:') ? _0xVault.dec(raw) : raw;
      const data = decoded ? JSON.parse(decoded) : [...DATA_AWAL];
      return data.map((d) => ({
        terpakai: false,
        statusProses: d.statusProses || (d.terpakai ? 'pengantaran' : 'belum'),
        jamKeberangkatan: '',
        jamTibaTujuan: '',
        jamJadwalPengambilan: '',
        jamOmprengKembaliSPPG: '',
        jamMulaiCuci: '',
        porsiBalita: '',
        porsiIbuMenyusui: '',
        porsiIbuHamil: '',
        ...d,
      }));
    } catch (e) {
      return [...DATA_AWAL];
    }
  }

  function simpanData(data) {
    try {
      const cipher = _0xVault.enc(JSON.stringify(data));
      localStorage.setItem(STORAGE_KEY, cipher);
    } catch (e) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }

  let dataPenugasan = muatData();
  let indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;

  function pilihKPMBelumBerikutnya() {
    if (dataPenugasan.length === 0) return;
    const startIdx = indexTerpilih >= 0 ? indexTerpilih : -1;
    for (let offset = 1; offset <= dataPenugasan.length; offset++) {
      const idx = (startIdx + offset) % dataPenugasan.length;
      if (dataPenugasan[idx].statusProses === 'belum') {
        indexTerpilih = idx;
        renderPanel();
        tampilkanToast(`Antrean berikutnya: <b>${escapeHtml(dataPenugasan[idx].sekolah)}</b>`, 'info');
        return;
      }
    }
    tampilkanToast('Semua KPM sudah diproses!', 'success');
  }

  function hitungTotalPorsi(data) {
    return (
      Number(data.porsiBesar || 0) +
      Number(data.porsiKecil || 0) +
      Number(data.porsiBalita || 0) +
      Number(data.porsiIbuMenyusui || 0) +
      Number(data.porsiIbuHamil || 0)
    );
  }

  function jenisKPM(data) {
    return (data.porsiBalita || data.porsiIbuMenyusui || data.porsiIbuHamil) ? 'posyandu' : 'sekolah';
  }

  function exportCSVData() {
    const headers = [
      'sekolah', 'ritase', 'batasWaktu', 'porsiBesar', 'porsiKecil',
      'porsiBalita', 'porsiIbuMenyusui', 'porsiIbuHamil', 'namaKurir', 'platNomor',
      'jamKeberangkatan', 'jamTibaTujuan', 'jamJadwalPengambilan', 'jamOmprengKembaliSPPG', 'jamMulaiCuci', 'statusProses'
    ];
    const rows = dataPenugasan.map((d) =>
      headers.map((h) => `"${String(d[h] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sipgn-kpm-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    catatAktivitas(`Export ${dataPenugasan.length} KPM ke CSV`, 'info');
    tampilkanToast('File CSV berhasil diunduh!', 'success');
  }

  function importCSVData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '').trim();
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) throw new Error('File CSV kosong atau hanya berisi header.');

        const parseLine = (line) => {
          const result = [];
          let cur = '', inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
              else inQuotes = !inQuotes;
            } else if ((ch === ',' || ch === ';') && !inQuotes) {
              result.push(cur.trim());
              cur = '';
            } else {
              cur += ch;
            }
          }
          result.push(cur.trim());
          return result;
        };

        const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
        const idxMap = (keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));

        const iSekolah = idxMap(['sekolah', 'kpm', 'nama']);
        if (iSekolah === -1) throw new Error('Kolom "sekolah" atau "nama" tidak ditemukan di CSV.');

        const imported = [];
        for (let r = 1; r < lines.length; r++) {
          const cols = parseLine(lines[r]);
          const getVal = (keys, def = '') => {
            const idx = idxMap(keys);
            return idx !== -1 && cols[idx] !== undefined ? cols[idx] : def;
          };
          const namaSekolah = cols[iSekolah];
          if (!namaSekolah) continue;

          imported.push({
            sekolah: namaSekolah,
            ritase: getVal(['ritase'], '1'),
            batasWaktu: getVal(['batas', 'waktu'], '10:00'),
            porsiBesar: getVal(['besar'], '0'),
            porsiKecil: getVal(['kecil'], '0'),
            porsiBalita: getVal(['balita'], ''),
            porsiIbuMenyusui: getVal(['menyusui'], ''),
            porsiIbuHamil: getVal(['hamil'], ''),
            namaKurir: getVal(['kurir', 'driver'], ''),
            platNomor: getVal(['plat', 'nopol'], ''),
            jamKeberangkatan: getVal(['berangkat'], ''),
            jamTibaTujuan: getVal(['tiba'], ''),
            jamJadwalPengambilan: getVal(['jadwal', 'ambil'], ''),
            jamOmprengKembaliSPPG: getVal(['kembali'], ''),
            jamMulaiCuci: getVal(['cuci'], ''),
            terpakai: false,
            statusProses: 'belum'
          });
        }

        if (imported.length === 0) throw new Error('Tidak ada baris KPM valid di dalam CSV.');
        dataPenugasan = [...dataPenugasan, ...imported];
        if (indexTerpilih === -1) indexTerpilih = 0;
        simpanData(dataPenugasan);
        renderPanel();
        catatAktivitas(`Import ${imported.length} KPM dari CSV`, 'success');
        tampilkanToast(`Berhasil menambahkan ${imported.length} KPM dari CSV!`, 'success');
      } catch (err) {
        tampilkanToast(`Import CSV gagal: ${err.message}`, 'error', 4000);
      }
    };
    reader.readAsText(file);
  }

  function syncBackupToDatabase(dataBackup) {
    const token = dapatkanAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    GM_xmlhttpRequest({
      method: 'POST',
      url: getVercelApiUrl(),
      headers,
      data: JSON.stringify({
        action: 'save_backup',
        device_id: dapatkanDeviceID(),
        user_id: dapatkanUserIdAktif(),
        backup_data: dataBackup,
        auto_delete_days: 3
      }),
      onload: () => tampilkanToast('Backup tersinkron ke Cloud Database!', 'success'),
      onerror: () => tampilkanToast('Backup lokal tersimpan, gagal sinkron Cloud.', 'warning')
    });
  }

  function downloadBackupData() {
    const backup = {
      Application: 'SIPGN POP - Autofill',
      Version: CURRENT_VERSION,
      Developed: 'Mindspace Studio',
      dibuatPada: new Date().toISOString(),
      dataKPM: dataPenugasan,
    };
    syncBackupToDatabase(backup);
    catatAktivitas('Backup data KPM ke Cloud & JSON', 'info');

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sipgn-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function importBackupData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const isi = JSON.parse(String(reader.result || ''));
        const dataImpor = Array.isArray(isi) ? isi : isi?.dataKPM;
        if (!Array.isArray(dataImpor)) throw new Error('Format JSON tidak valid.');
        dataPenugasan = dataImpor.map((d) => ({
          terpakai: false,
          statusProses: d.statusProses || 'belum',
          jamKeberangkatan: '',
          jamTibaTujuan: '',
          jamJadwalPengambilan: '',
          jamOmprengKembaliSPPG: '',
          jamMulaiCuci: '',
          porsiBalita: '',
          porsiIbuMenyusui: '',
          porsiIbuHamil: '',
          ...d,
        }));
        indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;
        simpanData(dataPenugasan);
        renderPanel();
        catatAktivitas(`Restore ${dataPenugasan.length} KPM dari JSON`, 'success');
        tampilkanToast(`Berhasil import ${dataPenugasan.length} data KPM!`, 'success');
      } catch (e) {
        tampilkanToast(`Import gagal: ${e.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  function importCloudData() {
    const token = dapatkanAuthToken();
    const headers = { 'Cache-Control': 'no-cache, no-store' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    GM_xmlhttpRequest({
      method: 'GET',
      url: `${getVercelApiUrl()}?action=get_backup&device_id=${encodeURIComponent(dapatkanDeviceID())}&_t=${Date.now()}`,
      headers,
      onload: (res) => {
        try {
          const resp = JSON.parse(res.responseText);
          const dataImpor = resp.backup_data?.dataKPM || resp.dataKPM || (Array.isArray(resp) ? resp : null);
          if (!Array.isArray(dataImpor)) throw new Error('Backup cloud kosong atau sudah kadaluarsa.');
          dataPenugasan = dataImpor.map((d) => ({
            terpakai: false,
            statusProses: d.statusProses || 'belum',
            ...d,
          }));
          indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;
          simpanData(dataPenugasan);
          renderPanel();
          catatAktivitas(`Pulihkan ${dataPenugasan.length} KPM dari Cloud`, 'success');
          tampilkanToast(`Berhasil pulihkan ${dataPenugasan.length} data KPM dari Cloud!`, 'success');
        } catch (e) {
          tampilkanToast(e.message, 'error');
        }
      },
      onerror: () => tampilkanToast('Gagal menghubungi Cloud Database.', 'error')
    });
  }

  function tampilkanModalFormKPM(dataEdit = null, indexTarget = null) {
    const overlay = buatOverlayModal('sipgn-kpm-form-modal');
    const isEdit = dataEdit !== null;

    const field = (label, id, ph, val = '') => `
      <div>
        <label style="display:block; font-size:10px; font-weight:700; color:#94a3b8; margin-bottom:4px; text-transform:uppercase;">${label}</label>
        <input id="${id}" class="ms-input" placeholder="${ph}" value="${escapeHtml(val)}" />
      </div>
    `;

    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box ms-scroll" style="padding: 22px; border-radius: 24px; width: 720px; max-width: 94vw; max-height: 90vh; overflow-y: auto; text-align: left;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--ms-border);">
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:800;">${isEdit ? '✏️ Edit Data KPM' : '✨ Tambah Data KPM Baru'}</h3>
            <div style="font-size:11px; color:var(--ms-text-muted);">Atur detail porsi, armada kurir, dan jadwal distribusi ompreng.</div>
          </div>
          <button id="ms-close-kpm-modal" class="ms-btn ms-btn-ghost" style="width:30px; height:30px; border-radius:50%; padding:0;">✕</button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 11px;">
          ${field('Nama Sekolah / KPM *', 'sipgn-in-sekolah', 'SMAN 1 MEDAN', dataEdit?.sekolah)}
          ${field('Ritase', 'sipgn-in-ritase', '1', dataEdit?.ritase || '1')}
          ${field('Batas Waktu (HH:MM)', 'sipgn-in-batasWaktu', '10:00', dataEdit?.batasWaktu || '10:00')}
          ${field('Nama Kurir', 'sipgn-in-namaKurir', 'BUDIAWAN SUTARJO', dataEdit?.namaKurir)}
          ${field('Plat Nomor Kendaraan', 'sipgn-in-platNomor', 'BK1234ABC', dataEdit?.platNomor)}

          ${field('Porsi Besar (Sekolah)', 'sipgn-in-porsiBesar', '0', dataEdit?.porsiBesar)}
          ${field('Porsi Kecil (Sekolah)', 'sipgn-in-porsiKecil', '0', dataEdit?.porsiKecil)}
          ${field('Porsi Balita (Posyandu)', 'sipgn-in-porsiBalita', '0', dataEdit?.porsiBalita)}
          ${field('Porsi Ibu Menyusui', 'sipgn-in-porsiIbuMenyusui', '0', dataEdit?.porsiIbuMenyusui)}
          ${field('Porsi Ibu Hamil', 'sipgn-in-porsiIbuHamil', '0', dataEdit?.porsiIbuHamil)}

          ${field('Jam Keberangkatan', 'sipgn-in-jamKeberangkatan', '10:00', dataEdit?.jamKeberangkatan)}
          ${field('Jam Tiba Tujuan', 'sipgn-in-jamTibaTujuan', '10:30', dataEdit?.jamTibaTujuan)}
          ${field('Jadwal Ambil Ompreng', 'sipgn-in-jamJadwalPengambilan', '11:00', dataEdit?.jamJadwalPengambilan)}
          ${field('Ompreng Kembali SPPG', 'sipgn-in-jamOmprengKembaliSPPG', '12:00', dataEdit?.jamOmprengKembaliSPPG)}
          ${field('Jam Mulai Pencucian', 'sipgn-in-jamMulaiCuci', '12:30', dataEdit?.jamMulaiCuci)}
        </div>

        <div style="margin-top:18px; display:flex; gap:8px;">
          <button id="ms-cancel-kpm-modal" class="ms-btn ms-btn-ghost" style="flex:1; padding:11px;">Batal</button>
          <button id="sipgn-btn-save-kpm-modal" class="ms-btn ms-btn-emerald" style="flex:2; padding:11px; font-size:12.5px;">${isEdit ? '💾 Simpan Perubahan' : '🚀 Simpan Data KPM'}</button>
        </div>
      </div>
    `;
    bantuAppendKeBody(overlay);

    document.getElementById('ms-close-kpm-modal').onclick = () => overlay.remove();
    document.getElementById('ms-cancel-kpm-modal').onclick = () => overlay.remove();
    document.getElementById('sipgn-btn-save-kpm-modal').onclick = () => {
      const ambil = (id) => document.getElementById(id)?.value.trim() || '';
      const sekolah = ambil('sipgn-in-sekolah');
      if (!sekolah) { tampilkanToast('Nama Sekolah / KPM wajib diisi!', 'warning'); return; }

      const dataForm = {
        sekolah,
        ritase: ambil('sipgn-in-ritase'),
        batasWaktu: ambil('sipgn-in-batasWaktu'),
        porsiBesar: ambil('sipgn-in-porsiBesar'),
        porsiKecil: ambil('sipgn-in-porsiKecil'),
        porsiBalita: ambil('sipgn-in-porsiBalita'),
        porsiIbuMenyusui: ambil('sipgn-in-porsiIbuMenyusui'),
        porsiIbuHamil: ambil('sipgn-in-porsiIbuHamil'),
        namaKurir: ambil('sipgn-in-namaKurir'),
        platNomor: ambil('sipgn-in-platNomor'),
        jamKeberangkatan: ambil('sipgn-in-jamKeberangkatan'),
        jamTibaTujuan: ambil('sipgn-in-jamTibaTujuan'),
        jamJadwalPengambilan: ambil('sipgn-in-jamJadwalPengambilan'),
        jamOmprengKembaliSPPG: ambil('sipgn-in-jamOmprengKembaliSPPG'),
        jamMulaiCuci: ambil('sipgn-in-jamMulaiCuci'),
        terpakai: isEdit ? dataPenugasan[indexTarget].terpakai : false,
        statusProses: isEdit ? (dataPenugasan[indexTarget].statusProses || 'belum') : 'belum'
      };

      if (isEdit && indexTarget !== null) {
        dataPenugasan[indexTarget] = dataForm;
        indexTerpilih = indexTarget;
        catatAktivitas(`Edit data KPM: ${sekolah}`, 'info');
        tampilkanToast(`Data "${sekolah}" diperbarui!`, 'success');
      } else {
        dataPenugasan.push(dataForm);
        indexTerpilih = dataPenugasan.length - 1;
        catatAktivitas(`Tambah KPM baru: ${sekolah}`, 'success');
        tampilkanToast(`KPM "${sekolah}" ditambahkan!`, 'success');
      }

      simpanData(dataPenugasan);
      overlay.remove();
      renderPanel();
    };
  }

  /* ============================================================================
   * 8. ENGINE AUTOFILL DOM & REACT/SPA INPUT INJECTION
   * ============================================================================ */
  function cekHalamanTugasBaru() {
    return location.pathname.includes('/distribution/new');
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getRandomDelay(min = 350, max = 800) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async function smartWait(minMs = 350, maxMs = 800) {
    const level = dapatkanTypingSpeedLevel();
    if (level === '0') { await wait(45); return; }
    const factor = level === '25' ? 0.5 : level === '75' ? 1.5 : 1.0;
    await wait(getRandomDelay(Math.floor(minMs * factor), Math.floor(maxMs * factor)));
  }

  function setNativeValue(element, value) {
    if (!element) return;
    const proto = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function setNativeValueHuman(element, value, charDelayMin = 30, charDelayMax = 70) {
    if (!element) return;
    try { element.focus(); element.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}

    const speedLevel = dapatkanTypingSpeedLevel();
    const valStr = String(value);

    if (speedLevel === '0') {
      setNativeValue(element, valStr);
      await wait(45);
      try { element.dispatchEvent(new Event('blur', { bubbles: true })); } catch (e) {}
      return;
    }

    const multiplier = speedLevel === '25' ? 0.4 : speedLevel === '75' ? 1.6 : 1.0;
    const minDelay = Math.max(10, Math.floor(charDelayMin * multiplier));
    const maxDelay = Math.max(20, Math.floor(charDelayMax * multiplier));

    const proto = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(element, '');
    element.dispatchEvent(new Event('input', { bubbles: true }));

    let currentVal = '';
    for (let i = 0; i < valStr.length; i++) {
      const char = valStr[i];
      currentVal += char;
      const keyOpts = { key: char, char: char, keyCode: char.charCodeAt(0), bubbles: true, cancelable: true };
      element.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
      element.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
      setter.call(element, currentVal);
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
      element.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
      await wait(getRandomDelay(minDelay, maxDelay));
    }
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(Math.floor(90 * multiplier));
    try { element.dispatchEvent(new Event('blur', { bubbles: true })); } catch (e) {}
  }

  async function tungguElemen(cariFn, maxTunggu = 5000, interval = 200) {
    const batas = Date.now() + maxTunggu;
    while (Date.now() < batas) {
      const hasil = cariFn();
      if (hasil) return hasil;
      await wait(interval);
    }
    return null;
  }

  function aturCheckboxKurirMBG() {
    const isAuto = dapatkanAutoKurirMBG();
    const semuaCheckbox = [...document.querySelectorAll('input[type="checkbox"]')].filter(
      (cb) => !cb.closest('#sipgn-autofill-panel')
    );
    const checkboxKurir = semuaCheckbox.find((cb) => {
      const parentText = (cb.closest('label') || cb.parentElement || document.body).innerText || '';
      return parentText.includes('Aplikasi Kurir MBG') || parentText.includes('Kurir MBG');
    }) || semuaCheckbox[0];

    if (checkboxKurir && checkboxKurir.checked !== isAuto) {
      checkboxKurir.checked = isAuto;
      checkboxKurir.dispatchEvent(new Event('change', { bubbles: true }));
      checkboxKurir.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return isAuto;
  }

  async function isiLokasiKPM(namaSekolah) {
    const input = document.querySelector('input[placeholder*="Cari nama KPM"]');
    if (!input) return false;
    await setNativeValueHuman(input, namaSekolah, 25, 55);
    const tombolOpsi = await tungguElemen(() =>
      [...document.querySelectorAll('button')].find((btn) => btn.textContent.includes(namaSekolah))
    );
    if (!tombolOpsi) return false;
    await smartWait(300, 550);
    tombolOpsi.click();
    return true;
  }

  async function isiRitase(nilai) {
    for (let i = 0; i < 4; i++) {
      const input = document.querySelector('input[placeholder="Contoh: 1"]');
      if (!input) { await wait(350); continue; }
      await setNativeValueHuman(input, nilai, 25, 60);
      await smartWait(250, 500);
      if (String(input.value) === String(nilai)) return true;
    }
    return false;
  }

  function isiBatasWaktu(nilai) {
    const input = document.querySelector('input[type="time"]');
    if (input) setNativeValue(input, nilai);
  }

  function cariInputPorsiKategori(namaKategori) {
    const judul = [...document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5')].find(
      (el) => el.children.length === 0 && el.textContent.trim() === namaKategori
    );
    if (!judul) return null;
    let kontainer = judul.parentElement;
    for (let i = 0; i < 6 && kontainer; i++) {
      const input = kontainer.querySelector('input[type="number"][placeholder="Masukkan jumlah porsi"]') || kontainer.querySelector('input[type="number"]');
      if (input) return input;
      kontainer = kontainer.parentElement;
    }
    return null;
  }

  async function isiPorsi(data) {
    const kategori = [
      { nama: 'Porsi Besar', nilai: data.porsiBesar },
      { nama: 'Porsi Kecil', nilai: data.porsiKecil },
      { nama: 'Balita', nilai: data.porsiBalita },
      { nama: 'Ibu Menyusui', nilai: data.porsiIbuMenyusui },
      { nama: 'Ibu Hamil', nilai: data.porsiIbuHamil },
    ];
    let terisi = 0;
    for (const k of kategori) {
      const input = cariInputPorsiKategori(k.nama);
      if (!input) continue;
      await setNativeValueHuman(input, k.nilai || '0', 25, 55);
      terisi++;
    }
    if (terisi === 0) {
      const inputs = [...document.querySelectorAll('input[type="number"]')].filter((inp) => !inp.closest('#sipgn-autofill-panel'));
      if (inputs.length >= 2) {
        await setNativeValueHuman(inputs[0], data.porsiBesar || '0', 25, 55);
        await setNativeValueHuman(inputs[1], data.porsiKecil || '0', 25, 55);
      }
    }
    return true;
  }

  async function isiKurirDanPlat(namaKurir, platNomor) {
    const semuaInput = [...document.querySelectorAll('input')].filter(
      (inp) => !inp.closest('#sipgn-autofill-panel') && inp.type !== 'hidden' && inp.type !== 'checkbox'
    );

    let inputKurir = semuaInput.find((inp) => {
      const s = `${inp.placeholder} ${inp.name} ${inp.id}`.toLowerCase();
      return s.includes('kurir') || s.includes('driver');
    });

    if (!inputKurir) {
      const labelKurir = [...document.querySelectorAll('label')].find((l) => !l.closest('#sipgn-autofill-panel') && /kurir|driver|pengemudi/i.test(l.textContent));
      if (labelKurir) inputKurir = labelKurir.querySelector('input') || labelKurir.parentElement?.querySelector('input');
    }

    let inputPlat = semuaInput.find((inp) => {
      const s = `${inp.placeholder} ${inp.name} ${inp.id}`.toLowerCase();
      return s.includes('1234') || s.includes('plat') || s.includes('nopol') || s.includes('kendaraan');
    });

    if (!inputPlat) {
      const labelPlat = [...document.querySelectorAll('label')].find((l) => !l.closest('#sipgn-autofill-panel') && /plat|nopol|kendaraan|polisi/i.test(l.textContent));
      if (labelPlat) inputPlat = labelPlat.querySelector('input') || labelPlat.parentElement?.querySelector('input');
    }

    if (inputKurir && namaKurir) { await setNativeValueHuman(inputKurir, namaKurir, 20, 50); await smartWait(180, 350); }
    if (inputPlat && platNomor) { await setNativeValueHuman(inputPlat, platNomor, 20, 50); await smartWait(180, 350); }
  }

  async function isiPenugasan(index) {
    const data = dataPenugasan[index];
    if (!data) return;

    tampilkanToast(`Mengisi penugasan: <b>${escapeHtml(data.sekolah)}</b>...`, 'info', 2500);
    await isiLokasiKPM(data.sekolah);
    await smartWait(450, 750);
    await isiRitase(data.ritase);
    await smartWait(300, 500);
    isiBatasWaktu(data.batasWaktu);
    await smartWait(200, 400);
    await isiPorsi(data);
    await smartWait(300, 550);
    aturCheckboxKurirMBG();
    await smartWait(200, 400);
    await isiKurirDanPlat(data.namaKurir, data.platNomor);

    dataPenugasan[index].terpakai = true;
    dataPenugasan[index].statusProses = 'pengantaran';
    simpanData(dataPenugasan);
    catatAktivitas(`Isi penugasan: ${data.sekolah} (${hitungTotalPorsi(data)} porsi)`, 'success');
    renderPanel();
    tampilkanToast(`Penugasan <b>${escapeHtml(data.sekolah)}</b> selesai diisi!`, 'success');
  }

  /* Time Picker Automation */
  function cariTriggerWaktuKeberangkatan(namaField = 'Waktu Keberangkatan') {
    const label = [...document.querySelectorAll('label')].find((el) => {
      const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
      return txt === namaField || txt.includes(namaField);
    });
    if (label?.parentElement) {
      const dariLabel = [...label.parentElement.querySelectorAll('div.flex.w-full.cursor-pointer')][0];
      if (dariLabel) return dariLabel;
    }
    return [...document.querySelectorAll('button, div')].find((el) => {
      if (el.offsetParent === null) return false;
      return /^\d{2}\/\d{2}\/\d{4},\s*\d{2}\.\d{2}$/.test(el.textContent.replace(/\s+/g, ' ').trim());
    }) || null;
  }

  function cariKolomSpinner(label) {
    const labelNormal = label.toLowerCase();
    const labelEl = [...document.querySelectorAll('p, span')].find((el) => el.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === labelNormal);
    if (!labelEl) return null;
    let kolom = labelEl.parentElement;
    while (kolom && kolom !== document.body) {
      if (kolom.querySelectorAll(':scope > button').length >= 2) return kolom;
      kolom = kolom.parentElement;
    }
    return labelEl.parentElement;
  }

  function bacaNilaiAktif(kolom) {
    const aktif = [...kolom.querySelectorAll('div')].find(
      (div) => div.className.includes('font-bold') && div.className.includes('text-white') && /^\d+$/.test(div.textContent.trim())
    );
    return aktif ? parseInt(aktif.textContent.trim(), 10) : null;
  }

  async function setSpinnerValue(labelKolom, target) {
    const kolom = cariKolomSpinner(labelKolom);
    if (!kolom) return false;
    const tombol = [...kolom.querySelectorAll('button')].filter((b) => b.offsetParent !== null && !b.disabled);
    if (tombol.length < 2) return false;
    const [tombolAtas, tombolBawah] = [tombol[0], tombol[tombol.length - 1]];

    let sekarang = bacaNilaiAktif(kolom);
    if (sekarang === null) return false;
    if (sekarang === target) return true;

    const putaran = labelKolom === 'Jam' ? 24 : 60;
    const naik = (target - sekarang + putaran) % putaran;
    const turun = (sekarang - target + putaran) % putaran;
    const klik = Math.min(naik, turun);
    const btn = naik <= turun ? tombolBawah : tombolAtas;

    for (let i = 0; i < klik; i++) {
      btn.click();
      await wait(getRandomDelay(30, 65));
    }
    await wait(60);
    return bacaNilaiAktif(kolom) === target;
  }

  async function aturWaktuKeberangkatan(jamMenitStr, namaField = 'Waktu Keberangkatan') {
    if (!jamMenitStr || !/^\d{1,2}:\d{2}$/.test(jamMenitStr)) return false;
    const [jamTarget, menitTarget] = jamMenitStr.split(':').map(Number);

    let kolomJam = cariKolomSpinner('Jam');
    if (!kolomJam) {
      const trigger = cariTriggerWaktuKeberangkatan(namaField);
      if (!trigger) return false;
      trigger.click();
      kolomJam = await tungguElemen(() => cariKolomSpinner('Jam'), 1800, 100);
      if (!kolomJam) return false;
    }

    await setSpinnerValue('Jam', jamTarget);
    await smartWait(120, 250);
    await setSpinnerValue('Menit', menitTarget);
    await smartWait(150, 300);

    const dialog = kolomJam.closest('[role="dialog"], [aria-modal="true"]') || kolomJam.parentElement?.parentElement;
    if (dialog) {
      const tombolSimpan = [...dialog.querySelectorAll('button')].find((btn) =>
        !btn.disabled && btn.offsetParent !== null && /^(simpan|terapkan|konfirmasi|selesai|ok)\b/i.test(btn.textContent.trim())
      );
      if (tombolSimpan) {
        tombolSimpan.click();
        await wait(300);
      }
    }
    return true;
  }

  async function isiPengambilanOmpreng(index) {
    const data = dataPenugasan[index];
    if (!data) return false;
    aturCheckboxKurirMBG();
    await smartWait(200, 400);
    const jumlahOmpreng = hitungTotalPorsi(data);
    const inputJumlah = [...document.querySelectorAll('input')].find(
      (inp) => !inp.closest('#sipgn-autofill-panel') && (inp.type === 'number' || /jumlah|ompreng/i.test(`${inp.placeholder} ${inp.name}`))
    );
    if (inputJumlah) await setNativeValueHuman(inputJumlah, String(jumlahOmpreng), 30, 65);
    await isiKurirDanPlat(data.namaKurir, data.platNomor);
    const hasil = await aturWaktuKeberangkatan(data.jamJadwalPengambilan, 'Waktu Dijadwalkan Pengambilan');
    if (hasil) {
      dataPenugasan[index].statusProses = 'pengembalian';
      simpanData(dataPenugasan);
      catatAktivitas(`Isi pengambilan ompreng: ${data.sekolah}`, 'success');
      renderPanel();
    }
    return hasil;
  }

  async function isiMulaiPencucian(index) {
    const data = dataPenugasan[index];
    if (!data) return false;
    const inputJumlah = document.querySelector('input[placeholder="Contoh: 25"]');
    if (inputJumlah) await setNativeValueHuman(inputJumlah, String(hitungTotalPorsi(data)), 30, 65);
    const hasil = await aturWaktuKeberangkatan(data.jamMulaiCuci, 'Waktu Mulai Cuci');
    if (hasil) {
      dataPenugasan[index].statusProses = 'pencucian';
      simpanData(dataPenugasan);
      catatAktivitas(`Isi mulai pencucian: ${data.sekolah}`, 'success');
      renderPanel();
    }
    return hasil;
  }

  async function jalankanAutoSequenceHalaman() {
    const kpmAktif = indexTerpilih >= 0 ? dataPenugasan[indexTerpilih] : null;
    if (!kpmAktif) { tampilkanToast('Pilih data KPM terlebih dahulu.', 'warning'); return; }

    const cekLabel = (kata) => [...document.querySelectorAll('label')].some((el) => !el.closest('#sipgn-autofill-panel') && el.textContent.includes(kata));
    let langkahDijalankan = 0;

    if (cekHalamanTugasBaru()) {
      await isiPenugasan(indexTerpilih);
      langkahDijalankan++;
    }
    if (cekLabel('Waktu Keberangkatan')) {
      const ok = await aturWaktuKeberangkatan(kpmAktif.jamKeberangkatan, 'Waktu Keberangkatan');
      if (ok) { kpmAktif.statusProses = 'pengantaran'; simpanData(dataPenugasan); langkahDijalankan++; }
    }
    if (cekLabel('Waktu Diterima di Tujuan')) {
      const ok = await aturWaktuKeberangkatan(kpmAktif.jamTibaTujuan, 'Waktu Diterima di Tujuan');
      if (ok) langkahDijalankan++;
    }
    if (cekLabel('Waktu Ompreng Kembali di SPPG')) {
      const ok = await aturWaktuKeberangkatan(kpmAktif.jamOmprengKembaliSPPG, 'Waktu Ompreng Kembali di SPPG');
      if (ok) { kpmAktif.statusProses = 'pengembalian'; simpanData(dataPenugasan); langkahDijalankan++; }
    }
    if ((cekLabel('Jumlah Ompreng') || cekLabel('Waktu Dijadwalkan Pengambilan')) && !cekLabel('Dicuci') && !cekLabel('Waktu Keberangkatan')) {
      const ok = await isiPengambilanOmpreng(indexTerpilih);
      if (ok) langkahDijalankan++;
    }
    if (cekLabel('Jumlah Ompreng Dicuci') || cekLabel('Waktu Mulai Cuci')) {
      const ok = await isiMulaiPencucian(indexTerpilih);
      if (ok) langkahDijalankan++;
    }

    if (langkahDijalankan > 0) {
      catatAktivitas(`Auto-Sequence menjalankan ${langkahDijalankan} aksi`, 'success');
      tampilkanToast(`Auto-Sequence selesai (${langkahDijalankan} aksi dieksekusi)!`, 'success');
      renderPanel();
    } else {
      tampilkanToast('Tidak ada formulir aktif yang terdeteksi di halaman ini.', 'warning');
    }
  }

  /* ============================================================================
   * 9. ULTRA-PREMIUM BENTO WORKSPACE RENDERER (v2.0.1)
   * ============================================================================ */
  function buatSVGProgressRing(persen, ukuran = 48, stroke = 4.5) {
    const r = (ukuran - stroke) / 2;
    const keliling = 2 * Math.PI * r;
    const offset = keliling - (persen / 100) * keliling;
    return `
      <svg width="${ukuran}" height="${ukuran}" style="transform: rotate(-90deg); flex-shrink:0;">
        <defs>
          <linearGradient id="msRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="50%" stop-color="#818cf8" />
            <stop offset="100%" stop-color="#10b981" />
          </linearGradient>
        </defs>
        <circle cx="${ukuran / 2}" cy="${ukuran / 2}" r="${r}" stroke="rgba(255,255,255,0.08)" stroke-width="${stroke}" fill="transparent" />
        <circle cx="${ukuran / 2}" cy="${ukuran / 2}" r="${r}" stroke="url(#msRingGrad)" stroke-width="${stroke}" fill="transparent"
              stroke-dasharray="${keliling}" stroke-dashoffset="${offset}" stroke-linecap="round" style="transition: stroke-dashoffset 0.45s cubic-bezier(0.16, 1, 0.3, 1);" />
      </svg>
    `;
  }

  function renderPanel() {
    try {
      pasangDesignSystemCSS();
      ['sipgn-autofill-panel', 'sipgn-fab-trigger', 'sipgn-mobile-backdrop'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });

      const mobileMode = isMobileDevice();
      const totalPengantaran = dataPenugasan.filter((d) => d.statusProses === 'pengantaran').length;
      const totalPengembalian = dataPenugasan.filter((d) => d.statusProses === 'pengembalian').length;
      const totalPencucian = dataPenugasan.filter((d) => d.statusProses === 'pencucian').length;

      // Mobile Floating FAB
      if (mobileMode && !mobilePanelOpen) {
        const fab = document.createElement('button');
        fab.id = 'sipgn-fab-trigger';
        fab.className = 'ms-ui-root ms-btn ms-btn-aurora';
        fab.innerHTML = `<span style="font-size:22px;">⚡</span>`;
        fab.style.cssText = `
          position: fixed; right: 18px; bottom: calc(env(safe-area-inset-bottom, 0px) + 20px);
          width: 58px; height: 58px; border-radius: 50%; z-index: 2147483645;
          box-shadow: 0 12px 30px rgba(99, 102, 241, 0.72), 0 0 0 2px rgba(56, 189, 248, 0.45);
        `;
        fab.onclick = () => { mobilePanelOpen = true; renderPanel(); };
        bantuAppendKeBody(fab);
        return;
      }

      if (mobileMode) {
        const backdrop = document.createElement('div');
        backdrop.id = 'sipgn-mobile-backdrop';
        backdrop.style.cssText = 'position:fixed; inset:0; background:rgba(3,6,13,0.78); backdrop-filter:blur(10px); z-index:2147483646;';
        backdrop.onclick = () => { mobilePanelOpen = false; renderPanel(); };
        bantuAppendKeBody(backdrop);
      }

      const isMinimized = !mobileMode && dapatkanPanelMinimized();
      const panel = document.createElement('div');
      panel.id = 'sipgn-autofill-panel';
      panel.className = 'ms-ui-root ms-aurora-shell ms-scroll';

      if (mobileMode) {
        panel.style.cssText = `
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483647;
          border-radius: 26px 26px 0 0; padding: 14px 16px calc(env(safe-area-inset-bottom, 0px) + 18px);
          max-height: 84vh; overflow-y: auto;
        `;
      } else {
        const savedPos = dapatkanPosisiPanel();
        const posStyle = savedPos
          ? `top: ${savedPos.top}px; left: ${savedPos.left}px;`
          : 'top: 18px; right: 18px;';
        panel.style.cssText = `
          position: fixed; ${posStyle} z-index: 1000000;
          width: ${isMinimized ? 'auto' : '394px'}; max-height: 92vh; overflow-y: auto;
          border-radius: 24px; padding: ${isMinimized ? '10px 14px' : '16px'};
        `;
      }

      // 1. TOP DRAGGABLE HEADER BAR
      const header = document.createElement('div');
      header.className = 'ms-drag-grip';
      header.style.cssText = `display:flex; align-items:center; justify-content:space-between; gap:8px; ${isMinimized ? '' : 'margin-bottom:12px;'}`;

      const badgeHeaderTitleHtml = availableUpdateRelease
        ? `<span style="font-size:9px; font-weight:800; padding:2px 6px; border-radius:6px; background:rgba(16,185,129,0.22); border:1px solid rgba(16,185,129,0.45); color:#34d399; font-family:var(--ms-font-mono); cursor:pointer;" title="Klik untuk install update">⬆️ v${escapeHtml(availableUpdateRelease.version)}</span>`
        : '';

      header.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="position:relative; width:32px; height:32px; border-radius:11px; background:linear-gradient(135deg, #0ea5e9, #6366f1, #9333ea); display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 6px 16px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.3);">
            ⚡
            <span style="position:absolute; top:-2px; right:-2px; width:9px; height:9px; border-radius:50%; background:#10b981; border:1.5px solid #050811;"></span>
            <span style="position:absolute; top:-2px; right:-2px; width:9px; height:9px; border-radius:50%; background:#10b981; animation:msPulseRing 2s infinite;"></span>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-weight:800; font-size:13.5px; letter-spacing:-0.2px; line-height:1.15;">SIPGN - Autofill</span>
              ${badgeHeaderTitleHtml}
            </div>
            <div style="font-size:9.5px; color:var(--ms-text-muted); font-family:var(--ms-font-mono); font-weight:700;">Crafted by <b>Mindspace Studio</b></div>
          </div>
        </div>
        <div id="ms-header-actions" style="display:flex; align-items:center; gap:5px;"></div>
      `;
      panel.appendChild(header);

      const headerActions = header.querySelector('#ms-header-actions');

      if (availableUpdateRelease) {
        const badgeSpan = header.querySelector('span[title="Klik untuk install update"]');
        if (badgeSpan) badgeSpan.onclick = tampilkanModalDetailUpdate;
      }

      if (!isMinimized) {
        const btnCmd = document.createElement('button');
        btnCmd.className = 'ms-btn ms-btn-ghost';
        btnCmd.style.cssText = 'height:28px; padding:0 8px; border-radius:9px; font-size:10px;';
        btnCmd.title = 'Command Palette (Ctrl+K / Alt+K)';
        btnCmd.innerHTML = `⌘ <span class="ms-kbd">Ctrl+K</span>`;
        btnCmd.onclick = tampilkanCommandPalette;
        headerActions.appendChild(btnCmd);

        const btnLog = document.createElement('button');
        btnLog.className = 'ms-btn ms-btn-ghost';
        btnLog.style.cssText = 'width:28px; height:28px; padding:0; border-radius:9px; font-size:12px;';
        btnLog.title = 'Riwayat Log Aktivitas';
        btnLog.textContent = '📜';
        btnLog.onclick = tampilkanModalActivityLog;
        headerActions.appendChild(btnLog);
      } else {
        const pill = document.createElement('span');
        pill.style.cssText = 'font-size:11px; font-family:var(--ms-font-mono); background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:99px; border:1px solid var(--ms-border);';
        pill.innerHTML = `<span style="color:#60a5fa">🚚${totalPengantaran}</span> <span style="color:#c084fc">📦${totalPengembalian}</span> <span style="color:#2dd4bf">🧼${totalPencucian}</span>`;
        headerActions.appendChild(pill);
      }

      const btnToggleSize = document.createElement('button');
      btnToggleSize.className = 'ms-btn ms-btn-ghost';
      btnToggleSize.style.cssText = 'width:28px; height:28px; padding:0; border-radius:9px;';
      btnToggleSize.textContent = mobileMode ? '✕' : (isMinimized ? '➕' : '➖');
      btnToggleSize.onclick = () => {
        if (mobileMode) mobilePanelOpen = false;
        else simpanPanelMinimized(!isMinimized);
        renderPanel();
      };
      headerActions.appendChild(btnToggleSize);

      aktifkanDraggablePanel(panel, header);

      if (isMinimized) {
        bantuAppendKeBody(panel);
        return;
      }

      // 2. BENTO TELEMETRY HERO GRID
      const namaSPPG = dapatkanNamaSPPG() || 'SPPG TERDAFTAR';
      const totalPorsiSemua = dataPenugasan.reduce((a, c) => a + hitungTotalPorsi(c), 0);
      const selesaiCount = dataPenugasan.filter((d) => d.statusProses !== 'belum').length;
      const progressPersen = dataPenugasan.length > 0 ? Math.round((selesaiCount / dataPenugasan.length) * 100) : 0;

      const bentoHero = document.createElement('div');
      bentoHero.className = 'ms-bento';
      bentoHero.style.cssText = 'padding: 13px; margin-bottom: 12px; background: linear-gradient(145deg, rgba(30,41,59,0.52), rgba(6,10,21,0.86)); border-color: rgba(56,189,248,0.2);';
      bentoHero.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:11px;">
          <div style="overflow:hidden;">
            <div style="display:flex; align-items:center; gap:5px; margin-bottom:2px;">
              <span style="font-size:9px; color:var(--ms-text-muted); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">SATUAN PELAYANAN PEMENUHAN GIZI</span>
            </div>
            <div style="font-size:16px; font-weight:800; color:var(--ms-amber); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              🏢 ${escapeHtml(namaSPPG)}
            </div>
          </div>
          <div style="position:relative; width:48px; height:48px; display:flex; align-items:center; justify-content:center;">
            ${buatSVGProgressRing(progressPersen, 48, 4.5)}
            <span style="position:absolute; font-size:10.5px; font-weight:800; font-family:var(--ms-font-mono); color:#f8fafc;">${progressPersen}%</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:5px; text-align:center;">
          <div style="background:rgba(6,10,21,0.72); padding:7px 2px; border-radius:11px; border:1px solid var(--ms-border);">
            <div style="font-size:8.5px; color:var(--ms-text-muted); font-weight:700;">KPM</div>
            <div style="font-size:13.5px; font-weight:800; color:var(--ms-cyan);">${dataPenugasan.length}</div>
          </div>
          <div style="background:rgba(6,10,21,0.72); padding:7px 2px; border-radius:11px; border:1px solid var(--ms-border);">
            <div style="font-size:8.5px; color:var(--ms-text-muted); font-weight:700;">PORSI</div>
            <div style="font-size:13.5px; font-weight:800; color:var(--ms-emerald);">${totalPorsiSemua.toLocaleString('id-ID')}</div>
          </div>
          <div style="background:rgba(6,10,21,0.72); padding:7px 2px; border-radius:11px; border:1px solid var(--ms-border);">
            <div style="font-size:8.5px; color:var(--ms-text-muted); font-weight:700;">ANTAR/AMBIL</div>
            <div style="font-size:12.5px; font-weight:800; color:#60a5fa;">${totalPengantaran}/${totalPengembalian}</div>
          </div>
          <div style="background:rgba(6,10,21,0.72); padding:7px 2px; border-radius:11px; border:1px solid var(--ms-border);">
            <div style="font-size:8.5px; color:var(--ms-text-muted); font-weight:700;">CUCI</div>
            <div style="font-size:13.5px; font-weight:800; color:#2dd4bf;">${totalPencucian}</div>
          </div>
        </div>
      `;
      panel.appendChild(bentoHero);

      // 3. FLOATING DOCK NAVIGATION
      const dockBar = document.createElement('div');
      dockBar.className = 'ms-dock-bar';
      dockBar.innerHTML = `
        <button class="ms-dock-btn ${activeTab === 'aksi' ? 'active' : ''}" data-tab="aksi">⚡ Workspace</button>
        <button class="ms-dock-btn ${activeTab === 'daftar' ? 'active' : ''}" data-tab="daftar">📋 Daftar (${dataPenugasan.length})</button>
        <button class="ms-dock-btn ${activeTab === 'pengaturan' ? 'active' : ''}" data-tab="pengaturan">⚙️ Sistem</button>
      `;
      dockBar.querySelectorAll('.ms-dock-btn').forEach((btn) => {
        btn.onclick = () => { activeTab = btn.dataset.tab; renderPanel(); };
      });
      panel.appendChild(dockBar);

      // 4. TAB CONTENT
      const content = document.createElement('div');
      if (activeTab === 'aksi') renderTabAksi(content);
      else if (activeTab === 'daftar') renderTabDaftar(content);
      else renderTabPengaturan(content);
      panel.appendChild(content);

      // Footer
      const footer = document.createElement('div');
      footer.style.cssText = 'margin-top:12px; display:flex; justify-content:space-between; align-items:center; font-size:9.5px; color:#64748b; padding:0 4px;';
      footer.innerHTML = `
        <span>Drag header • <b style="color:#94a3b8;">Ctrl+K</b></span>
        <span>Crafted by <b style="color:#94a3b8;">Mindspace Studio</b></span>
      `;
      panel.appendChild(footer);

      bantuAppendKeBody(panel);
    } catch (e) {
      console.error('[Autofill] Error renderPanel:', e);
    }
  }

  /* TAB 1: WORKSPACE & AKSI CEPAT */
  function renderTabAksi(container) {
    const kpmAktif = indexTerpilih >= 0 ? dataPenugasan[indexTerpilih] : null;

    const selectorCard = document.createElement('div');
    selectorCard.className = 'ms-bento';
    selectorCard.style.cssText = 'padding: 11px; margin-bottom: 10px;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;';
    topRow.innerHTML = `
      <span style="font-size:10px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase;">Target KPM Aktif</span>
      <div style="display:flex; gap:4px;">
        <button id="ms-prev-kpm" class="ms-btn ms-btn-ghost" style="padding:2px 7px; font-size:10px;" title="KPM Sebelumnya" ${dataPenugasan.length <= 1 ? 'disabled' : ''}>◀</button>
        <button id="ms-next-kpm" class="ms-btn ms-btn-ghost" style="padding:2px 7px; font-size:10px;" title="KPM Berikutnya" ${dataPenugasan.length <= 1 ? 'disabled' : ''}>▶</button>
        <button id="ms-next-pending-kpm" class="ms-btn ms-btn-ghost" style="padding:2px 7px; font-size:10px; color:var(--ms-emerald);" title="Lompat ke KPM Belum Diproses" ${dataPenugasan.length === 0 ? 'disabled' : ''}>⏭️</button>
        <button id="ms-quick-add-kpm" class="ms-btn ms-btn-ghost" style="padding:2px 8px; font-size:10px; color:var(--ms-cyan);">+ Baru</button>
      </div>
    `;
    selectorCard.appendChild(topRow);

    topRow.querySelector('#ms-prev-kpm').onclick = () => {
      if (dataPenugasan.length === 0) return;
      indexTerpilih = (indexTerpilih - 1 + dataPenugasan.length) % dataPenugasan.length;
      renderPanel();
    };
    topRow.querySelector('#ms-next-kpm').onclick = () => {
      if (dataPenugasan.length === 0) return;
      indexTerpilih = (indexTerpilih + 1) % dataPenugasan.length;
      renderPanel();
    };
    topRow.querySelector('#ms-next-pending-kpm').onclick = pilihKPMBelumBerikutnya;
    topRow.querySelector('#ms-quick-add-kpm').onclick = () => tampilkanModalFormKPM(null, null);

    const sel = document.createElement('select');
    sel.className = 'ms-select';
    dataPenugasan.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      const badge = d.statusProses === 'pengantaran' ? '🚚' : d.statusProses === 'pengembalian' ? '📦' : d.statusProses === 'pencucian' ? '🧼' : '⚪';
      opt.textContent = `${badge} ${d.sekolah} (${hitungTotalPorsi(d)} porsi)`;
      if (idx === indexTerpilih) opt.selected = true;
      sel.appendChild(opt);
    });
    if (dataPenugasan.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = '-- Belum ada data KPM --';
      sel.appendChild(opt);
    }
    sel.onchange = (e) => { indexTerpilih = Number(e.target.value); renderPanel(); };
    selectorCard.appendChild(sel);

    if (kpmAktif) {
      const statusSteps = [
        { id: 'belum', label: '⚪ Belum', warna: '#94a3b8' },
        { id: 'pengantaran', label: '🚚 Antar', warna: '#60a5fa' },
        { id: 'pengembalian', label: '📦 Ambil', warna: '#c084fc' },
        { id: 'pencucian', label: '🧼 Cuci', warna: '#2dd4bf' }
      ];

      const pills = [];
      if (Number(kpmAktif.porsiBesar) > 0) pills.push(`Besar: <b>${kpmAktif.porsiBesar}</b>`);
      if (Number(kpmAktif.porsiKecil) > 0) pills.push(`Kecil: <b>${kpmAktif.porsiKecil}</b>`);
      if (Number(kpmAktif.porsiBalita) > 0) pills.push(`Balita: <b>${kpmAktif.porsiBalita}</b>`);
      if (Number(kpmAktif.porsiIbuMenyusui) > 0) pills.push(`Busui: <b>${kpmAktif.porsiIbuMenyusui}</b>`);
      if (Number(kpmAktif.porsiIbuHamil) > 0) pills.push(`Bumil: <b>${kpmAktif.porsiIbuHamil}</b>`);

      const detailBox = document.createElement('div');
      detailBox.style.cssText = 'margin-top:9px; padding-top:9px; border-top:1px dashed var(--ms-border);';
      detailBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:7px;">
          <span style="color:var(--ms-text-muted);">Kurir: <b style="color:#e2e8f0;">${escapeHtml(kpmAktif.namaKurir || '-')}</b> (${escapeHtml(kpmAktif.platNomor || '-')})</span>
          <span style="font-size:10px; font-family:var(--ms-font-mono); color:var(--ms-cyan);">R${escapeHtml(kpmAktif.ritase || '1')}</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
          ${pills.length > 0 ? pills.map((p) => `<span style="font-size:10px; padding:2px 7px; border-radius:6px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.22); color:#cbd5e1;">${p}</span>`).join('') : '<span style="font-size:10px; color:var(--ms-text-muted);">0 porsi terkonfigurasi</span>'}
          <span style="font-size:10px; padding:2px 7px; border-radius:6px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); color:var(--ms-amber); font-family:var(--ms-font-mono);">⏰ ${escapeHtml(kpmAktif.batasWaktu || '-')}</span>
        </div>
        <div id="ms-status-stepper" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; background:rgba(6,10,21,0.65); padding:3px; border-radius:10px; border:1px solid var(--ms-border);"></div>
      `;

      const stepper = detailBox.querySelector('#ms-status-stepper');
      statusSteps.forEach((st) => {
        const isCurrent = (kpmAktif.statusProses || 'belum') === st.id;
        const stepBtn = document.createElement('button');
        stepBtn.className = 'ms-btn';
        stepBtn.style.cssText = `
          padding:4.5px 2px; font-size:9.5px; border-radius:7px;
          background:${isCurrent ? 'rgba(56,189,248,0.2)' : 'transparent'};
          border-color:${isCurrent ? 'rgba(56,189,248,0.45)' : 'transparent'};
          color:${isCurrent ? '#fff' : 'var(--ms-text-muted)'};
        `;
        stepBtn.textContent = st.label;
        stepBtn.title = 'Klik untuk ubah tahapan status KPM ini';
        stepBtn.onclick = () => {
          kpmAktif.statusProses = st.id;
          kpmAktif.terpakai = st.id !== 'belum';
          simpanData(dataPenugasan);
          catatAktivitas(`Ubah tahap ${kpmAktif.sekolah} → ${st.label}`, 'info');
          renderPanel();
        };
        stepper.appendChild(stepBtn);
      });

      selectorCard.appendChild(detailBox);
    }
    container.appendChild(selectorCard);

    const autoKurir = dapatkanAutoKurirMBG();
    const toggleCard = document.createElement('div');
    toggleCard.className = 'ms-bento';
    toggleCard.style.cssText = 'padding:10px 12px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; cursor:pointer;';
    toggleCard.innerHTML = `
      <span style="font-size:11.5px; font-weight:600; color:#e2e8f0;">🛵 Kirim ke Aplikasi Kurir MBG</span>
      <div style="width:36px; height:20px; border-radius:99px; background:${autoKurir ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : '#334155'}; position:relative; transition:0.2s;">
        <div style="width:16px; height:16px; border-radius:50%; background:#fff; position:absolute; top:2px; left:${autoKurir ? '18px' : '2px'}; transition:0.2s;"></div>
      </div>
    `;
    toggleCard.onclick = () => {
      simpanAutoKurirMBG(!autoKurir);
      aturCheckboxKurirMBG();
      renderPanel();
    };
    container.appendChild(toggleCard);

    const halamanTugasBaru = cekHalamanTugasBaru();
    const cekLabel = (kata) => [...document.querySelectorAll('label')].some((el) => !el.closest('#sipgn-autofill-panel') && el.textContent.includes(kata));
    const adaBerangkat = cekLabel('Waktu Keberangkatan');
    const adaTiba = cekLabel('Waktu Diterima di Tujuan');
    const adaKembali = cekLabel('Waktu Ompreng Kembali di SPPG');
    const adaAmbil = !adaBerangkat && !adaTiba && !adaKembali && (cekLabel('Jumlah Ompreng') || cekLabel('Waktu Dijadwalkan Pengambilan')) && !cekLabel('Dicuci');
    const adaCuci = cekLabel('Jumlah Ompreng Dicuci') || cekLabel('Waktu Mulai Cuci');

    const actionBox = document.createElement('div');
    actionBox.style.cssText = 'display:flex; flex-direction:column; gap:7px; margin-bottom:10px;';

    if (halamanTugasBaru) {
      const btn = document.createElement('button');
      btn.className = 'ms-btn ms-btn-aurora';
      btn.style.cssText = 'width:100%; padding:11.5px; font-size:12.5px;';
      btn.disabled = !kpmAktif;
      btn.innerHTML = '⚡ Isi Otomatis Penugasan Baru';
      btn.onclick = () => isiPenugasan(indexTerpilih);
      actionBox.appendChild(btn);
    }

    if (adaBerangkat || adaTiba) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:6px;';
      if (adaBerangkat) {
        const b1 = document.createElement('button');
        b1.className = 'ms-btn ms-btn-cyan';
        b1.style.cssText = 'flex:1; padding:10px;';
        b1.disabled = !kpmAktif;
        b1.textContent = '🕒 Set Berangkat';
        b1.onclick = async () => {
          b1.disabled = true; b1.textContent = '⏳...';
          const ok = await aturWaktuKeberangkatan(kpmAktif?.jamKeberangkatan, 'Waktu Keberangkatan');
          if (ok) { kpmAktif.statusProses = 'pengantaran'; simpanData(dataPenugasan); catatAktivitas(`Set berangkat: ${kpmAktif.sekolah}`, 'success'); tampilkanToast('Jam keberangkatan disimpan!', 'success'); }
          else tampilkanToast('Gagal mengatur jam keberangkatan.', 'error');
          renderPanel();
        };
        row.appendChild(b1);
      }
      if (adaTiba) {
        const b2 = document.createElement('button');
        b2.className = 'ms-btn ms-btn-emerald';
        b2.style.cssText = 'flex:1; padding:10px;';
        b2.disabled = !kpmAktif;
        b2.textContent = '🏁 Set Tiba';
        b2.onclick = async () => {
          b2.disabled = true; b2.textContent = '⏳...';
          const ok = await aturWaktuKeberangkatan(kpmAktif?.jamTibaTujuan, 'Waktu Diterima di Tujuan');
          if (ok) catatAktivitas(`Set tiba: ${kpmAktif.sekolah}`, 'success');
          tampilkanToast(ok ? 'Jam tiba disimpan!' : 'Gagal mengatur jam tiba.', ok ? 'success' : 'error');
          renderPanel();
        };
        row.appendChild(b2);
      }
      actionBox.appendChild(row);
    }

    if (adaAmbil) {
      const btn = document.createElement('button');
      btn.className = 'ms-btn ms-btn-violet';
      btn.style.cssText = 'width:100%; padding:10px;';
      btn.disabled = !kpmAktif;
      btn.textContent = '📦 Isi Pengambilan Ompreng';
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = '⏳ Mengisi...';
        const ok = await isiPengambilanOmpreng(indexTerpilih);
        tampilkanToast(ok ? 'Pengambilan ompreng terisi!' : 'Gagal mengisi pengambilan.', ok ? 'success' : 'error');
        renderPanel();
      };
      actionBox.appendChild(btn);
    }

    if (adaKembali) {
      const btn = document.createElement('button');
      btn.className = 'ms-btn ms-btn-emerald';
      btn.style.cssText = 'width:100%; padding:10px;';
      btn.disabled = !kpmAktif;
      btn.textContent = '🔄 Set Ompreng Kembali SPPG';
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = '⏳...';
        const ok = await aturWaktuKeberangkatan(kpmAktif?.jamOmprengKembaliSPPG, 'Waktu Ompreng Kembali di SPPG');
        if (ok) { kpmAktif.statusProses = 'pengembalian'; simpanData(dataPenugasan); catatAktivitas(`Ompreng kembali: ${kpmAktif.sekolah}`, 'success'); }
        tampilkanToast(ok ? 'Waktu kembali tersimpan!' : 'Gagal mengatur waktu.', ok ? 'success' : 'error');
        renderPanel();
      };
      actionBox.appendChild(btn);
    }

    if (adaCuci) {
      const btn = document.createElement('button');
      btn.className = 'ms-btn ms-btn-cyan';
      btn.style.cssText = 'width:100%; padding:10px;';
      btn.disabled = !kpmAktif;
      btn.textContent = '🧼 Isi Mulai Pencucian';
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = '⏳ Mengisi...';
        const ok = await isiMulaiPencucian(indexTerpilih);
        tampilkanToast(ok ? 'Form pencucian terisi!' : 'Gagal mengisi pencucian.', ok ? 'success' : 'error');
        renderPanel();
      };
      actionBox.appendChild(btn);
    }

    if (halamanTugasBaru || adaBerangkat || adaTiba || adaAmbil || adaKembali || adaCuci) {
      const btnSeq = document.createElement('button');
      btnSeq.className = 'ms-btn ms-btn-ghost';
      btnSeq.style.cssText = 'width:100%; padding:8.5px; border-color:rgba(56,189,248,0.38); color:var(--ms-cyan);';
      btnSeq.disabled = !kpmAktif;
      btnSeq.innerHTML = '🤖 Jalankan Auto-Sequence Halaman Ini';
      btnSeq.onclick = jalankanAutoSequenceHalaman;
      actionBox.appendChild(btnSeq);
    } else {
      const hint = document.createElement('div');
      hint.className = 'ms-bento';
      hint.style.cssText = 'padding:10px; font-size:11px; color:var(--ms-text-muted); text-align:center;';
      hint.innerHTML = '💡 Buka halaman <b>Tugas Baru</b> atau modal <b>Update Waktu / Ompreng</b>, atau tekan <span class="ms-kbd">Ctrl+K</span> untuk Command Palette.';
      actionBox.appendChild(hint);
    }

    container.appendChild(actionBox);

    if (kpmAktif) {
      const quickTools = document.createElement('div');
      quickTools.style.cssText = 'display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;';
      quickTools.innerHTML = `
        <button id="ms-act-edit" class="ms-btn ms-btn-ghost" style="padding:8px;">✏️ Edit</button>
        <button id="ms-act-dup" class="ms-btn ms-btn-ghost" style="padding:8px;">📋 Duplikat</button>
        <button id="ms-act-reset" class="ms-btn ms-btn-ghost" style="padding:8px;">↺ Reset</button>
      `;
      quickTools.querySelector('#ms-act-edit').onclick = () => tampilkanModalFormKPM(kpmAktif, indexTerpilih);
      quickTools.querySelector('#ms-act-dup').onclick = () => {
        const copy = { ...kpmAktif, sekolah: `${kpmAktif.sekolah} (Copy)`, terpakai: false, statusProses: 'belum' };
        dataPenugasan.push(copy);
        indexTerpilih = dataPenugasan.length - 1;
        simpanData(dataPenugasan);
        catatAktivitas(`Duplikat KPM: ${kpmAktif.sekolah}`, 'info');
        renderPanel();
        tampilkanToast('Data KPM berhasil diduplikasi!', 'success');
      };
      quickTools.querySelector('#ms-act-reset').onclick = () => {
        kpmAktif.terpakai = false;
        kpmAktif.statusProses = 'belum';
        simpanData(dataPenugasan);
        renderPanel();
        tampilkanToast('Status KPM direset ke Belum Diproses.', 'info');
      };
      container.appendChild(quickTools);
    }
  }

  /* TAB 2: DAFTAR KPM INTERAKTIF */
  function renderTabDaftar(container) {
    const topBar = document.createElement('div');
    topBar.style.cssText = 'display:flex; gap:6px; margin-bottom:8px;';
    topBar.innerHTML = `
      <input id="ms-search-kpm" class="ms-input" placeholder="🔍 Cari KPM / kurir..." value="${escapeHtml(searchQuery)}" style="flex:1;" />
      <select id="ms-sort-kpm" class="ms-select" style="width:96px; padding:7px 24px 7px 8px; font-size:10.5px;">
        <option value="default" ${sortMode === 'default' ? 'selected' : ''}>Urut: Default</option>
        <option value="nama" ${sortMode === 'nama' ? 'selected' : ''}>A → Z</option>
        <option value="porsi" ${sortMode === 'porsi' ? 'selected' : ''}>Porsi ↓</option>
        <option value="ritase" ${sortMode === 'ritase' ? 'selected' : ''}>Ritase ↑</option>
      </select>
      <button id="ms-add-kpm-list" class="ms-btn ms-btn-aurora" style="padding:0 11px;">+</button>
    `;
    container.appendChild(topBar);

    topBar.querySelector('#ms-search-kpm').oninput = (e) => { searchQuery = e.target.value; renderPanel(); };
    topBar.querySelector('#ms-sort-kpm').onchange = (e) => { sortMode = e.target.value; renderPanel(); };
    topBar.querySelector('#ms-add-kpm-list').onclick = () => tampilkanModalFormKPM(null, null);

    const filters = [
      { id: 'semua', label: 'Semua' },
      { id: 'belum', label: '⚪ Belum' },
      { id: 'pengantaran', label: '🚚 Antar' },
      { id: 'pengembalian', label: '📦 Ambil' },
      { id: 'pencucian', label: '🧼 Cuci' }
    ];
    const filterRow = document.createElement('div');
    filterRow.style.cssText = 'display:flex; gap:4px; overflow-x:auto; padding-bottom:6px; margin-bottom:8px;';
    filters.forEach((f) => {
      const chip = document.createElement('button');
      chip.className = 'ms-btn';
      const active = filterStatus === f.id;
      chip.style.cssText = `
        padding:4px 9px; font-size:10px; border-radius:99px; white-space:nowrap;
        background:${active ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.04)'};
        border-color:${active ? 'rgba(56,189,248,0.5)' : 'var(--ms-border)'};
        color:${active ? '#fff' : 'var(--ms-text-muted)'};
      `;
      chip.textContent = f.label;
      chip.onclick = () => { filterStatus = f.id; renderPanel(); };
      filterRow.appendChild(chip);
    });
    container.appendChild(filterRow);

    const listWrap = document.createElement('div');
    listWrap.className = 'ms-scroll';
    listWrap.style.cssText = 'max-height:230px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; margin-bottom:8px;';

    const q = searchQuery.toLowerCase();
    let items = dataPenugasan
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        const matchSearch = !q || item.sekolah.toLowerCase().includes(q) || (item.namaKurir || '').toLowerCase().includes(q);
        const matchStatus = filterStatus === 'semua' || item.statusProses === filterStatus;
        return matchSearch && matchStatus;
      });

    if (sortMode === 'nama') {
      items.sort((a, b) => a.item.sekolah.localeCompare(b.item.sekolah));
    } else if (sortMode === 'porsi') {
      items.sort((a, b) => hitungTotalPorsi(b.item) - hitungTotalPorsi(a.item));
    } else if (sortMode === 'ritase') {
      items.sort((a, b) => Number(a.item.ritase || 0) - Number(b.item.ritase || 0));
    }

    if (items.length === 0) {
      listWrap.innerHTML = `<div class="ms-bento" style="padding:16px; text-align:center; font-size:11px; color:var(--ms-text-muted);">Tidak ada data KPM yang cocok.</div>`;
    } else {
      items.forEach(({ item, idx }) => {
        const isSelected = idx === indexTerpilih;
        const card = document.createElement('div');
        card.className = 'ms-bento';
        card.style.cssText = `
          padding:9px 11px; cursor:pointer;
          border-color:${isSelected ? 'rgba(56,189,248,0.58)' : 'var(--ms-border)'};
          background:${isSelected ? 'rgba(56,189,248,0.12)' : 'var(--ms-bg-bento)'};
        `;
        const badgeIcon = item.statusProses === 'pengantaran' ? '🚚' : item.statusProses === 'pengembalian' ? '📦' : item.statusProses === 'pencucian' ? '🧼' : '⚪';
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <div style="font-size:11.5px; font-weight:700; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${badgeIcon} ${escapeHtml(item.sekolah)}
            </div>
            <div style="display:flex; gap:4px; flex-shrink:0;">
              <button class="ms-btn ms-btn-ghost ms-item-edit" style="padding:3px 6px; font-size:10px;">✏️</button>
              <button class="ms-btn ms-btn-danger ms-item-del" style="padding:3px 6px; font-size:10px;">🗑️</button>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:10px; color:var(--ms-text-muted);">
            <span>${jenisKPM(item) === 'posyandu' ? '👶 Posyandu' : '🏫 Sekolah'} • <b>${hitungTotalPorsi(item)}</b> porsi (R${escapeHtml(item.ritase || '1')})</span>
            <span>${escapeHtml(item.namaKurir || '-')}</span>
          </div>
        `;
        card.onclick = (e) => {
          if (e.target.closest('.ms-item-edit') || e.target.closest('.ms-item-del')) return;
          indexTerpilih = idx;
          activeTab = 'aksi';
          renderPanel();
        };
        card.querySelector('.ms-item-edit').onclick = () => tampilkanModalFormKPM(item, idx);
        card.querySelector('.ms-item-del').onclick = () => {
          tampilkanModalKonfirmasiModern('Hapus KPM', `Hapus data "${escapeHtml(item.sekolah)}"?`, () => {
            dataPenugasan.splice(idx, 1);
            if (indexTerpilih >= dataPenugasan.length) indexTerpilih = dataPenugasan.length - 1;
            simpanData(dataPenugasan);
            renderPanel();
            tampilkanToast('Data KPM dihapus.', 'info');
          });
        };
        listWrap.appendChild(card);
      });
    }
    container.appendChild(listWrap);

    const bulkRow = document.createElement('div');
    bulkRow.style.cssText = 'display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;';
    bulkRow.innerHTML = `
      <button id="ms-csv-import-btn" class="ms-btn ms-btn-ghost" style="padding:7.5px; font-size:10.5px;">📤 Import CSV</button>
      <button id="ms-csv-export-btn" class="ms-btn ms-btn-ghost" style="padding:7.5px; font-size:10.5px;">📥 Export CSV</button>
      <button id="ms-reset-all-btn" class="ms-btn ms-btn-ghost" style="padding:7.5px; font-size:10.5px;">↺ Reset All</button>
      <input type="file" id="ms-csv-file-input" accept=".csv,text/csv" style="display:none;" />
    `;
    const csvInp = bulkRow.querySelector('#ms-csv-file-input');
    bulkRow.querySelector('#ms-csv-import-btn').onclick = () => csvInp.click();
    csvInp.onchange = () => { importCSVData(csvInp.files?.[0]); csvInp.value = ''; };
    bulkRow.querySelector('#ms-csv-export-btn').onclick = exportCSVData;
    bulkRow.querySelector('#ms-reset-all-btn').onclick = () => {
      tampilkanModalKonfirmasiModern('Reset Semua Status', 'Kembalikan seluruh KPM ke status "Belum Diproses"?', () => {
        dataPenugasan.forEach((d) => { d.terpakai = false; d.statusProses = 'belum'; });
        simpanData(dataPenugasan);
        renderPanel();
        tampilkanToast('Semua status KPM berhasil direset.', 'success');
      });
    };
    container.appendChild(bulkRow);
  }

  /* TAB 3: PENGATURAN SISTEM */
  function renderTabPengaturan(container) {
    const devId = dapatkanDeviceID();
    const authUser = dapatkanAuthUser();
    const speedLevel = dapatkanTypingSpeedLevel();
    const expStr = currentDatabaseExpDate ? formatTanggalIndo(currentDatabaseExpDate) : 'Aktif';
    const sisaHari = hitungSisaHari(currentDatabaseExpDate);
    const isLinked = Boolean(cachedServerStatus?.is_linked || cachedServerStatus?.linked || cekStatusTautanLokal(dapatkanUserIdAktif()));

    const licCard = document.createElement('div');
    licCard.className = 'ms-bento';
    licCard.style.cssText = 'padding:12px; margin-bottom:10px;';
    licCard.innerHTML = `
      <div style="font-size:10px; font-weight:700; color:var(--ms-cyan); text-transform:uppercase; margin-bottom:8px;">🔐 Lisensi & Vault Perangkat</div>
      <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:5px;">
        <span style="color:var(--ms-text-muted);">Akun MindHUB:</span>
        <b style="color:#f8fafc;">@${escapeHtml(authUser?.username || 'User')}</b>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:5px;">
        <span style="color:var(--ms-text-muted);">Device ID:</span>
        <span id="ms-copy-devid" style="font-family:var(--ms-font-mono); color:var(--ms-amber); font-weight:700; cursor:pointer;" title="Klik untuk salin">${devId} 📋</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:9px;">
        <span style="color:var(--ms-text-muted);">Masa Aktif:</span>
        <b style="color:var(--ms-emerald);">${expStr}${sisaHari !== null ? ` (${sisaHari} hari)` : ''}</b>
      </div>
      <div id="ms-link-slot"></div>
    `;
    licCard.querySelector('#ms-copy-devid').onclick = () => {
      navigator.clipboard.writeText(devId);
      tampilkanToast('Device ID disalin!', 'success');
    };

    const linkSlot = licCard.querySelector('#ms-link-slot');
    if (isLinked) {
      linkSlot.innerHTML = `<div style="padding:7.5px; text-align:center; border-radius:9px; background:rgba(16,185,129,0.13); border:1px solid rgba(16,185,129,0.32); color:var(--ms-emerald); font-size:10.5px; font-weight:700;">✓ Perangkat Terenkripsi & Tertaut ke Akun</div>`;
    } else {
      const btnLink = document.createElement('button');
      btnLink.className = 'ms-btn ms-btn-cyan';
      btnLink.style.cssText = 'width:100%; padding:8.5px;';
      btnLink.textContent = '🔗 Tautkan Device ID Ini';
      btnLink.onclick = async () => {
        btnLink.disabled = true; btnLink.textContent = '⏳ Menautkan...';
        try {
          const res = await linkDeviceKeAkun();
          if (res.success) { tampilkanToast('Perangkat berhasil ditautkan!', 'success'); renderPanel(); }
          else { tampilkanToast(res.error || 'Gagal menautkan.', 'error'); btnLink.disabled = false; btnLink.textContent = '🔗 Tautkan Device ID Ini'; }
        } catch (e) {
          tampilkanToast('Error koneksi server.', 'error');
          btnLink.disabled = false; btnLink.textContent = '🔗 Tautkan Device ID Ini';
        }
      };
      linkSlot.appendChild(btnLink);
    }
    container.appendChild(licCard);

    const speedCard = document.createElement('div');
    speedCard.className = 'ms-bento';
    speedCard.style.cssText = 'padding:12px; margin-bottom:10px;';
    speedCard.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:10px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase;">⌨️ Kecepatan Ketik</span>
        <span id="ms-speed-badge" style="font-size:10.5px; font-family:var(--ms-font-mono); color:var(--ms-cyan); font-weight:700;">${speedLevel}%</span>
      </div>
      <input type="range" id="ms-speed-range" class="ms-range" min="0" max="75" step="25" value="${speedLevel}" />
      <div id="ms-speed-label" style="font-size:10.5px; color:#cbd5e1; margin-top:6px; text-align:center;">${formatSpeedText(speedLevel)}</div>
    `;
    const rangeEl = speedCard.querySelector('#ms-speed-range');
    rangeEl.oninput = (e) => {
      const v = e.target.value;
      speedCard.querySelector('#ms-speed-badge').textContent = `${v}%`;
      speedCard.querySelector('#ms-speed-label').textContent = formatSpeedText(v);
      simpanTypingSpeedLevel(v);
    };
    container.appendChild(speedCard);

    const backupCard = document.createElement('div');
    backupCard.className = 'ms-bento';
    backupCard.style.cssText = 'padding:12px; margin-bottom:10px;';
    backupCard.innerHTML = `
      <div style="font-size:10px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase; margin-bottom:7px;">☁️ Backup, Pembaruan & Tata Letak</div>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:6px;">
        <button id="ms-bk-save" class="ms-btn ms-btn-ghost" style="padding:8px;">↓ Backup</button>
        <button id="ms-bk-file" class="ms-btn ms-btn-ghost" style="padding:8px;">📂 JSON</button>
        <button id="ms-bk-cloud" class="ms-btn ms-btn-ghost" style="padding:8px;">☁️ Cloud</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px;">
        <button id="ms-check-update-btn" class="ms-btn ${availableUpdateRelease ? 'ms-btn-emerald' : 'ms-btn-ghost'}" style="padding:7.5px; font-size:10.5px;">
          ${availableUpdateRelease ? `⬆️ Update v${escapeHtml(availableUpdateRelease.version)}` : '🔄 Cek Update'}
        </button>
        <button id="ms-reset-pos-btn" class="ms-btn ms-btn-ghost" style="padding:7.5px; font-size:10.5px;">🎯 Reset Posisi</button>
      </div>
      <input type="file" id="ms-bk-file-input" accept="application/json,.json" style="display:none;" />
    `;
    backupCard.querySelector('#ms-bk-save').onclick = downloadBackupData;
    const fileInp = backupCard.querySelector('#ms-bk-file-input');
    backupCard.querySelector('#ms-bk-file').onclick = () => fileInp.click();
    fileInp.onchange = () => { importBackupData(fileInp.files?.[0]); fileInp.value = ''; };
    backupCard.querySelector('#ms-bk-cloud').onclick = importCloudData;
    backupCard.querySelector('#ms-check-update-btn').onclick = async (e) => {
      if (availableUpdateRelease) {
        tampilkanModalDetailUpdate();
        return;
      }
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = '⏳ Mengecek...';
      const rel = await cekUpdateAplikasiInApp();
      btn.disabled = false;
      btn.textContent = rel ? `⬆️ Update v${rel.version}` : '🔄 Cek Update';
      if (rel) tampilkanModalDetailUpdate();
      else tampilkanToast(`Anda sudah menggunakan versi terbaru (v${CURRENT_VERSION}).`, 'success');
    };
    backupCard.querySelector('#ms-reset-pos-btn').onclick = () => {
      resetPosisiPanel();
      renderPanel();
      tampilkanToast('Posisi panel dikembalikan ke default.', 'info');
    };
    container.appendChild(backupCard);

    const btnLogout = document.createElement('button');
    btnLogout.className = 'ms-btn ms-btn-danger';
    btnLogout.style.cssText = 'width:100%; padding:9.5px;';
    btnLogout.textContent = '🚪 Keluar Akun MindHUB';
    btnLogout.onclick = () => {
      tampilkanModalKonfirmasiModern('Keluar Akun', 'Akhiri sesi login MindHUB pada perangkat ini?', () => {
        hapusAuthSession();
        cachedServerStatus = null;
        const p = document.getElementById('sipgn-autofill-panel');
        if (p) p.remove();
        tampilkanModalLoginMindHUB(() => inialisasiSistem());
      });
    };
    container.appendChild(btnLogout);
  }

  /* ============================================================================
   * 10. KEYBOARD SHORTCUTS, SPA OBSERVER & LIFECYCLE INITIALIZATION
   * ============================================================================ */
  function pasangKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        tampilkanCommandPalette();
      } else if (e.key === 'Escape') {
        const cmdModal = document.getElementById('sipgn-command-palette');
        if (cmdModal) cmdModal.remove();
      }
    });
  }

  function aktifkanPengubahKameraKeGaleri() {
    const ubah = () => {
      document.querySelectorAll('input[type="file"]').forEach((input) => {
        if (input.hasAttribute('capture')) input.removeAttribute('capture');
        const acc = input.getAttribute('accept');
        if (!acc || acc.includes('camera')) input.setAttribute('accept', 'image/*');
      });
    };
    ubah();
    const obs = new MutationObserver(ubah);
    if (document.body || document.documentElement) {
      obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
  }

  function pasangDetektorNavigasiSPA() {
    let lastPath = location.pathname;
    const check = () => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        renderPanel();
      }
    };
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (...args) { origPush.apply(this, args); check(); };
    history.replaceState = function (...args) { origReplace.apply(this, args); check(); };
    window.addEventListener('popstate', check);
    setInterval(check, 900);
  }

  function pasangDetektorPerubahanForm() {
    const labels = [
      'Waktu Keberangkatan', 'Waktu Diterima di Tujuan', 'Jumlah Ompreng',
      'Waktu Dijadwalkan Pengambilan', 'Waktu Ompreng Kembali di SPPG',
      'Jumlah Ompreng Dicuci', 'Waktu Mulai Cuci'
    ];
    const sig = () => [...document.querySelectorAll('label')]
      .filter((el) => !el.closest('#sipgn-autofill-panel'))
      .map((el) => el.textContent.replace(/\s+/g, ' ').replace('*', '').trim())
      .filter((t) => labels.includes(t))
      .sort()
      .join('|');

    let prev = sig();
    let timer = null;
    const obs = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const curr = sig();
        if (curr !== prev) { prev = curr; renderPanel(); }
      }, 180);
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  }

  function mulaiJalankanSkrip() {
    aktifkanPengubahKameraKeGaleri();
    pasangKeyboardShortcuts();
    pasangDetektorNavigasiSPA();
    renderPanel();
    pasangDetektorPerubahanForm();
    cekUpdateAplikasiInApp();
  }

  function ambilStatusLisensiServer() {
    const devId = dapatkanDeviceID();
    const token = dapatkanAuthToken();
    const userId = dapatkanUserIdAktif();
    const sig = _0xVault.sign(`${devId}|${userId || ''}`);
    const headers = {
      'Cache-Control': 'no-cache, no-store',
      'X-MS-Integrity': sig
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${getVercelApiUrl()}?action=check_license&device_id=${encodeURIComponent(devId)}${userId ? `&user_id=${encodeURIComponent(userId)}` : ''}&_t=${Date.now()}`,
        headers,
        onload: (res) => {
          try {
            if (res.status === 401 || res.status === 403) {
              hapusAuthSession();
              return resolve({ status: 'unauthenticated', valid: false });
            }
            const data = JSON.parse(res.responseText);
            if (data && (data.unauthenticated || data.code === 'UNAUTHENTICATED')) {
              hapusAuthSession();
              return resolve({ status: 'unauthenticated', valid: false });
            }
            cachedServerStatus = data;
            const serverUserId = data.user_id || data.account_id || data.owner_id || null;
            if (data.is_linked === true || data.linked === true || (serverUserId && (!userId || String(serverUserId) === String(userId)))) {
              const idSimpan = serverUserId || userId;
              if (idSimpan) simpanStatusTautanLokal(idSimpan, true);
              cachedServerStatus.is_linked = true;
              cachedServerStatus.linked = true;
            }
            if (data?.sppg_name) simpanNamaSPPG(data.sppg_name);
            if (data?.exp_date) currentDatabaseExpDate = data.exp_date;
            resolve({
              status: data.valid ? 'active' : (data.status || 'expired'),
              valid: !!data.valid,
              msg: data.msg || data.message || ''
            });
          } catch (e) {
            resolve({ status: 'error', valid: false });
          }
        },
        onerror: () => resolve({ status: 'error', valid: false })
      });
    });
  }

  function tanganiStatusLisensi(res) {
    if (res.status === 'unauthenticated') {
      tampilkanModalLoginMindHUB(() => inialisasiSistem());
    } else if (res.valid || res.status === 'active') {
      if (!dapatkanNamaSPPG()) tampilkanModalWelcomeSPPG(() => mulaiJalankanSkrip());
      else mulaiJalankanSkrip();
    } else if (res.status === 'hold') {
      tampilkanModalStatusSitus('Akses Lisensi Ditangguhkan', res.msg || 'Perangkat Anda sedang ditangguhkan oleh administrator.', 'hold');
    } else if (res.status === 'revoked') {
      tampilkanModalStatusSitus('Akses Lisensi Dicabut', res.msg || 'Akses perangkat telah dicabut secara permanen.', 'revoked');
    } else if (res.status === 'unregistered') {
      const overlay = buatOverlayModal('sipgn-trial-modal');
      overlay.innerHTML = `
        <div class="ms-aurora-shell ms-modal-box" style="padding:26px; border-radius:24px; width:380px; max-width:92vw; text-align:center;">
          <div style="font-size:34px; margin-bottom:10px;">🎁</div>
          <h3 style="margin:0 0 6px; font-size:18px; font-weight:800;">Aktivasi Free Trial 24 Jam</h3>
          <p style="font-size:12px; color:var(--ms-text-muted); margin:0 0 18px; line-height:1.5;">Perangkat baru terdeteksi. Klaim akses penuh gratis selama 24 jam dan tautkan otomatis ke akun Anda.</p>
          <button id="ms-btn-trial-now" class="ms-btn ms-btn-aurora" style="width:100%; padding:12px; font-size:13px;">🚀 Klaim Free Trial Sekarang</button>
        </div>
      `;
      bantuAppendKeBody(overlay);
      document.getElementById('ms-btn-trial-now').onclick = async (e) => {
        e.target.disabled = true; e.target.textContent = '⏳ Memproses...';
        try {
          const r = await klaimFreeTrialVercel();
          if (r.success || r.exp_date) {
            try { await linkDeviceKeAkun(); } catch (err) {}
            overlay.remove();
            eksekusiSuksesPembayaran(1, dapatkanDeviceID(), r.exp_date);
          } else {
            tampilkanToast(r.error || 'Gagal klaim trial.', 'error');
            e.target.disabled = false; e.target.textContent = '🚀 Klaim Free Trial Sekarang';
          }
        } catch (err) {
          tampilkanToast('Error koneksi server.', 'error');
          e.target.disabled = false; e.target.textContent = '🚀 Klaim Free Trial Sekarang';
        }
      };
    } else {
      tampilkanModalStatusSitus('Masa Aktif Lisensi Habis', res.msg || 'Masa aktif lisensi perangkat telah berakhir. Masukkan kode voucher untuk memperpanjang.', 'expired');
    }
  }

  async function inialisasiSistem() {
    try {
      aktifkanPengubahKameraKeGaleri();
      if (!cekValiditasJWT(dapatkanAuthToken())) {
        hapusAuthSession();
        tampilkanModalLoginMindHUB(() => inialisasiSistem());
        return;
      }

      let targetStatus = null;
      const loader = tampilkanLoadingScreen(() => { if (targetStatus) tanganiStatusLisensi(targetStatus); });
      loader.updateProgress(30, 'Memverifikasi Sesi MindHUB...');
      await wait(600);
      loader.updateProgress(65, 'Memeriksa Lisensi Perangkat...');

      const resStatus = await ambilStatusLisensiServer();
      if (!resStatus || resStatus.status === 'error') {
        loader.tampilkanGagal('Koneksi Gagal! Periksa Jaringan Internet Anda.');
        return;
      }
      if (resStatus.status === 'unauthenticated') {
        const sp = document.getElementById('sipgn-splash-loading');
        if (sp) sp.remove();
        tampilkanModalLoginMindHUB(() => inialisasiSistem());
        return;
      }

      targetStatus = resStatus;
      loader.updateProgress(95, 'Menyiapkan Mindspace Autofill...');
      await wait(450);
      loader.siapLanjut();

      if (intervalMonitorLisensi) clearInterval(intervalMonitorLisensi);
      intervalMonitorLisensi = setInterval(() => {
        if (!cekValiditasJWT(dapatkanAuthToken())) {
          clearInterval(intervalMonitorLisensi);
          hapusAuthSession();
          tampilkanModalLoginMindHUB(() => inialisasiSistem());
          return;
        }
        ambilStatusLisensiServer().then((res) => {
          if (!res.valid && res.status !== 'active') tanganiStatusLisensi(res);
        });
      }, 60000);
    } catch (e) {
      tampilkanModalLoginMindHUB(() => inialisasiSistem());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(inialisasiSistem, 250));
  } else {
    setTimeout(inialisasiSistem, 250);
  }
})();
