// ==UserScript==
// @name         SIPGN Autofill POP - Mindspace Studio
// @namespace    sipgn-autofill
// @version      2.0.2
// @description  Ultra-Modern Cyber-Bento Glassmorphic Suite untuk Otomatisasi SIPGN POP (AI Smart Algorithm, WhatsApp Schedule Parser, AI Support Chat, Encrypted Core Vault, Fake Camera, Command Palette Ctrl+K & Auto-Sequence)
// @match        https://pop-sipgn.bgn.go.id/distribution*
// @match        https://pop-sipgn.bgn.go.id/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      minduniverse.id
// @connect      www.minduniverse.id
// @connect      mindspace-id.vercel.app
// @updateURL    https://minduniverse.id/files/sipgn-autofill.user.js
// @downloadURL  https://minduniverse.id/files/sipgn-autofill.user.js
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
    vApi: _0xVault.enc('https://www.minduniverse.id/api/tokopay'),
    aApi: _0xVault.enc('https://www.minduniverse.id/api/config'),
    aiApi: _0xVault.enc('https://mindspace-id.vercel.app/api/ai-support'),
    salt: _0xVault.enc('MINDSTUDIO2026')
  });

  const getVercelApiUrl = () => _0xVault.dec(_CFG_VAULT.vApi);
  const getAuthApiUrl = () => _0xVault.dec(_CFG_VAULT.aApi);
  const getAiApiUrl = () => _0xVault.dec(_CFG_VAULT.aiApi);
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
      let prevObjectUrl = null;

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
            const objectUrl = URL.createObjectURL(f);
            const i = new Image();
            i.onload = () => {
              if (prevObjectUrl) {
                try { URL.revokeObjectURL(prevObjectUrl); } catch (e) {}
              }
              prevObjectUrl = objectUrl;
              img = i;
              resolve();
            };
            i.onerror = () => {
              try { URL.revokeObjectURL(objectUrl); } catch (e) {}
              reject(new DOMException('Gambar gagal dimuat', 'NotReadableError'));
            };
            i.src = objectUrl;
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
    : '2.0.2';

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

  // Keys Fitur Automasi & AI
  const JITTER_MODE_KEY = 'sipgn_jitter_mode_enabled';
  const REALTIME_CLOCK_KEY = 'sipgn_realtime_clock_enabled';
  const AUTO_ADVANCE_KEY = 'sipgn_auto_advance_enabled';
  const AUTO_SUBMIT_KEY = 'sipgn_auto_submit_enabled';
  const AUTO_CLOUD_SYNC_KEY = 'sipgn_auto_cloud_sync_enabled';
  const AI_AUTO_HEAL_KEY = 'sipgn_ai_auto_heal_enabled';
  const FLEET_MASTER_KEY = 'sipgn_fleet_master_v1';

  let currentDatabaseExpDate = null;
  let cachedServerStatus = null;
  let intervalMonitorLisensi = null;
  let availableUpdateRelease = null;
  let mobilePanelOpen = false;
  let activeTab = 'aksi'; // 'aksi' | 'daftar' | 'ai' | 'pengaturan'
  let searchQuery = '';
  let filterStatus = 'semua';
  let sortMode = 'default'; // 'default' | 'nama' | 'porsi' | 'ritase'
  let activityLogs = [];
  let isAutomating = false;
  let isScriptInitialized = false;
  let globalDragListenersAttached = false;
  let activeDragState = null;

  // State Fitur Tambahan & AI
  let inlineEditIdx = null;
  let autoCloudSyncTimer = null;
  let cloudSyncState = 'idle'; // 'idle' | 'syncing' | 'synced' | 'error'
  let activeSubmitCountdownCancel = null;
  let aiChatThinking = false;
  let aiChatHistory = [
    {
      role: 'assistant',
      text: 'Halo! Saya **Mindspace AI**. Saya siap membantu menyusun jadwal anti-konflik, mengekstrak teks jadwal WhatsApp menjadi data KPM, serta mendiagnosa kendala pengisian form SIPGN.'
    }
  ];

  // Guard anti-loop & anti-duplikasi
  let sedangInisialisasi = false;
  let modalUpdateSudahDitampilkan = false;
  let pemantauHalamanAktif = false;

  function catatAktivitas(teks, tipe = 'info') {
    const waktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    activityLogs.unshift({ waktu, teks, tipe });
    if (activityLogs.length > 35) activityLogs.pop();
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

  function formatRichTextSimple(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f8fafc;">$1</strong>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(56,189,248,0.14); color:#38bdf8; padding:1px 5px; border-radius:4px; font-family:var(--ms-font-mono); font-size:10.5px;">$1</code>')
      .replace(/\n/g, '<br>');
  }

  function normalisasiFormatJam(rawJam) {
    if (rawJam === null || rawJam === undefined) return '';
    const bersih = String(rawJam).trim().replace(/\./g, ':');
    const match = bersih.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
    if (!match) return '';
    const jam = parseInt(match[1], 10);
    const menit = parseInt(match[2], 10);
    if (isNaN(jam) || isNaN(menit) || jam < 0 || jam > 23 || menit < 0 || menit > 59) return '';
    return `${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}`;
  }

  function jamKeMenit(jamStr) {
    const norm = normalisasiFormatJam(jamStr);
    if (!norm) return null;
    const [h, m] = norm.split(':').map(Number);
    return h * 60 + m;
  }

  function menitKeJam(totalMenit) {
    const safeM = ((totalMenit % 1440) + 1440) % 1440;
    const h = Math.floor(safeM / 60);
    const m = safeM % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Real-Time Clock & Jitter Mode (±1–4 Menit Alami)
  function terapkanRealTimeDanJitter(rawJam) {
    const useRealtime = dapatkanRealtimeClock();
    const useJitter = dapatkanJitterMode();

    let baseJam = normalisasiFormatJam(rawJam);
    if (useRealtime) {
      const now = new Date();
      baseJam = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    if (!baseJam) return '';

    if (useJitter) {
      const baseMenit = jamKeMenit(baseJam);
      if (baseMenit !== null) {
        const delta = (Math.floor(Math.random() * 4) + 1) * (Math.random() < 0.5 ? -1 : 1);
        const hasil = menitKeJam(baseMenit + delta);
        catatAktivitas(`Jitter Waktu: ${baseJam} → ${hasil} (${delta > 0 ? '+' : ''}${delta}m)`, 'info');
        return hasil;
      }
    }
    return baseJam;
  }

  // Pre-Flight Guard (Deteksi Konflik Jadwal & Porsi 0)
  function periksaKonflikPreFlight(data) {
    if (!data) return ['Data KPM tidak ditemukan.'];
    const konflik = [];
    const totalPorsi = hitungTotalPorsi(data);
    if (totalPorsi <= 0) {
      konflik.push('Total porsi bernilai 0 (belum ada porsi yang diisi).');
    }

    const mBerangkat = jamKeMenit(data.jamKeberangkatan);
    const mTiba = jamKeMenit(data.jamTibaTujuan);
    const mAmbil = jamKeMenit(data.jamJadwalPengambilan);
    const mKembali = jamKeMenit(data.jamOmprengKembaliSPPG);
    const mCuci = jamKeMenit(data.jamMulaiCuci);

    if (mBerangkat !== null && mTiba !== null && mTiba < mBerangkat) {
      konflik.push(`Jam Tiba (${normalisasiFormatJam(data.jamTibaTujuan)}) lebih awal dari Jam Berangkat (${normalisasiFormatJam(data.jamKeberangkatan)}).`);
    }
    if (mTiba !== null && mAmbil !== null && mAmbil < mTiba) {
      konflik.push(`Jadwal Ambil (${normalisasiFormatJam(data.jamJadwalPengambilan)}) lebih awal dari Jam Tiba (${normalisasiFormatJam(data.jamTibaTujuan)}).`);
    }
    if (mAmbil !== null && mKembali !== null && mKembali < mAmbil) {
      konflik.push(`Ompreng Kembali (${normalisasiFormatJam(data.jamOmprengKembaliSPPG)}) lebih awal dari Jadwal Ambil (${normalisasiFormatJam(data.jamJadwalPengambilan)}).`);
    }
    if (mKembali !== null && mCuci !== null && mCuci < mKembali) {
      konflik.push(`Jam Mulai Cuci (${normalisasiFormatJam(data.jamMulaiCuci)}) lebih awal dari Ompreng Kembali (${normalisasiFormatJam(data.jamOmprengKembaliSPPG)}).`);
    }
    return konflik;
  }

  function konfirmasiPreFlightJikaKonflik(data) {
    return new Promise((resolve) => {
      const daftarKonflik = periksaKonflikPreFlight(data);
      if (daftarKonflik.length === 0) return resolve(true);

      const overlay = buatOverlayModal('sipgn-preflight-modal');
      overlay.innerHTML = `
        <div class="ms-aurora-shell ms-modal-box" style="padding: 24px; border-radius: 22px; width: 400px; max-width: 92vw; text-align: left;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            <span style="font-size:26px;">🛡️</span>
            <div>
              <h3 style="margin:0; font-size:15.5px; font-weight:800; color:var(--ms-amber);">Pre-Flight Guard: Peringatan Data</h3>
              <div style="font-size:11px; color:var(--ms-text-muted);">Ditemukan anomali jadwal atau porsi pada <b>${escapeHtml(data.sekolah)}</b></div>
            </div>
          </div>
          <div class="ms-bento" style="padding:11px 13px; margin-bottom:14px; border-color:rgba(245,158,11,0.38); background:rgba(245,158,11,0.08);">
            <ul style="margin:0; padding-left:16px; font-size:11.5px; color:#fde68a; display:flex; flex-direction:column; gap:5px;">
              ${daftarKonflik.map((k) => `<li>${escapeHtml(k)}</li>`).join('')}
            </ul>
          </div>
          <button id="ms-preflight-ai-fix" class="ms-btn ms-btn-aurora" style="width:100%; padding:10px; margin-bottom:8px;">✨ Perbaiki Otomatis dengan AI Smart Schedule</button>
          <div style="display:flex; gap:8px;">
            <button id="ms-preflight-cancel" class="ms-btn ms-btn-ghost" style="flex:1; padding:10px;">Perbaiki Manual</button>
            <button id="ms-preflight-proceed" class="ms-btn ms-btn-primary" style="flex:1; padding:10px;">Tetap Jalankan</button>
          </div>
        </div>
      `;
      bantuAppendKeBody(overlay);
      document.getElementById('ms-preflight-ai-fix').onclick = () => {
        Object.assign(data, aiGenerateJadwalCerdas(data));
        simpanData(dataPenugasan);
        catatAktivitas(`AI Smart Schedule memperbaiki jadwal ${data.sekolah}`, 'success');
        tampilkanToast(`Jadwal "${escapeHtml(data.sekolah)}" dioptimasi AI!`, 'success');
        overlay.remove();
        renderPanel();
        resolve(true);
      };
      document.getElementById('ms-preflight-cancel').onclick = () => { overlay.remove(); resolve(false); };
      document.getElementById('ms-preflight-proceed').onclick = () => { overlay.remove(); resolve(true); };
    });
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
      const allowedHosts = ['minduniverse.id', 'www.minduniverse.id'];
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
              const safeUrl = validasiUrlUpdateAman(rel.download_url) || 'https://minduniverse.id/files/sipgn-autofill.user.js';
              availableUpdateRelease = {
                version: String(rel.version).trim(),
                download_url: safeUrl,
                changelog: String(rel.changelog || 'Pembaruan stabilitas dan peningkatan performa otomatis.').trim()
              };
              catatAktivitas(`Pembaruan tersedia: v${availableUpdateRelease.version}`, 'info');

              if (!modalUpdateSudahDitampilkan) {
                modalUpdateSudahDitampilkan = true;
                tampilkanToast(`Pembaruan v${escapeHtml(availableUpdateRelease.version)} tersedia!`, 'info', 4500);
                setTimeout(() => {
                  tampilkanModalDetailUpdate();
                }, 400);
              }

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

  function tampilkanModalDetailUpdate() {
    const updateInfo = availableUpdateRelease || {
      version: '2.0.2',
      download_url: 'https://minduniverse.id/files/sipgn-autofill.user.js',
      changelog: '✨ Integrasi Mindspace AI Engine - Parser Jadwal WhatsApp Otomatis - AI Smart Schedule Optimizer - Tab AI Support Chat.'
    };

    const formatChangelogToHTML = (rawText) => {
      const text = String(rawText || '').trim();
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
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 10px #10b981;"></div>
            <span style="font-size:11px; font-weight:700; color:#34d399; font-family:var(--ms-font-mono); text-transform:uppercase; letter-spacing:0.5px;">Sistem Pembaruan Otomatis</span>
          </div>
          <button id="ms-close-update-modal" class="ms-btn ms-btn-ghost" style="width:30px; height:30px; padding:0; border-radius:50%;">✕</button>
        </div>

        <div style="display:grid; grid-template-columns: 210px 1fr; gap: 20px; align-items: stretch; margin-bottom: 24px;">
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
   * 4. ULTRA-PREMIUM CYBER-AURORA BENTO DESIGN SYSTEM (v2.0.2)
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

      .ms-input, .ms-select, .ms-textarea {
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
      .ms-input:focus, .ms-select:focus, .ms-textarea:focus {
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
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        padding: 4px;
        background: rgba(6, 10, 21, 0.8);
        border: 1px solid var(--ms-border);
        border-radius: 14px;
        margin-bottom: 12px;
      }
      .ms-dock-btn {
        padding: 7.5px 4px;
        border-radius: 10px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--ms-text-muted);
        font-size: 10.5px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
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

      .ms-ai-bubble-user {
        align-self: flex-end;
        max-width: 85%;
        padding: 8px 11px;
        border-radius: 14px 14px 4px 14px;
        background: linear-gradient(135deg, rgba(2, 132, 199, 0.32), rgba(99, 102, 241, 0.34));
        border: 1px solid rgba(56, 189, 248, 0.38);
        color: #f8fafc;
        font-size: 11.5px;
        line-height: 1.45;
      }

      .ms-ai-bubble-bot {
        align-self: flex-start;
        max-width: 92%;
        padding: 9px 11px;
        border-radius: 14px 14px 14px 4px;
        background: rgba(15, 23, 42, 0.78);
        border: 1px solid rgba(168, 85, 247, 0.28);
        color: #cbd5e1;
        font-size: 11.5px;
        line-height: 1.5;
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
    return 2147483647;
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
   * 5. STATE, PREFERENCE, MASTER ARMADA & DRAGGABLE POSITION HELPERS
   * ============================================================================ */
  function dapatkanBoolPref(gmKey, defaultVal = false) {
    try {
      const val = GM_getValue(gmKey, defaultVal);
      return val === true || val === 'true';
    } catch (e) {
      const val = localStorage.getItem(gmKey);
      return val === null ? defaultVal : val === 'true';
    }
  }

  function simpanBoolPref(gmKey, val) {
    try { GM_setValue(gmKey, Boolean(val)); } catch (e) {}
    localStorage.setItem(gmKey, String(Boolean(val)));
  }

  const dapatkanJitterMode = () => dapatkanBoolPref(JITTER_MODE_KEY, false);
  const simpanJitterMode = (val) => simpanBoolPref(JITTER_MODE_KEY, val);
  const dapatkanRealtimeClock = () => dapatkanBoolPref(REALTIME_CLOCK_KEY, false);
  const simpanRealtimeClock = (val) => simpanBoolPref(REALTIME_CLOCK_KEY, val);
  const dapatkanAutoAdvance = () => dapatkanBoolPref(AUTO_ADVANCE_KEY, false);
  const simpanAutoAdvance = (val) => simpanBoolPref(AUTO_ADVANCE_KEY, val);
  const dapatkanAutoSubmit = () => dapatkanBoolPref(AUTO_SUBMIT_KEY, false);
  const simpanAutoSubmit = (val) => simpanBoolPref(AUTO_SUBMIT_KEY, val);
  const dapatkanAutoCloudSync = () => dapatkanBoolPref(AUTO_CLOUD_SYNC_KEY, true);
  const simpanAutoCloudSync = (val) => simpanBoolPref(AUTO_CLOUD_SYNC_KEY, val);
  const dapatkanAiAutoHeal = () => dapatkanBoolPref(AI_AUTO_HEAL_KEY, true);
  const simpanAiAutoHeal = (val) => simpanBoolPref(AI_AUTO_HEAL_KEY, val);

  function muatMasterArmada() {
    try {
      const raw = GM_getValue(FLEET_MASTER_KEY, '') || localStorage.getItem(FLEET_MASTER_KEY);
      if (!raw) return [{ namaKurir: 'BUDIAWAN SUTARJO', platNomor: 'BK1234ABC' }];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function simpanMasterArmada(list) {
    const str = JSON.stringify(list);
    try { GM_setValue(FLEET_MASTER_KEY, str); } catch (e) {}
    localStorage.setItem(FLEET_MASTER_KEY, str);
  }

  function tambahPresetArmadaJikaBaru(namaKurir, platNomor) {
    const nama = String(namaKurir || '').trim();
    const plat = String(platNomor || '').trim().toUpperCase();
    if (!nama && !plat) return;
    const list = muatMasterArmada();
    const exists = list.some(
      (a) => String(a.namaKurir || '').toLowerCase() === nama.toLowerCase() && String(a.platNomor || '').toUpperCase() === plat
    );
    if (!exists) {
      list.push({ namaKurir: nama, platNomor: plat });
      simpanMasterArmada(list);
    }
  }

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

    if (!globalDragListenersAttached) {
      globalDragListenersAttached = true;

      window.addEventListener('mousemove', (e) => {
        if (!activeDragState || !activeDragState.panelEl) return;
        const { panelEl: targetPanel, startX, startY, initialLeft, initialTop } = activeDragState;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = Math.min(Math.max(8, initialLeft + dx), window.innerWidth - targetPanel.offsetWidth - 8);
        const newTop = Math.min(Math.max(8, initialTop + dy), window.innerHeight - 60);
        targetPanel.style.left = `${newLeft}px`;
        targetPanel.style.top = `${newTop}px`;
      });

      window.addEventListener('mouseup', () => {
        if (!activeDragState || !activeDragState.panelEl) return;
        const rect = activeDragState.panelEl.getBoundingClientRect();
        simpanPosisiPanel(Math.round(rect.top), Math.round(rect.left));
        activeDragState = null;
      });
    }

    handleEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      const rect = panelEl.getBoundingClientRect();
      panelEl.style.right = 'auto';
      panelEl.style.left = `${rect.left}px`;
      panelEl.style.top = `${rect.top}px`;
      activeDragState = {
        panelEl,
        startX: e.clientX,
        startY: e.clientY,
        initialLeft: rect.left,
        initialTop: rect.top
      };
      e.preventDefault();
    });
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
    return dapatkanBoolPref(AUTO_KURIR_KEY, true);
  }

  function simpanAutoKurirMBG(val) {
    simpanBoolPref(AUTO_KURIR_KEY, val);
  }

  function dapatkanPanelMinimized() {
    return dapatkanBoolPref(MINIMIZE_KEY, false);
  }

  function simpanPanelMinimized(val) {
    simpanBoolPref(MINIMIZE_KEY, val);
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
   * 6. MINDSPACE AI ENGINE (SMART SCHEDULE, FUZZY DOM MATCHER, WA PARSER & AI SUPPORT)
   * ============================================================================ */
  // 6A. Algoritma AI: Penyusun Jadwal Anti-Konflik Berbasis Batas Waktu & Ritase
  function aiGenerateJadwalCerdas(kpm) {
    const mBatas = jamKeMenit(kpm?.batasWaktu || '10:00') ?? 600;
    const ritase = Math.max(1, parseInt(kpm?.ritase || '1', 10) || 1);
    const offsetRitase = (ritase - 1) * 45;

    const mBerangkat = mBatas + offsetRitase;
    const mTiba = mBerangkat + 25;
    const mAmbil = mTiba + 90;
    const mKembali = mAmbil + 30;
    const mCuci = mKembali + 20;

    return {
      jamKeberangkatan: menitKeJam(mBerangkat),
      jamTibaTujuan: menitKeJam(mTiba),
      jamJadwalPengambilan: menitKeJam(mAmbil),
      jamOmprengKembaliSPPG: menitKeJam(mKembali),
      jamMulaiCuci: menitKeJam(mCuci)
    };
  }

  function aiOptimasiSemuaJadwalKPM() {
    if (dataPenugasan.length === 0) {
      tampilkanToast('Belum ada data KPM untuk dioptimasi.', 'warning');
      return;
    }
    let diperbarui = 0;
    dataPenugasan.forEach((kpm, idx) => {
      if (!kpm.ritase) kpm.ritase = String(Math.floor(idx / 5) + 1);
      const jadwalBaru = aiGenerateJadwalCerdas(kpm);
      Object.assign(kpm, jadwalBaru);
      diperbarui++;
    });
    simpanData(dataPenugasan);
    catatAktivitas(`AI Smart Schedule mengoptimasi ${diperbarui} jadwal KPM`, 'success');
    tampilkanToast(`AI berhasil menyusun jadwal anti-konflik untuk ${diperbarui} KPM!`, 'success');
    renderPanel();
  }

  // 6B. Algoritma AI: Fuzzy Semantic DOM Field Matcher (Auto-Healing Selector)
  function aiSkorKemiripanTeks(teksSumber, kataKunciList) {
    const norm = String(teksSumber || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    if (!norm) return 0;
    let skor = 0;
    for (const kw of kataKunciList) {
      const k = kw.toLowerCase();
      if (norm === k) skor += 100;
      else if (norm.includes(k)) skor += 55;
      else {
        const tokens = k.split(/\s+/);
        const matchTokens = tokens.filter((t) => t.length > 2 && norm.includes(t)).length;
        skor += (matchTokens / Math.max(1, tokens.length)) * 35;
      }
    }
    return skor;
  }

  function aiCariInputDenganFuzzy(kataKunciList, tipeDiizinkan = ['text', 'number', 'time']) {
    if (!dapatkanAiAutoHeal()) return null;
    const kandidat = [...document.querySelectorAll('input')].filter(
      (inp) => !inp.closest('#sipgn-autofill-panel') && !inp.closest('.ms-ui-root') && !inp.disabled && !inp.readOnly && inp.offsetParent !== null && tipeDiizinkan.includes((inp.type || 'text').toLowerCase())
    );

    let terbaik = null;
    let skorTertinggi = 30; // Ambang batas kepercayaan minimal

    for (const inp of kandidat) {
      const labelEl = inp.id ? document.querySelector(`label[for="${CSS.escape(inp.id)}"]`) : inp.closest('label');
      const parentText = inp.parentElement?.parentElement?.innerText || '';
      const gabunganMeta = `${labelEl?.textContent || ''} ${inp.placeholder || ''} ${inp.name || ''} ${inp.id || ''} ${inp.getAttribute('aria-label') || ''} ${parentText.slice(0, 90)}`;
      const skor = aiSkorKemiripanTeks(gabunganMeta, kataKunciList);
      if (skor > skorTertinggi) {
        skorTertinggi = skor;
        terbaik = inp;
      }
    }
    return terbaik;
  }

  // 6C. Algoritma AI: WhatsApp Schedule Parser (Teks Broadcast -> Array Data KPM)
  function aiParseTeksWhatsAppLokal(rawText) {
    const baris = String(rawText || '').split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
    const hasil = [];
    let current = null;
    let defaultKurir = '';
    let defaultPlat = '';
    let defaultRitase = '1';

    for (const line of baris) {
      // Tangkap header global jika ada (mis. "Kurir: Budi | Plat: BK 1234 AB | Ritase 1")
      const globalKurir = line.match(/^(?:kurir|driver|pengemudi)\s*[:=\-]\s*([a-zA-Z\s\.]+)$/i);
      if (globalKurir && !current) {
        defaultKurir = globalKurir[1].trim().toUpperCase();
        continue;
      }
      const globalPlat = line.match(/^(?:plat|nopol|kendaraan)\s*[:=\-]\s*([A-Z0-9\s]+)$/i);
      if (globalPlat && !current) {
        defaultPlat = globalPlat[1].replace(/\s+/g, '').toUpperCase();
        continue;
      }
      const globalRit = line.match(/^ritase\s*[:=\-]?\s*(\d+)$/i);
      if (globalRit && !current) {
        defaultRitase = globalRit[1];
        continue;
      }

      // Deteksi baris nama Sekolah / Posyandu / KPM
      const bersihPrefix = line.replace(/^(?:\d+[\.\)]\s*|[-•*✅🏫👶]\s*)+/, '').trim();
      const isDataField = /^(?:porsi|besar|kecil|balita|busui|menyusui|bumil|hamil|total|kurir|driver|plat|nopol|jam|waktu|batas|ritase)\b/i.test(bersihPrefix);

      if (!isDataField && /[a-zA-Z]{3,}/.test(bersihPrefix)) {
        const inlinePorsi = bersihPrefix.match(/^(.+?)\s*[-–:|]\s*(\d+)\s*(?:porsi|pax|box)?$/i);
        if (current && current.sekolah) hasil.push(current);

        const namaSekolah = (inlinePorsi ? inlinePorsi[1] : bersihPrefix).trim();
        const porsiOtomatis = inlinePorsi ? inlinePorsi[2] : '0';

        current = {
          sekolah: namaSekolah,
          ritase: defaultRitase,
          batasWaktu: '10:00',
          porsiBesar: porsiOtomatis,
          porsiKecil: '0',
          porsiBalita: '',
          porsiIbuMenyusui: '',
          porsiIbuHamil: '',
          namaKurir: defaultKurir,
          platNomor: defaultPlat,
          omprengKembaliAktual: '',
          omprengDicuciAktual: '',
          catatanSelisih: '',
          terpakai: false,
          statusProses: 'belum',
          ...aiGenerateJadwalCerdas({ batasWaktu: '10:00', ritase: defaultRitase })
        };
        continue;
      }

      if (!current) continue;

      const mRitase = line.match(/ritase\s*[:=\-]?\s*(\d+)/i);
      const mBesar = line.match(/(?:porsi\s*)?(?:besar|pb|sma|smp|sd\s*besar)\s*[:=\-]?\s*(\d+)/i);
      const mKecil = line.match(/(?:porsi\s*)?(?:kecil|pk|tk|paud|sd\s*kecil)\s*[:=\-]?\s*(\d+)/i);
      const mBalita = line.match(/balita\s*[:=\-]?\s*(\d+)/i);
      const mBusui = line.match(/(?:busui|ibu\s*menyusui|menyusui)\s*[:=\-]?\s*(\d+)/i);
      const mBumil = line.match(/(?:bumil|ibu\s*hamil|hamil)\s*[:=\-]?\s*(\d+)/i);
      const mTotal = line.match(/(?:total|jumlah|porsi)\s*[:=\-]?\s*(\d+)/i);
      const mKurir = line.match(/(?:kurir|driver|pengemudi)\s*[:=\-]\s*([a-zA-Z\s\.]+)/i);
      const mPlat = line.match(/\b([A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{1,3})\b/);
      const mJam = line.match(/\b(\d{1,2}[:.]\d{2})\b/);

      if (mRitase) current.ritase = mRitase[1];
      if (mBesar) current.porsiBesar = mBesar[1];
      if (mKecil) current.porsiKecil = mKecil[1];
      if (mBalita) current.porsiBalita = mBalita[1];
      if (mBusui) current.porsiIbuMenyusui = mBusui[1];
      if (mBumil) current.porsiIbuHamil = mBumil[1];
      if (mTotal && current.porsiBesar === '0' && current.porsiKecil === '0' && !current.porsiBalita) {
        current.porsiBesar = mTotal[1];
      }
      if (mKurir) current.namaKurir = mKurir[1].trim().toUpperCase();
      if (mPlat) current.platNomor = mPlat[1].replace(/\s+/g, '').toUpperCase();
      if (mJam) {
        current.batasWaktu = normalisasiFormatJam(mJam[1]) || '10:00';
      }
      Object.assign(current, aiGenerateJadwalCerdas(current));
    }

    if (current && current.sekolah) hasil.push(current);
    return hasil;
  }

  function tampilkanModalAiWaParser() {
    const overlay = buatOverlayModal('sipgn-ai-wa-modal');
    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box ms-scroll" style="padding: 22px; border-radius: 24px; width: 520px; max-width: 94vw; max-height: 88vh; overflow-y: auto; text-align: left;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid var(--ms-border);">
          <div>
            <h3 style="margin:0; font-size:15.5px; font-weight:800;">🤖 AI WhatsApp Schedule Parser</h3>
            <div style="font-size:11px; color:var(--ms-text-muted);">Tempel pesan jadwal distribusi dari WhatsApp untuk otomatis diubah jadi KPM</div>
          </div>
          <button id="ms-close-wa-modal" class="ms-btn ms-btn-ghost" style="width:28px; height:28px; border-radius:50%; padding:0;">✕</button>
        </div>

        <div class="ms-bento" style="padding:10px 12px; margin-bottom:10px; font-size:10.5px; color:var(--ms-text-sub); background:rgba(56,189,248,0.06); border-color:rgba(56,189,248,0.24);">
          <b>Contoh format yang didukung:</b><br>
          <span style="font-family:var(--ms-font-mono); color:#94a3b8;">
            1. SMAN 1 MEDAN<br>
            Besar: 120, Kecil: 80, Jam: 09:30<br>
            Kurir: BUDI | BK 1234 ABC<br>
            2. POSYANDU MELATI<br>
            Balita: 35, Busui: 15, Bumil: 10
          </span>
        </div>

        <textarea id="ms-wa-raw-input" class="ms-textarea ms-scroll" rows="7" placeholder="Tempel (paste) teks jadwal distribusi WhatsApp di sini..." style="resize:vertical; margin-bottom:10px;"></textarea>

        <div id="ms-wa-preview-box" style="margin-bottom:12px;"></div>

        <div style="display:flex; gap:8px;">
          <button id="ms-wa-btn-preview" class="ms-btn ms-btn-ghost" style="flex:1; padding:10px;">🔍 Pratinjau Hasil AI</button>
          <button id="ms-wa-btn-import" class="ms-btn ms-btn-aurora" style="flex:1.4; padding:10px;">✨ Ekstrak & Simpan ke Daftar KPM</button>
        </div>
      </div>
    `;
    bantuAppendKeBody(overlay);

    const textarea = document.getElementById('ms-wa-raw-input');
    const previewBox = document.getElementById('ms-wa-preview-box');
    textarea.focus();

    const renderPreview = () => {
      const parsed = aiParseTeksWhatsAppLokal(textarea.value);
      if (parsed.length === 0) {
        previewBox.innerHTML = `<div style="font-size:11px; color:var(--ms-amber); padding:6px 0;">⚠️ Belum ada baris KPM yang terdeteksi. Pastikan setiap nama sekolah/posyandu berada pada baris tersendiri.</div>`;
        return [];
      }
      previewBox.innerHTML = `
        <div class="ms-bento ms-scroll" style="padding:10px; max-height:150px; overflow-y:auto;">
          <div style="font-size:10.5px; font-weight:800; color:var(--ms-emerald); margin-bottom:6px;">✅ Terdeteksi ${parsed.length} KPM (Jadwal Otomatis Disusun AI):</div>
          ${parsed.map((p) => `
            <div style="font-size:11px; padding:4px 0; border-bottom:1px dashed var(--ms-border); display:flex; justify-content:space-between;">
              <b>${escapeHtml(p.sekolah)}</b>
              <span style="font-family:var(--ms-font-mono); color:var(--ms-cyan);">${hitungTotalPorsi(p)} porsi • ${p.jamKeberangkatan}</span>
            </div>
          `).join('')}
        </div>
      `;
      return parsed;
    };

    document.getElementById('ms-close-wa-modal').onclick = () => overlay.remove();
    document.getElementById('ms-wa-btn-preview').onclick = renderPreview;
    document.getElementById('ms-wa-btn-import').onclick = () => {
      const parsed = renderPreview();
      if (parsed.length === 0) return;
      parsed.forEach((p) => tambahPresetArmadaJikaBaru(p.namaKurir, p.platNomor));
      dataPenugasan = [...dataPenugasan, ...parsed];
      if (indexTerpilih === -1) indexTerpilih = 0;
      simpanData(dataPenugasan);
      catatAktivitas(`AI Parser mengekstrak ${parsed.length} KPM dari WhatsApp`, 'success');
      tampilkanToast(`Berhasil menambahkan ${parsed.length} KPM dari teks WhatsApp!`, 'success');
      overlay.remove();
      activeTab = 'daftar';
      renderPanel();
    };
  }

  // 6D. AI Support Assistant (100% Direct Vercel Gemini API)
  function tanyaMindspaceAI(pertanyaan) {
    return new Promise((resolve) => {
      const kpmAktif = indexTerpilih >= 0 ? dataPenugasan[indexTerpilih] : null;
      const konteks = {
        version: CURRENT_VERSION,
        url: location.pathname,
        sppg: dapatkanNamaSPPG(),
        totalKpm: dataPenugasan.length,
        totalPorsi: dataPenugasan.reduce((a, c) => a + hitungTotalPorsi(c), 0),
        selisihCount: dataPenugasan.filter((d) => hitungSelisihOmpreng(d).adaSelisih).length,
        kpmAktif: kpmAktif ? {
          sekolah: kpmAktif.sekolah,
          porsi: hitungTotalPorsi(kpmAktif),
          status: kpmAktif.statusProses,
          konflik: periksaKonflikPreFlight(kpmAktif)
        } : null,
        recentLogs: activityLogs.slice(0, 6)
      };

      const token = dapatkanAuthToken();
      if (!token) {
        return resolve('⚠️ Sesi login MindHUB tidak ditemukan. Silakan buka tab **⚙️ Sistem → Logout** lalu login ulang.');
      }

      GM_xmlhttpRequest({
        method: 'POST',
        url: getAiApiUrl(),
        timeout: 20000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: JSON.stringify({
          prompt: pertanyaan,
          token: token,
          context: konteks,
          device_id: dapatkanDeviceID()
        }),
        onload: (res) => {
          try {
            const json = JSON.parse(res.responseText);
            if (res.status === 200 && json && json.reply) {
              return resolve(json.reply);
            }
            const errMsg = json?.error || json?.message || `Server merespons status HTTP ${res.status}`;
            catatAktivitas(`AI API Error: ${errMsg}`, 'error');
            return resolve(`❌ **Gagal memproses dari server AI (HTTP ${res.status}):** ${errMsg}`);
          } catch (e) {
            const snippet = (res.responseText || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
            catatAktivitas(`AI API Non-JSON (HTTP ${res.status})`, 'error');
            return resolve(`❌ **Respon server bukan JSON (HTTP ${res.status}).** Detail: \`${snippet || 'Kosong / Rute 404/500 Vercel'}\``);
          }
        },
        onerror: () => {
          catatAktivitas('AI API Network Error', 'error');
          resolve('❌ **Gagal terhubung ke server Mindspace AI.** Periksa koneksi internet kamu lalu coba kirim ulang.');
        },
        ontimeout: () => {
          catatAktivitas('AI API Timeout', 'error');
          resolve('⏳ **Waktu tunggu habis (Timeout).** Server AI terlalu lama merespons, silakan coba lagi.');
        }
      });
    });
  }

  /* ============================================================================
   * 7. MODAL DIALOGS (LOGIN, WELCOME, STATUS, KPM EDITOR, COMMAND PALETTE)
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
      { ikon: '✨', judul: 'AI Optimasi Jadwal Semua KPM', sub: 'Susun ulang seluruh jam agar bebas konflik Pre-Flight', aksi: () => aiOptimasiSemuaJadwalKPM() },
      { ikon: '💬', judul: 'AI Parser Jadwal WhatsApp', sub: 'Tempel teks broadcast WA untuk ekstrak KPM otomatis', aksi: () => tampilkanModalAiWaParser() },
      { ikon: '🧠', judul: 'Buka Tab AI Support & Smart Engine', sub: 'Konsultasi diagnosa error & asisten operasional AI', aksi: () => { activeTab = 'ai'; renderPanel(); } },
      { ikon: '➕', judul: 'Tambah Data KPM Baru', sub: 'Buka editor formulir KPM lengkap', aksi: () => tampilkanModalFormKPM(null, null) },
      { ikon: '⏭️', judul: 'Lompat ke KPM Belum Diproses Berikutnya', sub: 'Pilih otomatis antrean KPM dengan status Belum', aksi: () => pilihKPMBelumBerikutnya(true) },
      { ikon: '🔄', judul: 'Cek Pembaruan Versi Skrip (In-App Update)', sub: `Versi terpasang saat ini: v${CURRENT_VERSION}`, aksi: () => {
        cekUpdateAplikasiInApp().then((rel) => {
          if (rel) tampilkanModalDetailUpdate();
          else tampilkanToast(`Anda sudah menggunakan versi terbaru (v${CURRENT_VERSION}).`, 'success');
        });
      }},
      { ikon: '📥', judul: 'Export Daftar KPM ke CSV', sub: 'Unduh seluruh jadwal & porsi KPM ke spreadsheet CSV', aksi: () => exportCSVData() },
      { ikon: '☁️', judul: 'Backup Data ke Cloud & Lokal', sub: 'Sinkronisasi terenkripsi database KPM sekarang', aksi: () => downloadBackupData() },
      { ikon: '📜', judul: 'Lihat Log Aktivitas Otomatisasi', sub: 'Riwayat eksekusi pengisian formulir sesi ini', aksi: () => tampilkanModalActivityLog() },
      { ikon: '🎯', judul: 'Reset Posisi Panel Melayang', sub: 'Kembalikan panel ke pojok kanan atas', aksi: () => { resetPosisiPanel(); renderPanel(); tampilkanToast('Posisi panel dikembalikan ke default.', 'info'); } }
    ];

    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box" style="width: 490px; max-width: 94vw; border-radius: 22px; overflow: hidden; padding: 14px;">
        <div style="display:flex; align-items:center; gap:10px; padding: 4px 8px 12px; border-bottom: 1px solid var(--ms-border);">
          <span style="font-size:16px;">⌘</span>
          <input id="ms-cmd-input" class="ms-input" placeholder="Ketik perintah cepat, fitur AI, atau nama KPM..." style="border:none; background:transparent; padding:4px; font-size:13.5px; box-shadow:none;" />
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
            <div style="font-size:11px; color:var(--ms-text-muted);">Riwayat eksekusi otomatisasi & AI real-time</div>
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
          btnSubmit.textContent = '🔑 Login Akun';
        }
      } catch (err) {
        feedbackEl.style.color = 'var(--ms-rose)';
        feedbackEl.textContent = typeof err === 'string' ? err : 'Terjadi kesalahan koneksi.';
        btnSubmit.disabled = false;
        btnSubmit.textContent = '🔑 Login Akun';
      }
    };

    btnSubmit.onclick = prosesLogin;
    inputPass.onkeydown = (e) => { if (e.key === 'Enter') prosesLogin(); };
    inputUser.onkeydown = (e) => { if (e.key === 'Enter') inputPass.focus(); };
  }

  function tampilkanLoadingScreen(onLanjutkan) {
    const overlay = buatOverlayModal('sipgn-splash-loading');
    const namaSppgLama = dapatkanNamaSPPG();
    const devId = dapatkanDeviceID();
    const authUser = dapatkanAuthUser();
    const totalKpm = Array.isArray(dataPenugasan) ? dataPenugasan.length : 0;
    const totalPorsi = Array.isArray(dataPenugasan)
      ? dataPenugasan.reduce((acc, item) => acc + hitungTotalPorsi(item), 0)
      : 0;
    const sapaan = namaSppgLama ? `Halo, ${namaSppgLama} 👋` : 'Selamat Datang di Workspace Otomatisasi';

    overlay.innerHTML = `
      <style>
        .ms-splash-card {
          padding: 28px 30px;
          border-radius: 28px;
          width: 560px;
          max-width: 94vw;
          max-height: 92vh;
          overflow-y: auto;
          text-align: left;
          box-shadow: 0 36px 90px rgba(0,0,0,0.88), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .ms-splash-hero {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-bottom: 18px;
        }
        .ms-splash-avatar-wrap {
          position: relative;
          width: 72px;
          height: 72px;
          aspect-ratio: 1 / 1;
          flex-shrink: 0;
        }
        .ms-splash-avatar-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(56,189,248,0.18), rgba(168,85,247,0.2));
          border: 1.5px solid rgba(56,189,248,0.38);
          padding: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow: 0 10px 26px rgba(56,189,248,0.22);
        }
        .ms-splash-avatar-inner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .ms-splash-telemetry {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }
        .ms-splash-step-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        @media (max-width: 640px) {
          .ms-splash-card {
            padding: 22px 18px calc(env(safe-area-inset-bottom, 0px) + 22px) !important;
          }
          .ms-splash-hero {
            flex-direction: column;
            text-align: center;
            gap: 12px;
          }
          .ms-splash-hero-text {
            width: 100%;
          }
          .ms-splash-telemetry {
            grid-template-columns: repeat(2, 1fr);
          }
          .ms-splash-telemetry > div:last-child {
            grid-column: span 2;
          }
          .ms-splash-step-row {
            font-size: 10.5px;
          }
        }
      </style>

      <div class="ms-aurora-shell ms-modal-box ms-scroll ms-splash-card">
        <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:13px; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="sipgn-splash-live-dot" style="width:8px; height:8px; border-radius:50%; background:var(--ms-cyan); box-shadow:0 0 10px var(--ms-cyan);"></span>
            <span style="font-size:10px; font-weight:800; color:var(--ms-cyan); font-family:var(--ms-font-mono); letter-spacing:0.6px; text-transform:uppercase;">Mindspace AI & Security Boot</span>
          </div>
          <span style="font-size:10px; font-weight:700; color:var(--ms-text-muted); font-family:var(--ms-font-mono); background:rgba(255,255,255,0.05); padding:3px 9px; border-radius:99px; border:1px solid rgba(255,255,255,0.09);">v${escapeHtml(CURRENT_VERSION)}</span>
        </div>

        <div class="ms-splash-hero">
          <div class="ms-splash-avatar-wrap">
            <div class="ms-splash-avatar-inner">
              <img src="https://raw.githubusercontent.com/yosdniel/yosdniel.github.io/refs/heads/main/assets/favicon512.png" alt="Mindspace Logo" />
            </div>
          </div>
          <div class="ms-splash-hero-text" style="overflow:hidden;">
            <div style="font-size:19.5px; font-weight:800; letter-spacing:-0.3px; background:linear-gradient(135deg, #f8fafc 20%, #38bdf8 65%, #c084fc 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; line-height:1.2;">
              SIPGN Autofill POP + AI
            </div>
            <div style="font-size:12.5px; font-weight:600; color:#e2e8f0; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHtml(sapaan)}
            </div>
            <div style="font-size:10.5px; color:var(--ms-text-muted); margin-top:2px;">
              Smart Schedule & AI Support Suite • <strong style="color:#94a3b8;">Mindspace Studio</strong>
            </div>
          </div>
        </div>

        <div class="ms-splash-telemetry">
          <div class="ms-bento" style="padding:10px 12px; background:rgba(6,10,21,0.72);">
            <div style="font-size:9px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase; margin-bottom:3px;">Device ID</div>
            <div style="font-size:11px; font-weight:800; color:var(--ms-amber); font-family:var(--ms-font-mono); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(devId)}</div>
          </div>
          <div class="ms-bento" style="padding:10px 12px; background:rgba(6,10,21,0.72);">
            <div style="font-size:9px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase; margin-bottom:3px;">Akun MindHUB</div>
            <div style="font-size:11px; font-weight:800; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">@${escapeHtml(authUser?.username || 'Memeriksa...')}</div>
          </div>
          <div class="ms-bento" style="padding:10px 12px; background:rgba(6,10,21,0.72);">
            <div style="font-size:9px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase; margin-bottom:3px;">Vault Lokal</div>
            <div style="font-size:11px; font-weight:800; color:var(--ms-emerald); font-family:var(--ms-font-mono);">${totalKpm} KPM • ${totalPorsi.toLocaleString('id-ID')} Porsi</div>
          </div>
        </div>

        <div class="ms-bento" style="padding:14px 15px; margin-bottom:16px; background:rgba(8,13,26,0.82); border-color:rgba(56,189,248,0.24);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
            <span id="sipgn-splash-status" style="font-size:11.5px; font-weight:700; color:#f8fafc; line-height:1.35;">Menginisialisasi Encrypted Vault & AI Engine...</span>
            <span id="sipgn-splash-percent" style="font-size:11.5px; font-weight:800; color:var(--ms-cyan); font-family:var(--ms-font-mono); flex-shrink:0;">15%</span>
          </div>

          <div style="width:100%; height:7px; background:rgba(15,23,42,0.95); border-radius:99px; overflow:hidden; margin-bottom:13px; border:1px solid rgba(255,255,255,0.06);">
            <div id="sipgn-splash-bar" style="width:15%; height:100%; background:linear-gradient(90deg, #0ea5e9, #6366f1, #a855f7, #10b981); border-radius:99px; transition:width 0.35s cubic-bezier(0.16, 1, 0.3, 1);"></div>
          </div>

          <div style="display:flex; flex-direction:column; gap:7px; font-size:11px;">
            <div id="ms-step-vault" class="ms-splash-step-row" style="color:var(--ms-cyan);">
              <span>🔐 Menyiapkan Sistem & AI Smart Engine</span>
              <span class="ms-step-badge" style="font-family:var(--ms-font-mono); font-size:9.5px; font-weight:700; flex-shrink:0;">AKTIF</span>
            </div>
            <div id="ms-step-auth" class="ms-splash-step-row" style="color:var(--ms-text-muted);">
              <span>🔑 Memeriksa Akses Akun</span>
              <span class="ms-step-badge" style="font-family:var(--ms-font-mono); font-size:9.5px; font-weight:700; flex-shrink:0;">MENUNGGU</span>
            </div>
            <div id="ms-step-license" class="ms-splash-step-row" style="color:var(--ms-text-muted);">
              <span>🛡️ Mengecek Status Layanan</span>
              <span class="ms-step-badge" style="font-family:var(--ms-font-mono); font-size:9.5px; font-weight:700; flex-shrink:0;">MENUNGGU</span>
            </div>
            <div id="ms-step-workspace" class="ms-splash-step-row" style="color:var(--ms-text-muted);">
              <span>⚡ Memuat Data & Ruang Kerja</span>
              <span class="ms-step-badge" style="font-family:var(--ms-font-mono); font-size:9.5px; font-weight:700; flex-shrink:0;">MENUNGGU</span>
            </div>
          </div>
        </div>

        <div id="sipgn-splash-idle-note" style="text-align:center; font-size:11px; color:var(--ms-text-muted); padding:4px 0;">
          Harap tunggu sebentar, sistem sedang memverifikasi keamanan sesi Anda...
        </div>
        <button id="sipgn-btn-splash-lanjutkan" class="ms-btn ms-btn-aurora" style="display:none; width:100%; padding:13px; font-size:13.5px; border-radius:14px;">
          🚀 Masuk ke Workspace Sekarang
        </button>
        <button id="sipgn-btn-splash-retry" class="ms-btn ms-btn-danger" style="display:none; width:100%; padding:13px; font-size:13.5px; border-radius:14px;">
          🔄 Coba Hubungkan Ulang
        </button>

        <div style="margin-top:15px; padding-top:11px; border-top:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center; font-size:10px; color:#64748b;">
          <span>AES-XOR Vault • Mindspace AI</span>
          <span>Crafted by <strong style="color:#94a3b8;">Mindspace Studio</strong></span>
        </div>
      </div>
    `;
    bantuAppendKeBody(overlay);

    const statusEl = document.getElementById('sipgn-splash-status');
    const percentEl = document.getElementById('sipgn-splash-percent');
    const barEl = document.getElementById('sipgn-splash-bar');
    const idleNoteEl = document.getElementById('sipgn-splash-idle-note');
    const btnLanjut = document.getElementById('sipgn-btn-splash-lanjutkan');
    const btnRetry = document.getElementById('sipgn-btn-splash-retry');
    const liveDot = document.getElementById('sipgn-splash-live-dot');

    const setStepState = (stepId, state) => {
      const row = document.getElementById(stepId);
      if (!row) return;
      const badge = row.querySelector('.ms-step-badge');
      if (state === 'done') {
        row.style.color = 'var(--ms-emerald)';
        if (badge) badge.textContent = '✓ SELESAI';
      } else if (state === 'active') {
        row.style.color = 'var(--ms-cyan)';
        if (badge) badge.textContent = '⏳ PROSES';
      } else if (state === 'error') {
        row.style.color = 'var(--ms-rose)';
        if (badge) badge.textContent = '✕ GAGAL';
      }
    };

    setStepState('ms-step-vault', 'done');

    return {
      updateProgress: (persen, pesan) => {
        if (barEl) barEl.style.width = `${persen}%`;
        if (percentEl) percentEl.textContent = `${persen}%`;
        if (statusEl) statusEl.textContent = pesan;

        if (persen >= 25 && persen < 55) {
          setStepState('ms-step-auth', 'active');
        } else if (persen >= 55 && persen < 90) {
          setStepState('ms-step-auth', 'done');
          setStepState('ms-step-license', 'active');
        } else if (persen >= 90) {
          setStepState('ms-step-auth', 'done');
          setStepState('ms-step-license', 'done');
          setStepState('ms-step-workspace', 'active');
        }
      },
      siapLanjut: () => {
        if (barEl) barEl.style.width = '100%';
        if (percentEl) { percentEl.textContent = '100%'; percentEl.style.color = 'var(--ms-emerald)'; }
        if (statusEl) { statusEl.textContent = 'Seluruh Sistem & AI Terverifikasi Siap Digunakan'; statusEl.style.color = 'var(--ms-emerald)'; }
        if (liveDot) { liveDot.style.background = 'var(--ms-emerald)'; liveDot.style.boxShadow = '0 0 10px var(--ms-emerald)'; }

        setStepState('ms-step-auth', 'done');
        setStepState('ms-step-license', 'done');
        setStepState('ms-step-workspace', 'done');

        if (idleNoteEl) idleNoteEl.style.display = 'none';
        if (btnLanjut) {
          btnLanjut.style.display = 'inline-flex';
          btnLanjut.onclick = () => { overlay.remove(); if (onLanjutkan) onLanjutkan(); };
        }
      },
      tampilkanGagal: (pesanError) => {
        if (barEl) { barEl.style.width = '100%'; barEl.style.background = 'var(--ms-rose)'; }
        if (percentEl) { percentEl.textContent = 'ERR'; percentEl.style.color = 'var(--ms-rose)'; }
        if (statusEl) { statusEl.textContent = pesanError || 'Gagal terhubung ke server'; statusEl.style.color = 'var(--ms-rose)'; }
        if (liveDot) { liveDot.style.background = 'var(--ms-rose)'; liveDot.style.boxShadow = '0 0 10px var(--ms-rose)'; }

        setStepState('ms-step-license', 'error');

        if (idleNoteEl) idleNoteEl.style.display = 'none';
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
        <p style="margin: 0 0 18px; font-size: 12px; color: var(--ms-text-muted); line-height: 1.5;">Masukkan nama unit SPPG Anda satu kali untuk sinkronisasi otomatis ke profil perangkat & AI Assistant.</p>
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
   * 8. ENCRYPTED DATA KPM VAULT, CSV IMPORT/EXPORT & AUTO CLOUD SYNC
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
      omprengKembaliAktual: '',
      omprengDicuciAktual: '',
      catatanSelisih: '',
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
        omprengKembaliAktual: '',
        omprengDicuciAktual: '',
        catatanSelisih: '',
        ...d,
      }));
    } catch (e) {
      return [...DATA_AWAL];
    }
  }

  function jadwalkanAutoCloudSync(data) {
    if (!dapatkanAutoCloudSync() || !dapatkanAuthToken()) return;
    if (autoCloudSyncTimer) clearTimeout(autoCloudSyncTimer);
    cloudSyncState = 'syncing';

    autoCloudSyncTimer = setTimeout(() => {
      const backupPayload = {
        Application: 'SIPGN POP - Autofill',
        Version: CURRENT_VERSION,
        Developed: 'Mindspace Studio',
        dibuatPada: new Date().toISOString(),
        dataKPM: data,
      };
      const token = dapatkanAuthToken();
      GM_xmlhttpRequest({
        method: 'POST',
        url: getVercelApiUrl(),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: JSON.stringify({
          action: 'save_backup',
          device_id: dapatkanDeviceID(),
          user_id: dapatkanUserIdAktif(),
          backup_data: backupPayload,
          auto_delete_days: 3
        }),
        onload: () => {
          cloudSyncState = 'synced';
          const badgeEl = document.getElementById('ms-cloud-sync-pill');
          if (badgeEl) {
            badgeEl.textContent = '☁️ Synced';
            badgeEl.style.color = 'var(--ms-emerald)';
          }
        },
        onerror: () => {
          cloudSyncState = 'error';
          const badgeEl = document.getElementById('ms-cloud-sync-pill');
          if (badgeEl) {
            badgeEl.textContent = '☁️ Offline';
            badgeEl.style.color = 'var(--ms-amber)';
          }
        }
      });
    }, 2400);
  }

  function simpanData(data, skipCloudSync = false) {
    try {
      const cipher = _0xVault.enc(JSON.stringify(data));
      localStorage.setItem(STORAGE_KEY, cipher);
    } catch (e) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    if (!skipCloudSync) {
      jadwalkanAutoCloudSync(data);
    }
  }

  let dataPenugasan = muatData();
  let indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;

  function pilihKPMBelumBerikutnya(tampilkanNotif = true) {
    if (dataPenugasan.length === 0) return false;
    const startIdx = indexTerpilih >= 0 ? indexTerpilih : -1;
    for (let offset = 1; offset <= dataPenugasan.length; offset++) {
      const idx = (startIdx + offset) % dataPenugasan.length;
      if (dataPenugasan[idx].statusProses === 'belum') {
        indexTerpilih = idx;
        renderPanel();
        if (tampilkanNotif) {
          tampilkanToast(`Antrean berikutnya: <b>${escapeHtml(dataPenugasan[idx].sekolah)}</b>`, 'info');
        }
        return true;
      }
    }
    if (tampilkanNotif) {
      tampilkanToast('Semua KPM sudah diproses!', 'success');
    }
    return false;
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

  function hitungSelisihOmpreng(data) {
    const dikirim = hitungTotalPorsi(data);
    const kembali = data.omprengKembaliAktual !== '' && data.omprengKembaliAktual !== null && data.omprengKembaliAktual !== undefined
      ? Number(data.omprengKembaliAktual)
      : null;
    const dicuci = data.omprengDicuciAktual !== '' && data.omprengDicuciAktual !== null && data.omprengDicuciAktual !== undefined
      ? Number(data.omprengDicuciAktual)
      : null;

    const selisihKembali = kembali !== null && !isNaN(kembali) ? kembali - dikirim : 0;
    const selisihCuci = dicuci !== null && !isNaN(dicuci) ? dicuci - (kembali !== null && !isNaN(kembali) ? kembali : dikirim) : 0;
    const adaSelisih = (kembali !== null && selisihKembali !== 0) || (dicuci !== null && selisihCuci !== 0);
    return { dikirim, kembali, dicuci, selisihKembali, selisihCuci, adaSelisih };
  }

  function jenisKPM(data) {
    return (data.porsiBalita || data.porsiIbuMenyusui || data.porsiIbuHamil) ? 'posyandu' : 'sekolah';
  }

  function exportCSVData() {
    const headers = [
      'sekolah', 'ritase', 'batasWaktu', 'porsiBesar', 'porsiKecil',
      'porsiBalita', 'porsiIbuMenyusui', 'porsiIbuHamil', 'namaKurir', 'platNomor',
      'jamKeberangkatan', 'jamTibaTujuan', 'jamJadwalPengambilan', 'jamOmprengKembaliSPPG', 'jamMulaiCuci',
      'omprengKembaliAktual', 'omprengDicuciAktual', 'catatanSelisih', 'statusProses'
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

          const kurirVal = getVal(['kurir', 'driver'], '');
          const platVal = getVal(['plat', 'nopol'], '');
          tambahPresetArmadaJikaBaru(kurirVal, platVal);

          imported.push({
            sekolah: namaSekolah,
            ritase: getVal(['ritase'], '1'),
            batasWaktu: getVal(['batas', 'waktu'], '10:00'),
            porsiBesar: getVal(['besar'], '0'),
            porsiKecil: getVal(['kecil'], '0'),
            porsiBalita: getVal(['balita'], ''),
            porsiIbuMenyusui: getVal(['menyusui'], ''),
            porsiIbuHamil: getVal(['hamil'], ''),
            namaKurir: kurirVal,
            platNomor: platVal,
            jamKeberangkatan: getVal(['berangkat'], ''),
            jamTibaTujuan: getVal(['tiba'], ''),
            jamJadwalPengambilan: getVal(['jadwal', 'ambil'], ''),
            jamOmprengKembaliSPPG: getVal(['kembali'], ''),
            jamMulaiCuci: getVal(['cuci'], ''),
            omprengKembaliAktual: getVal(['kembaliaktual'], ''),
            omprengDicuciAktual: getVal(['dicuciaktual'], ''),
            catatanSelisih: getVal(['catatanselisih'], ''),
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
      onload: () => {
        cloudSyncState = 'synced';
        tampilkanToast('Backup tersinkron ke Cloud Database!', 'success');
      },
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
          omprengKembaliAktual: '',
          omprengDicuciAktual: '',
          catatanSelisih: '',
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
            omprengKembaliAktual: '',
            omprengDicuciAktual: '',
            catatanSelisih: '',
            ...d,
          }));
          indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;
          simpanData(dataPenugasan, true);
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

  function tampilkanModalMasterArmada(onUpdated = null) {
    const overlay = buatOverlayModal('sipgn-fleet-modal');
    const renderFleetContent = () => {
      const armadaList = muatMasterArmada();
      overlay.innerHTML = `
        <div class="ms-aurora-shell ms-modal-box ms-scroll" style="padding: 22px; border-radius: 24px; width: 460px; max-width: 94vw; max-height: 86vh; overflow-y: auto; text-align: left;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--ms-border);">
            <div>
              <h3 style="margin:0; font-size:15.5px; font-weight:800;">🚚 Master Database Kurir & Armada</h3>
              <div style="font-size:11px; color:var(--ms-text-muted);">Simpan preset kurir & plat nomor untuk pemilihan cepat</div>
            </div>
            <button id="ms-close-fleet-modal" class="ms-btn ms-btn-ghost" style="width:28px; height:28px; border-radius:50%; padding:0;">✕</button>
          </div>

          <div class="ms-bento" style="padding:12px; margin-bottom:14px;">
            <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:8px; margin-bottom:8px;">
              <input id="ms-new-fleet-kurir" class="ms-input" placeholder="Nama Kurir (mis. BUDI)" />
              <input id="ms-new-fleet-plat" class="ms-input" placeholder="Plat (mis. BK1234AB)" style="text-transform:uppercase;" />
            </div>
            <button id="ms-btn-add-fleet" class="ms-btn ms-btn-cyan" style="width:100%; padding:9px;">➕ Tambah ke Master Armada</button>
          </div>

          <div class="ms-scroll" style="max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
            ${armadaList.length === 0
              ? `<div style="padding:18px; text-align:center; font-size:11.5px; color:var(--ms-text-muted);">Belum ada preset kurir tersimpan.</div>`
              : armadaList.map((a, idx) => `
                <div class="ms-bento" style="padding:9px 12px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:12px; font-weight:700; color:#f8fafc;">🛵 ${escapeHtml(a.namaKurir || '-')}</div>
                    <div style="font-size:10.5px; font-family:var(--ms-font-mono); color:var(--ms-amber);">${escapeHtml(a.platNomor || '-')}</div>
                  </div>
                  <button class="ms-btn ms-btn-danger ms-del-fleet-btn" data-idx="${idx}" style="padding:4px 8px; font-size:10.5px;">🗑️</button>
                </div>
              `).join('')
            }
          </div>
        </div>
      `;

      overlay.querySelector('#ms-close-fleet-modal').onclick = () => { overlay.remove(); if (onUpdated) onUpdated(); };
      overlay.querySelector('#ms-btn-add-fleet').onclick = () => {
        const k = overlay.querySelector('#ms-new-fleet-kurir').value.trim();
        const p = overlay.querySelector('#ms-new-fleet-plat').value.trim().toUpperCase();
        if (!k && !p) { tampilkanToast('Isi nama kurir atau plat nomor.', 'warning'); return; }
        tambahPresetArmadaJikaBaru(k, p);
        tampilkanToast('Preset kurir & armada disimpan!', 'success');
        renderFleetContent();
      };
      overlay.querySelectorAll('.ms-del-fleet-btn').forEach((btn) => {
        btn.onclick = () => {
          const i = Number(btn.dataset.idx);
          const cur = muatMasterArmada();
          cur.splice(i, 1);
          simpanMasterArmada(cur);
          renderFleetContent();
        };
      });
    };

    renderFleetContent();
    bantuAppendKeBody(overlay);
  }

  function tampilkanModalFormKPM(dataEdit = null, indexTarget = null) {
    const overlay = buatOverlayModal('sipgn-kpm-form-modal');
    const isEdit = dataEdit !== null;
    const armadaPresets = muatMasterArmada();

    const field = (label, id, ph, val = '') => `
      <div>
        <label style="display:block; font-size:10px; font-weight:700; color:#94a3b8; margin-bottom:4px; text-transform:uppercase;">${label}</label>
        <input id="${id}" class="ms-input" placeholder="${ph}" value="${escapeHtml(val)}" />
      </div>
    `;

    overlay.innerHTML = `
      <div class="ms-aurora-shell ms-modal-box ms-scroll" style="padding: 22px; border-radius: 24px; width: 740px; max-width: 94vw; max-height: 90vh; overflow-y: auto; text-align: left;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--ms-border);">
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:800;">${isEdit ? '✏️ Edit Data KPM' : '✨ Tambah Data KPM Baru'}</h3>
            <div style="font-size:11px; color:var(--ms-text-muted);">Atur detail porsi, preset kurir & armada, jadwal distribusi, atau gunakan AI Auto-Jadwal.</div>
          </div>
          <button id="ms-close-kpm-modal" class="ms-btn ms-btn-ghost" style="width:30px; height:30px; border-radius:50%; padding:0;">✕</button>
        </div>

        <div class="ms-bento" style="padding:10px 12px; margin-bottom:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-size:10.5px; font-weight:700; color:var(--ms-cyan);">🚚 Preset Armada:</span>
          <select id="sipgn-select-preset-armada" class="ms-select" style="flex:1; min-width:180px; padding:7px 28px 7px 10px; font-size:11.5px;">
            <option value="">-- Pilih dari Master Kurir & Plat --</option>
            ${armadaPresets.map((a, idx) => `<option value="${idx}">${escapeHtml(a.namaKurir)} (${escapeHtml(a.platNomor)})</option>`).join('')}
          </select>
          <button type="button" id="sipgn-btn-ai-fill-schedule" class="ms-btn ms-btn-aurora" style="padding:7px 11px; font-size:10.5px;">✨ AI Isi Jam Otomatis</button>
          <button type="button" id="sipgn-btn-manage-fleet-inline" class="ms-btn ms-btn-ghost" style="padding:7px 10px; font-size:10.5px;">⚙️ Preset</button>
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

        <div class="ms-bento" style="padding:12px; margin-top:12px; border-color:rgba(168,85,247,0.28);">
          <div style="font-size:10.5px; font-weight:800; color:#c084fc; text-transform:uppercase; margin-bottom:8px;">📊 Pelacak Selisih Ompreng (Kembali vs Dicuci)</div>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
            ${field('Ompreng Kembali Aktual (Kosong = Sesuai Porsi)', 'sipgn-in-omprengKembaliAktual', 'Misal: 10', dataEdit?.omprengKembaliAktual)}
            ${field('Ompreng Dicuci Aktual (Kosong = Sesuai Kembali)', 'sipgn-in-omprengDicuciAktual', 'Misal: 10', dataEdit?.omprengDicuciAktual)}
            ${field('Catatan Selisih / Rusak / Tertinggal', 'sipgn-in-catatanSelisih', 'Misal: 1 tertinggal di UKS', dataEdit?.catatanSelisih)}
          </div>
        </div>

        <div style="margin-top:18px; display:flex; gap:8px;">
          <button id="ms-cancel-kpm-modal" class="ms-btn ms-btn-ghost" style="flex:1; padding:11px;">Batal</button>
          <button id="sipgn-btn-save-kpm-modal" class="ms-btn ms-btn-emerald" style="flex:2; padding:11px; font-size:12.5px;">${isEdit ? '💾 Simpan Perubahan' : '🚀 Simpan Data KPM'}</button>
        </div>
      </div>
    `;
    bantuAppendKeBody(overlay);

    const presetSel = document.getElementById('sipgn-select-preset-armada');
    presetSel.onchange = (e) => {
      if (e.target.value === '') return;
      const chosen = muatMasterArmada()[Number(e.target.value)];
      if (chosen) {
        document.getElementById('sipgn-in-namaKurir').value = chosen.namaKurir || '';
        document.getElementById('sipgn-in-platNomor').value = chosen.platNomor || '';
        tampilkanToast(`Kurir ${escapeHtml(chosen.namaKurir)} diterapkan.`, 'info', 2000);
      }
    };

    document.getElementById('sipgn-btn-ai-fill-schedule').onclick = () => {
      const batas = document.getElementById('sipgn-in-batasWaktu').value.trim() || '10:00';
      const rit = document.getElementById('sipgn-in-ritase').value.trim() || '1';
      const hasilJam = aiGenerateJadwalCerdas({ batasWaktu: batas, ritase: rit });
      document.getElementById('sipgn-in-jamKeberangkatan').value = hasilJam.jamKeberangkatan;
      document.getElementById('sipgn-in-jamTibaTujuan').value = hasilJam.jamTibaTujuan;
      document.getElementById('sipgn-in-jamJadwalPengambilan').value = hasilJam.jamJadwalPengambilan;
      document.getElementById('sipgn-in-jamOmprengKembaliSPPG').value = hasilJam.jamOmprengKembaliSPPG;
      document.getElementById('sipgn-in-jamMulaiCuci').value = hasilJam.jamMulaiCuci;
      tampilkanToast('AI menyusun 5 tahapan jam berdasarkan batas waktu & ritase!', 'success', 2400);
    };

    document.getElementById('sipgn-btn-manage-fleet-inline').onclick = () => {
      tampilkanModalMasterArmada(() => {
        const updatedList = muatMasterArmada();
        presetSel.innerHTML = `<option value="">-- Pilih dari Master Kurir & Plat --</option>` +
          updatedList.map((a, idx) => `<option value="${idx}">${escapeHtml(a.namaKurir)} (${escapeHtml(a.platNomor)})</option>`).join('');
      });
    };

    document.getElementById('ms-close-kpm-modal').onclick = () => overlay.remove();
    document.getElementById('ms-cancel-kpm-modal').onclick = () => overlay.remove();
    document.getElementById('sipgn-btn-save-kpm-modal').onclick = () => {
      const ambil = (id) => document.getElementById(id)?.value.trim() || '';
      const sekolah = ambil('sipgn-in-sekolah');
      if (!sekolah) { tampilkanToast('Nama Sekolah / KPM wajib diisi!', 'warning'); return; }

      const namaKurir = ambil('sipgn-in-namaKurir');
      const platNomor = ambil('sipgn-in-platNomor');
      tambahPresetArmadaJikaBaru(namaKurir, platNomor);

      const dataForm = {
        sekolah,
        ritase: ambil('sipgn-in-ritase'),
        batasWaktu: ambil('sipgn-in-batasWaktu'),
        porsiBesar: ambil('sipgn-in-porsiBesar'),
        porsiKecil: ambil('sipgn-in-porsiKecil'),
        porsiBalita: ambil('sipgn-in-porsiBalita'),
        porsiIbuMenyusui: ambil('sipgn-in-porsiIbuMenyusui'),
        porsiIbuHamil: ambil('sipgn-in-porsiIbuHamil'),
        namaKurir,
        platNomor,
        jamKeberangkatan: ambil('sipgn-in-jamKeberangkatan'),
        jamTibaTujuan: ambil('sipgn-in-jamTibaTujuan'),
        jamJadwalPengambilan: ambil('sipgn-in-jamJadwalPengambilan'),
        jamOmprengKembaliSPPG: ambil('sipgn-in-jamOmprengKembaliSPPG'),
        jamMulaiCuci: ambil('sipgn-in-jamMulaiCuci'),
        omprengKembaliAktual: ambil('sipgn-in-omprengKembaliAktual'),
        omprengDicuciAktual: ambil('sipgn-in-omprengDicuciAktual'),
        catatanSelisih: ambil('sipgn-in-catatanSelisih'),
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
   * 9. ENGINE AUTOFILL DOM, FUZZY FALLBACK, AUTO-SUBMIT & TIME PICKER
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
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
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
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(element, '');
    else element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));

    let currentVal = '';
    for (let i = 0; i < valStr.length; i++) {
      const char = valStr[i];
      currentVal += char;
      const keyOpts = { key: char, char: char, keyCode: char.charCodeAt(0), bubbles: true, cancelable: true };
      element.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
      element.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
      if (setter) setter.call(element, currentVal);
      else element.value = currentVal;
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

  function cariTombolSubmitHalamanSIPGN() {
    const kandidat = [...document.querySelectorAll('button')].filter(
      (btn) => !btn.closest('#sipgn-autofill-panel') && !btn.closest('.ms-ui-root') && btn.offsetParent !== null && !btn.disabled
    );
    return (
      kandidat.find((btn) => /^(simpan|submit|kirim|buat tugas|simpan penugasan|konfirmasi)$/i.test(btn.textContent.replace(/\s+/g, ' ').trim())) ||
      kandidat.find((btn) => btn.type === 'submit' && /simpan|kirim|submit|buat/i.test(btn.textContent))
    ) || null;
  }

  function picuAutoSubmitDenganCountdown() {
    if (!dapatkanAutoSubmit()) return;
    const targetBtn = cariTombolSubmitHalamanSIPGN();
    if (!targetBtn) {
      tampilkanToast('Auto-Submit aktif, namun tombol Simpan halaman tidak ditemukan.', 'warning');
      return;
    }

    if (activeSubmitCountdownCancel) activeSubmitCountdownCancel();

    pasangDesignSystemCSS();
    const banner = document.createElement('div');
    banner.id = 'ms-autosubmit-banner';
    banner.className = 'ms-ui-root ms-aurora-shell';
    banner.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      z-index: ${dapatkanTopZIndex()}; padding: 12px 18px; border-radius: 16px;
      display: flex; align-items: center; gap: 14px; border-color: rgba(16,185,129,0.55);
    `;

    let sisaDetik = 3;
    banner.innerHTML = `
      <span style="font-size:18px;">🚀</span>
      <div style="font-size:12px;">
        <div style="font-weight:800; color:#34d399;">Auto-Submit dalam <span id="ms-countdown-num">3</span> detik...</div>
        <div style="font-size:10.5px; color:var(--ms-text-muted);">Menekan tombol "${escapeHtml(targetBtn.textContent.trim())}" otomatis</div>
      </div>
      <button id="ms-cancel-autosubmit" class="ms-btn ms-btn-danger" style="padding:7px 12px; font-size:11px;">✕ Batalkan</button>
    `;
    bantuAppendKeBody(banner);

    let dibatalkan = false;
    const timer = setInterval(() => {
      if (dibatalkan) return;
      sisaDetik--;
      const numEl = document.getElementById('ms-countdown-num');
      if (numEl) numEl.textContent = String(Math.max(0, sisaDetik));

      if (sisaDetik <= 0) {
        clearInterval(timer);
        banner.remove();
        activeSubmitCountdownCancel = null;
        catatAktivitas(`Auto-Submit menekan: ${targetBtn.textContent.trim()}`, 'success');
        targetBtn.click();
      }
    }, 1000);

    const batalFn = () => {
      dibatalkan = true;
      clearInterval(timer);
      banner.remove();
      activeSubmitCountdownCancel = null;
      tampilkanToast('Auto-Submit dibatalkan.', 'info', 2200);
    };

    activeSubmitCountdownCancel = batalFn;
    banner.querySelector('#ms-cancel-autosubmit').onclick = batalFn;
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

  function setNativeSelectValue(selectEl, optionEl) {
    if (!selectEl || !optionEl) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    if (setter) setter.call(selectEl, optionEl.value);
    else selectEl.value = optionEl.value;
    selectEl.dispatchEvent(new Event('input', { bubbles: true }));
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function pilihWorkOrderPalingAtas() {
    const isPlaceholderOption = (opt) => {
      if (!opt || opt.disabled) return true;
      const val = String(opt.value || '').trim();
      const txt = String(opt.textContent || '').replace(/\s+/g, ' ').trim();
      return !val || /^[-—–\s]*pilih\s*work\s*order[-—–\s]*$/i.test(txt);
    };

    const nativeSelect = await tungguElemen(() => {
      const selects = [...document.querySelectorAll('select')].filter(
        (s) => !s.closest('#sipgn-autofill-panel') && !s.closest('.ms-ui-root') && s.disabled === false
      );
      return selects.find((s) => {
        const meta = `${s.name || ''} ${s.id || ''} ${s.getAttribute('aria-label') || ''}`.toLowerCase();
        const optsText = [...s.options].map((o) => o.textContent || '').join(' ');
        return /work\s*order/i.test(meta) || /pilih\s*work\s*order|wo-/i.test(optsText);
      }) || null;
    }, 3500, 150);

    if (nativeSelect) {
      const validOptions = [...nativeSelect.options].filter((o) => !isPlaceholderOption(o));
      if (validOptions.length > 0) {
        const topOption = validOptions[0];
        try { nativeSelect.focus(); nativeSelect.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        setNativeSelectValue(nativeSelect, topOption);
        try { nativeSelect.dispatchEvent(new Event('blur', { bubbles: true })); } catch (e) {}
        catatAktivitas(`Pilih Work Order teratas: ${topOption.textContent.trim()}`, 'success');
        return true;
      }
    }

    const triggerEl = await tungguElemen(() => {
      const candidates = [...document.querySelectorAll('button, [role="combobox"], [role="button"], div')].filter((el) => {
        if (el.closest('#sipgn-autofill-panel') || el.closest('.ms-ui-root') || el.offsetParent === null) return false;
        if (el.querySelector('button, [role="combobox"], input, select')) return false;
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return /pilih\s*work\s*order/i.test(txt) && txt.length <= 80;
      });
      return candidates[0] || null;
    }, 2500, 150);

    if (!triggerEl) return false;

    await klikElemenPrecise(triggerEl);
    await wait(220);

    const topOptionEl = await tungguElemen(() => {
      const optionNodes = [...document.querySelectorAll('[role="option"], li, [role="menuitem"], div[class*="option"], button')].filter((el) => {
        if (el.closest('#sipgn-autofill-panel') || el.closest('.ms-ui-root') || el.offsetParent === null) return false;
        if (el === triggerEl || el.contains(triggerEl)) return false;
        if (el.querySelector('[role="option"], li')) return false;
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt || txt.length > 220) return false;
        if (/^[-—–\s]*pilih\s*work\s*order[-—–\s]*$/i.test(txt)) return false;
        if (/work\s*order\s*tersedia/i.test(txt)) return false;
        const ariaDisabled = el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');
        return !ariaDisabled;
      });
      return optionNodes[0] || null;
    }, 2500, 100);

    if (!topOptionEl) return false;

    const labelWO = (topOptionEl.textContent || '').replace(/\s+/g, ' ').trim();
    await klikElemenPrecise(topOptionEl);
    catatAktivitas(`Pilih Work Order teratas: ${labelWO}`, 'success');
    return true;
  }

  async function isiLokasiKPM(namaSekolah) {
    const input = document.querySelector('input[placeholder*="Cari nama KPM"]') ||
      aiCariInputDenganFuzzy(['cari nama kpm', 'nama sekolah', 'lokasi kpm', 'tujuan kpm'], ['text', 'search']);
    if (!input) return false;
    await setNativeValueHuman(input, namaSekolah, 25, 55);
    const namaTargetLower = String(namaSekolah || '').trim().toLowerCase();
    const tombolOpsi = await tungguElemen(() => {
      const semuaBtn = [...document.querySelectorAll('button, [role="option"]')].filter(
        (btn) => !btn.closest('#sipgn-autofill-panel') && btn.offsetParent !== null
      );
      return (
        semuaBtn.find((btn) => btn.textContent.trim().toLowerCase() === namaTargetLower) ||
        semuaBtn.find((btn) => btn.textContent.toLowerCase().includes(namaTargetLower))
      );
    });
    if (!tombolOpsi) return false;
    await smartWait(300, 550);
    tombolOpsi.click();
    return true;
  }

  async function isiRitase(nilai) {
    for (let i = 0; i < 4; i++) {
      const input = document.querySelector('input[placeholder="Contoh: 1"]') ||
        aiCariInputDenganFuzzy(['ritase', 'trip pengantaran', 'urutan ritase'], ['number', 'text']);
      if (!input) { await wait(350); continue; }
      await setNativeValueHuman(input, nilai, 25, 60);
      await smartWait(250, 500);
      if (String(input.value) === String(nilai)) return true;
    }
    return false;
  }

  function isiBatasWaktu(nilai) {
    const jamValid = normalisasiFormatJam(nilai);
    if (!jamValid) return false;
    const input = document.querySelector('input[type="time"]') ||
      aiCariInputDenganFuzzy(['batas waktu', 'target waktu', 'jam batas'], ['time', 'text']);
    if (!input) return false;
    setNativeValue(input, jamValid);
    return true;
  }

  function cariInputPorsiKategori(namaKategori) {
    const judul = [...document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5')].find(
      (el) => !el.closest('#sipgn-autofill-panel') && el.children.length === 0 && el.textContent.trim() === namaKategori
    );
    if (judul) {
      let kontainer = judul.parentElement;
      for (let i = 0; i < 6 && kontainer; i++) {
        const input = kontainer.querySelector('input[type="number"][placeholder="Masukkan jumlah porsi"]') || kontainer.querySelector('input[type="number"]');
        if (input) return input;
        kontainer = kontainer.parentElement;
      }
    }
    return aiCariInputDenganFuzzy([namaKategori, `jumlah ${namaKategori}`], ['number']);
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

  /* ----------------------------------------------------------------------------
   * [PERBAIKAN] Pencarian input berdasarkan teks LABEL.
   * Form "Status Pengambilan" memakai placeholder "Contoh: B 9999 XYZ" untuk plat,
   * sehingga pencarian lama (placeholder/name/id) tidak menemukannya.
   * ---------------------------------------------------------------------------- */
  function cariInputDariLabel(daftarTeksLabel) {
    const inputValid = (el) =>
      el && el.tagName === 'INPUT' &&
      !el.closest('#sipgn-autofill-panel') && !el.closest('.ms-ui-root') &&
      !el.disabled && !el.readOnly && el.offsetParent !== null &&
      el.type !== 'hidden' && el.type !== 'checkbox' && el.type !== 'radio';

    const labels = [...document.querySelectorAll('label')].filter(
      (el) => !el.closest('#sipgn-autofill-panel') && !el.closest('.ms-ui-root') && el.offsetParent !== null
    );

    for (const teks of daftarTeksLabel) {
      const target = String(teks).toLowerCase();
      const label = labels.find((el) =>
        el.textContent.replace(/\s+/g, ' ').replace(/\*/g, '').trim().toLowerCase().includes(target)
      );
      if (!label) continue;

      // 1) label[for] -> id input
      if (label.htmlFor) {
        const byFor = document.getElementById(label.htmlFor);
        if (inputValid(byFor)) return byFor;
      }

      // 2) input di dalam kontainer terdekat label
      let kontainer = label.parentElement;
      for (let d = 0; d < 2 && kontainer && kontainer !== document.body; d++) {
        const inp = [...kontainer.querySelectorAll('input')].find(inputValid);
        if (inp) return inp;
        kontainer = kontainer.parentElement;
      }
    }
    return null;
  }

  async function isiKurirDanPlat(namaKurir, platNomor) {
    const semuaInput = [...document.querySelectorAll('input')].filter(
      (inp) => !inp.closest('#sipgn-autofill-panel') && !inp.closest('.ms-ui-root') && inp.type !== 'hidden' && inp.type !== 'checkbox' && inp.offsetParent !== null
    );

    // 1) Prioritas: berdasarkan teks label
    let inputKurir = cariInputDariLabel(['nama kurir pengambil', 'nama kurir', 'nama driver', 'pengemudi']);
    let inputPlat = cariInputDariLabel(['plat kendaraan pengambil', 'plat kendaraan', 'plat nomor', 'nomor polisi', 'nopol']);

    // 2) Cadangan: placeholder / name / id
    if (!inputKurir) {
      inputKurir = semuaInput.find((inp) => {
        const s = `${inp.placeholder} ${inp.name} ${inp.id}`.toLowerCase();
        return s.includes('kurir') || s.includes('driver') || s.includes('courier');
      }) || null;
    }
    if (!inputPlat) {
      inputPlat = semuaInput.find((inp) => {
        const s = `${inp.placeholder} ${inp.name} ${inp.id}`.toLowerCase();
        return s.includes('1234') || s.includes('9999') || s.includes('xyz') ||
          s.includes('plat') || s.includes('nopol') || s.includes('kendaraan') ||
          s.includes('vehicle') || s.includes('plate');
      }) || null;
    }

    // 3) Cadangan terakhir: AI fuzzy
    if (!inputKurir) inputKurir = aiCariInputDenganFuzzy(['nama kurir', 'pengemudi', 'driver pengantar'], ['text']);
    if (!inputPlat) inputPlat = aiCariInputDenganFuzzy(['plat kendaraan', 'plat nomor', 'nomor polisi', 'nopol kendaraan'], ['text']);

    if (inputKurir && namaKurir) {
      await setNativeValueHuman(inputKurir, namaKurir, 20, 50);
      await smartWait(180, 350);
    }
    if (inputPlat && platNomor) {
      await setNativeValueHuman(inputPlat, platNomor, 20, 50);
      await smartWait(180, 350);
    } else if (!inputPlat && platNomor) {
      catatAktivitas('Kolom Plat Kendaraan tidak ditemukan di halaman ini', 'error');
      tampilkanToast('Kolom Plat Kendaraan tidak ditemukan.', 'warning', 2800);
    }
  }

  async function isiPenugasan(index) {
    if (isAutomating) return false;
    const data = dataPenugasan[index];
    if (!data) return false;

    const lanjut = await konfirmasiPreFlightJikaKonflik(data);
    if (!lanjut) return false;

    isAutomating = true;

    try {
      tampilkanToast(`Mengisi penugasan: <b>${escapeHtml(data.sekolah)}</b>...`, 'info', 2500);
      await pilihWorkOrderPalingAtas();
      await smartWait(350, 600);
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
      picuAutoSubmitDenganCountdown();
      return true;
    } finally {
      isAutomating = false;
    }
  }

  /* Time Picker Automation */
  function teksBerisiTanggalWaktuSIPGN(teks) {
    return /\d{2}\/\d{2}\/\d{4},?\s*\d{2}[.:]\d{2}/.test(String(teks || '').replace(/\s+/g, ' ').trim());
  }

  function cariTriggerWaktuKeberangkatan(namaField = 'Waktu Keberangkatan') {
    const label = [...document.querySelectorAll('label')].find((el) => {
      if (el.closest('#sipgn-autofill-panel')) return false;
      const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
      return txt === namaField || txt.includes(namaField);
    });

    if (label) {
      let kontainer = label.parentElement;
      for (let depth = 0; depth < 3 && kontainer && kontainer !== document.body; depth++) {
        const dariFlex = [...kontainer.querySelectorAll('div.flex.w-full.cursor-pointer')].find(
          (el) => !el.closest('#sipgn-autofill-panel') && el.offsetParent !== null
        );
        if (dariFlex) return dariFlex;

        const dariTanggal = [...kontainer.querySelectorAll('div, button')].find((el) => {
          if (el.closest('#sipgn-autofill-panel') || el.offsetParent === null) return false;
          if (el.querySelector('div, button')) return false;
          const teks = el.textContent.replace(/\s+/g, ' ').trim();
          return teksBerisiTanggalWaktuSIPGN(teks) || /pilih\s*(tanggal|waktu)/i.test(teks);
        });
        if (dariTanggal) return dariTanggal.closest('div.cursor-pointer, button') || dariTanggal;

        kontainer = kontainer.parentElement;
      }
    }

    const labelCadangan = [...document.querySelectorAll('label, p, span')].find((el) => {
      if (el.closest('#sipgn-autofill-panel')) return false;
      return new RegExp(`^${namaField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`, 'i').test(
        el.textContent.replace(/\s+/g, ' ').trim()
      );
    });
    if (labelCadangan?.parentElement) {
      const dariLabel = [...labelCadangan.parentElement.querySelectorAll('div, button')].find((el) => {
        if (el.closest('#sipgn-autofill-panel') || el.offsetParent === null) return false;
        const teks = el.textContent.replace(/\s+/g, ' ').trim();
        return teksBerisiTanggalWaktuSIPGN(teks) || /pilih\s*(tanggal|waktu)/i.test(teks);
      });
      if (dariLabel) return dariLabel;
    }

    const semuaTriggerTanggal = [...document.querySelectorAll('div.flex.w-full.cursor-pointer, button, div')].filter((el) => {
      if (el.closest('#sipgn-autofill-panel') || el.offsetParent === null) return false;
      const teks = el.textContent.replace(/\s+/g, ' ').trim();
      return teksBerisiTanggalWaktuSIPGN(teks);
    });
    if (semuaTriggerTanggal.length === 1) return semuaTriggerTanggal[0];

    return null;
  }

  function cariDialogWaktu() {
    const kolomJam = cariKolomSpinner('Jam');
    const kolomMenit = cariKolomSpinner('Menit');
    if (!kolomJam || !kolomMenit) return null;

    const dialog = kolomJam.closest('[role="dialog"], [aria-modal="true"]');
    if (dialog && !dialog.closest('#sipgn-autofill-panel')) return dialog;

    let induk = kolomJam.parentElement;
    while (induk && induk !== document.body) {
      if (induk.contains(kolomMenit)) return induk;
      induk = induk.parentElement;
    }
    return null;
  }

  async function tutupDialogWaktuJikaTerbuka() {
    const dialog = cariDialogWaktu();
    if (!dialog) return;
    const tombolTutup = [...dialog.querySelectorAll('button')].find((btn) => {
      if (btn.disabled || btn.offsetParent === null) return false;
      const teks = btn.textContent.replace(/\s+/g, ' ').trim();
      return /^(batal|tutup|cancel|close|✕|×)$/i.test(teks);
    });
    if (tombolTutup) {
      tombolTutup.click();
      await wait(250);
    } else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(250);
    }
  }

  async function simpanPickerWaktu(jamMenitStr, namaField = 'Waktu Keberangkatan') {
    const dialog = cariDialogWaktu();
    if (!dialog) return true;

    const tombolSimpan = [...dialog.querySelectorAll('button')].find((btn) => {
      if (btn.disabled || btn.offsetParent === null) return false;
      const teks = btn.textContent.replace(/\s+/g, ' ').trim();
      return /^(simpan|terapkan|konfirmasi|selesai|ok)$/i.test(teks) ||
        /^(simpan|terapkan|konfirmasi)\b/i.test(teks);
    });
    if (!tombolSimpan) {
      await wait(150);
      const trigger = cariTriggerWaktuKeberangkatan(namaField);
      const teksTrigger = trigger ? trigger.textContent : '';
      return !!trigger && (teksTrigger.includes(jamMenitStr.replace(':', '.')) || teksTrigger.includes(jamMenitStr));
    }

    const triggerSebelum = cariTriggerWaktuKeberangkatan(namaField);
    const teksSebelum = triggerSebelum ? triggerSebelum.textContent : '';
    await smartWait(200, 400);
    tombolSimpan.click();
    await wait(350);

    const triggerSesudah = cariTriggerWaktuKeberangkatan(namaField);
    const waktuTitik = jamMenitStr.replace(':', '.');
    const berubah = triggerSesudah && (
      triggerSesudah.textContent.includes(waktuTitik) ||
      triggerSesudah.textContent.includes(jamMenitStr) ||
      triggerSesudah.textContent !== teksSebelum
    );
    return Boolean(berubah);
  }

  function cariKolomSpinner(label) {
    const labelNormal = label.toLowerCase();
    const labelEl = [...document.querySelectorAll('p, span')].find(
      (el) => !el.closest('#sipgn-autofill-panel') && el.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === labelNormal
    );
    if (!labelEl) return null;
    let kolom = labelEl.parentElement;
    while (kolom && kolom !== document.body) {
      if (kolom.querySelectorAll(':scope > button').length >= 2) return kolom;
      kolom = kolom.parentElement;
    }
    return labelEl.parentElement;
  }

  function cariTombolPanah(kolom, arah) {
    const tombol = [...kolom.querySelectorAll('button')].filter(
      (btn) => btn.offsetParent !== null && !btn.disabled
    );
    if (tombol.length < 2) return null;
    return arah === 'up' ? tombol[0] : tombol[tombol.length - 1];
  }

  function cariKontainerScrollWheel(kolom) {
    const kandidat = [...kolom.querySelectorAll('div, li, ul')].filter((el) => {
      if (el.children.length === 0) return false;
      const style = window.getComputedStyle(el);
      return (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight
      );
    });
    return kandidat[kandidat.length - 1] || null;
  }

  function bacaNilaiAktif(kolom) {
    const semuaDiv = kolom.querySelectorAll('div');
    const aktif = [...semuaDiv].find(
      (div) =>
        String(div.className || '').includes('font-bold') &&
        String(div.className || '').includes('text-white') &&
        /^\d+$/.test(div.textContent.trim())
    );
    if (aktif) return parseInt(aktif.textContent.trim(), 10);

    const kontainer = cariKontainerScrollWheel(kolom);
    if (kontainer) {
      const rect = kontainer.getBoundingClientRect();
      const tengah = rect.top + rect.height / 2;
      let terdekat = null;
      let jarakTerdekat = Infinity;
      [...kontainer.querySelectorAll('div, li, span')].forEach((el) => {
        if (el.children.length > 0) return;
        const teks = el.textContent.trim();
        if (!/^\d+$/.test(teks)) return;
        const r = el.getBoundingClientRect();
        if (r.height <= 0) return;
        const jarak = Math.abs(r.top + r.height / 2 - tengah);
        if (jarak < jarakTerdekat) {
          jarakTerdekat = jarak;
          terdekat = el;
        }
      });
      if (terdekat) return parseInt(terdekat.textContent.trim(), 10);
    }
    return null;
  }

  function scrollKeNilai(kolom, target) {
    const kontainer = cariKontainerScrollWheel(kolom);
    if (!kontainer) return false;
    const items = [...kontainer.querySelectorAll('div, li, span')].filter((el) => {
      if (el.children.length > 0) return false;
      const teks = el.textContent.trim();
      return /^\d+$/.test(teks) && teks.length <= 2;
    });
    const targetEl = items.find((el) => parseInt(el.textContent.trim(), 10) === target);
    if (!targetEl) return false;

    const cRect = kontainer.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();
    const geser = tRect.top - cRect.top + tRect.height / 2 - cRect.height / 2;
    kontainer.scrollTop = Math.max(
      0,
      Math.min(kontainer.scrollTop + geser, kontainer.scrollHeight - kontainer.clientHeight)
    );
    kontainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    return true;
  }

  async function tungguSpinnerSelesai(kolom, nilaiSebelum, maxTunggu = 700) {
    const batas = Date.now() + maxTunggu;
    let nilai = null;
    while (Date.now() < batas) {
      await wait(20);
      nilai = bacaNilaiAktif(kolom);
      if (nilai !== null && nilai !== nilaiSebelum) {
        await wait(30);
        const nilaiCek = bacaNilaiAktif(kolom);
        if (nilaiCek === nilai) return nilai;
      }
    }
    return nilai;
  }

  async function tungguNilaiStabil(kolom, maxTunggu = 900) {
    const batas = Date.now() + maxTunggu;
    let terakhir = null;
    while (Date.now() < batas) {
      await wait(25);
      terakhir = bacaNilaiAktif(kolom);
      if (terakhir === null) continue;
      await wait(35);
      const kedua = bacaNilaiAktif(kolom);
      if (kedua !== null && kedua === terakhir) return kedua;
    }
    return terakhir;
  }

  function cariDivNilaiExact(kolom, nilai) {
    return [...kolom.querySelectorAll('div, li, button, span')].find((el) => {
      if (el.children.length > 0) return false;
      const teks = el.textContent.trim();
      return /^\d+$/.test(teks) && parseInt(teks, 10) === nilai;
    });
  }

  async function klikElemenPrecise(el) {
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
    try {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    } catch (e) {}
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    } catch (e) {}
    el.click();
  }

  async function setSpinnerValue(labelKolom, target, maxIterasi = 40) {
    const kolom = cariKolomSpinner(labelKolom);
    if (!kolom) return false;

    const tombolAtas = cariTombolPanah(kolom, 'up');
    const tombolBawah = cariTombolPanah(kolom, 'down');

    let nilaiSekarang = await tungguNilaiStabil(kolom);
    if (nilaiSekarang === null) return false;
    if (nilaiSekarang === target) return true;

    if (scrollKeNilai(kolom, target)) {
      nilaiSekarang = await tungguNilaiStabil(kolom);
      if (nilaiSekarang === target) return true;
    }

    const divTarget = cariDivNilaiExact(kolom, target);
    if (divTarget) {
      await klikElemenPrecise(divTarget);
      const hasilKlik = await tungguSpinnerSelesai(kolom, nilaiSekarang);
      if (hasilKlik === target) return true;
      if (hasilKlik !== null) nilaiSekarang = hasilKlik;
    }

    const putaran = labelKolom === 'Jam' ? 24 : 60;
    const langkahNaik = (target - nilaiSekarang + putaran) % putaran;
    const langkahTurun = (nilaiSekarang - target + putaran) % putaran;
    const jumlahKlik = Math.min(langkahNaik, langkahTurun);
    const tombol = langkahNaik <= langkahTurun ? tombolBawah : tombolAtas;
    if (!tombol || jumlahKlik > maxIterasi) return false;

    for (let i = 0; i < jumlahKlik; i++) {
      tombol.click();
      await wait(getRandomDelay(35, 75));
    }
    await wait(60);
    nilaiSekarang = bacaNilaiAktif(kolom);
    return nilaiSekarang === target;
  }

  async function bacaKolomStabil(label) {
    const kolom = cariKolomSpinner(label);
    return kolom ? await tungguNilaiStabil(kolom) : null;
  }

  async function aturWaktuKeberangkatan(jamMenitStr, namaField = 'Waktu Keberangkatan') {
    const jamNormal = terapkanRealTimeDanJitter(jamMenitStr);
    if (!jamNormal) return false;
    const [jamTarget, menitTarget] = jamNormal.split(':').map(Number);

    await tutupDialogWaktuJikaTerbuka();

    let kolomJam = cariKolomSpinner('Jam');
    if (!kolomJam) {
      const trigger = cariTriggerWaktuKeberangkatan(namaField);
      if (!trigger) return false;

      trigger.focus?.();
      trigger.click();
      kolomJam = await tungguElemen(() => cariKolomSpinner('Jam'), 1200, 75);
      if (!kolomJam) {
        await klikElemenPrecise(trigger);
        kolomJam = await tungguElemen(() => cariKolomSpinner('Jam'), 1900, 100);
      }
      if (!kolomJam) return false;
    }

    const triggerAktif = cariTriggerWaktuKeberangkatan(namaField);
    if (!teksBerisiTanggalWaktuSIPGN(triggerAktif?.textContent || '')) {
      const tombolSekarang = [...document.querySelectorAll('button')].find((btn) =>
        btn.offsetParent !== null && /^(sekarang|hari ini)$/i.test(btn.textContent.replace(/\s+/g, ' ').trim())
      );
      if (tombolSekarang) {
        await klikElemenPrecise(tombolSekarang);
        await wait(400);
      }
    }

    for (let percobaan = 1; percobaan <= 3; percobaan++) {
      await setSpinnerValue('Jam', jamTarget);
      await smartWait(150, 300);
      await setSpinnerValue('Menit', menitTarget);
      await smartWait(150, 300);

      const jamAkhir = await bacaKolomStabil('Jam');
      const menitAkhir = await bacaKolomStabil('Menit');

      if (jamAkhir === jamTarget && menitAkhir === menitTarget) {
        return await simpanPickerWaktu(jamNormal, namaField);
      }
      await wait(400);
    }

    await tutupDialogWaktuJikaTerbuka();
    return false;
  }

  function cariInputJumlahOmpreng(mode = 'pengambilan') {
    const labelTargetText = mode === 'pencucian' ? 'Jumlah Ompreng Dicuci' : 'Jumlah Ompreng';
    const labelEl = [...document.querySelectorAll('label')].find((el) => {
      if (el.closest('#sipgn-autofill-panel')) return false;
      const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
      return txt === labelTargetText || (mode === 'pencucian' ? txt.includes('Dicuci') : txt.includes('Jumlah Ompreng') && !txt.includes('Dicuci'));
    });

    if (labelEl) {
      let kontainer = labelEl.parentElement;
      for (let d = 0; d < 3 && kontainer && kontainer !== document.body; d++) {
        const inp = [...kontainer.querySelectorAll('input')].find(
          (el) => !el.closest('#sipgn-autofill-panel') && !el.disabled && !el.readOnly && el.offsetParent !== null && el.type !== 'hidden' && el.type !== 'checkbox'
        );
        if (inp) return inp;
        kontainer = kontainer.parentElement;
      }
    }

    if (mode === 'pencucian') {
      const inpPh = document.querySelector('input[placeholder="Contoh: 25"]');
      if (inpPh && !inpPh.closest('#sipgn-autofill-panel') && inpPh.offsetParent !== null) return inpPh;
    }

    return aiCariInputDenganFuzzy(mode === 'pencucian' ? ['jumlah ompreng dicuci', 'ompreng cuci'] : ['jumlah ompreng', 'total ompreng'], ['number', 'text']);
  }

  async function isiPengambilanOmpreng(index) {
    if (isAutomating) return false;
    const data = dataPenugasan[index];
    if (!data) return false;
    isAutomating = true;

    try {
      aturCheckboxKurirMBG();
      await smartWait(200, 400);
      const selisihInfo = hitungSelisihOmpreng(data);
      const jumlahOmpreng = selisihInfo.kembali !== null && !isNaN(selisihInfo.kembali)
        ? selisihInfo.kembali
        : selisihInfo.dikirim;
      const inputJumlah = cariInputJumlahOmpreng('pengambilan');
      if (inputJumlah) await setNativeValueHuman(inputJumlah, String(jumlahOmpreng), 30, 65);
      await isiKurirDanPlat(data.namaKurir, data.platNomor);
      const hasil = await aturWaktuKeberangkatan(data.jamJadwalPengambilan, 'Waktu Dijadwalkan Pengambilan');
      if (hasil) {
        dataPenugasan[index].statusProses = 'pengembalian';
        simpanData(dataPenugasan);
        catatAktivitas(`Isi pengambilan ompreng (${jumlahOmpreng}): ${data.sekolah}`, 'success');
        renderPanel();
        picuAutoSubmitDenganCountdown();
      }
      return hasil;
    } finally {
      isAutomating = false;
    }
  }

  async function isiMulaiPencucian(index) {
    if (isAutomating) return false;
    const data = dataPenugasan[index];
    if (!data) return false;
    isAutomating = true;

    try {
      const selisihInfo = hitungSelisihOmpreng(data);
      const jumlahCuci = selisihInfo.dicuci !== null && !isNaN(selisihInfo.dicuci)
        ? selisihInfo.dicuci
        : (selisihInfo.kembali !== null && !isNaN(selisihInfo.kembali) ? selisihInfo.kembali : selisihInfo.dikirim);
      const inputJumlah = cariInputJumlahOmpreng('pencucian');
      if (inputJumlah) await setNativeValueHuman(inputJumlah, String(jumlahCuci), 30, 65);
      const hasil = await aturWaktuKeberangkatan(data.jamMulaiCuci, 'Waktu Mulai Cuci');
      if (hasil) {
        dataPenugasan[index].statusProses = 'pencucian';
        simpanData(dataPenugasan);
        catatAktivitas(`Isi mulai pencucian (${jumlahCuci}): ${data.sekolah}`, 'success');
        renderPanel();
        picuAutoSubmitDenganCountdown();
      }
      return hasil;
    } finally {
      isAutomating = false;
    }
  }

  async function jalankanAutoSequenceHalaman() {
    if (isAutomating) {
      tampilkanToast('Proses otomatisasi sedang berjalan, harap tunggu...', 'warning');
      return;
    }
    const kpmAktif = indexTerpilih >= 0 ? dataPenugasan[indexTerpilih] : null;
    if (!kpmAktif) { tampilkanToast('Pilih data KPM terlebih dahulu.', 'warning'); return; }

    const lanjut = await konfirmasiPreFlightJikaKonflik(kpmAktif);
    if (!lanjut) return;

    const cekLabel = (kata) => [...document.querySelectorAll('label')].some((el) => !el.closest('#sipgn-autofill-panel') && el.offsetParent !== null && el.textContent.includes(kata));
    let langkahDijalankan = 0;

    if (cekHalamanTugasBaru()) {
      const ok = await isiPenugasan(indexTerpilih);
      if (ok) langkahDijalankan++;
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
      if (!cekHalamanTugasBaru()) picuAutoSubmitDenganCountdown();
    } else {
      tampilkanToast('Tidak ada formulir aktif atau jadwal jam belum diisi pada KPM ini.', 'warning');
    }
  }

  /* ============================================================================
   * 10. ULTRA-PREMIUM BENTO WORKSPACE RENDERER (v2.0.2)
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
      const panelLama = document.getElementById('sipgn-autofill-panel');
      const scrollLama = panelLama ? panelLama.scrollTop : 0;
      setTimeout(() => {
        const p = document.getElementById('sipgn-autofill-panel');
        if (p && scrollLama) p.scrollTop = scrollLama;
      }, 0);
      ['sipgn-autofill-panel', 'sipgn-fab-trigger', 'sipgn-mobile-backdrop'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });

      const mobileMode = isMobileDevice();
      const totalPengantaran = dataPenugasan.filter((d) => d.statusProses === 'pengantaran').length;
      const totalPengembalian = dataPenugasan.filter((d) => d.statusProses === 'pengembalian').length;
      const totalPencucian = dataPenugasan.filter((d) => d.statusProses === 'pencucian').length;

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
        backdrop.className = 'ms-ui-root';
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
          width: ${isMinimized ? 'auto' : '404px'}; max-height: 92vh; overflow-y: auto;
          border-radius: 24px; padding: ${isMinimized ? '10px 14px' : '16px'};
        `;
      }

      const header = document.createElement('div');
      header.className = 'ms-drag-grip';
      header.style.cssText = `display:flex; align-items:center; justify-content:space-between; gap:8px; ${isMinimized ? '' : 'margin-bottom:12px;'}`;

      const badgeHeaderTitleHtml = availableUpdateRelease
        ? `<span style="font-size:9px; font-weight:800; padding:2px 6px; border-radius:6px; background:rgba(16,185,129,0.22); border:1px solid rgba(16,185,129,0.45); color:#34d399; font-family:var(--ms-font-mono); cursor:pointer;" title="Klik untuk install update">⬆️ v${escapeHtml(availableUpdateRelease.version)}</span>`
        : `<span style="font-size:8.5px; font-weight:800; padding:2px 6px; border-radius:6px; background:rgba(168,85,247,0.22); border:1px solid rgba(168,85,247,0.45); color:#e9d5ff; font-family:var(--ms-font-mono);">AI v${escapeHtml(CURRENT_VERSION)}</span>`;

      header.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="position:relative; width:32px; height:32px; border-radius:11px; background:linear-gradient(135deg, #0ea5e9, #6366f1, #9333ea); display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 6px 16px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.3);">
            ⚡
            <span style="position:absolute; top:-2px; right:-2px; width:9px; height:9px; border-radius:50%; background:#10b981; border:1.5px solid #050811;"></span>
            <span style="position:absolute; top:-2px; right:-2px; width:9px; height:9px; border-radius:50%; background:#10b981; animation:msPulseRing 2s infinite;"></span>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-weight:800; font-size:13.5px; letter-spacing:-0.2px; line-height:1.15;">POP - Autofill</span>
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

      const namaSPPG = dapatkanNamaSPPG() || 'SPPG TERDAFTAR';
      const totalPorsiSemua = dataPenugasan.reduce((a, c) => a + hitungTotalPorsi(c), 0);
      const selesaiCount = dataPenugasan.filter((d) => d.statusProses !== 'belum').length;
      const progressPersen = dataPenugasan.length > 0 ? Math.round((selesaiCount / dataPenugasan.length) * 100) : 0;
      const totalSelisihCount = dataPenugasan.filter((d) => hitungSelisihOmpreng(d).adaSelisih).length;

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
          <div style="background:rgba(6,10,21,0.72); padding:7px 2px; border-radius:11px; border:1px solid ${totalSelisihCount > 0 ? 'rgba(244,63,94,0.45)' : 'var(--ms-border)'};">
            <div style="font-size:8.5px; color:var(--ms-text-muted); font-weight:700;">${totalSelisihCount > 0 ? 'SELISIH' : 'CUCI'}</div>
            <div style="font-size:13.5px; font-weight:800; color:${totalSelisihCount > 0 ? 'var(--ms-rose)' : '#2dd4bf'};">${totalSelisihCount > 0 ? `${totalSelisihCount}⚠️` : totalPencucian}</div>
          </div>
        </div>
      `;
      panel.appendChild(bentoHero);

      // FLOATING DOCK NAVIGATION (4 TAB: WORKSPACE, DAFTAR, AI ENGINE, SISTEM)
      const dockBar = document.createElement('div');
      dockBar.className = 'ms-dock-bar';
      dockBar.innerHTML = `
        <button class="ms-dock-btn ${activeTab === 'aksi' ? 'active' : ''}" data-tab="aksi">⚡ Kerja</button>
        <button class="ms-dock-btn ${activeTab === 'daftar' ? 'active' : ''}" data-tab="daftar">📋 KPM (${dataPenugasan.length})</button>
        <button class="ms-dock-btn ${activeTab === 'ai' ? 'active' : ''}" data-tab="ai">✨ AI</button>
        <button class="ms-dock-btn ${activeTab === 'pengaturan' ? 'active' : ''}" data-tab="pengaturan">⚙️ Sistem</button>
      `;
      dockBar.querySelectorAll('.ms-dock-btn').forEach((btn) => {
        btn.onclick = () => { activeTab = btn.dataset.tab; renderPanel(); };
      });
      panel.appendChild(dockBar);

      const content = document.createElement('div');
      if (activeTab === 'aksi') renderTabAksi(content);
      else if (activeTab === 'daftar') renderTabDaftar(content);
      else if (activeTab === 'ai') renderTabAI(content);
      else renderTabPengaturan(content);
      panel.appendChild(content);

      const footer = document.createElement('div');
      footer.style.cssText = 'margin-top:12px; display:flex; justify-content:space-between; align-items:center; font-size:9.5px; color:#64748b; padding:0 4px;';
      const syncStatusText = dapatkanAutoCloudSync()
        ? (cloudSyncState === 'syncing' ? '☁️ Syncing...' : cloudSyncState === 'error' ? '☁️ Offline' : '☁️ Auto-Sync')
        : '☁️ Manual';
      footer.innerHTML = `
        <span>Drag header • <b style="color:#94a3b8;">Ctrl+K</b> • <span id="ms-cloud-sync-pill" style="color:var(--ms-cyan);">${syncStatusText}</span></span>
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
        <button id="ms-quick-wa-ai" class="ms-btn ms-btn-ghost" style="padding:2px 7px; font-size:10px; color:#c084fc;" title="Import Jadwal WhatsApp via AI">💬 WA</button>
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
    topRow.querySelector('#ms-next-pending-kpm').onclick = () => pilihKPMBelumBerikutnya(true);
    topRow.querySelector('#ms-quick-wa-ai').onclick = tampilkanModalAiWaParser;
    topRow.querySelector('#ms-quick-add-kpm').onclick = () => tampilkanModalFormKPM(null, null);

    const sel = document.createElement('select');
    sel.className = 'ms-select';
    dataPenugasan.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      const badge = d.statusProses === 'pengantaran' ? '🚚' : d.statusProses === 'pengembalian' ? '📦' : d.statusProses === 'pencucian' ? '🧼' : '⚪';
      const selisihMark = hitungSelisihOmpreng(d).adaSelisih ? ' ⚠️' : '';
      opt.textContent = `${badge} ${d.sekolah} (${hitungTotalPorsi(d)} porsi)${selisihMark}`;
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
        { id: 'belum', label: '⚪ Belum' },
        { id: 'pengantaran', label: '🚚 Antar' },
        { id: 'pengembalian', label: '📦 Ambil' },
        { id: 'pencucian', label: '🧼 Cuci' }
      ];

      const pills = [];
      if (Number(kpmAktif.porsiBesar) > 0) pills.push(`Besar: <b>${escapeHtml(kpmAktif.porsiBesar)}</b>`);
      if (Number(kpmAktif.porsiKecil) > 0) pills.push(`Kecil: <b>${escapeHtml(kpmAktif.porsiKecil)}</b>`);
      if (Number(kpmAktif.porsiBalita) > 0) pills.push(`Balita: <b>${escapeHtml(kpmAktif.porsiBalita)}</b>`);
      if (Number(kpmAktif.porsiIbuMenyusui) > 0) pills.push(`Busui: <b>${escapeHtml(kpmAktif.porsiIbuMenyusui)}</b>`);
      if (Number(kpmAktif.porsiIbuHamil) > 0) pills.push(`Bumil: <b>${escapeHtml(kpmAktif.porsiIbuHamil)}</b>`);

      const konflikList = periksaKonflikPreFlight(kpmAktif);
      const selisihObj = hitungSelisihOmpreng(kpmAktif);

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
        ${konflikList.length > 0 ? `
          <div style="font-size:10px; color:#fde68a; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.35); padding:6px 8px; border-radius:8px; margin-bottom:7px; display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <span>🛡️ <b>Konflik:</b> ${escapeHtml(konflikList[0])}</span>
            <button id="ms-inline-ai-fix-btn" class="ms-btn ms-btn-aurora" style="padding:3px 7px; font-size:9.5px; flex-shrink:0;">✨ Fix AI</button>
          </div>
        ` : ''}
        ${selisihObj.adaSelisih ? `
          <div style="font-size:10px; color:#fda4af; background:rgba(244,63,94,0.12); border:1px solid rgba(244,63,94,0.35); padding:5px 8px; border-radius:8px; margin-bottom:7px;">
            📊 <b>Selisih Ompreng:</b> Kirim ${selisihObj.dikirim} • Kembali ${selisihObj.kembali ?? selisihObj.dikirim} (${selisihObj.selisihKembali >= 0 ? '+' : ''}${selisihObj.selisihKembali}) • Cuci ${selisihObj.dicuci ?? '-'}
            ${kpmAktif.catatanSelisih ? `<div style="margin-top:2px; color:#fecdd3;">📝 ${escapeHtml(kpmAktif.catatanSelisih)}</div>` : ''}
          </div>
        ` : ''}
        <div id="ms-status-stepper" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; background:rgba(6,10,21,0.65); padding:3px; border-radius:10px; border:1px solid var(--ms-border);"></div>
      `;

      const fixBtn = detailBox.querySelector('#ms-inline-ai-fix-btn');
      if (fixBtn) {
        fixBtn.onclick = () => {
          Object.assign(kpmAktif, aiGenerateJadwalCerdas(kpmAktif));
          simpanData(dataPenugasan);
          catatAktivitas(`AI Smart Schedule memperbaiki ${kpmAktif.sekolah}`, 'success');
          tampilkanToast('Jadwal diperbaiki otomatis oleh AI!', 'success');
          renderPanel();
        };
      }

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
    const jitterOn = dapatkanJitterMode();
    const realtimeOn = dapatkanRealtimeClock();
    const autoSubmitOn = dapatkanAutoSubmit();

    const quickModesBox = document.createElement('div');
    quickModesBox.className = 'ms-bento';
    quickModesBox.style.cssText = 'padding:9px 10px; margin-bottom:10px; display:grid; grid-template-columns:repeat(2, 1fr); gap:6px;';
    quickModesBox.innerHTML = `
      <button id="ms-tog-kurir" class="ms-btn" style="padding:6px 8px; font-size:10px; justify-content:space-between; background:${autoKurir ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.03)'}; border-color:${autoKurir ? 'rgba(56,189,248,0.45)' : 'var(--ms-border)'}; color:${autoKurir ? '#fff' : 'var(--ms-text-muted)'};">
        <span>🛵 Kurir MBG</span><b>${autoKurir ? 'ON' : 'OFF'}</b>
      </button>
      <button id="ms-tog-jitter" class="ms-btn" style="padding:6px 8px; font-size:10px; justify-content:space-between; background:${jitterOn ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.03)'}; border-color:${jitterOn ? 'rgba(168,85,247,0.48)' : 'var(--ms-border)'}; color:${jitterOn ? '#fff' : 'var(--ms-text-muted)'};">
        <span>🎲 Jitter ±1-4m</span><b>${jitterOn ? 'ON' : 'OFF'}</b>
      </button>
      <button id="ms-tog-realtime" class="ms-btn" style="padding:6px 8px; font-size:10px; justify-content:space-between; background:${realtimeOn ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.03)'}; border-color:${realtimeOn ? 'rgba(14,165,233,0.48)' : 'var(--ms-border)'}; color:${realtimeOn ? '#fff' : 'var(--ms-text-muted)'};">
        <span>⏱️ Jam Live</span><b>${realtimeOn ? 'ON' : 'OFF'}</b>
      </button>
      <button id="ms-tog-autosubmit" class="ms-btn" style="padding:6px 8px; font-size:10px; justify-content:space-between; background:${autoSubmitOn ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)'}; border-color:${autoSubmitOn ? 'rgba(16,185,129,0.48)' : 'var(--ms-border)'}; color:${autoSubmitOn ? '#fff' : 'var(--ms-text-muted)'};">
        <span>🚀 Auto-Submit</span><b>${autoSubmitOn ? 'ON' : 'OFF'}</b>
      </button>
    `;
    quickModesBox.querySelector('#ms-tog-kurir').onclick = () => { simpanAutoKurirMBG(!autoKurir); aturCheckboxKurirMBG(); renderPanel(); };
    quickModesBox.querySelector('#ms-tog-jitter').onclick = () => { simpanJitterMode(!jitterOn); renderPanel(); tampilkanToast(`Jitter Mode ±1–4 menit ${!jitterOn ? 'diaktifkan' : 'dimatikan'}.`, 'info', 2000); };
    quickModesBox.querySelector('#ms-tog-realtime').onclick = () => { simpanRealtimeClock(!realtimeOn); renderPanel(); tampilkanToast(`Real-Time Clock ${!realtimeOn ? 'diaktifkan' : 'dimatikan'}.`, 'info', 2000); };
    quickModesBox.querySelector('#ms-tog-autosubmit').onclick = () => { simpanAutoSubmit(!autoSubmitOn); renderPanel(); tampilkanToast(`Auto-Submit (3s countdown) ${!autoSubmitOn ? 'diaktifkan' : 'dimatikan'}.`, 'info', 2200); };
    container.appendChild(quickModesBox);

    const halamanTugasBaru = cekHalamanTugasBaru();
    const cekLabel = (kata) => [...document.querySelectorAll('label')].some((el) => !el.closest('#sipgn-autofill-panel') && el.offsetParent !== null && el.textContent.includes(kata));
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
      btn.disabled = !kpmAktif || isAutomating;
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
        b1.disabled = !kpmAktif || isAutomating;
        b1.textContent = '🕒 Set Berangkat';
        b1.onclick = async () => {
          if (isAutomating) return;
          isAutomating = true;
          b1.disabled = true; b1.textContent = '⏳...';
          try {
            const ok = await aturWaktuKeberangkatan(kpmAktif?.jamKeberangkatan, 'Waktu Keberangkatan');
            if (ok) { kpmAktif.statusProses = 'pengantaran'; simpanData(dataPenugasan); catatAktivitas(`Set berangkat: ${kpmAktif.sekolah}`, 'success'); tampilkanToast('Jam keberangkatan disimpan!', 'success'); picuAutoSubmitDenganCountdown(); }
            else tampilkanToast('Gagal mengatur jam keberangkatan. Pastikan format jam valid.', 'error');
          } finally {
            isAutomating = false;
            renderPanel();
          }
        };
        row.appendChild(b1);
      }
      if (adaTiba) {
        const b2 = document.createElement('button');
        b2.className = 'ms-btn ms-btn-emerald';
        b2.style.cssText = 'flex:1; padding:10px;';
        b2.disabled = !kpmAktif || isAutomating;
        b2.textContent = '📦 Set Ompreng Tiba';
        b2.onclick = async () => {
          if (isAutomating) return;
          isAutomating = true;
          b2.disabled = true; b2.textContent = '⏳...';
          try {
            const ok = await aturWaktuKeberangkatan(kpmAktif?.jamTibaTujuan, 'Waktu Diterima di Tujuan');
            if (ok) { catatAktivitas(`Set tiba: ${kpmAktif.sekolah}`, 'success'); picuAutoSubmitDenganCountdown(); }
            tampilkanToast(ok ? 'Jam tiba disimpan!' : 'Gagal mengatur jam tiba. Pastikan format jam valid.', ok ? 'success' : 'error');
          } finally {
            isAutomating = false;
            renderPanel();
          }
        };
        row.appendChild(b2);
      }
      actionBox.appendChild(row);
    }

    if (adaAmbil) {
      const btn = document.createElement('button');
      btn.className = 'ms-btn ms-btn-violet';
      btn.style.cssText = 'width:100%; padding:10px;';
      btn.disabled = !kpmAktif || isAutomating;
      btn.textContent = '📦 Isi Pengambilan Ompreng';
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = '⏳ Mengisi...';
        const ok = await isiPengambilanOmpreng(indexTerpilih);
        tampilkanToast(ok ? 'Pengambilan ompreng terisi!' : 'Gagal mengisi pengambilan. Periksa jadwal jam pengambilan.', ok ? 'success' : 'error');
        renderPanel();
      };
      actionBox.appendChild(btn);
    }

    if (adaKembali) {
      const btn = document.createElement('button');
      btn.className = 'ms-btn ms-btn-emerald';
      btn.style.cssText = 'width:100%; padding:10px;';
      btn.disabled = !kpmAktif || isAutomating;
      btn.textContent = '🔄 Set Ompreng Kembali ke SPPG';
      btn.onclick = async () => {
        if (isAutomating) return;
        isAutomating = true;
        btn.disabled = true; btn.textContent = '⏳...';
        try {
          const ok = await aturWaktuKeberangkatan(kpmAktif?.jamOmprengKembaliSPPG, 'Waktu Ompreng Kembali di SPPG');
          if (ok) { kpmAktif.statusProses = 'pengembalian'; simpanData(dataPenugasan); catatAktivitas(`Ompreng kembali: ${kpmAktif.sekolah}`, 'success'); picuAutoSubmitDenganCountdown(); }
          tampilkanToast(ok ? 'Waktu kembali tersimpan!' : 'Gagal mengatur waktu kembali. Periksa jadwal jam kembali.', ok ? 'success' : 'error');
        } finally {
          isAutomating = false;
          renderPanel();
        }
      };
      actionBox.appendChild(btn);
    }

    if (adaCuci) {
      const btn = document.createElement('button');
      btn.className = 'ms-btn ms-btn-cyan';
      btn.style.cssText = 'width:100%; padding:10px;';
      btn.disabled = !kpmAktif || isAutomating;
      btn.textContent = '🧼 Isi Mulai Pencucian';
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = '⏳ Mengisi...';
        const ok = await isiMulaiPencucian(indexTerpilih);
        tampilkanToast(ok ? 'Form pencucian terisi!' : 'Gagal mengisi pencucian. Periksa jadwal jam cuci.', ok ? 'success' : 'error');
        renderPanel();
      };
      actionBox.appendChild(btn);
    }

    if (halamanTugasBaru || adaBerangkat || adaTiba || adaAmbil || adaKembali || adaCuci) {
      const btnSeq = document.createElement('button');
      btnSeq.className = 'ms-btn ms-btn-ghost';
      btnSeq.style.cssText = 'width:100%; padding:9px; font-size:11px; border-color:rgba(56,189,248,0.35); color:var(--ms-cyan);';
      btnSeq.disabled = !kpmAktif || isAutomating;
      btnSeq.innerHTML = '🤖 Jalankan Semua Aksi Halaman Ini (Auto-Sequence)';
      btnSeq.onclick = jalankanAutoSequenceHalaman;
      actionBox.appendChild(btnSeq);
    }

    if (actionBox.children.length === 0) {
      actionBox.innerHTML = `
        <div class="ms-bento" style="padding:14px; text-align:center; font-size:11.5px; color:var(--ms-text-muted); line-height:1.5;">
          💡 Buka halaman <b>Tugas Baru</b> atau modal <b>Waktu/Pengambilan/Pencucian</b> pada SIPGN untuk memunculkan tombol eksekusi otomatis.
        </div>
      `;
    }
    container.appendChild(actionBox);

    if (kpmAktif) {
      const timelineCard = document.createElement('div');
      timelineCard.className = 'ms-bento';
      timelineCard.style.cssText = 'padding: 10px 12px;';
      timelineCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:7px;">
          <span style="font-size:10px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase;">Jadwal Operasional KPM</span>
          <button id="ms-edit-active-kpm" class="ms-btn ms-btn-ghost" style="padding:2px 7px; font-size:10px; color:var(--ms-amber);">✏️ Edit</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:4px; text-align:center;">
          <div style="background:rgba(6,10,21,0.65); padding:5px 2px; border-radius:8px; border:1px solid var(--ms-border);">
            <div style="font-size:8.5px; color:var(--ms-text-muted);">Berangkat</div>
            <div style="font-size:10.5px; font-weight:700; font-family:var(--ms-font-mono); color:#60a5fa;">${escapeHtml(kpmAktif.jamKeberangkatan || '--:--')}</div>
          </div>
          <div style="background:rgba(6,10,21,0.65); padding:5px 2px; border-radius:8px; border:1px solid var(--ms-border);">
            <div style="font-size:8.5px; color:var(--ms-text-muted);">Tiba</div>
            <div style="font-size:10.5px; font-weight:700; font-family:var(--ms-font-mono); color:#34d399;">${escapeHtml(kpmAktif.jamTibaTujuan || '--:--')}</div>
          </div>
          <div style="background:rgba(6,10,21,0.65); padding:5px 2px; border-radius:8px; border:1px solid var(--ms-border);">
            <div style="font-size:8.5px; color:var(--ms-text-muted);">Ambil</div>
            <div style="font-size:10.5px; font-weight:700; font-family:var(--ms-font-mono); color:#c084fc;">${escapeHtml(kpmAktif.jamJadwalPengambilan || '--:--')}</div>
          </div>
          <div style="background:rgba(6,10,21,0.65); padding:5px 2px; border-radius:8px; border:1px solid var(--ms-border);">
            <div style="font-size:8.5px; color:var(--ms-text-muted);">Kembali</div>
            <div style="font-size:10.5px; font-weight:700; font-family:var(--ms-font-mono); color:var(--ms-amber);">${escapeHtml(kpmAktif.jamOmprengKembaliSPPG || '--:--')}</div>
          </div>
          <div style="background:rgba(6,10,21,0.65); padding:5px 2px; border-radius:8px; border:1px solid var(--ms-border);">
            <div style="font-size:8.5px; color:var(--ms-text-muted);">Cuci</div>
            <div style="font-size:10.5px; font-weight:700; font-family:var(--ms-font-mono); color:#2dd4bf;">${escapeHtml(kpmAktif.jamMulaiCuci || '--:--')}</div>
          </div>
        </div>
      `;
      timelineCard.querySelector('#ms-edit-active-kpm').onclick = () => tampilkanModalFormKPM(kpmAktif, indexTerpilih);
      container.appendChild(timelineCard);
    }
  }

  /* TAB 2: DAFTAR KPM, SEARCH, FILTER, SORTING, INLINE QUICK-EDIT & CSV */
  function renderTabDaftar(container) {
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex; flex-direction:column; gap:7px; margin-bottom:10px;';

    const searchRow = document.createElement('div');
    searchRow.style.cssText = 'display:flex; gap:6px;';
    searchRow.innerHTML = `
      <input id="ms-search-kpm" class="ms-input" placeholder="🔍 Cari sekolah / kurir..." value="${escapeHtml(searchQuery)}" style="padding:7.5px 10px; font-size:11.5px;" />
      <button id="ms-btn-wa-import-tab" class="ms-btn ms-btn-violet" style="padding:0 9px; flex-shrink:0;" title="AI Parser Jadwal WhatsApp">💬 WA</button>
      <button id="ms-btn-add-kpm-tab" class="ms-btn ms-btn-emerald" style="padding:0 11px; flex-shrink:0;">+ KPM</button>
    `;
    toolbar.appendChild(searchRow);

    const filterRow = document.createElement('div');
    filterRow.style.cssText = 'display:flex; gap:4px; align-items:center;';
    const filters = [
      { id: 'semua', label: 'Semua' },
      { id: 'belum', label: '⚪ Belum' },
      { id: 'pengantaran', label: '🚚 Antar' },
      { id: 'pengembalian', label: '📦 Ambil' },
      { id: 'pencucian', label: '🧼 Cuci' }
    ];
    filters.forEach((f) => {
      const btn = document.createElement('button');
      btn.className = 'ms-btn';
      const active = filterStatus === f.id;
      btn.style.cssText = `
        flex:1; padding:5px 2px; font-size:9.5px; border-radius:8px;
        background:${active ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.03)'};
        border-color:${active ? 'rgba(56,189,248,0.5)' : 'var(--ms-border)'};
        color:${active ? '#fff' : 'var(--ms-text-muted)'};
      `;
      btn.textContent = f.label;
      btn.onclick = () => { filterStatus = f.id; renderPanel(); };
      filterRow.appendChild(btn);
    });
    toolbar.appendChild(filterRow);

    const sortExportRow = document.createElement('div');
    sortExportRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:6px;';
    sortExportRow.innerHTML = `
      <select id="ms-sort-kpm" class="ms-select" style="padding:5px 24px 5px 8px; font-size:10px; width:auto; flex:1;">
        <option value="default" ${sortMode === 'default' ? 'selected' : ''}>Urutan: Default</option>
        <option value="nama" ${sortMode === 'nama' ? 'selected' : ''}>Urutan: Nama A–Z</option>
        <option value="porsi" ${sortMode === 'porsi' ? 'selected' : ''}>Urutan: Porsi Terbanyak</option>
        <option value="ritase" ${sortMode === 'ritase' ? 'selected' : ''}>Urutan: Ritase</option>
      </select>
      <button id="ms-btn-export-csv" class="ms-btn ms-btn-ghost" style="padding:5px 8px; font-size:10px;" title="Export ke CSV">📤 CSV</button>
      <button id="ms-btn-import-csv" class="ms-btn ms-btn-ghost" style="padding:5px 8px; font-size:10px;" title="Import dari CSV">📥 CSV</button>
      <input type="file" id="ms-input-csv-file" accept=".csv,text/csv" style="display:none;" />
    `;
    toolbar.appendChild(sortExportRow);
    container.appendChild(toolbar);

    const searchInput = searchRow.querySelector('#ms-search-kpm');
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      const pos = e.target.selectionStart;
      renderPanel();
      const restored = document.getElementById('ms-search-kpm');
      if (restored) { restored.focus(); restored.setSelectionRange(pos, pos); }
    };
    searchRow.querySelector('#ms-btn-wa-import-tab').onclick = tampilkanModalAiWaParser;
    searchRow.querySelector('#ms-btn-add-kpm-tab').onclick = () => tampilkanModalFormKPM(null, null);
    sortExportRow.querySelector('#ms-sort-kpm').onchange = (e) => { sortMode = e.target.value; renderPanel(); };
    sortExportRow.querySelector('#ms-btn-export-csv').onclick = exportCSVData;
    const csvInput = sortExportRow.querySelector('#ms-input-csv-file');
    sortExportRow.querySelector('#ms-btn-import-csv').onclick = () => csvInput.click();
    csvInput.onchange = (e) => importCSVData(e.target.files?.[0]);

    const listWrap = document.createElement('div');
    listWrap.className = 'ms-scroll';
    listWrap.style.cssText = 'max-height: 295px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 2px;';

    let filtered = dataPenugasan
      .map((item, originalIdx) => ({ item, originalIdx }))
      .filter(({ item }) => {
        const matchSearch = !searchQuery || String(item.sekolah || '').toLowerCase().includes(searchQuery.toLowerCase()) || (item.namaKurir || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchFilter = filterStatus === 'semua' || (item.statusProses || 'belum') === filterStatus;
        return matchSearch && matchFilter;
      });

    if (sortMode === 'nama') {
      filtered.sort((a, b) => String(a.item.sekolah || '').localeCompare(String(b.item.sekolah || '')));
    } else if (sortMode === 'porsi') {
      filtered.sort((a, b) => hitungTotalPorsi(b.item) - hitungTotalPorsi(a.item));
    } else if (sortMode === 'ritase') {
      filtered.sort((a, b) => Number(a.item.ritase || 1) - Number(b.item.ritase || 1));
    }

    if (filtered.length === 0) {
      listWrap.innerHTML = `<div class="ms-bento" style="padding:20px; text-align:center; font-size:11.5px; color:var(--ms-text-muted);">Tidak ada data KPM yang cocok.</div>`;
    } else {
      filtered.forEach(({ item, originalIdx }) => {
        const isSelected = originalIdx === indexTerpilih;
        const isInlineEditing = inlineEditIdx === originalIdx;
        const selisihObj = hitungSelisihOmpreng(item);

        const card = document.createElement('div');
        card.className = 'ms-bento';
        card.style.cssText = `
          padding: 9px 11px; cursor: pointer;
          border-color: ${isSelected ? 'var(--ms-cyan)' : selisihObj.adaSelisih ? 'rgba(244,63,94,0.4)' : 'var(--ms-border)'};
          background: ${isSelected ? 'rgba(56,189,248,0.12)' : 'var(--ms-bg-bento)'};
        `;

        const statusIkon = item.statusProses === 'pengantaran' ? '🚚' : item.statusProses === 'pengembalian' ? '📦' : item.statusProses === 'pencucian' ? '🧼' : '⚪';
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <div style="overflow:hidden; flex:1;" class="ms-select-kpm-area">
              <div style="font-size:12px; font-weight:700; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${statusIkon} ${escapeHtml(item.sekolah)} ${selisihObj.adaSelisih ? '<span style="color:var(--ms-rose); font-size:10px;">⚠️</span>' : ''}
              </div>
              <div style="font-size:10px; color:var(--ms-text-muted); margin-top:2px;">
                ${jenisKPM(item) === 'posyandu' ? '👶 Posyandu' : '🏫 Sekolah'} • <b style="color:var(--ms-emerald);">${hitungTotalPorsi(item)} porsi</b> • R${escapeHtml(item.ritase || '1')} • ⏰ ${escapeHtml(item.batasWaktu || '-')}
              </div>
            </div>
            <div style="display:flex; gap:3px; flex-shrink:0;">
              <button class="ms-btn ms-btn-ghost ms-btn-quick-inline" style="padding:4px 6px; font-size:10px; color:var(--ms-cyan);" title="Quick-Edit Porsi & Jam">⚡</button>
              <button class="ms-btn ms-btn-ghost ms-btn-dup-item" style="padding:4px 6px; font-size:10px;" title="Duplikat">📑</button>
              <button class="ms-btn ms-btn-ghost ms-btn-edit-item" style="padding:4px 6px; font-size:10px; color:var(--ms-amber);" title="Edit Lengkap">✏️</button>
              <button class="ms-btn ms-btn-danger ms-btn-del-item" style="padding:4px 6px; font-size:10px;" title="Hapus">🗑️</button>
            </div>
          </div>

          ${isInlineEditing ? `
            <div class="ms-inline-editor" style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--ms-border); display:flex; flex-direction:column; gap:6px;">
              <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:5px;">
                <div>
                  <label style="font-size:8.5px; color:var(--ms-text-muted); display:block;">P. Besar</label>
                  <input type="number" class="ms-input ms-qe-besar" value="${escapeHtml(item.porsiBesar)}" style="padding:4px 6px; font-size:11px;" />
                </div>
                <div>
                  <label style="font-size:8.5px; color:var(--ms-text-muted); display:block;">P. Kecil</label>
                  <input type="number" class="ms-input ms-qe-kecil" value="${escapeHtml(item.porsiKecil)}" style="padding:4px 6px; font-size:11px;" />
                </div>
                <div>
                  <label style="font-size:8.5px; color:var(--ms-text-muted); display:block;">Ritase</label>
                  <input type="number" class="ms-input ms-qe-ritase" value="${escapeHtml(item.ritase || '1')}" style="padding:4px 6px; font-size:11px;" />
                </div>
              </div>
              <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:5px;">
                <div>
                  <label style="font-size:8.5px; color:var(--ms-text-muted); display:block;">Berangkat</label>
                  <input type="text" class="ms-input ms-qe-berangkat" value="${escapeHtml(item.jamKeberangkatan)}" placeholder="10:00" style="padding:4px 6px; font-size:11px; font-family:var(--ms-font-mono);" />
                </div>
                <div>
                  <label style="font-size:8.5px; color:var(--ms-text-muted); display:block;">Ambil</label>
                  <input type="text" class="ms-input ms-qe-ambil" value="${escapeHtml(item.jamJadwalPengambilan)}" placeholder="11:00" style="padding:4px 6px; font-size:11px; font-family:var(--ms-font-mono);" />
                </div>
                <div>
                  <label style="font-size:8.5px; color:var(--ms-text-muted); display:block;">Cuci</label>
                  <input type="text" class="ms-input ms-qe-cuci" value="${escapeHtml(item.jamMulaiCuci)}" placeholder="12:30" style="padding:4px 6px; font-size:11px; font-family:var(--ms-font-mono);" />
                </div>
              </div>
              <div style="display:flex; gap:5px; justify-content:flex-end;">
                <button class="ms-btn ms-btn-ghost ms-qe-cancel" style="padding:4px 8px; font-size:10px;">Batal</button>
                <button class="ms-btn ms-btn-emerald ms-qe-save" style="padding:4px 10px; font-size:10px;">💾 Simpan Cepat</button>
              </div>
            </div>
          ` : ''}
        `;

        card.querySelector('.ms-select-kpm-area').onclick = () => { indexTerpilih = originalIdx; activeTab = 'aksi'; renderPanel(); };
        card.querySelector('.ms-btn-quick-inline').onclick = (e) => {
          e.stopPropagation();
          inlineEditIdx = isInlineEditing ? null : originalIdx;
          renderPanel();
        };

        if (isInlineEditing) {
          const edBox = card.querySelector('.ms-inline-editor');
          edBox.onclick = (e) => e.stopPropagation();
          edBox.querySelector('.ms-qe-cancel').onclick = () => { inlineEditIdx = null; renderPanel(); };
          edBox.querySelector('.ms-qe-save').onclick = () => {
            item.porsiBesar = edBox.querySelector('.ms-qe-besar').value.trim();
            item.porsiKecil = edBox.querySelector('.ms-qe-kecil').value.trim();
            item.ritase = edBox.querySelector('.ms-qe-ritase').value.trim() || '1';
            item.jamKeberangkatan = edBox.querySelector('.ms-qe-berangkat').value.trim();
            item.jamJadwalPengambilan = edBox.querySelector('.ms-qe-ambil').value.trim();
            item.jamMulaiCuci = edBox.querySelector('.ms-qe-cuci').value.trim();
            inlineEditIdx = null;
            simpanData(dataPenugasan);
            catatAktivitas(`Quick-Edit KPM: ${item.sekolah}`, 'info');
            tampilkanToast(`Perubahan cepat "${escapeHtml(item.sekolah)}" disimpan!`, 'success', 2200);
            renderPanel();
          };
        }

        card.querySelector('.ms-btn-dup-item').onclick = (e) => {
          e.stopPropagation();
          const copy = { ...item, sekolah: `${item.sekolah} (Copy)`, terpakai: false, statusProses: 'belum' };
          dataPenugasan.splice(originalIdx + 1, 0, copy);
          simpanData(dataPenugasan);
          tampilkanToast('Data KPM diduplikat!', 'info');
          renderPanel();
        };
        card.querySelector('.ms-btn-edit-item').onclick = (e) => { e.stopPropagation(); tampilkanModalFormKPM(item, originalIdx); };
        card.querySelector('.ms-btn-del-item').onclick = (e) => {
          e.stopPropagation();
          tampilkanModalKonfirmasiModern('Hapus KPM?', `Hapus <b>${escapeHtml(item.sekolah)}</b> dari daftar?`, () => {
            dataPenugasan.splice(originalIdx, 1);
            if (inlineEditIdx === originalIdx) inlineEditIdx = null;
            if (indexTerpilih >= dataPenugasan.length) indexTerpilih = dataPenugasan.length - 1;
            simpanData(dataPenugasan);
            renderPanel();
          });
        };
        listWrap.appendChild(card);
      });
    }
    container.appendChild(listWrap);

    if (dataPenugasan.length > 0) {
      const resetRow = document.createElement('div');
      resetRow.style.cssText = 'display:flex; gap:6px; margin-top:8px;';
      resetRow.innerHTML = `
        <button id="ms-reset-status-all" class="ms-btn ms-btn-ghost" style="flex:1; padding:7.5px; font-size:10.5px;">🔄 Reset Status Semua</button>
        <button id="ms-delete-all-kpm" class="ms-btn ms-btn-danger" style="flex:1; padding:7.5px; font-size:10.5px;">🗑️ Kosongkan Semua</button>
      `;
      resetRow.querySelector('#ms-reset-status-all').onclick = () => {
        tampilkanModalKonfirmasiModern('Reset Status?', 'Kembalikan status seluruh KPM menjadi Belum Diproses?', () => {
          dataPenugasan.forEach((d) => { d.terpakai = false; d.statusProses = 'belum'; });
          simpanData(dataPenugasan);
          renderPanel();
        });
      };
      resetRow.querySelector('#ms-delete-all-kpm').onclick = () => {
        tampilkanModalKonfirmasiModern('Kosongkan Daftar?', 'Hapus seluruh data KPM dari penyimpanan lokal?', () => {
          dataPenugasan = []; indexTerpilih = -1; simpanData(dataPenugasan); renderPanel();
        });
      };
      container.appendChild(resetRow);
    }
  }

  /* TAB 3: MINDSPACE AI ENGINE & AI SUPPORT CHAT */
  function renderTabAI(container) {
    // 1. Kartu AI Support Chat
    const chatCard = document.createElement('div');
    chatCard.className = 'ms-bento';
    chatCard.style.cssText = 'padding: 10px; display: flex; flex-direction: column; gap: 8px;';

    const chatHeader = document.createElement('div');
    chatHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
    chatHeader.innerHTML = `
      <span style="font-size:10px; font-weight:800; color:var(--ms-cyan); text-transform:uppercase;">🤖 AI Support & Diagnosa Sesi</span>
      <button id="ms-ai-clear-chat" class="ms-btn ms-btn-ghost" style="padding:2px 7px; font-size:9.5px;">🧹 Bersihkan</button>
    `;
    chatHeader.querySelector('#ms-ai-clear-chat').onclick = () => {
      aiChatHistory = [aiChatHistory[0]];
      renderPanel();
    };
    chatCard.appendChild(chatHeader);

    const messagesBox = document.createElement('div');
    messagesBox.id = 'ms-ai-chat-messages';
    messagesBox.className = 'ms-scroll';
    messagesBox.style.cssText = 'height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 7px; padding: 4px 2px;';

    aiChatHistory.forEach((msg) => {
      const bubble = document.createElement('div');
      bubble.className = msg.role === 'user' ? 'ms-ai-bubble-user' : 'ms-ai-bubble-bot';
      bubble.innerHTML = formatRichTextSimple(msg.text);
      messagesBox.appendChild(bubble);
    });

    if (aiChatThinking) {
      const typingBubble = document.createElement('div');
      typingBubble.className = 'ms-ai-bubble-bot';
      typingBubble.style.color = 'var(--ms-cyan)';
      typingBubble.textContent = '⏳ sedang mengetik ...';
      messagesBox.appendChild(typingBubble);
    }

    chatCard.appendChild(messagesBox);

    const kirimPertanyaanKeAI = async (teksPrompt) => {
      const q = String(teksPrompt || '').trim();
      if (!q || aiChatThinking) return;
      aiChatHistory.push({ role: 'user', text: q });
      aiChatThinking = true;
      renderPanel();

      const balasan = await tanyaMindspaceAI(q);
      aiChatHistory.push({ role: 'assistant', text: balasan });
      aiChatThinking = false;
      renderPanel();
    };

    // Quick Prompts Chips
    const chipsRow = document.createElement('div');
    chipsRow.className = 'ms-scroll';
    chipsRow.style.cssText = 'display:flex; gap:4px; overflow-x:auto; padding-bottom:2px;';
    const quickPrompts = [
      { label: '🔍 Audit Konflik KPM', text: 'Audit dan cek konflik jadwal semua KPM saya sekarang' },
      { label: '🛠️ Diagnosa Form', text: 'Kenapa form SIPGN gagal terisi dan bagaimana solusinya?' },
      { label: '📊 Cek Ompreng', text: 'Analisis selisih ompreng dari data KPM saya' }
    ];
    quickPrompts.forEach((qp) => {
      const chip = document.createElement('button');
      chip.className = 'ms-btn ms-btn-ghost';
      chip.style.cssText = 'padding:4px 8px; font-size:9.5px; white-space:nowrap; flex-shrink:0; border-radius:99px;';
      chip.textContent = qp.label;
      chip.disabled = aiChatThinking;
      chip.onclick = () => kirimPertanyaanKeAI(qp.text);
      chipsRow.appendChild(chip);
    });
    chatCard.appendChild(chipsRow);

    // Input Row
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex; gap:6px;';
    inputRow.innerHTML = `
      <input id="ms-ai-chat-input" class="ms-input" placeholder="Tanya AI seputar jadwal, WA parser, atau error..." style="padding:8px 10px; font-size:11.5px;" ${aiChatThinking ? 'disabled' : ''} />
      <button id="ms-ai-chat-send" class="ms-btn ms-btn-cyan" style="padding:0 12px; flex-shrink:0;" ${aiChatThinking ? 'disabled' : ''}>➤</button>
    `;
    chatCard.appendChild(inputRow);
    container.appendChild(chatCard);

    setTimeout(() => {
      const box = document.getElementById('ms-ai-chat-messages');
      if (box) box.scrollTop = box.scrollHeight;
    }, 10);

    const inpEl = inputRow.querySelector('#ms-ai-chat-input');
    const sendBtn = inputRow.querySelector('#ms-ai-chat-send');
    sendBtn.onclick = () => kirimPertanyaanKeAI(inpEl.value);
    inpEl.onkeydown = (e) => {
      if (e.key === 'Enter') kirimPertanyaanKeAI(inpEl.value);
    };
  }

  /* TAB 4: PENGATURAN SISTEM, LISENSI & DATABASE */
  function renderTabPengaturan(container) {
    const devId = dapatkanDeviceID();
    const expStr = currentDatabaseExpDate ? formatTanggalIndo(currentDatabaseExpDate) : '-';
    const sisaHari = currentDatabaseExpDate ? hitungSisaHari(currentDatabaseExpDate) : null;
    const authUser = dapatkanAuthUser();
    const isLinked = Boolean(cachedServerStatus?.is_linked || cachedServerStatus?.linked || cekStatusTautanLokal(dapatkanUserIdAktif()));

    const updateCard = document.createElement('div');
    updateCard.className = 'ms-bento';
    updateCard.style.cssText = `padding: 12px; margin-bottom: 10px; border-color: ${availableUpdateRelease ? 'rgba(16,185,129,0.5)' : 'var(--ms-border)'};`;
    updateCard.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:10px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase;">Versi Saat Ini</span>
        <span style="font-size:11px; font-weight:800; font-family:var(--ms-font-mono); color:var(--ms-cyan);">v${escapeHtml(CURRENT_VERSION)}</span>
      </div>
      ${availableUpdateRelease ? `
        <div style="font-size:11.5px; color:#34d399; font-weight:700; margin-bottom:8px;">
          ✨ Tersedia versi terbaru: <b>v${escapeHtml(availableUpdateRelease.version)}</b>
        </div>
        <div style="display:flex; gap:6px;">
          <button id="ms-btn-open-update-detail" class="ms-btn ms-btn-emerald" style="flex:1; padding:8px; font-size:11px;">🚀 Lihat & Update Sekarang</button>
        </div>
      ` : `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <span style="font-size:11px; color:var(--ms-text-sub);">Status: Versi terbaru terpasang</span>
          <button id="ms-btn-manual-check-update" class="ms-btn ms-btn-ghost" style="padding:5px 9px; font-size:10.5px;">🔄 Cek Update</button>
        </div>
      `}
    `;
    container.appendChild(updateCard);

    if (availableUpdateRelease) {
      updateCard.querySelector('#ms-btn-open-update-detail').onclick = tampilkanModalDetailUpdate;
    } else {
      updateCard.querySelector('#ms-btn-manual-check-update').onclick = async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = '⏳...';
        const rel = await cekUpdateAplikasiInApp();
        if (rel) {
          tampilkanModalDetailUpdate();
        } else {
          tampilkanToast(`Skrip sudah versi terbaru (v${CURRENT_VERSION}).`, 'success');
          renderPanel();
        }
      };
    }

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
        <span id="ms-copy-devid" style="font-family:var(--ms-font-mono); color:var(--ms-amber); font-weight:700; cursor:pointer;" title="Klik untuk salin">${escapeHtml(devId)} 📋</span>
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
    speedCard.style.cssText = 'padding: 12px; margin-bottom: 10px;';
    const curSpeed = dapatkanTypingSpeedLevel();
    speedCard.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:10px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase;">Kecepatan Ketik Otomatis</span>
        <span id="ms-speed-label" style="font-size:10.5px; font-weight:700; color:var(--ms-cyan);">${formatSpeedText(curSpeed)}</span>
      </div>
      <input id="ms-speed-slider" type="range" min="0" max="75" step="25" value="${curSpeed}" class="ms-range" />
    `;
    const slider = speedCard.querySelector('#ms-speed-slider');
    slider.oninput = (e) => {
      simpanTypingSpeedLevel(e.target.value);
      speedCard.querySelector('#ms-speed-label').textContent = formatSpeedText(e.target.value);
    };
    container.appendChild(speedCard);

    const autoCard = document.createElement('div');
    autoCard.className = 'ms-bento';
    autoCard.style.cssText = 'padding: 12px; margin-bottom: 10px;';
    const isAutoAdvance = dapatkanAutoAdvance();
    const isAutoSync = dapatkanAutoCloudSync();
    const isAiHeal = dapatkanAiAutoHeal();

    autoCard.innerHTML = `
      <div style="font-size:10px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase; margin-bottom:8px;">Otomatisasi Alur, AI & Armada</div>
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
        <button id="ms-set-auto-advance" class="ms-btn" style="width:100%; padding:8px 10px; justify-content:space-between; background:${isAutoAdvance ? 'rgba(56,189,248,0.16)' : 'rgba(255,255,255,0.03)'}; border-color:${isAutoAdvance ? 'rgba(56,189,248,0.4)' : 'var(--ms-border)'}; color:${isAutoAdvance ? '#fff' : 'var(--ms-text-muted)'};">
          <span>⏭️ Auto-Advance ke KPM Berikutnya</span><b>${isAutoAdvance ? 'AKTIF' : 'MATI'}</b>
        </button>
        <button id="ms-set-ai-heal" class="ms-btn" style="width:100%; padding:8px 10px; justify-content:space-between; background:${isAiHeal ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.03)'}; border-color:${isAiHeal ? 'rgba(168,85,247,0.45)' : 'var(--ms-border)'}; color:${isAiHeal ? '#fff' : 'var(--ms-text-muted)'};">
          <span>🧠 AI Fuzzy DOM Selector (Auto-Heal)</span><b>${isAiHeal ? 'AKTIF' : 'MATI'}</b>
        </button>
        <button id="ms-set-auto-sync" class="ms-btn" style="width:100%; padding:8px 10px; justify-content:space-between; background:${isAutoSync ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.03)'}; border-color:${isAutoSync ? 'rgba(16,185,129,0.4)' : 'var(--ms-border)'}; color:${isAutoSync ? '#fff' : 'var(--ms-text-muted)'};">
          <span>☁️ Auto-Save Cloud Sync (Realtime)</span><b>${isAutoSync ? 'AKTIF' : 'MATI'}</b>
        </button>
      </div>
      <button id="ms-open-fleet-master" class="ms-btn ms-btn-ghost" style="width:100%; padding:8px; color:var(--ms-cyan);">🚚 Kelola Master Kurir & Armada (${muatMasterArmada().length})</button>
    `;
    autoCard.querySelector('#ms-set-auto-advance').onclick = () => {
      simpanAutoAdvance(!isAutoAdvance);
      tampilkanToast(`Auto-Advance KPM ${!isAutoAdvance ? 'diaktifkan' : 'dimatikan'}.`, 'info');
      renderPanel();
    };
    autoCard.querySelector('#ms-set-ai-heal').onclick = () => {
      simpanAiAutoHeal(!isAiHeal);
      tampilkanToast(`AI Fuzzy DOM Selector ${!isAiHeal ? 'diaktifkan' : 'dimatikan'}.`, 'info');
      renderPanel();
    };
    autoCard.querySelector('#ms-set-auto-sync').onclick = () => {
      simpanAutoCloudSync(!isAutoSync);
      if (!isAutoSync) jadwalkanAutoCloudSync(dataPenugasan);
      tampilkanToast(`Auto-Save Cloud Sync ${!isAutoSync ? 'diaktifkan' : 'dimatikan'}.`, 'info');
      renderPanel();
    };
    autoCard.querySelector('#ms-open-fleet-master').onclick = () => tampilkanModalMasterArmada(() => renderPanel());
    container.appendChild(autoCard);

    const backupCard = document.createElement('div');
    backupCard.className = 'ms-bento';
    backupCard.style.cssText = 'padding: 12px;';
    backupCard.innerHTML = `
      <div style="font-size:10px; font-weight:700; color:var(--ms-text-muted); text-transform:uppercase; margin-bottom:8px;">Sinkronisasi & Backup Database</div>
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px;">
        <button id="ms-btn-backup-json" class="ms-btn ms-btn-ghost" style="padding:8px 4px; font-size:10.5px;">💾 JSON</button>
        <button id="ms-btn-import-json" class="ms-btn ms-btn-ghost" style="padding:8px 4px; font-size:10.5px;">📂 File</button>
        <button id="ms-btn-import-cloud" class="ms-btn ms-btn-primary" style="padding:8px 4px; font-size:10.5px;">☁️ Cloud</button>
      </div>
      <input type="file" id="ms-input-backup-file" accept=".json,application/json" style="display:none;" />
    `;
    const fileInput = backupCard.querySelector('#ms-input-backup-file');
    backupCard.querySelector('#ms-btn-backup-json').onclick = downloadBackupData;
    backupCard.querySelector('#ms-btn-import-json').onclick = () => fileInput.click();
    fileInput.onchange = (e) => importBackupData(e.target.files?.[0]);
    backupCard.querySelector('#ms-btn-import-cloud').onclick = () => {
      tampilkanModalKonfirmasiModern('Pulihkan dari Cloud?', 'Data KPM saat ini akan digantikan oleh backup dari server.', importCloudData);
    };
    container.appendChild(backupCard);
  }

  /* ============================================================================
   * 11. VALIDASI SERVER, KEYBOARD SHORTCUTS (CTRL+K) & PEMANTAU PERUBAHAN HALAMAN
   * ============================================================================ */
  function cekStatusLisensiDariDatabase() {
    return new Promise((resolve, reject) => {
      const devId = dapatkanDeviceID();
      const token = dapatkanAuthToken();
      const headers = { 'Cache-Control': 'no-cache, no-store' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      GM_xmlhttpRequest({
        method: 'GET',
        url: `${getVercelApiUrl()}?action=check_status&device_id=${encodeURIComponent(devId)}&_t=${Date.now()}`,
        headers,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            cachedServerStatus = data;
            if (data && data.sppg_name) {
              secureSetGM(SPPG_NAME_KEY, data.sppg_name);
              localStorage.setItem(SPPG_NAME_KEY, data.sppg_name);
            }
            const userIdAktif = dapatkanUserIdAktif();
            if (userIdAktif && (data.is_linked === true || data.linked === true || (data.user_id && String(data.user_id) === String(userIdAktif)))) {
              simpanStatusTautanLokal(userIdAktif, true);
            }
            resolve(data);
          } catch (e) {
            reject('Respon server tidak valid.');
          }
        },
        onerror: () => reject('Gagal terhubung ke server verifikasi.')
      });
    });
  }

  function mulaiPemantauStatusRealTime() {
    if (intervalMonitorLisensi) clearInterval(intervalMonitorLisensi);
    intervalMonitorLisensi = setInterval(async () => {
      try {
        const res = await cekStatusLisensiDariDatabase();
        const statusDB = (res.status || '').toLowerCase();
        if (statusDB === 'revoked' || statusDB === 'hold' || statusDB === 'expired') {
          clearInterval(intervalMonitorLisensi);
          const panel = document.getElementById('sipgn-autofill-panel');
          if (panel) panel.remove();
          tampilkanModalStatusSitus('Sesi Dihentikan', 'Perubahan status lisensi terdeteksi oleh sistem.', statusDB);
        }
      } catch (e) {}
    }, 60000);
  }

  function muatUlangStateLokal() {
    dataPenugasan = muatData();
    indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;
    catatAktivitas('Memuat ulang vault data KPM', 'info');
  }

  function mulaiJalankanSkrip() {
    isScriptInitialized = true;
    muatUlangStateLokal();
    renderPanel();
    if (cekHalamanTugasBaru()) aturCheckboxKurirMBG();
    mulaiPemantauStatusRealTime();
    setTimeout(() => { cekUpdateAplikasiInApp(); }, 1800);

    if (!pemantauHalamanAktif) {
      pemantauHalamanAktif = true;
      let urlTerakhir = location.href;
      let judulFormTerakhir = '';
      let renderDebounce = null;

      new MutationObserver(() => {
        if (!isScriptInitialized) return;

        const panelAda = Boolean(document.getElementById('sipgn-autofill-panel') || document.getElementById('sipgn-fab-trigger'));
        const labelAktif = [...document.querySelectorAll('label')]
          .filter((el) => !el.closest('#sipgn-autofill-panel') && el.offsetParent !== null)
          .map((el) => el.textContent.trim())
          .join('|');

        if (location.href !== urlTerakhir || labelAktif !== judulFormTerakhir || !panelAda) {
          urlTerakhir = location.href;
          judulFormTerakhir = labelAktif;
          clearTimeout(renderDebounce);
          renderDebounce = setTimeout(() => {
            if (!isAutomating && !document.getElementById('sipgn-kpm-form-modal')) {
              if (cekHalamanTugasBaru()) aturCheckboxKurirMBG();
              renderPanel();
            }
          }, 250);
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  async function inialisasiSistem() {
    if (sedangInisialisasi) return;
    sedangInisialisasi = true;

    try {
      const loader = tampilkanLoadingScreen(() => {
        if (!dapatkanNamaSPPG()) {
          tampilkanModalWelcomeSPPG(() => mulaiJalankanSkrip());
        } else {
          mulaiJalankanSkrip();
        }
      });

      loader.updateProgress(25, 'Memeriksa sesi autentikasi MindHUB...');
      const tokenTersimpan = dapatkanAuthToken();

      if (!tokenTersimpan || !cekValiditasJWT(tokenTersimpan)) {
        hapusAuthSession();
        const splashOverlay = document.getElementById('sipgn-splash-loading');
        if (splashOverlay) splashOverlay.remove();
        sedangInisialisasi = false;
        tampilkanModalLoginMindHUB(() => inialisasiSistem());
        return;
      }

      loader.updateProgress(55, 'Memverifikasi integritas perangkat & status lisensi...');
      const resDB = await cekStatusLisensiDariDatabase();
      const statusDB = (resDB.status || '').toLowerCase();

      if (statusDB === 'unregistered' || statusDB === 'not_found' || resDB.registered === false) {
        const userIdAktif = dapatkanUserIdAktif();
        const sudahTertautLokal = cekStatusTautanLokal(userIdAktif);
        const sudahTertautServer = resDB.is_linked === true || resDB.linked === true || (userIdAktif && resDB.user_id && String(resDB.user_id) === String(userIdAktif));

        if (sudahTertautLokal || sudahTertautServer) {
          if (userIdAktif) simpanStatusTautanLokal(userIdAktif, true);
          loader.updateProgress(100, 'Perangkat terverifikasi. Mengalihkan...');
          loader.siapLanjut();
          sedangInisialisasi = false;
          return;
        }

        const splashOverlay = document.getElementById('sipgn-splash-loading');
        if (splashOverlay) splashOverlay.remove();
        sedangInisialisasi = false;

        const overlayLink = buatOverlayModal('sipgn-link-device-modal');
        const authUser = dapatkanAuthUser();
        const devId = dapatkanDeviceID();
        overlayLink.innerHTML = `
          <div class="ms-aurora-shell ms-modal-box" style="padding: 26px 22px; border-radius: 24px; width: 410px; max-width: 92vw; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 10px;">🔗</div>
            <h3 style="margin: 0 0 6px; font-size: 17px; font-weight: 800;">Aktivasi Perangkat Baru</h3>
            <p style="font-size: 12px; color: var(--ms-text-muted); margin: 0 0 14px; line-height: 1.5;">
              Tautkan perangkat ini ke akun <b>@${escapeHtml(authUser?.username || 'MindHUB')}</b> untuk mengaktifkan lisensi.
            </p>
            <div class="ms-bento" style="padding: 10px; margin-bottom: 14px; font-family: var(--ms-font-mono); font-size: 12px; color: var(--ms-amber); font-weight: 700;">
              ${devId}
            </div>
            <div id="sipgn-link-feedback" style="font-size: 11px; min-height: 16px; margin-bottom: 10px; font-weight: 600;"></div>
            <button id="sipgn-btn-confirm-link" class="ms-btn ms-btn-aurora" style="width: 100%; padding: 12px; margin-bottom: 8px;">🔗 Tautkan & Aktifkan Sekarang</button>
            <button id="sipgn-btn-logout-link" class="ms-btn ms-btn-ghost" style="width: 100%; padding: 9px; font-size: 11px;">🚪 Ganti Akun</button>
          </div>
        `;
        bantuAppendKeBody(overlayLink);
        document.getElementById('sipgn-btn-logout-link').onclick = () => { hapusAuthSession(); overlayLink.remove(); inialisasiSistem(); };
        document.getElementById('sipgn-btn-confirm-link').onclick = async (e) => {
          const btn = e.currentTarget;
          const fb = document.getElementById('sipgn-link-feedback');
          btn.disabled = true; btn.textContent = '⏳ Menautkan...';
          try {
            const res = await linkDeviceKeAkun();
            if (res.success) {
              fb.style.color = 'var(--ms-emerald)'; fb.textContent = 'Perangkat berhasil ditautkan!';
              setTimeout(() => { overlayLink.remove(); inialisasiSistem(); }, 400);
            } else {
              fb.style.color = 'var(--ms-rose)'; fb.textContent = res.error || 'Gagal menautkan perangkat.';
              btn.disabled = false; btn.textContent = '🔗 Tautkan & Aktifkan Sekarang';
            }
          } catch (err) {
            fb.style.color = 'var(--ms-rose)'; fb.textContent = typeof err === 'string' ? err : 'Gagal menghubungi server.';
            btn.disabled = false; btn.textContent = '🔗 Tautkan & Aktifkan Sekarang';
          }
        };
        return;
      }

      if (statusDB === 'revoked') {
        const splashOverlay = document.getElementById('sipgn-splash-loading');
        if (splashOverlay) splashOverlay.remove();
        sedangInisialisasi = false;
        tampilkanModalStatusSitus('Akses Diblokir', resDB.message || 'Lisensi perangkat ini telah dicabut oleh Administrator.', 'revoked');
        return;
      }

      if (statusDB === 'hold') {
        const splashOverlay = document.getElementById('sipgn-splash-loading');
        if (splashOverlay) splashOverlay.remove();
        sedangInisialisasi = false;
        tampilkanModalStatusSitus('Lisensi Ditangguhkan', resDB.message || 'Lisensi perangkat sedang dalam status Hold.', 'hold');
        return;
      }

      if (statusDB === 'expired') {
        const splashOverlay = document.getElementById('sipgn-splash-loading');
        if (splashOverlay) splashOverlay.remove();
        sedangInisialisasi = false;
        tampilkanModalStatusSitus('Masa Aktif Habis', 'Masa berlaku lisensi telah berakhir. Silakan klaim voucher perpanjangan atau perbarui melalui MindHUB.', 'expired');
        return;
      }

      if (resDB.exp_date) {
        currentDatabaseExpDate = resDB.exp_date;
        secureSetGM(LICENSE_STORAGE_KEY, buatLicenseKey(resDB.exp_date, dapatkanDeviceID(), 'Synced'));
      }

      loader.updateProgress(100, 'Autentikasi sukses. Mengalihkan...');
      loader.siapLanjut();
      sedangInisialisasi = false;
    } catch (err) {
      sedangInisialisasi = false;
      const statusEl = document.getElementById('sipgn-splash-status');
      const retryBtn = document.getElementById('sipgn-btn-splash-retry');
      if (statusEl) { statusEl.textContent = typeof err === 'string' ? err : 'Gagal memverifikasi server.'; statusEl.style.color = 'var(--ms-rose)'; }
      if (retryBtn) { retryBtn.style.display = 'inline-flex'; retryBtn.onclick = () => { document.getElementById('sipgn-splash-loading')?.remove(); inialisasiSistem(); }; }
    }
  }

  /* ============================================================================
   * 12. PROTEKSI ANTI-COPY / KLIK KANAN & SHORTCUT KEYBOARD (CTRL+K / ESC)
   * ============================================================================ */
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest && (e.target.closest('#sipgn-autofill-panel') || e.target.closest('.ms-ui-root'))) {
      e.preventDefault();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey || e.altKey) && String(e.key || '').toLowerCase() === 'k') {
      if (isScriptInitialized) {
        e.preventDefault();
        tampilkanCommandPalette();
      }
    }
    if (e.key === 'Escape') {
      const cmd = document.getElementById('sipgn-command-palette');
      if (cmd) cmd.remove();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inialisasiSistem);
  } else {
    inialisasiSistem();
  }
})();
