// ==UserScript==
// @name        SIPGN Autofill - POP
// @namespace   sipgn-autofill
// @version     1.5.47
// @description Isi otomatis form Tugas Pengiriman & Klaim Voucher Durasi Custom Baru
// @match       https://pop-sipgn.bgn.go.id/distribution/*
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_xmlhttpRequest
// @connect     mindspace-id.vercel.app
// @connect     api.qrserver.com
// @connect     chart.googleapis.com
// @updateURL   https://mindspace-id.vercel.app/sipgn-autofill.user.js
// @downloadURL https://mindspace-id.vercel.app/sipgn-autofill.user.js
// ==/UserScript==

(function () {
  'use strict';

  const CURRENT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script)
    ? GM_info.script.version
    : '1.5.48';

  const VERCEL_API_URL = 'https://mindspace-id.vercel.app/api/tokopay';

  const SECRET_SALT = 'MINDSTUDIO2026';
  const LICENSE_STORAGE_KEY = 'sipgn_license_key';
  const DEVICE_STORAGE_KEY = 'sipgn_device_id';
  const SPPG_NAME_KEY = 'sipgn_sppg_name';
  const STORAGE_KEY = 'sipgnAutofillData';
  const AUTO_KURIR_KEY = 'sipgn_auto_kurir_mbg';
  const MINIMIZE_KEY = 'sipgn_panel_minimized';

  let currentDatabaseExpDate = null;
  let statusLisensiTerakhir = null;
  let cachedServerStatus = null;
  let intervalMonitorLisensi = null;
  let isPaymentModalOpen = false;
  let isPaymentSuccess = false;
  let daftarVouchersGlobal = [];
  let kodeVoucherTerpakai = null;

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
    try {
      GM_setValue(AUTO_KURIR_KEY, val);
    } catch (e) {}
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
    try {
      GM_setValue(MINIMIZE_KEY, val);
    } catch (e) {}
    localStorage.setItem(MINIMIZE_KEY, String(val));
  }

  function dapatkanNamaSPPG() {
    try {
      return GM_getValue(SPPG_NAME_KEY, '') || localStorage.getItem(SPPG_NAME_KEY) || '';
    } catch (e) {
      return localStorage.getItem(SPPG_NAME_KEY) || '';
    }
  }

  function simpanNamaSPPG(nama) {
    try {
      GM_setValue(SPPG_NAME_KEY, nama);
    } catch (e) {}
    localStorage.setItem(SPPG_NAME_KEY, nama);
    kirimNamaSPPGKeDatabase(nama);
  }

  function kirimNamaSPPGKeDatabase(nama) {
    const devId = dapatkanDeviceID();
    GM_xmlhttpRequest({
      method: 'POST',
      url: VERCEL_API_URL,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        action: 'register_sppg',
        device_id: devId,
        sppg_name: nama
      }),
      onload: function (res) {
        try {
          console.log('[Autofill] Sinkronisasi nama SPPG ke database berhasil.');
        } catch (e) {}
      },
      onerror: function () {
        console.warn('[Autofill] Gagal meng-upload nama SPPG ke database server.');
      }
    });
  }

  function aturCheckboxKurirMBG() {
    const isAuto = dapatkanAutoKurirMBG();

    const semuaCheckbox = [...document.querySelectorAll('input[type="checkbox"]')].filter(
      (cb) => !cb.closest('#sipgn-autofill-panel')
    );

    const checkboxKurir = semuaCheckbox.find((cb) => {
      const parentText = (cb.closest('label') || cb.parentElement || document.body).innerText || '';
      return parentText.includes('Kirim tugas pengiriman ke Aplikasi Kurir MBG') || parentText.includes('Kurir MBG');
    }) || semuaCheckbox[0];

    if (checkboxKurir) {
      if (isAuto && !checkboxKurir.checked) {
        checkboxKurir.checked = true;
        checkboxKurir.dispatchEvent(new Event('change', { bubbles: true }));
        checkboxKurir.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (!isAuto && checkboxKurir.checked) {
        checkboxKurir.checked = false;
        checkboxKurir.dispatchEvent(new Event('change', { bubbles: true }));
        checkboxKurir.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return isAuto;
    }
    return false;
  }

  function getRandomDelay(min = 350, max = 800) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async function smartWait(minMs = 350, maxMs = 800) {
    const delay = getRandomDelay(minMs, maxMs);
    await wait(delay);
  }

  function cekUpdateSkrip() {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `${VERCEL_API_URL}?action=check_version&_t=${Date.now()}`,
      headers: { 'Cache-Control': 'no-cache, no-store' },
      onload: function (res) {
        try {
          const data = JSON.parse(res.responseText);
          const latestVersion = data.version;
          const downloadUrl = data.download_url || 'https://mindspace-id.vercel.app/files/sipgn-autofill.user.js';
          const changelog = data.changelog || 'Tidak ada catatan perubahan.';

          if (latestVersion && latestVersion !== CURRENT_VERSION) {
            tampilkanNotifikasiUpdate(latestVersion, downloadUrl, changelog);
          }
        } catch (e) {
          console.warn('[Autofill] Gagal memproses data update:', e);
        }
      },
      onerror: function () {
        console.warn('[Autofill] Gagal menghubungi server update.');
      }
    });
  }

  function tampilkanNotifikasiUpdate(versiBaru, urlDownload, changelog = '') {
    const modalLama = document.getElementById('sipgn-update-modal');
    if (modalLama) modalLama.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sipgn-update-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
      z-index: 1000000; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <style>
        #sipgn-changelog-box::-webkit-scrollbar {
          width: 8px;
        }
        #sipgn-changelog-box::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.6);
          border-radius: 8px;
        }
        #sipgn-changelog-box::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 8px;
          border: 2px solid rgba(15, 23, 42, 0.6);
        }
        #sipgn-changelog-box::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
        #sipgn-changelog-box {
          scrollbar-width: thin;
          scrollbar-color: #334155 rgba(15, 23, 42, 0.6);
        }
      </style>
      <div style="position: relative; background: #1e293b; border: 1px solid rgba(234, 179, 8, 0.4); color: #f8fafc; padding: 28px; border-radius: 20px; width: 680px; max-width: 92vw; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); text-align: left;">
        <button id="sipgn-btn-close-update" style="position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.05); border: none; color: #94a3b8; width: 30px; height: 30px; border-radius: 50%; font-size: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;">✕</button>

        <div style="display: grid; grid-template-columns: 240px 1fr; gap: 24px; align-items: start;">

          <div style="display: flex; flex-direction: column; align-items: center; text-align: center; border-right: 1px solid rgba(51, 65, 85, 0.6); padding-right: 20px;">
            <div style="width: 56px; height: 56px; background: rgba(234, 179, 8, 0.1); color: #eab308; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 14px;">🚀</div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #fef08a; line-height: 1.3;">Update Versi Baru Tersedia!</h3>

            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(51, 65, 85, 0.6); border-radius: 10px; padding: 10px 14px; margin: 14px 0; width: 100%; box-sizing: border-box;">
              <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">Versi Saat Ini: <b style="color: #ef4444;">v${CURRENT_VERSION}</b></div>
              <div style="font-size: 11px; color: #94a3b8;">Versi Terbaru: <b style="color: #4ade80;">v${versiBaru}</b></div>
            </div>

            <a href="${urlDownload}" target="_blank" id="sipgn-link-update" style="display: block; width: 100%; box-sizing: border-box; padding: 10px; background: #eab308; color: #0f172a; font-weight: 700; border-radius: 10px; text-decoration: none; font-size: 12px; margin-bottom: 8px; text-align: center; transition: 0.2s;">
              📥 Download & Install
            </a>
            <button id="sipgn-btn-later-update" style="width: 100%; padding: 9px; border: 1px solid #334155; border-radius: 10px; background: transparent; color: #cbd5e1; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s;">
              Nanti Saja
            </button>
          </div>

          <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <span>📋</span> Catatan Perubahan (Changelogs)
            </div>
            <div id="sipgn-changelog-box" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 12px; padding: 14px; height: 260px; overflow-y: auto; font-size: 12px; color: #cbd5e1; line-height: 1.6; white-space: pre-wrap; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
${changelog}
            </div>
          </div>

        </div>

        <div style="margin-top: 18px; padding-top: 4px; text-align: center; font-size: 10px; color: #64748b;">© 2026 - <b>Mindspace Studio</b></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const tutupModal = () => overlay.remove();
    document.getElementById('sipgn-btn-close-update').onclick = tutupModal;
    document.getElementById('sipgn-btn-later-update').onclick = tutupModal;
    document.getElementById('sipgn-link-update').onclick = () => {
      setTimeout(tutupModal, 1500);
    };
  }

  function formatTanggalIndo(tanggalStr) {
    if (!tanggalStr || typeof tanggalStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalStr)) {
      return tanggalStr || '';
    }
    const namaBulan = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const [yyyy, mm, dd] = tanggalStr.split('-');
    return `${dd} ${namaBulan[parseInt(mm, 10) - 1]} ${yyyy}`;
  }

  function hitungSisaHari(tanggalStr) {
    if (!tanggalStr || typeof tanggalStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalStr)) {
      return null;
    }
    const targetDate = new Date(tanggalStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function formatSisaHariTeks(sisaHari) {
    if (sisaHari === null) return '';
    if (sisaHari > 0) {
      return ` (${sisaHari} hari lagi)`;
    } else if (sisaHari === 0) {
      return ' (hari ini)';
    } else {
      return ` (${Math.abs(sisaHari)} hari yang lalu)`;
    }
  }

  function dapatkanWarnaMasaAktif(sisaHari) {
    if (sisaHari === null) return '#facc15';
    if (sisaHari > 7) return '#34d399';
    if (sisaHari <= 7 && sisaHari >= 3) return '#facc15';
    return '#ef4444';
  }

  function dapatkanDeviceID() {
    try {
      let devId = GM_getValue(DEVICE_STORAGE_KEY, '');
      if (!devId) {
        const hashAcak = Array.from({ length: 8 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('').toUpperCase();
        devId = `DEV-${hashAcak.slice(0, 4)}-${hashAcak.slice(4)}`;
        GM_setValue(DEVICE_STORAGE_KEY, devId);
      }
      return devId;
    } catch (e) {
      return 'DEV-DEFAULT-KEY';
    }
  }

  function buatLicenseKey(expDate, deviceId, client = 'User') {
    const nonce = Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
    const payload = `${expDate}|${deviceId}|${client}|${SECRET_SALT}|${nonce}`;
    const encoded = btoa(payload);
    const reversed = encoded.split('').reverse().join('');
    return `MIND-${reversed}`;
  }

  function tampilkanModalWelcomeSPPG(onSelesai) {
    const modalLama = document.getElementById('sipgn-welcome-sppg-modal');
    if (modalLama) modalLama.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sipgn-welcome-sppg-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(10px);
      z-index: 1000010; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="background: #1e293b; border: 1px solid rgba(56, 189, 248, 0.4); color: #f8fafc; padding: 28px; border-radius: 20px; width: 380px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);">
        <div style="width: 56px; height: 56px; background: rgba(56, 189, 248, 0.1); color: #38bdf8; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px auto;">👋</div>
        <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 700; color: #f8fafc;">Selamat Datang!</h3>
        <p style="font-size: 12px; color: #94a3b8; margin: 0 0 20px 0; line-height: 1.5;">
          Sebelum memulai, silakan masukkan <b>Nama SPPG</b> Anda. Nama ini akan ditampilkan pada header panel utama.
        </p>

        <div style="text-align: left; margin-bottom: 18px;">
          <label style="display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Nama SPPG <span style="color: #ef4444;">*</span></label>
          <input type="text" id="sipgn-input-nama-sppg" placeholder="Contoh: SPPG MEDAN KOTA" style="width: 100%; box-sizing: border-box; padding: 10px 14px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: white; font-size: 13px; font-weight: 600; outline: none; transition: 0.2s;" />
          <div id="sipgn-sppg-error" style="color: #ef4444; font-size: 11px; margin-top: 4px; display: none;">Nama SPPG wajib diisi!</div>
        </div>

        <button id="sipgn-btn-save-sppg" style="width: 100%; padding: 12px; border: none; border-radius: 10px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; font-weight: 700; cursor: pointer; font-size: 13px; transition: 0.2s; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
          Lanjutkan 🚀
        </button>
        <div style="margin-top: 16px; font-size: 10px; color: #64748b;">© 2026 - <b>Mindspace Studio</b></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const inputSPPG = document.getElementById('sipgn-input-nama-sppg');
    const errText = document.getElementById('sipgn-sppg-error');
    const btnSave = document.getElementById('sipgn-btn-save-sppg');

    inputSPPG.value = dapatkanNamaSPPG();
    inputSPPG.focus();

    btnSave.onclick = () => {
      const val = inputSPPG.value.trim();
      if (!val) {
        errText.style.display = 'block';
        inputSPPG.style.borderColor = '#ef4444';
        return;
      }
      simpanNamaSPPG(val);
      overlay.remove();
      if (onSelesai) onSelesai();
    };

    inputSPPG.oninput = () => {
      if (inputSPPG.value.trim()) {
        errText.style.display = 'none';
        inputSPPG.style.borderColor = '#334155';
      }
    };
  }

  function tampilkanModalKonfirmasiModern(judulText, pesanText, onKonfirmasi) {
    const modalLama = document.getElementById('sipgn-confirm-modal');
    if (modalLama) modalLama.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sipgn-confirm-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
      z-index: 1000004; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="background: #1e293b; border: 1px solid rgba(234, 179, 8, 0.3); color: #f8fafc; padding: 24px; border-radius: 16px; width: 340px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        <div style="width: 48px; height: 48px; background: rgba(234, 179, 8, 0.1); color: #eab308; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 14px auto;">⚠️</div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #fef08a;">${judulText}</h3>
        <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 16px 0; line-height: 1.5;">${pesanText}</p>

        <div style="display: flex; gap: 8px;">
          <button id="sipgn-btn-conf-yes" style="flex: 1; padding: 10px; border: none; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s;">
            Ya, Lanjutkan
          </button>
          <button id="sipgn-btn-conf-no" style="flex: 1; padding: 10px; border: 1px solid #334155; border-radius: 10px; background: transparent; color: #cbd5e1; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s;">
            Batal
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sipgn-btn-conf-yes').onclick = () => {
      overlay.remove();
      onKonfirmasi();
    };
    document.getElementById('sipgn-btn-conf-no').onclick = () => {
      overlay.remove();
    };
  }

  function tampilkanModalAlertModern(judulText, pesanText, isBerhasil = true, onTutup = null) {
    const modalLama = document.getElementById('sipgn-alert-modal');
    if (modalLama) modalLama.remove();

    const warnaTema = isBerhasil ? '#34d399' : '#ef4444';
    const bgIcon = isBerhasil ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    const iconSym = isBerhasil ? '✅' : '❌';
    const borderColor = isBerhasil ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';

    const overlay = document.createElement('div');
    overlay.id = 'sipgn-alert-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
      z-index: 1000005; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="background: #1e293b; border: 1px solid ${borderColor}; color: #f8fafc; padding: 24px; border-radius: 16px; width: 340px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        <div style="width: 48px; height: 48px; background: ${bgIcon}; color: ${warnaTema}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 14px auto;">${iconSym}</div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: ${warnaTema};">${judulText}</h3>
        <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 16px 0; line-height: 1.5;">${pesanText}</p>

        <button id="sipgn-btn-alert-ok" style="width: 100%; padding: 10px; border: none; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s;">
          OK
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sipgn-btn-alert-ok').onclick = () => {
      overlay.remove();
      if (onTutup) onTutup();
    };
  }

  function ambilDaftarPaketDanVercel() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${VERCEL_API_URL}?action=get_packages&_t=${Date.now()}`,
        headers: { 'Cache-Control': 'no-cache, no-store' },
        onload: function (resPkg) {
          GM_xmlhttpRequest({
            method: 'GET',
            url: `${VERCEL_API_URL}?action=get_vouchers&_t=${Date.now()}`,
            headers: { 'Cache-Control': 'no-cache, no-store' },
            onload: function (resVouch) {
              try {
                const dataPkg = JSON.parse(resPkg.responseText);

                let listPaket = [];
                if (Array.isArray(dataPkg)) {
                  listPaket = dataPkg;
                } else if (dataPkg && Array.isArray(dataPkg.packages)) {
                  listPaket = dataPkg.packages;
                } else if (dataPkg && Array.isArray(dataPkg.data)) {
                  listPaket = dataPkg.data;
                }

                let listVoucher = [];
                try {
                  const dataVouch = JSON.parse(resVouch.responseText);
                  listVoucher = dataVouch.vouchers || (Array.isArray(dataVouch) ? dataVouch : []);
                } catch(e) {}

                daftarVouchersGlobal = listVoucher;
                resolve({ packages: listPaket, vouchers: listVoucher });
              } catch (e) {
                reject('Respon data dari Vercel tidak valid.');
              }
            },
            onerror: () => reject('Gagal mengambil voucher.')
          });
        },
        onerror: function () {
          reject('Gagal mengambil daftar paket dari server Vercel.');
        }
      });
    });
  }

  function klaimVoucherVercel(kodeVoucher) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: VERCEL_API_URL,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          action: 'claim_voucher',
          voucher_code: kodeVoucher,
          device_id: dapatkanDeviceID()
        }),
        onload: function (res) {
          try {
            const data = JSON.parse(res.responseText);
            resolve(data);
          } catch (e) {
            reject('Respon klaim voucher dari Vercel tidak valid.');
          }
        },
        onerror: function () {
          reject('Gagal menghubungi server Vercel.');
        }
      });
    });
  }

  function klaimFreeTrialVercel() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: VERCEL_API_URL,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          action: 'claim_trial',
          device_id: dapatkanDeviceID(),
          sppg_name: dapatkanNamaSPPG()
        }),
        onload: function (res) {
          try {
            const data = JSON.parse(res.responseText);
            resolve(data);
          } catch (e) {
            reject('Respon klaim trial tidak valid.');
          }
        },
        onerror: function () {
          reject('Gagal terhubung ke server.');
        }
      });
    });
  }

  function buatOrderVercel(paketHari, refId) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: VERCEL_API_URL,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          paket_hari: paketHari,
          reff_id: refId,
          ref_id: refId,
          device_id: dapatkanDeviceID(),
          metode: 'QRISREALTIME',
          produk: 'Topup Lisensi SIPGN'
        }),
        onload: function (res) {
          try {
            const data = JSON.parse(res.responseText);
            resolve(data);
          } catch (e) {
            reject('Respon dari Vercel tidak valid.');
          }
        },
        onerror: function () {
          reject('Gagal menghubungi server Vercel.');
        }
      });
    });
  }

  function cekStatusVercel(refId, paketHari = 7) {
    const devId = dapatkanDeviceID();
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${VERCEL_API_URL}?reff_id=${encodeURIComponent(refId)}&ref_id=${encodeURIComponent(refId)}&device_id=${encodeURIComponent(devId)}&paket_hari=${encodeURIComponent(paketHari)}&metode=QRISREALTIME&_t=${Date.now()}`,
        headers: { 'Cache-Control': 'no-cache, no-store' },
        onload: function (res) {
          try {
            const data = typeof res.responseText === 'string' ? JSON.parse(res.responseText) : res.responseText;
            resolve(data);
          } catch (e) {
            reject('Gagal cek status dari Vercel.');
          }
        },
        onerror: function (err) {
          reject(err);
        }
      });
    });
  }

  let intervalPollingPembayaran = null;
  let intervalTimerCountdown = null;
  let intervalCancelCountdown = null;

  function hentikanTimerDanPolling() {
    if (intervalPollingPembayaran) { clearInterval(intervalPollingPembayaran); intervalPollingPembayaran = null; }
    if (intervalTimerCountdown) { clearInterval(intervalTimerCountdown); intervalTimerCountdown = null; }
    if (intervalCancelCountdown) { clearInterval(intervalCancelCountdown); intervalCancelCountdown = null; }
  }

  function batalkanPembayaranLangsung() {
    hentikanTimerDanPolling();
    isPaymentModalOpen = false;
    isPaymentSuccess = false;
    const btnBeli = document.getElementById('sipgn-btn-buy-qris');
    const qrContainer = document.getElementById('sipgn-qris-container');
    const wrapperPaket = document.getElementById('sipgn-wrapper-paket');
    const voucherSection = document.getElementById('sipgn-voucher-section');
    const infoPerangkatSec = document.getElementById('sipgn-info-perangkat-sec');
    const backupImportSec = document.getElementById('sipgn-backup-import-sec');

    if (qrContainer) { qrContainer.style.display = 'none'; qrContainer.innerHTML = ''; }
    if (wrapperPaket) wrapperPaket.style.display = 'block';
    if (voucherSection) voucherSection.style.display = 'block';
    if (infoPerangkatSec) infoPerangkatSec.style.display = 'block';
    if (backupImportSec) backupImportSec.style.display = 'block';
    if (btnBeli) { btnBeli.style.display = 'block'; btnBeli.disabled = false; btnBeli.textContent = '💳 Bayar via QRIS'; }
  }

  function prosesMulaiBatalWithCountdown() {
    const btnCancel = document.getElementById('sipgn-btn-cancel-qris');
    if (!btnCancel || intervalCancelCountdown) return;

    let sisaBatal = 3;
    btnCancel.disabled = true;
    btnCancel.style.background = '#ea580c';
    btnCancel.style.color = '#ffffff';
    btnCancel.textContent = `⏳ Membatalkan dalam (${sisaBatal}s)...`;

    intervalCancelCountdown = setInterval(() => {
      sisaBatal--;
      if (sisaBatal > 0) {
        btnCancel.textContent = `⏳ Membatalkan dalam (${sisaBatal}s)...`;
      } else {
        clearInterval(intervalCancelCountdown);
        intervalCancelCountdown = null;
        batalkanPembayaranLangsung();
      }
    }, 1000);
  }

  function mulaiJalankanSkrip() {
    pasangDetektorNavigasiSPA();
    renderPanel();
    pasangDetektorPerubahanForm();
    cekUpdateSkrip();
  }

  function tampilkanModalSukses(expDateTarget, pesanSuksesCustom = 'PEMBAYARAN BERHASIL!') {
    const modalAktivasiLama = document.getElementById('sipgn-license-modal');
    if (modalAktivasiLama) modalAktivasiLama.remove();

    const modalSuksesLama = document.getElementById('sipgn-success-modal');
    if (modalSuksesLama) modalSuksesLama.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sipgn-success-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
      z-index: 1000001; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const sisaHariSukses = hitungSisaHari(expDateTarget);
    const teksSisaHariSukses = formatSisaHariTeks(sisaHariSukses);
    const warnaMasaAktifSukses = dapatkanWarnaMasaAktif(sisaHariSukses);

    overlay.innerHTML = `
      <div style="position: relative; background: #1e293b; border: 1px solid rgba(16, 185, 129, 0.3); color: #f8fafc; padding: 28px; border-radius: 16px; width: 340px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        <div style="width: 56px; height: 56px; background: rgba(16, 185, 129, 0.1); color: #34d399; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 auto 16px auto;">🎉</div>
        <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #34d399;">${pesanSuksesCustom}</h3>
        <p style="font-size: 12px; color: #94a3b8; margin: 6px 0 16px 0;">Akses sistem Anda telah diperbarui.</p>

        <div style="background: rgba(6, 78, 59, 0.4); color: #a7f3d0; padding: 14px; border-radius: 12px; font-size: 12px; margin-bottom: 20px; border: 1px solid rgba(4, 120, 87, 0.4); text-align: center;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #34d399; font-weight: 600; margin-bottom: 4px;">Status: Aktif</div>
          <div style="font-size: 11px; color: #cbd5e1;">Masa Aktif:</div>
          <div style="margin-top: 2px; font-size: 14px; font-weight: 700; color: ${warnaMasaAktifSukses};">${formatTanggalIndo(expDateTarget)}${teksSisaHariSukses}</div>
        </div>

        <button id="sipgn-btn-close-success" style="width: 100%; padding: 11px; border: none; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; cursor: pointer; font-size: 13px; transition: 0.2s;">
          🚀 Lanjutkan Sesi
        </button>
        <div style="margin-top: 16px; font-size: 11px; color: #64748b;">© 2026 - <b>Mindspace Studio</b></div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sipgn-btn-close-success').onclick = () => {
      isPaymentSuccess = false;
      isPaymentModalOpen = false;
      overlay.remove();
      mulaiJalankanSkrip();
    };
  }

  function eksekusiSuksesPembayaran(jumlahHari, devId, expDateFromBackend = null, nominalBayarTrx = 0) {
    hentikanTimerDanPolling();
    isPaymentSuccess = true;

    let expDateTarget = expDateFromBackend;

    if (!expDateTarget) {
      let baseDate = new Date();
      if (currentDatabaseExpDate) {
        const expDateObj = new Date(currentDatabaseExpDate + 'T00:00:00');
        if (expDateObj > baseDate) {
          baseDate = expDateObj;
        }
      }
      baseDate.setDate(baseDate.getDate() + jumlahHari);
      const yyyy = baseDate.getFullYear();
      const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
      const dd = String(baseDate.getDate()).padStart(2, '0');
      expDateTarget = `${yyyy}-${mm}-${dd}`;
    }

    currentDatabaseExpDate = expDateTarget;
    statusLisensiTerakhir = 'active';

    const autoKey = buatLicenseKey(expDateTarget, devId, 'AutoPayment');
    GM_setValue(LICENSE_STORAGE_KEY, autoKey);

    if (nominalBayarTrx > 0) {
      GM_xmlhttpRequest({
        method: 'POST',
        url: VERCEL_API_URL,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          action: 'record_successful_payment',
          device_id: devId,
          amount: Number(nominalBayarTrx),
          paket_hari: jumlahHari
        }),
        onload: function() {},
        onerror: function() {}
      });
    }

    tampilkanModalSukses(expDateTarget);
  }

  function cekApakahLunas(obj) {
    if (!obj) return false;
    const subData = obj.data || obj.result || obj;
    const innerSubData = subData?.data || subData;
    const listStatusSukses = ['success', 'paid', 'completed', 'lunas', 'berhasil', '200', '1'];

    const isPaidFlag =
      subData.is_paid === true || subData.paid === true ||
      innerSubData.is_paid === true || innerSubData.paid === true ||
      obj.is_paid === true || obj.paid === true;

    const statusVal = String(
      innerSubData.status || innerSubData.raw_status || innerSubData.transaction_status ||
      subData.status || subData.raw_status || subData.transaction_status ||
      obj.status || ''
    ).toLowerCase().trim();

    if (isPaidFlag || listStatusSukses.includes(statusVal)) {
      return true;
    }
    return false;
  }

  async function prosesPembayaranOtomatis(jumlahHari) {
    const devId = dapatkanDeviceID();
    const cleanDevId = devId.replace(/[^a-zA-Z0-9]/g, '');
    const refIdAwal = `SIPGN__${cleanDevId}__${jumlahHari}__${Date.now()}`;

    const btnBeli = document.getElementById('sipgn-btn-buy-qris');
    const qrContainer = document.getElementById('sipgn-qris-container');
    const wrapperPaket = document.getElementById('sipgn-wrapper-paket');
    const voucherSection = document.getElementById('sipgn-voucher-section');
    const infoPerangkatSec = document.getElementById('sipgn-info-perangkat-sec');
    const backupImportSec = document.getElementById('sipgn-backup-import-sec');

    hentikanTimerDanPolling();
    isPaymentModalOpen = true;
    isPaymentSuccess = false;

    try {
      if (btnBeli) {
        btnBeli.disabled = true;
        btnBeli.textContent = '⏳ Memproses QRIS...';
      }

      const resOrder = await buatOrderVercel(jumlahHari, refIdAwal);
      console.log('[Autofill] Respon Buat Order Vercel:', resOrder);

      if (resOrder.error) {
        tampilkanModalAlertModern('Gagal dari Server', resOrder.error, false);
        isPaymentModalOpen = false;
        if (btnBeli) { btnBeli.disabled = false; btnBeli.textContent = '💳 Bayar via QRIS'; }
        return;
      }

      const refIdFix = resOrder.reff_id || resOrder.ref_id || resOrder.data?.reff_id || resOrder.data?.ref_id || refIdAwal;
      const orderData = resOrder.data?.data?.data || resOrder.data?.data || resOrder.data || resOrder;

      const qrStringRaw = resOrder.qr_string || orderData.qr_string || orderData.qr_code || orderData.qr_content || null;
      const qrLinkRaw = resOrder.qr_link || orderData.qr_link || orderData.qr_url || null;
      const nominalPembayaran = resOrder.total_bayar || orderData.total_bayar || orderData.jumlah_bayar || orderData.nominal || orderData.price || orderData.total || null;

      let finalQrImageUrl = null;

      if (qrStringRaw && typeof qrStringRaw === 'string' && qrStringRaw.trim().length > 10) {
        finalQrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrStringRaw.trim())}`;
      } else if (qrLinkRaw && typeof qrLinkRaw === 'string' && (qrLinkRaw.includes('.png') || qrLinkRaw.includes('.jpg') || qrLinkRaw.includes('qr'))) {
        finalQrImageUrl = qrLinkRaw;
      } else if (orderData.pay_url) {
        finalQrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(orderData.pay_url)}`;
      }

      if (!finalQrImageUrl) {
        const pesanErrorMsg = resOrder.data?.error_msg || resOrder.data?.message || orderData.error_msg || orderData.message || 'Data QRIS tidak ditemukan dari Tokopay.';
        tampilkanModalAlertModern('Gagal QRIS', pesanErrorMsg, false);
        isPaymentModalOpen = false;
        if (btnBeli) {
          btnBeli.disabled = false;
          btnBeli.textContent = '💳 Bayar via QRIS';
        }
        return;
      }

      if (wrapperPaket) wrapperPaket.style.display = 'none';
      if (voucherSection) voucherSection.style.display = 'none';
      if (infoPerangkatSec) infoPerangkatSec.style.display = 'none';
      if (backupImportSec) backupImportSec.style.display = 'none';
      if (btnBeli) btnBeli.style.display = 'none';

      if (qrContainer) {
        const teksNominal = nominalPembayaran ? `Rp ${Number(nominalPembayaran).toLocaleString('id-ID')}` : '-';

        qrContainer.style.display = 'block';
        qrContainer.innerHTML = `
          <div style="background: white; padding: 12px; border-radius: 12px; display: inline-block; margin: 10px 0; border: 2px solid rgba(16, 185, 129, 0.4);">
            <img id="sipgn-qr-img-element" src="${finalQrImageUrl}" alt="QRIS Tokopay" style="width: 200px; height: 200px; display: block; margin: 0 auto; image-rendering: pixelated;" />
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">
            Total Pembayaran:<br><b style="color: #4ade80; font-size: 18px; font-weight: 700;">${teksNominal}</b>
          </div>
          <div style="font-size: 11px; color: #facc15; font-weight: 600; margin-top: 4px;">
            Selesaikan pembayaran dalam waktu:
          </div>
          <div id="sipgn-timer-display" style="font-size: 20px; font-weight: 700; color: #ef4444; margin-top: 2px; margin-bottom: 12px;">
            10:00
          </div>
          <button id="sipgn-btn-cancel-qris" style="width: 100%; padding: 9px; border: none; border-radius: 10px; background: rgba(153, 27, 27, 0.2); color: #fecaca; border: 1px solid rgba(153, 27, 27, 0.4); font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s;">
            ❌ Batalkan Pembayaran
          </button>
        `;

        const imgEl = document.getElementById('sipgn-qr-img-element');
        if (imgEl && qrStringRaw) {
          imgEl.onerror = function () {
            this.src = `https://chart.googleapis.com/chart?cht=qr&chs=250x250&chl=${encodeURIComponent(qrStringRaw.trim())}`;
          };
        }

        const btnCancel = document.getElementById('sipgn-btn-cancel-qris');
        if (btnCancel) btnCancel.onclick = prosesMulaiBatalWithCountdown;
      }

      let sisaWaktu = 600;
      const timerDisplay = document.getElementById('sipgn-timer-display');

      intervalTimerCountdown = setInterval(() => {
        sisaWaktu--;
        const menit = String(Math.floor(sisaWaktu / 60)).padStart(2, '0');
        const detik = String(sisaWaktu % 60).padStart(2, '0');

        if (timerDisplay) timerDisplay.textContent = `${menit}:${detik}`;

        if (sisaWaktu <= 0) {
          hentikanTimerDanPolling();
          isPaymentModalOpen = false;
          if (wrapperPaket) wrapperPaket.style.display = 'block';
          if (voucherSection) voucherSection.style.display = 'block';
          if (infoPerangkatSec) infoPerangkatSec.style.display = 'block';
          if (backupImportSec) backupImportSec.style.display = 'block';
          if (qrContainer) {
            qrContainer.innerHTML = `
              <div style="background: rgba(127, 29, 29, 0.2); color: #fecaca; padding: 12px; border-radius: 10px; font-size: 12px; margin-top: 10px; border: 1px solid rgba(153, 27, 27, 0.4);">
                ⏰ <b>WAKTU PEMBAYARAN HABIS!</b><br>Silakan buat tagihan QRIS baru.
              </div>
            `;
          }
          if (btnBeli) {
            btnBeli.style.display = 'block';
            btnBeli.disabled = false;
            btnBeli.textContent = '💳 Bayar via QRIS';
          }
        }
      }, 1000);

      let isPollingBusy = false;
      intervalPollingPembayaran = setInterval(async () => {
        if (isPollingBusy) return;
        isPollingBusy = true;

        try {
          const resStatus = await cekStatusVercel(refIdFix, jumlahHari);
          const isLunas = cekApakahLunas(resStatus);

          if (isLunas) {
            const innerData = resStatus?.data || resStatus;
            const expDateFromBackend = innerData?.exp_date || resStatus?.exp_date || null;
            eksekusiSuksesPembayaran(jumlahHari, devId, expDateFromBackend, Number(nominalPembayaran || 0));
          }
        } catch (e) {
          console.warn('[Autofill] Polling status terganggu:', e);
        } finally {
          isPollingBusy = false;
        }
      }, 3000);

    } catch (err) {
      tampilkanModalAlertModern('Error Transaksi', err, false);
      isPaymentModalOpen = false;
      if (wrapperPaket) wrapperPaket.style.display = 'block';
      if (voucherSection) voucherSection.style.display = 'block';
      if (infoPerangkatSec) infoPerangkatSec.style.display = 'block';
      if (backupImportSec) backupImportSec.style.display = 'block';
      if (btnBeli) {
        btnBeli.disabled = false;
        btnBeli.textContent = '💳 Bayar via QRIS';
      }
    }
  }

  function muatDaftarPaketKeSelect(selectEl, btnBeliEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">⏳ Memuat paket...</option>';
    if (btnBeliEl) btnBeliEl.disabled = true;

    ambilDaftarPaketDanVercel()
      .then((resData) => {
        let listPaket = [];

        if (resData && Array.isArray(resData.packages)) {
          listPaket = resData.packages;
        } else if (Array.isArray(resData)) {
          listPaket = resData;
        } else if (resData && Array.isArray(resData.data)) {
          listPaket = resData.data;
        }

        if (!listPaket || listPaket.length === 0) {
          listPaket = [
            { hari: 7, harga: 100, nama: 'Paket 7 Hari' },
            { hari: 30, harga: 50000, nama: 'Paket 30 Hari' }
          ];
        }

        selectEl.innerHTML = '';
        listPaket.forEach((p, idx) => {
          const opt = document.createElement('option');
          const hari = p.hari ?? p.paket_hari ?? p.days ?? p.value ?? 7;
          const harga = p.harga ?? p.price ?? p.formatted_price ?? p.nominal ?? p.total ?? 0;
          const nama = p.nama ?? p.label ?? p.name ?? `Paket ${hari} Hari`;

          opt.value = hari;
          opt.textContent = Number(harga) > 0
            ? `${nama} - Rp ${Number(harga).toLocaleString('id-ID')}`
            : nama;

          if (p.selected || idx === 0) opt.selected = true;
          selectEl.appendChild(opt);
        });

        if (btnBeliEl) btnBeliEl.disabled = false;
      })
      .catch((err) => {
        console.warn('[Autofill] Gagal muat paket Vercel, menggunakan opsi bawaan:', err);
        selectEl.innerHTML = `
          <option value="7">Paket 7 Hari - Rp 100</option>
          <option value="30">Paket 30 Hari - Rp 50.000</option>
        `;
        if (btnBeliEl) btnBeliEl.disabled = false;
      });
  }

  async function tampilkanModalAktivasi(pesanPeringatan = '', bisaDitutup = true, isBerhasil = false) {
    try {
      const modalLama = document.getElementById('sipgn-license-modal');
      if (modalLama) modalLama.remove();

      const currentDevId = dapatkanDeviceID();

      let serverStatusData = cachedServerStatus || { status: 'unregistered', valid: false, exp_date: null, msg: '', qris_enabled: true };

      if (!cachedServerStatus) {
        try {
          const checkRes = await new Promise((resolve) => {
            GM_xmlhttpRequest({
              method: 'GET',
              url: `${VERCEL_API_URL}?action=check_license&device_id=${encodeURIComponent(currentDevId)}&_t=${Date.now()}`,
              headers: { 'Cache-Control': 'no-cache, no-store' },
              onload: (res) => {
                try { resolve(JSON.parse(res.responseText)); } catch(e) { resolve({ valid: false, qris_enabled: true }); }
              },
              onerror: () => resolve({ valid: false, qris_enabled: true })
            });
          });
          serverStatusData = checkRes;
          cachedServerStatus = checkRes;
        } catch(e) {}
      }

      const isQrisEnabled = serverStatusData.qris_enabled !== false;
      const isUserBaru = serverStatusData.status && serverStatusData.status === 'unregistered';
      const rawStatus = serverStatusData.status || (serverStatusData.valid ? 'active' : 'expired');
      let statusLabelFormatted = 'Tidak Aktif';
      let statusColor = '#ef4444';

      if (rawStatus === 'active' || serverStatusData.valid) {
        statusLabelFormatted = 'Aktif';
        statusColor = '#34d399';
      } else if (rawStatus === 'hold') {
        statusLabelFormatted = 'Hold';
        statusColor = '#f59e0b';
      } else if (rawStatus === 'revoked') {
        statusLabelFormatted = 'Revoked';
        statusColor = '#ef4444';
      } else if (rawStatus === 'expired') {
        statusLabelFormatted = 'Kadaluarsa';
        statusColor = '#ef4444';
      }

      const isKadaluarsa = (rawStatus === 'expired' || rawStatus === 'unregistered' || !serverStatusData.valid) && !isUserBaru;

      const expDateVal = serverStatusData.exp_date || currentDatabaseExpDate;
      const sisaHari = hitungSisaHari(expDateVal);
      const teksSisaHari = formatSisaHariTeks(sisaHari);
      const warnaMasaAktif = dapatkanWarnaMasaAktif(sisaHari);
      const infoExpFormatted = expDateVal ? `${formatTanggalIndo(expDateVal)}${teksSisaHari}` : '-';

      const overlay = document.createElement('div');
      overlay.id = 'sipgn-license-modal';
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
        z-index: 999999; display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;

      overlay.innerHTML = `
        <div style="position: relative; background: #1e293b; border: 1px solid rgba(51, 65, 85, 0.8); color: #f8fafc; padding: 24px; border-radius: 16px; width: 380px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
          ${
            bisaDitutup
              ? `<button id="sipgn-btn-close-x" style="position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.05); border: none; color: #94a3b8; width: 28px; height: 28px; border-radius: 50%; font-size: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;">✕</button>`
              : ''
          }
          <div style="width: 44px; height: 44px; background: rgba(37, 99, 235, 0.1); color: #38bdf8; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin: 0 auto 12px auto;">💳</div>
          <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #f8fafc;">Informasi & Status Perangkat</h3>
          <p style="font-size: 11px; color: #94a3b8; margin: 0 0 16px 0; line-height: 1.4;">${isUserBaru ? 'Selamat datang! Dapatkan trial gratis 1 hari (24 jam) untuk pengguna baru.' : 'Kelola langganan dan identitas perangkat Anda.'}</p>

          <div id="sipgn-info-perangkat-sec" style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 12px; margin-bottom: 14px; border: 1px solid rgba(51, 65, 85, 0.5); text-align: left; ${isKadaluarsa ? 'display: none;' : ''}">
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; margin-bottom: 4px;">Informasi Perangkat</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12px; color: #cbd5e1;">Device ID:</span>
              <span id="sipgn-dev-id-text" style="font-size: 12px; font-weight: 700; color: #facc15; font-family: monospace; background: rgba(250, 204, 21, 0.1); padding: 2px 6px; border-radius: 4px;">${currentDevId}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12px; color: #cbd5e1;">Status:</span>
              <span style="font-size: 12px; font-weight: 700; color: ${statusColor}; text-transform: uppercase;">${statusLabelFormatted}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 12px; color: #cbd5e1;">Masa Aktif:</span>
              <span style="font-size: 12px; font-weight: 600; color: ${warnaMasaAktif}; text-align: right;">${infoExpFormatted}</span>
            </div>
          </div>

          <div id="sipgn-backup-import-sec" style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 12px; margin-bottom: 14px; border: 1px solid rgba(51, 65, 85, 0.5); text-align: left; ${(isKadaluarsa || isUserBaru) ? 'display: none;' : ''}">
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; margin-bottom: 8px;">Backup & Import Data KPM</div>
            <div style="display: flex; gap: 8px;">
              <button id="sipgn-btn-modal-backup" style="flex: 1; padding: 8px; border: none; border-radius: 8px; background: #334155; color: white; cursor: pointer; font-size: 11px; font-weight: 600; transition: background 0.2s;">↓ Backup</button>
              <button id="sipgn-btn-modal-import" style="flex: 1; padding: 8px; border: none; border-radius: 8px; background: #334155; color: white; cursor: pointer; font-size: 11px; font-weight: 600; transition: background 0.2s;">↑ Import</button>
            </div>
            <input type="file" id="sipgn-modal-input-import" accept="application/json,.json" style="display: none;" />
          </div>

          ${
            pesanPeringatan
              ? `<div style="background: ${isBerhasil ? 'rgba(6, 78, 59, 0.4)' : 'rgba(127, 29, 29, 0.3)'}; color: ${isBerhasil ? '#a7f3d0' : '#fecaca'}; padding: 10px; border-radius: 10px; font-size: 11px; margin-bottom: 14px; border: 1px solid ${isBerhasil ? 'rgba(4, 120, 87, 0.4)' : 'rgba(153, 27, 27, 0.4)'}; text-align: left;">
                  ${pesanPeringatan}
                 </div>`
              : ''
          }

          <div id="sipgn-sec-qris" style="display: block; background: rgba(15, 23, 42, 0.4); padding: 14px; border-radius: 12px; border: 1px solid rgba(51, 65, 85, 0.5); margin-bottom: 14px;">

            ${
              isUserBaru
                ? `<button id="sipgn-btn-claim-trial" style="width: 100%; padding: 12px; border: none; border-radius: 10px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; font-weight: 700; cursor: pointer; font-size: 13px; transition: 0.2s; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                     🎁 Claim Free Trial (24 Jam)
                   </button>`
                : `${isQrisEnabled ? `
                     <div id="sipgn-wrapper-paket" style="text-align: left;">
                       <label style="display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">Pilih Paket Durasi :</label>
                       <select id="sipgn-select-paket" style="width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: white; font-size: 12px; margin-bottom: 12px; outline: none;">
                         <option value="">⏳ Memuat paket...</option>
                       </select>
                     </div>

                     <button id="sipgn-btn-buy-qris" style="width: 100%; padding: 11px; border: none; border-radius: 10px; background: #10b981; color: white; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s; margin-bottom: 12px;">
                       💳 Bayar via QRIS
                     </button>
                   ` : `
                     <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); color: #fef08a; padding: 10px 12px; border-radius: 10px; font-size: 11px; text-align: center; margin-bottom: 12px; line-height: 1.4;">
                       ⚠️ <b>Pembayaran QRIS Ditutup Sementara.</b><br>Silakan gunakan kode voucher untuk melakukan perpanjangan lisensi.
                     </div>
                   `}

                   <div id="sipgn-voucher-section" style="text-align: left; border-top: 1px dashed rgba(51, 65, 85, 0.8); padding-top: 12px;">
                     <label style="display: block; font-size: 11px; font-weight: 600; color: #38bdf8; margin-bottom: 6px;">Klaim Kode Voucher:</label>
                     <div style="display: flex; gap: 6px; margin-bottom: 4px;">
                       <input type="text" id="sipgn-input-voucher" placeholder="KODE VOUCHER" style="flex: 2; box-sizing: border-box; padding: 8px 12px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: white; font-size: 12px; text-transform: uppercase; outline: none;" />
                       <button id="sipgn-btn-apply-voucher" style="flex: 1; padding: 8px 12px; border: none; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s;">Klaim</button>
                     </div>
                     <div id="sipgn-voucher-feedback" style="font-size: 11px; min-height: 14px; margin-top: 4px;"></div>
                   </div>`
            }

            <div id="sipgn-qris-container" style="display: none; text-align: center;"></div>
          </div>

          <div style="font-size: 11px; color: #64748b;">© 2026 - <b>Mindspace Studio</b></div>
        </div>
      `;

      document.body.appendChild(overlay);

      if (isUserBaru) {
        const btnClaimTrial = document.getElementById('sipgn-btn-claim-trial');
        if (btnClaimTrial) {
          btnClaimTrial.onclick = async () => {
            btnClaimTrial.disabled = true;
            btnClaimTrial.textContent = '⏳ Memproses Free Trial...';
            try {
              const resTrial = await klaimFreeTrialVercel();
              if (resTrial.success || resTrial.exp_date) {
                overlay.remove();
                eksekusiSuksesPembayaran(1, currentDevId, resTrial.exp_date, 0);
              } else {
                tampilkanModalAlertModern('Gagal Klaim Trial', resTrial.error || 'Gagal memproses trial gratis.', false);
                btnClaimTrial.disabled = false;
                btnClaimTrial.textContent = '🎁 Claim Free Trial (24 Jam)';
              }
            } catch (err) {
              tampilkanModalAlertModern('Error Trial', 'Gagal terhubung ke server untuk klaim trial.', false);
              btnClaimTrial.disabled = false;
              btnClaimTrial.textContent = '🎁 Claim Free Trial (24 Jam)';
            }
          };
        }
      } else {
        const btnBackup = document.getElementById('sipgn-btn-modal-backup');
        if (btnBackup) btnBackup.onclick = () => {
          tampilkanModalBackupInfo();
        };

        const modalInputImport = document.getElementById('sipgn-modal-input-import');
        const btnImport = document.getElementById('sipgn-btn-modal-import');

        if (btnImport && modalInputImport) {
          btnImport.onclick = () => {
            tampilkanModalPilihanImport(
              () => modalInputImport.click(),
              () => importCloudData()
            );
          };
          modalInputImport.onchange = () => {
            importBackupData(modalInputImport.files?.[0]);
            modalInputImport.value = '';
          };
        }

        if (isQrisEnabled) {
          const selectPaket = document.getElementById('sipgn-select-paket');
          const btnBeli = document.getElementById('sipgn-btn-buy-qris');

          muatDaftarPaketKeSelect(selectPaket, btnBeli);

          if (btnBeli) {
            btnBeli.onclick = () => {
              if (!selectPaket || !selectPaket.value) {
                tampilkanModalAlertModern('Perhatian', 'Silakan pilih paket durasi terlebih dahulu.', false);
                return;
              }
              const hari = Number(selectPaket.value);
              prosesPembayaranOtomatis(hari);
            };
          }
        }

        const inputVoucher = document.getElementById('sipgn-input-voucher');
        const btnApplyVoucher = document.getElementById('sipgn-btn-apply-voucher');
        const voucherFeedback = document.getElementById('sipgn-voucher-feedback');

        if (btnApplyVoucher) {
          btnApplyVoucher.onclick = async () => {
            const kode = inputVoucher.value.trim().toUpperCase();
            if (!kode) {
              voucherFeedback.textContent = 'Masukkan kode voucher terlebih dahulu.';
              voucherFeedback.style.color = '#ef4444';
              return;
            }

            btnApplyVoucher.disabled = true;
            btnApplyVoucher.textContent = 'Memeriksa...';
            voucherFeedback.textContent = '';

            try {
              const resKlaim = await klaimVoucherVercel(kode);
              if (resKlaim.success) {
                voucherFeedback.textContent = resKlaim.message;
                voucherFeedback.style.color = '#4ade80';
                setTimeout(() => {
                  overlay.remove();
                  eksekusiSuksesPembayaran(0, currentDevId, resKlaim.exp_date, 0);
                }, 1000);
              } else {
                voucherFeedback.textContent = resKlaim.error || 'Voucher tidak valid.';
                voucherFeedback.style.color = '#ef4444';
                btnApplyVoucher.disabled = false;
                btnApplyVoucher.textContent = 'Klaim';
              }
            } catch (err) {
              voucherFeedback.textContent = 'Gagal memproses klaim voucher.';
              voucherFeedback.style.color = '#ef4444';
              btnApplyVoucher.disabled = false;
              btnApplyVoucher.textContent = 'Klaim';
            }
          };
        }
      }

      if (bisaDitutup || isBerhasil) {
        const btnCloseX = document.getElementById('sipgn-btn-close-x');
        if (btnCloseX) {
          btnCloseX.onclick = () => {
            hentikanTimerDanPolling();
            isPaymentModalOpen = false;
            isPaymentSuccess = false;
            overlay.remove();
          };
        }
      }

    } catch (e) {
      console.error('[Autofill] Gagal merender modal:', e);
    }
  }

  function tampilkanModalBackupInfo() {
    const modalLama = document.getElementById('sipgn-backup-info-modal');
    if (modalLama) modalLama.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sipgn-backup-info-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
      z-index: 1000003; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="background: #1e293b; border: 1px solid rgba(56, 189, 248, 0.3); color: #f8fafc; padding: 24px; border-radius: 16px; width: 340px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        <div style="width: 48px; height: 48px; background: rgba(56, 189, 248, 0.1); color: #38bdf8; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 14px auto;">💾</div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #f8fafc;">Konfirmasi Backup Data</h3>
        <p style="font-size: 11px; color: #94a3b8; margin: 8px 0 16px 0; line-height: 1.5;">
          Backup akan disimpan secara <b>lokal</b> (file .json terunduh ke perangkat Anda) dan disinkronkan ke <b>cloud database</b>.<br><br>
          Data backup pada cloud akan tersimpan selama <b>3 hari</b> sebelum terhapus otomatis.
        </p>

        <button id="sipgn-btn-bk-proceed" style="width: 100%; padding: 10px; border: none; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; cursor: pointer; font-size: 12px; margin-bottom: 8px; transition: 0.2s;">
          🚀 Lanjutkan Backup
        </button>
        <button id="sipgn-btn-bk-cancel" style="width: 100%; padding: 9px; border: 1px solid #334155; border-radius: 10px; background: transparent; color: #cbd5e1; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s;">
          Batal
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sipgn-btn-bk-proceed').onclick = () => {
      overlay.remove();
      downloadBackupData();
    };
    document.getElementById('sipgn-btn-bk-cancel').onclick = () => {
      overlay.remove();
    };
  }

  function tampilkanModalPilihanImport(onPilihLokal, onPilihCloud) {
    const modalLama = document.getElementById('sipgn-import-choice-modal');
    if (modalLama) modalLama.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sipgn-import-choice-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
      z-index: 1000003; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="background: #1e293b; border: 1px solid rgba(56, 189, 248, 0.3); color: #f8fafc; padding: 24px; border-radius: 16px; width: 340px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        <div style="width: 48px; height: 48px; background: rgba(56, 189, 248, 0.1); color: #38bdf8; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 14px auto;">📥</div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #f8fafc;">Pilih Metode Import</h3>
        <p style="font-size: 11px; color: #94a3b8; margin: 8px 0 16px 0;">Pilih sumber data KPM yang ingin Anda pulihkan.</p>

        <button id="sipgn-btn-imp-local" style="width: 100%; padding: 10px; border: none; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; cursor: pointer; font-size: 12px; margin-bottom: 8px; transition: 0.2s;">
          📂 Dari File Lokal (.json)
        </button>
        <button id="sipgn-btn-imp-cloud" style="width: 100%; padding: 10px; border: none; border-radius: 10px; background: #0d9488; color: white; font-weight: 600; cursor: pointer; font-size: 12px; margin-bottom: 12px; transition: 0.2s;">
          ☁️ Dari Cloud Database
        </button>
        <button id="sipgn-btn-imp-cancel" style="width: 100%; padding: 9px; border: 1px solid #334155; border-radius: 10px; background: transparent; color: #cbd5e1; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s;">
          Batal
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sipgn-btn-imp-local').onclick = () => {
      overlay.remove();
      onPilihLokal();
    };
    document.getElementById('sipgn-btn-imp-cloud').onclick = () => {
      overlay.remove();
      onPilihCloud();
    };
    document.getElementById('sipgn-btn-imp-cancel').onclick = () => {
      overlay.remove();
    };
  }

  function tampilkanModalStatusSitus(judulText, pesanText, warnaTema = 'revoked') {
    const modalLama = document.getElementById('sipgn-status-modal');
    if (modalLama) modalLama.remove();

    const isHold = warnaTema === 'hold';
    const bgHeader = isHold ? 'rgba(120, 53, 15, 0.3)' : 'rgba(127, 29, 29, 0.3)';
    const borderColor = isHold ? 'rgba(217, 119, 6, 0.4)' : 'rgba(153, 27, 27, 0.4)';
    const textColor = isHold ? '#fef08a' : '#fecaca';

    const overlay = document.createElement('div');
    overlay.id = 'sipgn-status-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px);
      z-index: 999999; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="position: relative; background: #1e293b; border: 1px solid ${borderColor}; color: #f8fafc; padding: 28px; border-radius: 16px; width: 340px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
        <div style="width: 52px; height: 52px; background: ${bgHeader}; color: ${textColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 16px auto;">${isHold ? '⏸️' : '🚫'}</div>
        <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: ${textColor};">${judulText}</h3>
        <div style="background: rgba(15, 23, 42, 0.6); color: #cbd5e1; padding: 14px; border-radius: 12px; font-size: 12px; margin-bottom: 16px; border: 1px solid ${borderColor}; line-height: 1.5;">
          ${pesanText}
        </div>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 16px;">
          Device ID: <b style="color:#facc15; font-family: monospace;">${dapatkanDeviceID()}</b>
        </div>
        <button id="sipgn-btn-reload-status" style="width: 100%; padding: 11px; border: none; border-radius: 10px; background: #334155; color: white; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s;">
          🔄 Muat Ulang Halaman
        </button>
        <div style="margin-top: 16px; font-size: 11px; color: #64748b;">© 2026 - <b>Mindspace Studio</b></div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sipgn-btn-reload-status').onclick = () => {
      location.reload();
    };
  }

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

  function cekHalamanTugasBaru() {
    return location.pathname.includes('/distribution/new');
  }

  function muatData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [...DATA_AWAL];
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function syncBackupToDatabase(dataBackup) {
    const devId = dapatkanDeviceID();
    GM_xmlhttpRequest({
      method: 'POST',
      url: VERCEL_API_URL,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        action: 'save_backup',
        device_id: devId,
        backup_data: dataBackup,
        auto_delete_days: 3
      }),
      onload: function(res) {
        try {
          const resp = JSON.parse(res.responseText);
          console.log('[Autofill] Backup tersinkron ke database & auto-delete diatur (3 hari):', resp);
        } catch(e) {
          console.warn('[Autofill] Gagal parsing respon sync database backup');
        }
      },
      onerror: function() {
        console.warn('[Autofill] Gagal mengirim backup ke database cloud.');
      }
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

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const tautan = document.createElement('a');
    const tanggal = new Date().toISOString().slice(0, 10);
    tautan.href = url;
    tautan.download = `sipgn-autofill-backup-${tanggal}.json`;
    document.body.appendChild(tautan);
    tautan.click();
    tautan.remove();
    URL.revokeObjectURL(url);
  }

  function importBackupData(file) {
    if (!file) return;
    const pembaca = new FileReader();
    pembaca.onload = () => {
      try {
        const isi = JSON.parse(String(pembaca.result || ''));
        const dataImpor = Array.isArray(isi) ? isi : isi?.dataKPM;
        if (!Array.isArray(dataImpor) || !dataImpor.every((data) => data && typeof data.sekolah === 'string')) {
          throw new Error('Format backup tidak berisi daftar data KPM yang valid.');
        }

        tampilkanModalKonfirmasiModern(
          'Konfirmasi Import Data',
          `Import ${dataImpor.length} data KPM akan mengganti data saat ini. Lanjutkan?`,
          () => {
            dataPenugasan = dataImpor.map((data) => ({
              terpakai: false,
              jamKeberangkatan: '',
              jamTibaTujuan: '',
              jamJadwalPengambilan: '',
              jamOmprengKembaliSPPG: '',
              jamMulaiCuci: '',
              porsiBalita: '',
              porsiIbuMenyusui: '',
              porsiIbuHamil: '',
              ...data,
            }));
            indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;
            indexSedangDiedit = null;
            simpanData(dataPenugasan);
            renderPanel();
            tampilkanModalAlertModern('Berhasil', 'Data KPM berhasil diimpor dari file lokal.', true);
          }
        );
      } catch (error) {
        tampilkanModalAlertModern('Import Gagal', error.message, false);
      }
    };
    pembaca.readAsText(file);
  }

  function importCloudData() {
    const devId = dapatkanDeviceID();
    GM_xmlhttpRequest({
      method: 'GET',
      url: `${VERCEL_API_URL}?action=get_backup&device_id=${encodeURIComponent(devId)}&_t=${Date.now()}`,
      headers: { 'Cache-Control': 'no-cache, no-store' },
      onload: function(res) {
        try {
          const resp = JSON.parse(res.responseText);
          const dataImpor = resp.backup_data?.dataKPM || resp.dataKPM || (Array.isArray(resp) ? resp : null);

          if (!Array.isArray(dataImpor) || !dataImpor.every((data) => data && typeof data.sekolah === 'string')) {
            throw new Error('Data backup dari cloud database tidak valid atau sudah kadaluarsa (terhapus otomatis setelah 3 hari).');
          }

          tampilkanModalKonfirmasiModern(
            'Konfirmasi Import Cloud',
            `Import <b>${dataImpor.length} data KPM</b> dari cloud database akan mengganti data saat ini. Lanjutkan?`,
            () => {
              dataPenugasan = dataImpor.map((data) => ({
                terpakai: false,
                jamKeberangkatan: '',
                jamTibaTujuan: '',
                jamJadwalPengambilan: '',
                jamOmprengKembaliSPPG: '',
                jamMulaiCuci: '',
                porsiBalita: '',
                porsiIbuMenyusui: '',
                porsiIbuHamil: '',
                ...data,
              }));
              indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;
              indexSedangDiedit = null;
              simpanData(dataPenugasan);
              renderPanel();
              tampilkanModalAlertModern('Berhasil', 'Berhasil mengimpor data dari cloud database!', true);
            }
          );
        } catch (error) {
          tampilkanModalAlertModern('Import Cloud Gagal', error.message, false);
        }
      },
      onerror: function() {
        tampilkanModalAlertModern('Koneksi Gagal', 'Gagal terhubung ke server cloud untuk mengambil backup.', false);
      }
    });
  }

  let dataPenugasan = muatData();
  let indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;
  let indexSedangDiedit = null;

  function setNativeValue(element, value) {
    if (!element) return;
    const proto = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function tampilkanBadgeStatus(pesan) {}

  function sembunyikanBadgeStatus() {}

  async function setNativeValueHuman(element, value, charDelayMin = 35, charDelayMax = 80) {
    if (!element) return;
    try {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}

    const valStr = String(value);
    const proto = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;

    setter.call(element, '');
    element.dispatchEvent(new Event('input', { bubbles: true }));

    let currentVal = '';
    for (let i = 0; i < valStr.length; i++) {
      const char = valStr[i];
      currentVal += char;

      // Cetak event keyboard fisik nyata untuk memicu animasi mengetik pada framework web (React/Vue)
      const keyOptions = { key: char, char: char, keyCode: char.charCodeAt(0), bubbles: true, cancelable: true };
      element.dispatchEvent(new KeyboardEvent('keydown', keyOptions));
      element.dispatchEvent(new KeyboardEvent('keypress', keyOptions));

      setter.call(element, currentVal);
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
      element.dispatchEvent(new KeyboardEvent('keyup', keyOptions));

      // Jeda pengetikan acak (agak melambat saat menemukan spasi atau tanda hubung)
      let delay = getRandomDelay(charDelayMin, charDelayMax);
      if (char === ' ' || char === '-' || char === '/') delay += getRandomDelay(40, 90);
      await wait(delay);
    }
    element.dispatchEvent(new Event('change', { bubbles: true }));

    await wait(120);
    try { element.dispatchEvent(new Event('blur', { bubbles: true })); } catch (e) {}
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function tungguElemen(cariFn, maxTunggu = 5000, interval = 200) {
    const batasWaktu = Date.now() + maxTunggu;
    while (Date.now() < batasWaktu) {
      const hasil = cariFn();
      if (hasil) return hasil;
      await wait(interval);
    }
    return null;
  }

  async function setValueDenganVerifikasi(cariInputFn, nilai, namaField, percobaan = 4) {
    for (let i = 0; i < percobaan; i++) {
      const input = cariInputFn();
      if (!input) {
        await wait(400);
        continue;
      }
      await setNativeValueHuman(input, nilai, 30, 70);
      await smartWait(300, 600);

      const inputSetelah = cariInputFn();
      if (inputSetelah && String(inputSetelah.value) === String(nilai)) {
        return true;
      }
    }
    return false;
  }

  async function isiLokasiKPM(namaSekolah) {
    const input = document.querySelector('input[placeholder*="Cari nama KPM"]');
    if (!input) return false;

    await setNativeValueHuman(input, namaSekolah, 25, 60);

    const tombolOpsi = await tungguElemen(() =>
      [...document.querySelectorAll('button')].find((btn) =>
        btn.textContent.includes(namaSekolah)
      )
    );

    if (!tombolOpsi) return false;
    await smartWait(350, 600);
    tombolOpsi.click();
    return true;
  }

  async function isiRitase(nilai) {
    return setValueDenganVerifikasi(
      () => document.querySelector('input[placeholder="Contoh: 1"]'),
      nilai,
      'Ritase'
    );
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

  async function isiPorsiSekolahLama(porsiBesar, porsiKecil) {
    const inputs = document.querySelectorAll('input[type="number"]');
    const validInputs = [...inputs].filter(inp => !inp.closest('#sipgn-autofill-panel'));
    if (validInputs.length < 2) return false;
    await setNativeValueHuman(validInputs[0], porsiBesar || '0', 25, 60);
    await setNativeValueHuman(validInputs[1], porsiKecil || '0', 25, 60);
    return true;
  }

  async function isiPorsi(data) {
    const kategori = [
      { nama: 'Porsi Besar', nilai: data.porsiBesar },
      { nama: 'Porsi Kecil', nilai: data.porsiKecil },
      { nama: 'Balita', nilai: data.porsiBalita },
      { nama: 'Ibu Menyusui', nilai: data.porsiIbuMenyusui },
      { nama: 'Ibu Hamil', nilai: data.porsiIbuHamil },
    ];
    let jumlahTerisi = 0;
    for (const k of kategori) {
      const input = cariInputPorsiKategori(k.nama);
      if (!input) continue;
      await setNativeValueHuman(input, k.nilai || '0', 25, 60);
      jumlahTerisi++;
    }
    if (jumlahTerisi === 0) {
      return await isiPorsiSekolahLama(data.porsiBesar, data.porsiKecil);
    }
    return true;
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

  async function isiKurirDanPlat(namaKurir, platNomor) {
    const semuaInput = [...document.querySelectorAll('input')].filter(
      (inp) => !inp.closest('#sipgn-autofill-panel') && inp.type !== 'hidden' && inp.type !== 'checkbox'
    );

    // 1. Deteksi Input Nama Kurir / Driver
    let inputKurir = semuaInput.find((inp) => {
      const ph = (inp.placeholder || '').toLowerCase();
      const name = (inp.name || '').toLowerCase();
      const id = (inp.id || '').toLowerCase();
      return ph.includes('kurir') || ph.includes('driver') || name.includes('kurir') || name.includes('driver') || id.includes('kurir');
    });

    if (!inputKurir) {
      const labels = [...document.querySelectorAll('label')].filter((l) => !l.closest('#sipgn-autofill-panel'));
      const labelKurir = labels.find((l) => {
        const txt = l.textContent.toLowerCase();
        return txt.includes('kurir') || txt.includes('driver') || txt.includes('pengemudi');
      });
      if (labelKurir) {
        inputKurir = labelKurir.querySelector('input') ||
                     labelKurir.parentElement?.querySelector('input') ||
                     (labelKurir.parentElement?.parentElement ? labelKurir.parentElement.parentElement.querySelector('input') : null);
      }
    }

    // 2. Deteksi Input Plat Nomor Kendaraan
    let inputPlat = semuaInput.find((inp) => {
      const ph = (inp.placeholder || '').toLowerCase();
      const name = (inp.name || '').toLowerCase();
      const id = (inp.id || '').toLowerCase();
      return ph.includes('1234') || ph.includes('plat') || ph.includes('nopol') || ph.includes('kendaraan') ||
             name.includes('plat') || name.includes('nopol') || name.includes('kendaraan') ||
             id.includes('plat') || id.includes('nopol') || id.includes('kendaraan');
    });

    if (!inputPlat) {
      const labels = [...document.querySelectorAll('label')].filter((l) => !l.closest('#sipgn-autofill-panel'));
      const labelPlat = labels.find((l) => {
        const txt = l.textContent.toLowerCase();
        return txt.includes('plat') || txt.includes('nopol') || txt.includes('nomor kendaraan') || txt.includes('kendaraan') || txt.includes('polisi');
      });
      if (labelPlat) {
        inputPlat = labelPlat.querySelector('input') ||
                    labelPlat.parentElement?.querySelector('input') ||
                    (labelPlat.parentElement?.parentElement ? labelPlat.parentElement.parentElement.querySelector('input') : null);
      }
    }

    // Fallback: Jika input plat tidak ditemukan langsung, gunakan input teks setelah input kurir
    if (!inputPlat && inputKurir) {
      const kontainerInduk = inputKurir.closest('form') || inputKurir.parentElement?.parentElement;
      if (kontainerInduk) {
        const inputsKontainer = [...kontainerInduk.querySelectorAll('input')].filter(
          (inp) => inp !== inputKurir && !inp.closest('#sipgn-autofill-panel') && inp.type !== 'hidden' && inp.type !== 'checkbox' && inp.type !== 'number'
        );
        if (inputsKontainer.length > 0) {
          inputPlat = inputsKontainer[0];
        }
      }
    }

    if (inputKurir && namaKurir) {
      await setNativeValueHuman(inputKurir, namaKurir, 20, 55);
      await smartWait(200, 400);
    }

    if (inputPlat && platNomor) {
      await setNativeValueHuman(inputPlat, platNomor, 25, 60);
      await smartWait(200, 400);
    }
  }

  async function isiPenugasan(index) {
    const data = dataPenugasan[index];
    if (!data) return;

    tampilkanBadgeStatus(`Sedang Mengetik: <b>${data.sekolah}</b>...`);

    await isiLokasiKPM(data.sekolah);
    await smartWait(500, 850);

    tampilkanBadgeStatus(`Mengisi Ritase & Waktu...`);
    await isiRitase(data.ritase);
    await smartWait(350, 600);

    isiBatasWaktu(data.batasWaktu);
    await smartWait(250, 450);

    tampilkanBadgeStatus(`Mengisi Jumlah Porsi...`);
    await isiPorsi(data);
    await smartWait(350, 650);

    // Atur checkbox Kurir MBG (centang jika toggle ON, uncheck jika OFF)
    aturCheckboxKurirMBG();
    await smartWait(250, 450);

    tampilkanBadgeStatus(`Mengisi Nama Kurir & Plat Nomor...`);
    // Selalu isi data Nama Kurir dan Plat Nomor Kendaraan secara halus
    await isiKurirDanPlat(data.namaKurir, data.platNomor);
    await smartWait(300, 500);

    dataPenugasan[index].terpakai = true;
    dataPenugasan[index].statusProses = 'pengantaran';
    simpanData(dataPenugasan);
    renderPanel();
  }

  function cariTriggerWaktuKeberangkatan(namaField = 'Waktu Keberangkatan') {
    const label = [...document.querySelectorAll('label')].find((el) => {
      const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
      return txt === namaField || txt.includes(namaField);
    });
    if (label?.parentElement) {
      const dariLabel = [...label.parentElement.querySelectorAll('div.flex.w-full.cursor-pointer')][0];
      if (dariLabel) return dariLabel;
    }

    const selectorTrigger = 'div.flex.w-full.cursor-pointer.select-none.items-center.justify-between.rounded-xl';
    const triggerSIPGN = [...document.querySelectorAll(selectorTrigger)].find((el) => {
      const teks = el.querySelector('span')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      return /^\d{2}\/\d{2}\/\d{4},\s*\d{2}\.\d{2}$/.test(teks);
    });
    if (triggerSIPGN) return triggerSIPGN;

    const labelCadangan = [...document.querySelectorAll('label, p, span')].find((el) =>
      new RegExp(`^${namaField}\\s*\\*?$`).test(el.textContent.replace(/\s+/g, ' ').trim())
    );
    if (labelCadangan?.parentElement) {
      const dariLabel = [...labelCadangan.parentElement.querySelectorAll('div, button')].find((el) => {
        const teks = el.textContent.replace(/\s+/g, ' ').trim();
        return /^\d{2}\/\d{2}\/\d{4},\s*\d{2}\.\d{2}$/.test(teks);
      });
      if (dariLabel) return dariLabel;
    }

    const kandidat = [...document.querySelectorAll('button, div')].find((el) => {
      if (el.offsetParent === null) return false;
      const teks = el.textContent.replace(/\s+/g, ' ').trim();
      return /^\d{2}\/\d{2}\/\d{4},\s*\d{2}\.\d{2}$/.test(teks);
    });
    return kandidat || null;
  }

  function cariDialogWaktu() {
    const kolomJam = cariKolomSpinner('Jam');
    const kolomMenit = cariKolomSpinner('Menit');
    if (!kolomJam || !kolomMenit) return null;

    const dialog = kolomJam.closest('[role="dialog"], [aria-modal="true"]');
    if (dialog) return dialog;

    let induk = kolomJam.parentElement;
    while (induk && induk !== document.body) {
      if (induk.contains(kolomMenit)) return induk;
      induk = induk.parentElement;
    }
    return null;
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
      return !!trigger && trigger.textContent.includes(jamMenitStr.replace(':', '.'));
    }

    const triggerSebelum = cariTriggerWaktuKeberangkatan(namaField);
    const teksSebelum = triggerSebelum ? triggerSebelum.textContent : '';
    await smartWait(200, 400);
    tombolSimpan.click();
    await wait(350);

    const triggerSesudah = cariTriggerWaktuKeberangkatan(namaField);
    const waktuTampil = jamMenitStr.replace(':', '.');
    const berubah = triggerSesudah && (
      triggerSesudah.textContent.includes(waktuTampil) ||
      triggerSesudah.textContent !== teksSebelum
    );
    if (!berubah) {
      return false;
    }
    return true;
  }

  function cariKolomSpinner(label) {
    const labelNormal = label.toLowerCase();
    const labelEl = [...document.querySelectorAll('p, span')].find((el) =>
      el.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === labelNormal
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
        div.className.includes('font-bold') &&
        div.className.includes('text-white') &&
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
    try {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
    } catch (e) {}
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
      const terkunci = await tungguSpinnerSelesai(kolom, nilaiSekarang);
      if (terkunci === target) return true;
      nilaiSekarang = terkunci !== null ? terkunci : nilaiSekarang;
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

  function cariInputWaktu() {
    return [...document.querySelectorAll('input')].filter((inp) => {
      if (inp.closest('#sipgn-autofill-panel')) return false;
      if (inp.disabled || inp.readOnly) return false;
      const tipe = (inp.type || '').toLowerCase();
      const nama = ((inp.name || '') + ' ' + (inp.id || '')).toLowerCase();
      const val = String(inp.value || '');
      return (
        tipe === 'time' ||
        nama.includes('time') ||
        nama.includes('jam') ||
        nama.includes('berangkat') ||
        nama.includes('keberangkatan') ||
        /^\d{1,2}:\d{2}$/.test(val) ||
        /^\d{2}\/\d{2}\/\d{4},\s*\d{2}\.\d{2}$/.test(val)
      );
    });
  }

  async function kunciWaktuViaInput(jamMenitStr) {
    const kandidat = cariInputWaktu();
    if (kandidat.length === 0) return false;

    for (const inp of kandidat) {
      const nilaiSekarang = String(inp.value || '');
      const nilaiBaru = /^\d{2}\/\d{2}\/\d{4},\s*\d{2}\.\d{2}$/.test(nilaiSekarang)
        ? nilaiSekarang.replace(/\d{2}\.\d{2}$/, jamMenitStr.replace(':', '.'))
        : jamMenitStr;
      setNativeValue(inp, nilaiBaru);
      inp.dispatchEvent(new Event('blur', { bubbles: true }));
      await wait(250);
      const trigger = cariTriggerWaktuKeberangkatan();
      const teksTrigger = trigger ? trigger.textContent : '';
      const pola = jamMenitStr.replace(':', '.');
      if (String(inp.value).startsWith(jamMenitStr) || teksTrigger.includes(pola)) {
        return true;
      }
    }
    return false;
  }

  async function aturWaktuKeberangkatan(jamMenitStr, namaField = 'Waktu Keberangkatan') {
    if (!jamMenitStr || !/^\d{1,2}:\d{2}$/.test(jamMenitStr)) return false;
    const [jamTarget, menitTarget] = jamMenitStr.split(':').map(Number);

    if (await kunciWaktuViaInput(jamMenitStr)) {
      return simpanPickerWaktu(jamMenitStr, namaField);
    }

    let kolomJam = cariKolomSpinner('Jam');
    if (!kolomJam) {
      const trigger = cariTriggerWaktuKeberangkatan(namaField);
      if (!trigger) return false;

      trigger.focus?.();
      trigger.click();
      kolomJam = await tungguElemen(() => cariKolomSpinner('Jam'), 600, 75);
      if (!kolomJam) {
        await klikElemenPrecise(trigger);
        kolomJam = await tungguElemen(() => cariKolomSpinner('Jam'), 1900, 100);
      }
      if (!kolomJam) return false;
    }

    const triggerAktif = cariTriggerWaktuKeberangkatan(namaField);
    if (!/^\d{2}\/\d{2}\/\d{4},\s*\d{2}\.\d{2}$/.test(triggerAktif?.textContent?.trim() || '')) {
      const tombolSekarang = [...document.querySelectorAll('button')].find((btn) =>
        btn.offsetParent !== null && btn.textContent.trim() === 'Sekarang'
      );
      if (tombolSekarang) {
        tombolSekarang.click();
        await wait(250);
      }
    }

    if (await kunciWaktuViaInput(jamMenitStr)) {
      return simpanPickerWaktu(jamMenitStr, namaField);
    }

    for (let percobaan = 1; percobaan <= 3; percobaan++) {
      await setSpinnerValue('Jam', jamTarget);
      await smartWait(150, 300);
      await setSpinnerValue('Menit', menitTarget);
      await smartWait(150, 300);

      const jamAkhir = await bacaKolomStabil('Jam');
      const menitAkhir = await bacaKolomStabil('Menit');

      if (jamAkhir === jamTarget && menitAkhir === menitTarget) {
        if (await simpanPickerWaktu(jamMenitStr, namaField)) {
          return true;
        }
        return false;
      }
      await wait(400);
    }

    return false;
  }

  async function isiPengambilanOmpreng(index) {
    const data = dataPenugasan[index];
    if (!data) return false;

    // Atur checkbox Kurir MBG
    aturCheckboxKurirMBG();
    await smartWait(250, 450);

    const jumlahOmpreng = hitungTotalPorsi(data);
    const semuaInput = [...document.querySelectorAll('input')].filter((inp) => !inp.closest('#sipgn-autofill-panel'));
    const inputJumlah = semuaInput.find((inp) => {
      const ph = (inp.placeholder || '').toLowerCase();
      const name = (inp.name || '').toLowerCase();
      return ph.includes('contoh: 25') || ph.includes('jumlah') || ph.includes('ompreng') || name.includes('jumlah') || name.includes('ompreng') || inp.type === 'number';
    });

    if (inputJumlah) {
      await setNativeValueHuman(inputJumlah, String(jumlahOmpreng), 35, 75);
      await smartWait(250, 450);
    }

    // Mengisi Nama Kurir dan Plat Nomor Kendaraan pada formulir pengambilan ompreng
    await isiKurirDanPlat(data.namaKurir, data.platNomor);
    await smartWait(300, 550);

    const hasil = await aturWaktuKeberangkatan(data.jamJadwalPengambilan, 'Waktu Dijadwalkan Pengambilan');

    if (hasil) {
      dataPenugasan[index].statusProses = 'pengembalian';
      simpanData(dataPenugasan);
      renderPanel();
    }
    return hasil;
  }

  async function isiMulaiPencucian(index) {
    const data = dataPenugasan[index];
    if (!data) return false;

    tampilkanBadgeStatus(`Proses Pencucian: <b>${data.sekolah}</b>...`);

    const jumlahOmpreng = hitungTotalPorsi(data);
    const inputJumlah = document.querySelector('input[placeholder="Contoh: 25"]');
    if (inputJumlah) {
      await setNativeValueHuman(inputJumlah, String(jumlahOmpreng), 35, 75);
      await smartWait(300, 550);
    }

    const hasil = await aturWaktuKeberangkatan(data.jamMulaiCuci, 'Waktu Mulai Cuci');
    sembunyikanBadgeStatus();

    if (hasil) {
      dataPenugasan[index].statusProses = 'pencucian';
      simpanData(dataPenugasan);
      renderPanel();
    }
    return hasil;
  }

  function pasangDetektorNavigasiSPA() {
    let pathnameSebelumnya = location.pathname;

    function tanganiPerubahan() {
      if (location.pathname === pathnameSebelumnya) return;
      pathnameSebelumnya = location.pathname;
      renderPanel();
    }

    const asliPushState = history.pushState;
    const asliReplaceState = history.replaceState;
    history.pushState = function (...args) {
      asliPushState.apply(this, args);
      tanganiPerubahan();
    };
    history.replaceState = function (...args) {
      asliReplaceState.apply(this, args);
      tanganiPerubahan();
    };
    window.addEventListener('popstate', tanganiPerubahan);
    setInterval(tanganiPerubahan, 800);
  }

  function pasangDetektorPerubahanForm() {
    const labelYangDipantau = [
      'Waktu Keberangkatan',
      'Waktu Diterima di Tujuan',
      'Jumlah Ompreng',
      'Waktu Dijadwalkan Pengambilan',
      'Waktu Ompreng Kembali di SPPG',
      'Jumlah Ompreng Dicuci',
      'Waktu Mulai Cuci',
    ];
    const tandaFormSaatIni = () => [...document.querySelectorAll('label')]
      .filter((el) => !el.closest('#sipgn-autofill-panel'))
      .map((el) => el.textContent.replace(/\s+/g, ' ').replace('*', '').trim())
      .filter((teks) => labelYangDipantau.includes(teks))
      .sort()
      .join('|');

    let tandaSebelumnya = tandaFormSaatIni();
    let timerRender = null;
    const observer = new MutationObserver(() => {
      if (timerRender) clearTimeout(timerRender);
      timerRender = setTimeout(() => {
        const tandaBaru = tandaFormSaatIni();
        if (tandaBaru !== tandaSebelumnya) {
          tandaSebelumnya = tandaBaru;
          renderPanel();
        }
      }, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function buatFormInput(labelTeks, idInput, placeholder = '', iconSvg = '') {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom: 0px;';

    const label = document.createElement('label');
    label.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 11px; margin-bottom: 4px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;';

    if (iconSvg) {
      const iconSpan = document.createElement('span');
      iconSpan.style.cssText = 'display: inline-flex; align-items: center; color: #38bdf8; font-size: 13px;';
      iconSpan.innerHTML = iconSvg;
      label.appendChild(iconSpan);
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = labelTeks;
    label.appendChild(textSpan);

    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = 'position: relative;';

    const input = document.createElement('input');
    input.id = idInput;
    input.placeholder = placeholder;
    input.style.cssText = `
      width: 100%; box-sizing: border-box; padding: 8px 12px; border-radius: 8px;
      border: 1px solid rgba(51, 65, 85, 0.8); font-size: 12px; background: rgba(15, 23, 42, 0.7); color: #f8fafc;
      outline: none; transition: all 0.25s ease; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    `;

    input.onfocus = () => {
      input.style.borderColor = '#38bdf8';
      input.style.background = 'rgba(15, 23, 42, 0.95)';
      input.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.15), inset 0 2px 4px rgba(0, 0, 0, 0.1)';
    };

    input.onblur = () => {
      input.style.borderColor = 'rgba(51, 65, 85, 0.8)';
      input.style.background = 'rgba(15, 23, 42, 0.7)';
      input.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1)';
    };

    inputContainer.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(inputContainer);
    return wrapper;
  }

  function tampilkanModalFormKPM(dataEdit = null, indexTarget = null) {
    const modalLama = document.getElementById('sipgn-kpm-form-modal');
    if (modalLama) modalLama.remove();

    const isEdit = dataEdit !== null;

    const overlay = document.createElement('div');
    overlay.id = 'sipgn-kpm-form-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(10px);
      z-index: 1000002; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="position: relative; background: linear-gradient(145deg, #1e293b, #0f172a); border: 1px solid rgba(56, 189, 248, 0.2); color: #f8fafc; padding: 28px; border-radius: 20px; width: 850px; max-width: 92vw; max-height: 88vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); text-align: left; display: flex; flex-direction: column;">

        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(51, 65, 85, 0.6); padding-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #38bdf8; font-size: 16px;">
              ${isEdit ? '✏️' : '✨'}
            </div>
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #f8fafc; letter-spacing: -0.2px;">${isEdit ? 'Edit Data KPM' : 'Tambah Data KPM Baru'}</h3>
              <p style="font-size: 11px; color: #94a3b8; margin: 2px 0 0 0;">Lengkapi formulir manajemen pengiriman di bawah ini.</p>
            </div>
          </div>
          <button id="sipgn-btn-close-kpm-modal" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; width: 32px; height: 32px; border-radius: 50%; font-size: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">✕</button>
        </div>

        <div id="sipgn-kpm-form-inputs-container" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 16px;"></div>

        <div style="margin-top: 24px; border-top: 1px solid rgba(51, 65, 85, 0.6); padding-top: 16px;">
          <button id="sipgn-btn-save-kpm-modal" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; font-weight: 600; cursor: pointer; font-size: 13px; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.35); transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>${isEdit ? '💾 Update Data KPM' : '🚀 Simpan Data KPM'}</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const containerInputs = document.getElementById('sipgn-kpm-form-inputs-container');

    containerInputs.appendChild(buatFormInput('Nama Sekolah/KPM', 'sipgn-in-sekolah', 'SMAN 1 MEDAN', '🏫'));
    containerInputs.appendChild(buatFormInput('Ritase', 'sipgn-in-ritase', '1', '🔄'));
    containerInputs.appendChild(buatFormInput('Batas Waktu (HH:MM)', 'sipgn-in-batasWaktu', '10:00', '⏰'));
    containerInputs.appendChild(buatFormInput('Nama Kurir', 'sipgn-in-namaKurir', 'Budiawan Sutarjo', '👤'));
    containerInputs.appendChild(buatFormInput('Plat Nomor', 'sipgn-in-platNomor', 'BK1234ABC', '🚗'));

    containerInputs.appendChild(buatFormInput('Porsi Besar (KPM Sekolah)', 'sipgn-in-porsiBesar', '5', '📦'));
    containerInputs.appendChild(buatFormInput('Porsi Kecil (KPM Sekolah)', 'sipgn-in-porsiKecil', '5', '📦'));
    containerInputs.appendChild(buatFormInput('Porsi Balita (KPM Posyandu)', 'sipgn-in-porsiBalita', '0', '👶'));
    containerInputs.appendChild(buatFormInput('Porsi Ibu Menyusui (KPM Posyandu)', 'sipgn-in-porsiIbuMenyusui', '0', '🤱'));
    containerInputs.appendChild(buatFormInput('Porsi Ibu Hamil (KPM Posyandu)', 'sipgn-in-porsiIbuHamil', '0', '🤰'));

    containerInputs.appendChild(buatFormInput('Jam Keberangkatan (HH:MM)', 'sipgn-in-jamKeberangkatan', '10:00', '⏱️'));
    containerInputs.appendChild(buatFormInput('Waktu Tiba di Tujuan (HH:MM)', 'sipgn-in-jamTibaTujuan', '10:30', '🏁'));
    containerInputs.appendChild(buatFormInput('Jadwal Pengambilan Ompreng (HH:MM)', 'sipgn-in-jamJadwalPengambilan', '11:00', '📋'));
    containerInputs.appendChild(buatFormInput('Waktu Ompreng Kembali di SPPG (HH:MM)', 'sipgn-in-jamOmprengKembaliSPPG', '12:00', '🏢'));
    containerInputs.appendChild(buatFormInput('Waktu Mulai Cuci (HH:MM)', 'sipgn-in-jamMulaiCuci', '12:30', '🧼'));

    if (isEdit && dataEdit) {
      document.getElementById('sipgn-in-sekolah').value = dataEdit.sekolah || '';
      document.getElementById('sipgn-in-ritase').value = dataEdit.ritase || '';
      document.getElementById('sipgn-in-batasWaktu').value = dataEdit.batasWaktu || '';
      document.getElementById('sipgn-in-porsiBesar').value = dataEdit.porsiBesar || '';
      document.getElementById('sipgn-in-porsiKecil').value = dataEdit.porsiKecil || '';
      document.getElementById('sipgn-in-porsiBalita').value = dataEdit.porsiBalita || '';
      document.getElementById('sipgn-in-porsiIbuMenyusui').value = dataEdit.porsiIbuMenyusui || '';
      document.getElementById('sipgn-in-porsiIbuHamil').value = dataEdit.porsiIbuHamil || '';
      document.getElementById('sipgn-in-namaKurir').value = dataEdit.namaKurir || '';
      document.getElementById('sipgn-in-platNomor').value = dataEdit.platNomor || '';
      document.getElementById('sipgn-in-jamKeberangkatan').value = dataEdit.jamKeberangkatan || '';
      document.getElementById('sipgn-in-jamTibaTujuan').value = dataEdit.jamTibaTujuan || '';
      document.getElementById('sipgn-in-jamJadwalPengambilan').value = dataEdit.jamJadwalPengambilan || '';
      document.getElementById('sipgn-in-jamOmprengKembaliSPPG').value = dataEdit.jamOmprengKembaliSPPG || '';
      document.getElementById('sipgn-in-jamMulaiCuci').value = dataEdit.jamMulaiCuci || '';
    }

    const btnClose = document.getElementById('sipgn-btn-close-kpm-modal');
    btnClose.onclick = () => overlay.remove();

    const btnSave = document.getElementById('sipgn-btn-save-kpm-modal');
    btnSave.onclick = () => {
      const ambil = (id) => document.getElementById(id)?.value.trim() || '';
      const dataForm = {
        sekolah: ambil('sipgn-in-sekolah'),
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
        statusProses: (isEdit && indexTarget !== null) ? (dataPenugasan[indexTarget]?.statusProses || 'belum') : 'belum',
      };

      if (!dataForm.sekolah) {
        tampilkanModalAlertModern('Validasi Gagal', 'Nama sekolah/KPM wajib diisi.', false);
        return;
      }

      if (isEdit && indexTarget !== null) {
        dataForm.terpakai = dataPenugasan[indexTarget].terpakai;
        dataPenugasan[indexTarget] = dataForm;
        indexTerpilih = indexTarget;
      } else {
        dataForm.terpakai = false;
        dataPenugasan.push(dataForm);
        indexTerpilih = dataPenugasan.length - 1;
      }

      simpanData(dataPenugasan);
      overlay.remove();
      renderPanel();
    };
  }

  function hapusDataTerpilih() {
    if (indexTerpilih < 0 || !dataPenugasan[indexTerpilih]) return;
    tampilkanModalKonfirmasiModern(
      'Hapus Data KPM',
      `Hapus data "${dataPenugasan[indexTerpilih].sekolah}"?`,
      () => {
        dataPenugasan.splice(indexTerpilih, 1);
        indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;
        simpanData(dataPenugasan);
        renderPanel();
      }
    );
  }

  function tandaiUlangStatus(status) {
    if (indexTerpilih < 0 || !dataPenugasan[indexTerpilih]) return;
    dataPenugasan[indexTerpilih].terpakai = status;
    if (!status) dataPenugasan[indexTerpilih].statusProses = 'belum';
    simpanData(dataPenugasan);
    renderPanel();
  }

  function hapusSemuaTanda() {
    const jumlahTerpakai = dataPenugasan.filter((d) => d.terpakai || d.statusProses !== 'belum').length;
    if (jumlahTerpakai === 0) {
      tampilkanModalAlertModern('Informasi', 'Tidak ada KPM yang tertandai sedang berjalan.', false);
      return;
    }
    tampilkanModalKonfirmasiModern(
      'Reset Status Tanda',
      `Reset status proses pada ${jumlahTerpakai} KPM? Semua KPM akan kembali ke status "Belum Diproses".`,
      () => {
        dataPenugasan.forEach((d) => {
          d.terpakai = false;
          d.statusProses = 'belum';
        });
        simpanData(dataPenugasan);
        renderPanel();
      }
    );
  }

  function pasangGayaScrollbar() {
    if (document.getElementById('sipgn-scrollbar-style')) return;
    const style = document.createElement('style');
    style.id = 'sipgn-scrollbar-style';
    style.textContent = `
      #sipgn-autofill-panel::-webkit-scrollbar,
      #sipgn-kpm-form-modal div::-webkit-scrollbar,
      #sipgn-license-modal div::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      #sipgn-autofill-panel::-webkit-scrollbar-track,
      #sipgn-kpm-form-modal div::-webkit-scrollbar-track,
      #sipgn-license-modal div::-webkit-scrollbar-track {
        background: transparent;
        border-radius: 6px;
      }
      #sipgn-autofill-panel::-webkit-scrollbar-thumb,
      #sipgn-kpm-form-modal div::-webkit-scrollbar-thumb,
      #sipgn-license-modal div::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 6px;
      }
      #sipgn-autofill-panel::-webkit-scrollbar-thumb:hover,
      #sipgn-kpm-form-modal div::-webkit-scrollbar-thumb:hover,
      #sipgn-license-modal div::-webkit-scrollbar-thumb:hover {
        background: #475569;
      }
      #sipgn-autofill-panel {
        scrollbar-width: thin;
        scrollbar-color: #334155 transparent;
      }
      #sipgn-autofill-panel select,
      #sipgn-kpm-form-modal select,
      #sipgn-license-modal select {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2338bdf8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 10px center;
        background-size: 14px;
        padding-right: 30px !important;
      }
      #sipgn-autofill-panel select option,
      #sipgn-kpm-form-modal select option,
      #sipgn-license-modal select option {
        background-color: #0f172a;
        color: #f8fafc;
        padding: 8px;
      }
      #sipgn-autofill-panel select:focus,
      #sipgn-kpm-form-modal select:focus,
      #sipgn-license-modal select:focus {
        border-color: #38bdf8 !important;
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2) !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function renderPanel() {
    try {
      pasangGayaScrollbar();
      let panel = document.getElementById('sipgn-autofill-panel');
      if (panel) panel.remove();

      const isMinimized = dapatkanPanelMinimized();

      panel = document.createElement('div');
      panel.id = 'sipgn-autofill-panel';
      panel.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 99999;
        background: #1e293b; color: #f8fafc; padding: ${isMinimized ? '10px 14px' : '16px'};
        border-radius: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px;
        width: ${isMinimized ? 'auto' : '330px'}; max-height: 90vh; overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(51, 65, 85, 0.8); transition: all 0.2s ease;
      `;

      const halamanTugasBaru = cekHalamanTugasBaru();

      function jenisKPM(data) {
        return (data.porsiBalita || data.porsiIbuMenyusui || data.porsiIbuHamil) ? 'posyandu' : 'sekolah';
      }

      const totalSekolah = dataPenugasan.filter((d) => jenisKPM(d) === 'sekolah').length;
      const totalPosyandu = dataPenugasan.filter((d) => jenisKPM(d) === 'posyandu').length;
      const totalKPM = dataPenugasan.length;
      const totalPorsiSemua = dataPenugasan.reduce((acc, curr) => acc + hitungTotalPorsi(curr), 0);

      const totalPengantaran = dataPenugasan.filter((d) => d.statusProses === 'pengantaran').length;
      const totalPengembalian = dataPenugasan.filter((d) => d.statusProses === 'pengembalian').length;
      const totalPencucian = dataPenugasan.filter((d) => d.statusProses === 'pencucian').length;

      const headerContainer = document.createElement('div');
      headerContainer.style.cssText = `display: flex; align-items: center; justify-content: space-between; gap: 8px; ${isMinimized ? '' : 'margin-bottom: 10px;'}`;

      const headerLeft = document.createElement('div');
      headerLeft.style.cssText = 'display: flex; align-items: center; gap: 6px;';

      const judul = document.createElement('div');
      judul.textContent = 'SIPGN Autofill';
      judul.style.cssText = 'font-weight: 700; font-size: 14px; color: #f8fafc; letter-spacing: -0.2px;';
      headerLeft.appendChild(judul);

      const badgeVer = document.createElement('span');
      badgeVer.textContent = `v${CURRENT_VERSION}`;
      badgeVer.style.cssText = 'font-size: 10px; background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 2px 6px; border-radius: 6px; font-weight: 600;';
      headerLeft.appendChild(badgeVer);

      headerContainer.appendChild(headerLeft);

      const headerRight = document.createElement('div');
      headerRight.style.cssText = 'display: flex; align-items: center; gap: 6px;';

      if (isMinimized) {
        const miniBadge = document.createElement('span');
        miniBadge.style.cssText = 'font-size: 11px; background: rgba(15, 23, 42, 0.8); border: 1px solid #334155; padding: 2px 8px; border-radius: 8px; color: #cbd5e1; font-weight: 600; font-family: monospace;';
        miniBadge.innerHTML = `<span style="color:#60a5fa;">🚚${totalPengantaran}</span> <span style="color:#c084fc;">📦${totalPengembalian}</span> <span style="color:#2dd4bf;">🧼${totalPencucian}</span>`;
        headerRight.appendChild(miniBadge);
      }

      const btnMinimize = document.createElement('button');
      btnMinimize.innerHTML = isMinimized ? '➕' : '➖';
      btnMinimize.title = isMinimized ? 'Perbesar Panel' : 'Minimalkan Panel';
      btnMinimize.style.cssText = `
        background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);
        color: #cbd5e1; width: 24px; height: 24px; border-radius: 6px;
        font-size: 11px; display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s; outline: none;
      `;
      btnMinimize.onclick = () => {
        simpanPanelMinimized(!isMinimized);
        renderPanel();
      };
      headerRight.appendChild(btnMinimize);
      headerContainer.appendChild(headerRight);

      panel.appendChild(headerContainer);

      if (isMinimized) {
        document.body.appendChild(panel);
        return;
      }

      const bodyContainer = document.createElement('div');
      bodyContainer.id = 'sipgn-panel-body';

      const namaSPPG = dapatkanNamaSPPG() || 'SPPG - UNKNOWN';

      const summaryBar = document.createElement('div');
      summaryBar.style.cssText = `
        background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(51, 65, 85, 0.6);
        border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; font-size: 11px;
      `;
      summaryBar.innerHTML = `
        <div style="color: #facc15; font-weight: 700; font-size: 12px; margin-bottom: 8px; border-bottom: 1px dashed rgba(51, 65, 85, 0.8); padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px; display: flex; align-items: center; gap: 6px;">
          <span>🏢</span> <span>${namaSPPG}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-around; color: #cbd5e1; font-size: 11px; font-weight: 600;">
          <span>🏫 <b style="color: #38bdf8; font-size: 12px;">${totalSekolah}</b></span>
          <span>👶 <b style="color: #f472b6; font-size: 12px;">${totalPosyandu}</b></span>
          <span>📊 <b style="color: #facc15; font-size: 12px;">${totalKPM}</b></span>
          <span>📦 <b style="color: #4ade80; font-size: 12px;">${totalPorsiSemua.toLocaleString('id-ID')}</b></span>
        </div>
      `;
      bodyContainer.appendChild(summaryBar);

      const indikatorHalaman = document.createElement('div');
      indikatorHalaman.textContent = halamanTugasBaru
        ? '📍 Halaman: Buat Penugasan'
        : '📍 Halaman: Detail Distribusi';
      indikatorHalaman.style.cssText = 'font-size: 11px; color: #94a3b8; margin-bottom: 10px; font-weight: 500;';
      bodyContainer.appendChild(indikatorHalaman);

      const autoKurirState = dapatkanAutoKurirMBG();
      const wrapperToggle = document.createElement('div');
      wrapperToggle.style.cssText = `
        display: flex; align-items: center; justify-content: space-between;
        background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.2);
        padding: 8px 10px; border-radius: 10px; margin-bottom: 10px; cursor: pointer;
      `;

      const teksToggle = document.createElement('span');
      teksToggle.style.cssText = 'font-size: 11px; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px;';
      teksToggle.innerHTML = `🛵 Tugaskan ke Aplikasi Kurir MBG`;

      const switchToggle = document.createElement('div');
      switchToggle.style.cssText = `
        width: 34px; height: 18px; background: ${autoKurirState ? '#38bdf8' : '#334155'};
        border-radius: 10px; position: relative; transition: background 0.2s;
      `;
      const knobToggle = document.createElement('div');
      knobToggle.style.cssText = `
        width: 14px; height: 14px; background: white; border-radius: 50%;
        position: absolute; top: 2px; left: ${autoKurirState ? '18px' : '2px'}; transition: left 0.2s;
      `;
      switchToggle.appendChild(knobToggle);

      wrapperToggle.appendChild(teksToggle);
      wrapperToggle.appendChild(switchToggle);

      wrapperToggle.onclick = () => {
        const valBaru = !dapatkanAutoKurirMBG();
        simpanAutoKurirMBG(valBaru);
        aturCheckboxKurirMBG();
        renderPanel();
      };

      bodyContainer.appendChild(wrapperToggle);

      const garis2 = document.createElement('hr');
      garis2.style.cssText = 'border: none; border-top: 1px solid #334155; margin: 0 0 12px 0;';
      bodyContainer.appendChild(garis2);

      function formatStatusBadge(status) {
        if (status === 'pengantaran') return '🚚 Pengantaran';
        if (status === 'pengembalian') return '📦 Pengembalian';
        if (status === 'pencucian') return '🧼 Pencucian';
        return '';
      }

      function teksOpsi(data) {
        const statusStr = formatStatusBadge(data.statusProses);
        return statusStr ? `[${statusStr}] ${data.sekolah}` : data.sekolah;
      }

      let selectSekolah = null;
      let selectPosyandu = null;

      function buatSelectKPM(labelTeks, jenisTarget) {
        const labelSelect = document.createElement('div');
        labelSelect.textContent = labelTeks;
        labelSelect.style.cssText = 'font-size: 11px; color: #94a3b8; margin-bottom: 4px; font-weight: 500;';
        bodyContainer.appendChild(labelSelect);

        const sel = document.createElement('select');
        sel.style.cssText = `
          width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; margin-bottom: 10px;
          border: 1px solid #334155; font-size: 12px; background: #0f172a; color: #f8fafc;
          outline: none; transition: border-color 0.2s; cursor: pointer;
        `;
        sel.onfocus = () => sel.style.borderColor = '#38bdf8';
        sel.onblur = () => sel.style.borderColor = '#334155';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = `-- Pilih ${labelTeks} --`;
        sel.appendChild(placeholder);

        let adaTerpilihDiGrup = false;
        dataPenugasan.forEach((data, i) => {
          if (jenisKPM(data) !== jenisTarget) return;
          const opt = document.createElement('option');
          opt.value = i;
          opt.textContent = teksOpsi(data);
          if (i === indexTerpilih) {
            opt.selected = true;
            adaTerpilihDiGrup = true;
          }
          sel.appendChild(opt);
        });
        if (!adaTerpilihDiGrup) placeholder.selected = true;
        if (sel.options.length === 1) {
          placeholder.textContent = `(Belum ada data)`;
        }

        sel.onchange = (e) => {
          const nilai = e.target.value;
          if (nilai === '') return;
          indexTerpilih = Number(nilai);
          const selLain = sel === selectSekolah ? selectPosyandu : selectSekolah;
          if (selLain) selLain.value = '';
          renderPanel();
        };
        bodyContainer.appendChild(sel);
        return sel;
      }

      selectSekolah = buatSelectKPM('KPM Sekolah', 'sekolah');
      selectPosyandu = buatSelectKPM('KPM Posyandu (3B)', 'posyandu');

      // Tampilkan status bar KPM Terpilih
      if (indexTerpilih >= 0 && dataPenugasan[indexTerpilih]) {
        const kpmAktif = dataPenugasan[indexTerpilih];
        let colorBg = 'rgba(51, 65, 85, 0.4)';
        let colorText = '#94a3b8';
        let statusTeks = '⚪ Belum Diproses';

        if (kpmAktif.statusProses === 'pengantaran') {
          colorBg = 'rgba(37, 99, 235, 0.2)';
          colorText = '#60a5fa';
          statusTeks = '🚚 Ditugaskan Pengantaran';
        } else if (kpmAktif.statusProses === 'pengembalian') {
          colorBg = 'rgba(124, 58, 237, 0.2)';
          colorText = '#c084fc';
          statusTeks = '📦 Ditugaskan Pengembalian';
        } else if (kpmAktif.statusProses === 'pencucian') {
          colorBg = 'rgba(13, 148, 136, 0.2)';
          colorText = '#2dd4bf';
          statusTeks = '🧼 Proses Pencucian';
        }

        const statusBox = document.createElement('div');
        statusBox.style.cssText = `
          background: ${colorBg}; border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; font-size: 11px;
          display: flex; align-items: center; justify-content: space-between;
        `;
        statusBox.innerHTML = `
          <span style="color: #cbd5e1; font-weight: 500;">Status Proses:</span>
          <b style="color: ${colorText}; font-weight: 700;">${statusTeks}</b>
        `;
        bodyContainer.appendChild(statusBox);
      }

      // Ringkasan Jumlah Status Proses ringkas 1 baris
      const processCountBar = document.createElement('div');
      processCountBar.style.cssText = `
        background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(51, 65, 85, 0.6);
        border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; font-size: 11px;
        display: flex; align-items: center; justify-content: space-around; font-weight: 600;
      `;
      processCountBar.innerHTML = `
        <span>🚚 <b style="color: #60a5fa;">${totalPengantaran}</b></span>
        <span style="color: rgba(51, 65, 85, 0.8);">|</span>
        <span>📦 <b style="color: #c084fc;">${totalPengembalian}</b></span>
        <span style="color: rgba(51, 65, 85, 0.8);">|</span>
        <span>🧼 <b style="color: #2dd4bf;">${totalPencucian}</b></span>
      `;
      bodyContainer.appendChild(processCountBar);

      const jumlahKPMTerpakai = dataPenugasan.filter((d) => d.terpakai || d.statusProses !== 'belum').length;
      const tombolHapusSemuaTanda = document.createElement('button');
      tombolHapusSemuaTanda.textContent = `Reset Semua Status${jumlahKPMTerpakai > 0 ? ` (${jumlahKPMTerpakai})` : ''}`;
      tombolHapusSemuaTanda.disabled = jumlahKPMTerpakai === 0;
      tombolHapusSemuaTanda.style.cssText = `
        width: 100%; padding: 7px; border: none; border-radius: 8px;
        background: ${jumlahKPMTerpakai > 0 ? 'rgba(51, 65, 85, 0.5)' : 'transparent'};
        color: ${jumlahKPMTerpakai > 0 ? '#cbd5e1' : '#64748b'};
        cursor: ${jumlahKPMTerpakai > 0 ? 'pointer' : 'not-allowed'};
        font-size: 11px; font-weight: 500; margin-bottom: 10px; border: 1px dashed #334155;
      `;
      tombolHapusSemuaTanda.onclick = hapusSemuaTanda;
      bodyContainer.appendChild(tombolHapusSemuaTanda);

      const bisaIsiPenugasan = indexTerpilih >= 0 && halamanTugasBaru;

      const adaWaktuKeberangkatan = [...document.querySelectorAll('label')].some((el) => {
        const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
        return txt === 'Waktu Keberangkatan' || txt.includes('Waktu Keberangkatan');
      });
      const adaWaktuDiterima = [...document.querySelectorAll('label')].some((el) => {
        const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
        return txt === 'Waktu Diterima di Tujuan' || txt.includes('Waktu Diterima di Tujuan');
      });
      const adaFormPengambilan = [...document.querySelectorAll('label')].some((el) => {
        const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
        return (txt === 'Jumlah Ompreng' || txt.includes('Jumlah Ompreng') || txt.includes('Waktu Dijadwalkan Pengambilan')) &&
               !txt.includes('Dicuci') && !txt.includes('Kembali');
      });
      const adaWaktuKembaliSPPG = [...document.querySelectorAll('label')].some((el) => {
        const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
        return txt === 'Waktu Ompreng Kembali di SPPG' || txt.includes('Waktu Ompreng Kembali di SPPG');
      });
      const adaFormPencucian = [...document.querySelectorAll('label')].some((el) => {
        const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
        return txt === 'Jumlah Ompreng Dicuci' || txt.includes('Jumlah Ompreng Dicuci') || txt.includes('Waktu Mulai Cuci');
      });

      const bisaSetJam = indexTerpilih >= 0 && !halamanTugasBaru && adaWaktuKeberangkatan;
      const bisaSetJamTiba = indexTerpilih >= 0 && adaWaktuDiterima;
      const bisaIsiPengambilan = indexTerpilih >= 0 && adaFormPengambilan;
      const bisaSetWaktuKembali = indexTerpilih >= 0 && adaWaktuKembaliSPPG;
      const bisaIsiPencucian = indexTerpilih >= 0 && adaFormPencucian;

      if (halamanTugasBaru) {
        const barisPenugasan = document.createElement('div');
        barisPenugasan.style.cssText = 'display: flex; margin-bottom: 8px;';
        const tombolPenugasan = document.createElement('button');
        tombolPenugasan.textContent = '⚡ Isi Penugasan';
        tombolPenugasan.disabled = !bisaIsiPenugasan;
        tombolPenugasan.style.cssText = `
          width: 100%; padding: 9px; border: none; border-radius: 8px;
          background: ${bisaIsiPenugasan ? '#7c3aed' : '#334155'}; color: white;
          cursor: ${bisaIsiPenugasan ? 'pointer' : 'not-allowed'}; font-size: 12px; font-weight: 600;
          box-shadow: ${bisaIsiPenugasan ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none'};
        `;
        tombolPenugasan.onclick = () => {
          if (!bisaIsiPenugasan) return;
          isiPenugasan(indexTerpilih);
        };
        barisPenugasan.appendChild(tombolPenugasan);
        bodyContainer.appendChild(barisPenugasan);
      }

      if (adaWaktuKeberangkatan || adaWaktuDiterima) {
        const barisJam = document.createElement('div');
        barisJam.style.cssText = 'display: flex; gap: 6px; margin-bottom: 8px;';

        if (adaWaktuKeberangkatan) {
          const tombolJam = document.createElement('button');
          tombolJam.textContent = 'Set Berangkat';
          tombolJam.disabled = !bisaSetJam;
          tombolJam.style.cssText = `
            flex: 1; padding: 8px; border: none; border-radius: 8px;
            background: ${bisaSetJam ? '#0e7490' : '#334155'}; color: white;
            cursor: ${bisaSetJam ? 'pointer' : 'not-allowed'}; font-size: 11px; font-weight: 600;
          `;
          tombolJam.onclick = async () => {
            if (!bisaSetJam) return;
            tombolJam.disabled = true;
            tombolJam.textContent = 'Mengatur...';
            const berhasil = await aturWaktuKeberangkatan(dataPenugasan[indexTerpilih]?.jamKeberangkatan, 'Waktu Keberangkatan');
            if (berhasil && dataPenugasan[indexTerpilih]) {
              dataPenugasan[indexTerpilih].statusProses = 'pengantaran';
              simpanData(dataPenugasan);
            }
            tombolJam.textContent = berhasil ? 'Tersimpan' : 'Gagal';
            await wait(1200);
            renderPanel();
          };
          barisJam.appendChild(tombolJam);
        }

        if (adaWaktuDiterima) {
          const tombolJamTiba = document.createElement('button');
          tombolJamTiba.textContent = 'Set Tiba';
          tombolJamTiba.disabled = !bisaSetJamTiba;
          tombolJamTiba.style.cssText = `
            flex: 1; padding: 8px; border: none; border-radius: 8px;
            background: ${bisaSetJamTiba ? '#15803d' : '#334155'}; color: white;
            cursor: ${bisaSetJamTiba ? 'pointer' : 'not-allowed'}; font-size: 11px; font-weight: 600;
          `;
          tombolJamTiba.onclick = async () => {
            if (!bisaSetJamTiba) return;
            tombolJamTiba.disabled = true;
            tombolJamTiba.textContent = 'Mengatur...';
            const berhasil = await aturWaktuKeberangkatan(
              dataPenugasan[indexTerpilih]?.jamTibaTujuan,
              'Waktu Diterima di Tujuan'
            );
            tombolJamTiba.textContent = berhasil ? 'Tersimpan' : 'Gagal';
            await wait(1200);
            renderPanel();
          };
          barisJam.appendChild(tombolJamTiba);
        }

        bodyContainer.appendChild(barisJam);
      }

      if (adaFormPengambilan) {
        const barisPengambilan = document.createElement('div');
        barisPengambilan.style.cssText = 'display: flex; margin-bottom: 8px;';
        const tombolPengambilan = document.createElement('button');
        tombolPengambilan.textContent = '📦 Isi Pengambilan Ompreng';
        tombolPengambilan.disabled = !bisaIsiPengambilan;
        tombolPengambilan.style.cssText = `
          width: 100%; padding: 8px; border: none; border-radius: 8px;
          background: ${bisaIsiPengambilan ? '#7c3aed' : '#334155'}; color: white;
          cursor: ${bisaIsiPengambilan ? 'pointer' : 'not-allowed'}; font-size: 11px; font-weight: 600;
        `;
        tombolPengambilan.onclick = async () => {
          if (!bisaIsiPengambilan) return;
          tombolPengambilan.disabled = true;
          tombolPengambilan.textContent = 'Mengisi...';
          const berhasil = await isiPengambilanOmpreng(indexTerpilih);
          tombolPengambilan.textContent = berhasil ? 'Terisi' : 'Gagal';
          await wait(1200);
          renderPanel();
        };
        barisPengambilan.appendChild(tombolPengambilan);
        bodyContainer.appendChild(barisPengambilan);
      }

      if (adaWaktuKembaliSPPG) {
        const barisWaktuKembali = document.createElement('div');
        barisWaktuKembali.style.cssText = 'display: flex; margin-bottom: 8px;';
        const tombolWaktuKembali = document.createElement('button');
        tombolWaktuKembali.textContent = '🔄 Set Ompreng Kembali';
        tombolWaktuKembali.disabled = !bisaSetWaktuKembali;
        tombolWaktuKembali.style.cssText = `
          width: 100%; padding: 8px; border: none; border-radius: 8px;
          background: ${bisaSetWaktuKembali ? '#0f766e' : '#334155'}; color: white;
          cursor: ${bisaSetWaktuKembali ? 'pointer' : 'not-allowed'}; font-size: 11px; font-weight: 600;
        `;
        tombolWaktuKembali.onclick = async () => {
          if (!bisaSetWaktuKembali) return;
          tombolWaktuKembali.disabled = true;
          tombolWaktuKembali.textContent = 'Mengatur...';
          const berhasil = await aturWaktuKeberangkatan(
            dataPenugasan[indexTerpilih]?.jamOmprengKembaliSPPG,
            'Waktu Ompreng Kembali di SPPG'
          );
          if (berhasil && dataPenugasan[indexTerpilih]) {
            dataPenugasan[indexTerpilih].statusProses = 'pengembalian';
            simpanData(dataPenugasan);
          }
          tombolWaktuKembali.textContent = berhasil ? 'Tersimpan' : 'Gagal';
          await wait(1200);
          renderPanel();
        };
        barisWaktuKembali.appendChild(tombolWaktuKembali);
        bodyContainer.appendChild(barisWaktuKembali);
      }

      if (adaFormPencucian) {
        const barisPencucian = document.createElement('div');
        barisPencucian.style.cssText = 'display: flex; margin-bottom: 8px;';
        const tombolPencucian = document.createElement('button');
        tombolPencucian.textContent = '🧼 Isi Mulai Pencucian';
        tombolPencucian.disabled = !bisaIsiPencucian;
        tombolPencucian.style.cssText = `
          width: 100%; padding: 8px; border: none; border-radius: 8px;
          background: ${bisaIsiPencucian ? '#0369a1' : '#334155'}; color: white;
          cursor: ${bisaIsiPencucian ? 'pointer' : 'not-allowed'}; font-size: 11px; font-weight: 600;
        `;
        tombolPencucian.onclick = async () => {
          if (!bisaIsiPencucian) return;
          tombolPencucian.disabled = true;
          tombolPencucian.textContent = 'Mengisi...';
          const berhasil = await isiMulaiPencucian(indexTerpilih);
          tombolPencucian.textContent = berhasil ? 'Terisi' : 'Gagal';
          await wait(1200);
          renderPanel();
        };
        barisPencucian.appendChild(tombolPencucian);
        bodyContainer.appendChild(barisPencucian);
      }

      const barisAksi = document.createElement('div');
      barisAksi.style.cssText = 'display: flex; gap: 6px; margin-bottom: 8px;';

      const tombolEdit = document.createElement('button');
      tombolEdit.textContent = '✏️ Edit';
      tombolEdit.disabled = indexTerpilih < 0;
      tombolEdit.style.cssText = `
        flex: 1; padding: 7px; border: none; border-radius: 8px;
        background: ${indexTerpilih >= 0 ? '#1e3a8a' : '#334155'}; color: white; cursor: ${indexTerpilih >= 0 ? 'pointer' : 'not-allowed'}; font-size: 11px; font-weight: 600;
      `;
      tombolEdit.onclick = () => {
        if (indexTerpilih < 0) return;
        tampilkanModalFormKPM(dataPenugasan[indexTerpilih], indexTerpilih);
      };

      const tombolHapus = document.createElement('button');
      tombolHapus.textContent = '🗑️ Hapus';
      tombolHapus.disabled = indexTerpilih < 0;
      tombolHapus.style.cssText = `
        padding: 7px 12px; border: none; border-radius: 8px;
        background: ${indexTerpilih >= 0 ? 'rgba(127, 29, 29, 0.6)' : '#334155'}; color: white; cursor: ${indexTerpilih >= 0 ? 'pointer' : 'not-allowed'}; font-size: 11px; font-weight: 600;
      `;
      tombolHapus.onclick = hapusDataTerpilih;

      barisAksi.appendChild(tombolEdit);
      barisAksi.appendChild(tombolHapus);
      bodyContainer.appendChild(barisAksi);

      if (indexTerpilih >= 0 && (dataPenugasan[indexTerpilih]?.terpakai || dataPenugasan[indexTerpilih]?.statusProses !== 'belum')) {
        const tombolReset = document.createElement('button');
        tombolReset.textContent = '↺ Reset Status KPM Ini';
        tombolReset.style.cssText = `
          width: 100%; padding: 6px; border: none; border-radius: 8px;
          background: #334155; color: #cbd5e1; cursor: pointer; font-size: 11px; font-weight: 500; margin-bottom: 10px;
        `;
        tombolReset.onclick = () => tandaiUlangStatus(false);
        bodyContainer.appendChild(tombolReset);
      }

      const garis = document.createElement('hr');
      garis.style.cssText = 'border: none; border-top: 1px solid #334155; margin: 10px 0;';
      bodyContainer.appendChild(garis);

      const tombolToggleForm = document.createElement('button');
      tombolToggleForm.textContent = '+ Tambah Data KPM Baru';
      tombolToggleForm.style.cssText = `
        width: 100%; padding: 8px; border: none; border-radius: 8px;
        background: rgba(37, 99, 235, 0.2); color: #38bdf8; border: 1px solid rgba(37, 99, 235, 0.3); cursor: pointer; font-size: 11px; font-weight: 600; margin-bottom: 8px;
        transition: 0.2s;
      `;
      tombolToggleForm.onclick = () => {
        tampilkanModalFormKPM(null, null);
      };

      bodyContainer.appendChild(tombolToggleForm);

      const tombolLisensi = document.createElement('button');
      tombolLisensi.textContent = '💳 Informasi & Status Perangkat';
      tombolLisensi.style.cssText = `
        width: 100%; padding: 9px; border: none; border-radius: 8px;
        background: #334155; color: white; cursor: pointer; font-size: 11px; font-weight: 600; margin-bottom: 4px;
        transition: background 0.2s;
      `;
      tombolLisensi.onclick = () => {
        tampilkanModalAktivasi('', true);
      };
      bodyContainer.appendChild(tombolLisensi);

      const footer = document.createElement('div');
      footer.style.cssText = `margin-top: 6px; font-size: 10px; text-align: center; color: #64748b;`;
      footer.innerHTML = '© 2026 - <b>Mindspace Studio</b>';
      bodyContainer.appendChild(footer);

      panel.appendChild(bodyContainer);
      document.body.appendChild(panel);
    } catch (e) {
      console.error('[Autofill] Gagal merender panel UI:', e);
    }
  }

  function bersihkanSemuaUI() {
    if (isPaymentModalOpen || isPaymentSuccess) return;

    const panel = document.getElementById('sipgn-autofill-panel');
    if (panel) panel.remove();
    const modalAktivasi = document.getElementById('sipgn-license-modal');
    if (modalAktivasi) modalAktivasi.remove();
    const modalStatus = document.getElementById('sipgn-status-modal');
    if (modalStatus) modalStatus.remove();
  }

  function periksaStatusLisensiOnline(isPemeriksaanAwal = false) {
    if ((isPaymentModalOpen || isPaymentSuccess) && !isPemeriksaanAwal) return;
    const currentDevId = dapatkanDeviceID();

    GM_xmlhttpRequest({
      method: 'GET',
      url: `${VERCEL_API_URL}?action=check_license&device_id=${encodeURIComponent(currentDevId)}&_t=${Date.now()}`,
      headers: {
        'Cache-Control': 'no-cache, no-store'
      },
      onload: function (res) {
        try {
          const data = JSON.parse(res.responseText);
          cachedServerStatus = data;

          if (data && data.sppg_name) {
            simpanNamaSPPG(data.sppg_name);
          }

          if (isPaymentModalOpen || isPaymentSuccess) return;

          let statusSekarang = 'unregistered';
          if (data.status === 'revoked') {
            statusSekarang = 'revoked';
          } else if (data.status === 'hold') {
            statusSekarang = 'hold';
          } else if (data.valid) {
            statusSekarang = 'active';
          } else if (data.exp_date || (data.msg && data.msg.includes('kadaluarsa'))) {
            statusSekarang = 'expired';
          }

          if (statusSekarang !== statusLisensiTerakhir || isPemeriksaanAwal) {
            statusLisensiTerakhir = statusSekarang;

            if (statusSekarang === 'revoked') {
              bersihkanSemuaUI();
              tampilkanModalStatusSitus('Akses Dibatalkan', 'Lisensi Anda telah dicabut oleh Administrator.', 'revoked');
            } else if (statusSekarang === 'hold') {
              bersihkanServerUI();
              tampilkanModalStatusSitus('Lisensi Ditangguhkan', 'Lisensi Anda sedang ditangguhkan sementara. Silakan hubungi Administrator.', 'hold');
            } else if (statusSekarang === 'active') {
              currentDatabaseExpDate = data.exp_date;
              bersihkanSemuaUI();
              mulaiJalankanSkrip();
            } else if (statusSekarang === 'unregistered') {
              if (!dapatkanNamaSPPG()) {
                tampilkanModalWelcomeSPPG(() => {
                  currentDatabaseExpDate = data.exp_date || null;
                  bersihkanSemuaUI();
                  tampilkanModalAktivasi(data.msg || '', false);
                });
              } else {
                currentDatabaseExpDate = data.exp_date || null;
                bersihkanSemuaUI();
                tampilkanModalAktivasi(data.msg || '', false);
              }
            } else {
              currentDatabaseExpDate = data.exp_date || null;
              bersihkanSemuaUI();
              tampilkanModalAktivasi(data.msg || 'Lisensi tidak ditemukan atau telah kadaluarsa.', false);
            }
          }
        } catch (e) {
          if (isPemeriksaanAwal) tampilkanModalAktivasi('Gagal memverifikasi status lisensi ke server.', false);
        }
      },
      onerror: function () {
        if (isPemeriksaanAwal) tampilkanModalAktivasi('Gagal terhubung ke server verifikasi.', false);
      }
    });
  }

  function inialisasiSistem() {
    try {
      periksaStatusLisensiOnline(true);

      if (intervalMonitorLisensi) clearInterval(intervalMonitorLisensi);
      intervalMonitorLisensi = setInterval(() => {
        periksaStatusLisensiOnline(false);
      }, 60000);

    } catch (e) {
      console.error('[Autofill] Gagal inisialisasi, membuka modal aktivasi:', e);
      tampilkanModalAktivasi('', false);
    }
  }

  setTimeout(() => {
    inialisasiSistem();
  }, 500);
})();
