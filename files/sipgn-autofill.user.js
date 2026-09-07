// ==UserScript==
// @name       SIPGN Autofill - POP
// @namespace    sipgn-autofill
// @version      1.5.39
// @description Isi otomatis form Tugas Pengiriman & Klaim Voucher Durasi Custom Baru
// @match        https://pop-sipgn.bgn.go.id/distribution/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      mindspace-id.vercel.app
// @connect      api.qrserver.com
// @connect      chart.googleapis.com
// @updateURL    https://mindspace-id.vercel.app/sipgn-autofill.user.js
// @downloadURL https://mindspace-id.vercel.app/sipgn-autofill.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // KONFIGURASI API VERCEL & STORAGE
  // ------------------------------------------------------------------
  const CURRENT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script)
    ? GM_info.script.version
    : '1.5.39';

  const VERCEL_API_URL = 'https://mindspace-id.vercel.app/api/tokopay';

  const SECRET_SALT = 'MINDSTUDIO2026';
  const LICENSE_STORAGE_KEY = 'sipgn_license_key';
  const DEVICE_STORAGE_KEY = 'sipgn_device_id';
  const STORAGE_KEY = 'sipgnAutofillData';

  let currentDatabaseExpDate = null;
  let statusLisensiTerakhir = null;
  let intervalMonitorLisensi = null;
  let isPaymentModalOpen = false;
  let isPaymentSuccess = false;
  let daftarVouchersGlobal = [];
  let kodeVoucherTerpakai = null;

  // ------------------------------------------------------------------
  // FITUR IN-APP UPDATE CHECKER & POP-UP NOTIFICATION
  // ------------------------------------------------------------------
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

          if (latestVersion && latestVersion !== CURRENT_VERSION) {
            tampilkanNotifikasiUpdate(latestVersion, downloadUrl);
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

  function tampilkanNotifikasiUpdate(versiBaru, urlDownload) {
    const modalLama = document.getElementById('sipgn-update-modal');
    if (modalLama) modalLama.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sipgn-update-modal';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
      z-index: 1000000; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="position: relative; background: #1e293b; border: 1px solid rgba(234, 179, 8, 0.3); color: #f8fafc; padding: 24px; border-radius: 16px; width: 340px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        <button id="sipgn-btn-close-update" style="position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.05); border: none; color: #94a3b8; width: 28px; height: 28px; border-radius: 50%; font-size: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;">✕</button>
        <div style="width: 48px; height: 48px; background: rgba(234, 179, 8, 0.1); color: #eab308; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 14px auto;">🚀</div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #fef08a;">Update Versi Baru Tersedia!</h3>
        <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 16px 0; line-height: 1.5;">
          Versi saat ini: <b style="color: #ef4444;">v${CURRENT_VERSION}</b><br>
          Versi terbaru: <b style="color: #4ade80;">v${versiBaru}</b>
        </p>
        <a href="${urlDownload}" target="_blank" id="sipgn-link-update" style="display: block; width: 100%; box-sizing: border-box; padding: 10px; background: #eab308; color: #0f172a; font-weight: 600; border-radius: 10px; text-decoration: none; font-size: 13px; margin-bottom: 8px; transition: 0.2s;">
          📥 Download & Install
        </a>
        <button id="sipgn-btn-later-update" style="width: 100%; padding: 10px; border: 1px solid #334155; border-radius: 10px; background: transparent; color: #cbd5e1; font-weight: 600; cursor: pointer; font-size: 13px; transition: 0.2s;">
          Nanti Saja
        </button>
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
    if (sisaHari > 7) return '#34d399'; // Hijau
    if (sisaHari <= 7 && sisaHari >= 3) return '#facc15'; // Kuning
    return '#ef4444'; // Merah (< 3 hari)
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

  // ------------------------------------------------------------------
  // FUNGSI KOMUNIKASI API VERCEL <-> TOKOPAY & VOUCHER KLAIM
  // ------------------------------------------------------------------
  function ambilDaftarPaketDanVoucherVercel() {
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
                const listPaket = dataPkg.packages || dataPkg.data || (Array.isArray(dataPkg) ? dataPkg : []);

                let listVoucher = [];
                try {
                  const dataVouch = JSON.parse(resVouch.responseText);
                  listVoucher = dataVouch.vouchers || [];
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

  // ------------------------------------------------------------------
  // MODAL INDEPENDEN UNTUK TRANSAKSI SUKSES
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // PROSES PEMBAYARAN OTOMATIS & VOUCHER KLAIM
  // ------------------------------------------------------------------
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
        alert('Gagal dari Server: ' + resOrder.error);
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
        alert('Gagal membuat transaksi QRIS: ' + pesanErrorMsg);
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
      alert('Error: ' + err);
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

    ambilDaftarPaketDanVoucherVercel()
      .then((resData) => {
        const listPaket = resData.packages;
        selectEl.innerHTML = '';
        listPaket.forEach((p, idx) => {
          const opt = document.createElement('option');
          const hari = p.hari || p.paket_hari || p.days || p.value;
          const harga = p.harga || p.price || p.formatted_price;
          const nama = p.nama || p.label || p.name || `Paket ${hari} Hari`;

          opt.value = hari;
          opt.textContent = harga ? `${nama} - Rp ${Number(harga).toLocaleString('id-ID')}` : nama;
          if (p.selected || idx === 0) opt.selected = true;
          selectEl.appendChild(opt);
        });
        if (btnBeliEl) btnBeliEl.disabled = false;
      })
      .catch((err) => {
        console.warn('[Autofill] Gagal muat paket Vercel:', err);
        selectEl.innerHTML = '<option value="">❌ Gagal memuat data paket</option>';
      });
  }

  async function tampilkanModalAktivasi(pesanPeringatan = '', bisaDitutup = true, isBerhasil = false) {
    try {
      const modalLama = document.getElementById('sipgn-license-modal');
      if (modalLama) modalLama.remove();

      const currentDevId = dapatkanDeviceID();

      let serverStatusData = { status: 'unregistered', valid: false, exp_date: null, msg: '' };
      try {
        const checkRes = await new Promise((resolve) => {
          GM_xmlhttpRequest({
            method: 'GET',
            url: `${VERCEL_API_URL}?action=check_license&device_id=${encodeURIComponent(currentDevId)}&_t=${Date.now()}`,
            headers: { 'Cache-Control': 'no-cache, no-store' },
            onload: (res) => {
              try { resolve(JSON.parse(res.responseText)); } catch(e) { resolve({ valid: false }); }
            },
            onerror: () => resolve({ valid: false })
          });
        });
        serverStatusData = checkRes;
      } catch(e) {}

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
          <p style="font-size: 11px; color: #94a3b8; margin: 0 0 16px 0; line-height: 1.4;">${isUserBaru ? 'Selamat datang! Gunakan kupon voucher atau pilih paket durasi untuk mulai.' : 'Kelola langganan dan identitas perangkat Anda.'}</p>

          <!-- AKUN / DEVICE ID SECTION -->
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

          <!-- PENGATURAN BACKUP & IMPORT DI DALAM MODAL PENGATURAN -->
          <div id="sipgn-backup-import-sec" style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 12px; margin-bottom: 14px; border: 1px solid rgba(51, 65, 85, 0.5); text-align: left; ${isKadaluarsa ? 'display: none;' : ''}">
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

            <div id="sipgn-wrapper-paket" style="text-align: left;">
              <label style="display: block; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">Pilih Paket Durasi :</label>
              <select id="sipgn-select-paket" style="width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: white; font-size: 12px; margin-bottom: 12px; outline: none;">
                <option value="">⏳ Memuat paket...</option>
              </select>
            </div>

            <button id="sipgn-btn-buy-qris" style="width: 100%; padding: 11px; border: none; border-radius: 10px; background: #10b981; color: white; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s; margin-bottom: 12px;">
              💳 Bayar via QRIS
            </button>

            <!-- VOUCHER SECTION (DIBAWAH TOMBOL BAYAR QRIS) -->
            <div id="sipgn-voucher-section" style="text-align: left; border-top: 1px dashed rgba(51, 65, 85, 0.8); padding-top: 12px;">
              <label style="display: block; font-size: 11px; font-weight: 600; color: #38bdf8; margin-bottom: 6px;">Klaim Kode Voucher:</label>
              <div style="display: flex; gap: 6px; margin-bottom: 4px;">
                <input type="text" id="sipgn-input-voucher" placeholder="KODE VOUCHER" style="flex: 2; box-sizing: border-box; padding: 8px 12px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: white; font-size: 12px; text-transform: uppercase; outline: none;" />
                <button id="sipgn-btn-apply-voucher" style="flex: 1; padding: 8px 12px; border: none; border-radius: 10px; background: #2563eb; color: white; font-weight: 600; cursor: pointer; font-size: 12px; transition: 0.2s;">Klaim</button>
              </div>
              <div id="sipgn-voucher-feedback" style="font-size: 11px; min-height: 14px; margin-top: 4px;"></div>
            </div>

            <div id="sipgn-qris-container" style="display: none; text-align: center;"></div>
          </div>

          <div style="font-size: 11px; color: #64748b;">© 2026 - <b>Mindspace Studio</b></div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Event listener untuk tombol backup dan import di dalam modal pengaturan (jika ada)
      const btnBackup = document.getElementById('sipgn-btn-modal-backup');
      if (btnBackup) btnBackup.onclick = downloadBackupData;
      const modalInputImport = document.getElementById('sipgn-modal-input-import');
      const btnImport = document.getElementById('sipgn-btn-modal-import');
      if (btnImport && modalInputImport) {
        btnImport.onclick = () => modalInputImport.click();
        modalInputImport.onchange = () => {
          importBackupData(modalInputImport.files?.[0]);
          modalInputImport.value = '';
        };
      }

      const selectPaket = document.getElementById('sipgn-select-paket');
      const btnBeli = document.getElementById('sipgn-btn-buy-qris');

      muatDaftarPaketKeSelect(selectPaket, btnBeli);

      const inputVoucher = document.getElementById('sipgn-input-voucher');
      const btnApplyVoucher = document.getElementById('sipgn-btn-apply-voucher');
      const voucherFeedback = document.getElementById('sipgn-voucher-feedback');

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

      btnBeli.onclick = () => {
        if (!selectPaket || !selectPaket.value) {
          alert('Silakan pilih paket durasi terlebih dahulu.');
          return;
        }
        const hari = Number(selectPaket.value);
        prosesPembayaranOtomatis(hari);
      };
    } catch (e) {
      console.error('[Autofill] Gagal merender modal:', e);
    }
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

  // ------------------------------------------------------------------
  // CORE LOGIC FORM FILLER & SPINNER (Sama seperti sebelumnya)
  // ------------------------------------------------------------------
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

  function downloadBackupData() {
    const backup = {
      Application: 'SIPGN POP - Autofill',
      Version: CURRENT_VERSION,
      Developed: 'Mindspace Studio',
      dibuatPada: new Date().toISOString(),
      dataKPM: dataPenugasan,
    };
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
        if (!confirm(`Import ${dataImpor.length} data KPM akan mengganti data saat ini. Lanjutkan?`)) return;
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
      } catch (error) {
        alert(`Import backup gagal: ${error.message}`);
      }
    };
    pembaca.readAsText(file);
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
      setNativeValue(input, nilai);
      await wait(500);

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

    setNativeValue(input, namaSekolah);

    const tombolOpsi = await tungguElemen(() =>
      [...document.querySelectorAll('button')].find((btn) =>
        btn.textContent.includes(namaSekolah)
      )
    );

    if (!tombolOpsi) return false;
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

  function isiPorsiSekolahLama(porsiBesar, porsiKecil) {
    const inputs = document.querySelectorAll('input[type="number"]');
    const validInputs = [...inputs].filter(inp => !inp.closest('#sipgn-autofill-panel'));
    if (validInputs.length < 2) return false;
    setNativeValue(validInputs[0], porsiBesar);
    setNativeValue(validInputs[1], porsiKecil);
    return true;
  }

  function isiPorsi(data) {
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
      setNativeValue(input, k.nilai || '0');
      jumlahTerisi++;
    }
    if (jumlahTerisi === 0) {
      return isiPorsiSekolahLama(data.porsiBesar, data.porsiKecil);
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

  function isiKurirDanPlat(namaKurir, platNomor) {
    const inputKurir = document.querySelector('input[placeholder="Nama lengkap kurir/driver"]');
    const inputPlat = document.querySelector('input[placeholder="Contoh: B 1234 ABC"]');
    if (inputKurir) setNativeValue(inputKurir, namaKurir);
    if (inputPlat) setNativeValue(inputPlat, platNomor);
  }

  async function isiPenugasan(index) {
    const data = dataPenugasan[index];
    if (!data) return;

    await isiLokasiKPM(data.sekolah);
    await wait(1200);

    await isiRitase(data.ritase);
    isiBatasWaktu(data.batasWaktu);
    isiPorsi(data);
    isiKurirDanPlat(data.namaKurir, data.platNomor);

    dataPenugasan[index].terpakai = true;
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
      await wait(18);
    }
    await wait(45);
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
      await setSpinnerValue('Menit', menitTarget);

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

    const jumlahOmpreng = hitungTotalPorsi(data);
    const inputJumlah = document.querySelector('input[placeholder="Contoh: 25"]');
    const inputKurir = document.querySelector('input[placeholder="Nama kurir"]');
    const inputPlat = document.querySelector('input[placeholder="Contoh: B 9999 XYZ"]');

    if (inputJumlah) setNativeValue(inputJumlah, String(jumlahOmpreng));
    if (inputKurir) setNativeValue(inputKurir, data.namaKurir || '');
    if (inputPlat) setNativeValue(inputPlat, data.platNomor || '');

    return aturWaktuKeberangkatan(data.jamJadwalPengambilan, 'Waktu Dijadwalkan Pengambilan');
  }

  async function isiMulaiPencucian(index) {
    const data = dataPenugasan[index];
    if (!data) return false;

    const jumlahOmpreng = hitungTotalPorsi(data);
    const inputJumlah = document.querySelector('input[placeholder="Contoh: 25"]');
    if (inputJumlah) setNativeValue(inputJumlah, String(jumlahOmpreng));

    return aturWaktuKeberangkatan(data.jamMulaiCuci, 'Waktu Mulai Cuci');
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
      'Waktu Ompreng Kembali di SPPG',
      'Jumlah Ompreng Dicuci',
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
      animation: sipgnFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    overlay.innerHTML = `
      <div style="position: relative; background: linear-gradient(145deg, #1e293b, #0f172a); border: 1px solid rgba(56, 189, 248, 0.2); color: #f8fafc; padding: 28px; border-radius: 20px; width: 850px; max-width: 92vw; max-height: 88vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.05); text-align: left; display: flex; flex-direction: column;">

        <!-- Header Modal -->
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

        <!-- Inputs Container (Grid 3 Kolom Berdasarkan Jenisnya) -->
        <div id="sipgn-kpm-form-inputs-container" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 16px;"></div>

        <!-- Footer Action Button -->
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
    btnClose.onmouseover = () => { btnClose.style.background = 'rgba(255, 255, 255, 0.1)'; btnClose.style.color = '#fff'; };
    btnClose.onmouseout = () => { btnClose.style.background = 'rgba(255, 255, 255, 0.05)'; btnClose.style.color = '#94a3b8'; };
    btnClose.onclick = () => overlay.remove();

    const btnSave = document.getElementById('sipgn-btn-save-kpm-modal');
    btnSave.onmouseover = () => btnSave.style.filter = 'brightness(1.1)';
    btnSave.onmouseout = () => btnSave.style.filter = 'none';

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
      };

      if (!dataForm.sekolah) {
        alert('Nama sekolah/KPM wajib diisi.');
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
    if (!confirm(`Hapus data "${dataPenugasan[indexTerpilih].sekolah}"?`)) return;
    dataPenugasan.splice(indexTerpilih, 1);
    indexTerpilih = dataPenugasan.length > 0 ? 0 : -1;
    simpanData(dataPenugasan);
    renderPanel();
  }

  function tandaiUlangStatus(status) {
    if (indexTerpilih < 0 || !dataPenugasan[indexTerpilih]) return;
    dataPenugasan[indexTerpilih].terpakai = status;
    simpanData(dataPenugasan);
    renderPanel();
  }

  function hapusSemuaTanda() {
    const jumlahTerpakai = dataPenugasan.filter((d) => d.terpakai).length;
    if (jumlahTerpakai === 0) {
      alert('Tidak ada KPM yang tertandai digunakan.');
      return;
    }
    if (!confirm(`Hapus tanda "digunakan" pada ${jumlahTerpakai} KPM? Semua KPM akan kembali berstatus belum dipakai.`)) return;
    dataPenugasan.forEach((d) => { d.terpakai = false; });
    simpanData(dataPenugasan);
    renderPanel();
  }

  function renderPanel() {
    try {
      let panel = document.getElementById('sipgn-autofill-panel');
      if (panel) panel.remove();

      panel = document.createElement('div');
      panel.id = 'sipgn-autofill-panel';
      panel.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 99999;
        background: #1e293b; color: #f8fafc; padding: 16px;
        border-radius: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px;
        width: 300px; max-height: 90vh; overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(51, 65, 85, 0.8);
      `;

      const halamanTugasBaru = cekHalamanTugasBaru();

      const headerContainer = document.createElement('div');
      headerContainer.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;';

      const judul = document.createElement('div');
      judul.textContent = 'SIPGN Autofill';
      judul.style.cssText = 'font-weight: 700; font-size: 15px; color: #f8fafc; letter-spacing: -0.2px;';
      headerContainer.appendChild(judul);

      const badgeVer = document.createElement('span');
      badgeVer.textContent = `v${CURRENT_VERSION}`;
      badgeVer.style.cssText = 'font-size: 10px; background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 2px 6px; border-radius: 6px; font-weight: 600;';
      headerContainer.appendChild(badgeVer);

      panel.appendChild(headerContainer);

      const indikatorHalaman = document.createElement('div');
      indikatorHalaman.textContent = halamanTugasBaru
        ? '📍 Halaman: Buat Penugasan'
        : '📍 Halaman: Detail Distribusi';
      indikatorHalaman.style.cssText = 'font-size: 11px; color: #94a3b8; margin-bottom: 12px; font-weight: 500;';
      panel.appendChild(indikatorHalaman);

      const garis2 = document.createElement('hr');
      garis2.style.cssText = 'border: none; border-top: 1px solid #334155; margin: 0 0 12px 0;';
      panel.appendChild(garis2);

      function jenisKPM(data) {
        return (data.porsiBalita || data.porsiIbuMenyusui || data.porsiIbuHamil) ? 'posyandu' : 'sekolah';
      }

      function teksOpsi(data) {
        return `${data.terpakai ? '✅ ' : ''}${data.sekolah}${data.terpakai ? ' (digunakan)' : ''}`;
      }

      let selectSekolah = null;
      let selectPosyandu = null;

      function buatSelectKPM(labelTeks, jenisTarget) {
        const labelSelect = document.createElement('div');
        labelSelect.textContent = labelTeks;
        labelSelect.style.cssText = 'font-size: 11px; color: #94a3b8; margin-bottom: 4px; font-weight: 500;';
        panel.appendChild(labelSelect);

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
        };
        panel.appendChild(sel);
        return sel;
      }

      selectSekolah = buatSelectKPM('KPM Sekolah', 'sekolah');
      selectPosyandu = buatSelectKPM('KPM Posyandu (3B)', 'posyandu');

      const jumlahKPMTerpakai = dataPenugasan.filter((d) => d.terpakai).length;
      const tombolHapusSemuaTanda = document.createElement('button');
      tombolHapusSemuaTanda.textContent = `Hapus Semua Tanda${jumlahKPMTerpakai > 0 ? ` (${jumlahKPMTerpakai})` : ''}`;
      tombolHapusSemuaTanda.disabled = jumlahKPMTerpakai === 0;
      tombolHapusSemuaTanda.style.cssText = `
        width: 100%; padding: 7px; border: none; border-radius: 8px;
        background: ${jumlahKPMTerpakai > 0 ? 'rgba(51, 65, 85, 0.5)' : 'transparent'};
        color: ${jumlahKPMTerpakai > 0 ? '#cbd5e1' : '#64748b'};
        cursor: ${jumlahKPMTerpakai > 0 ? 'pointer' : 'not-allowed'};
        font-size: 11px; font-weight: 500; margin-bottom: 10px; border: 1px dashed #334155;
      `;
      tombolHapusSemuaTanda.onclick = hapusSemuaTanda;
      panel.appendChild(tombolHapusSemuaTanda);

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
        return txt === 'Jumlah Ompreng' || txt.includes('Jumlah Ompreng');
      });
      const adaWaktuKembaliSPPG = [...document.querySelectorAll('label')].some((el) => {
        const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
        return txt === 'Waktu Ompreng Kembali di SPPG' || txt.includes('Waktu Ompreng Kembali di SPPG');
      });
      const adaFormPencucian = [...document.querySelectorAll('label')].some((el) => {
        const txt = el.textContent.replace(/\s+/g, ' ').replace('*', '').trim();
        return txt === 'Jumlah Ompreng Dicuci' || txt.includes('Jumlah Ompreng Dicuci');
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
        panel.appendChild(barisPenugasan);
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
            tombolJam.textContent = berhasil ? 'Tersimpan' : 'Gagal';
            await wait(1200);
            tombolJam.textContent = 'Set Berangkat';
            tombolJam.disabled = !bisaSetJam;
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
            tombolJamTiba.textContent = 'Set Tiba';
            tombolJamTiba.disabled = !bisaSetJamTiba;
          };
          barisJam.appendChild(tombolJamTiba);
        }

        panel.appendChild(barisJam);
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
          tombolPengambilan.textContent = '📦 Isi Pengambilan Ompreng';
          tombolPengambilan.disabled = !bisaIsiPengambilan;
        };
        barisPengambilan.appendChild(tombolPengambilan);
        panel.appendChild(barisPengambilan);
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
          tombolWaktuKembali.textContent = berhasil ? 'Tersimpan' : 'Gagal';
          await wait(1200);
          tombolWaktuKembali.textContent = '🔄 Set Ompreng Kembali';
          tombolWaktuKembali.disabled = !bisaSetWaktuKembali;
        };
        barisWaktuKembali.appendChild(tombolWaktuKembali);
        panel.appendChild(barisWaktuKembali);
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
          tombolPencucian.textContent = '🧼 Isi Mulai Pencucian';
          tombolPencucian.disabled = !bisaIsiPencucian;
        };
        barisPencucian.appendChild(tombolPencucian);
        panel.appendChild(barisPencucian);
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
      panel.appendChild(barisAksi);

      if (indexTerpilih >= 0 && dataPenugasan[indexTerpilih]?.terpakai) {
        const tombolReset = document.createElement('button');
        tombolReset.textContent = '↺ Tandai Belum Dipakai';
        tombolReset.style.cssText = `
          width: 100%; padding: 6px; border: none; border-radius: 8px;
          background: #334155; color: #cbd5e1; cursor: pointer; font-size: 11px; font-weight: 500; margin-bottom: 10px;
        `;
        tombolReset.onclick = () => tandaiUlangStatus(false);
        panel.appendChild(tombolReset);
      }

      const garis = document.createElement('hr');
      garis.style.cssText = 'border: none; border-top: 1px solid #334155; margin: 10px 0;';
      panel.appendChild(garis);

      var tombolToggleForm = document.createElement('button');
      tombolToggleForm.textContent = '+ Tambah Data KPM Baru';
      tombolToggleForm.style.cssText = `
        width: 100%; padding: 8px; border: none; border-radius: 8px;
        background: rgba(37, 99, 235, 0.2); color: #38bdf8; border: 1px solid rgba(37, 99, 235, 0.3); cursor: pointer; font-size: 11px; font-weight: 600; margin-bottom: 8px;
        transition: 0.2s;
      `;
      tombolToggleForm.onclick = () => {
        tampilkanModalFormKPM(null, null);
      };

      panel.appendChild(tombolToggleForm);

      const tombolLisensi = document.createElement('button');
      tombolLisensi.textContent = '💳 Informasi & Status Perangkat';
      tombolLisensi.style.cssText = `
        width: 100%; padding: 9px; border: none; border-radius: 8px;
        background: #334155; color: white; cursor: pointer; font-size: 11px; font-weight: 600; margin-bottom: 4px;
        transition: background 0.2s;
      `;
      tombolLisensi.onmouseover = () => tombolLisensi.style.background = '#475569';
      tombolLisensi.onmouseout = () => tombolLisensi.style.background = '#334155';
      tombolLisensi.onclick = () => {
        tampilkanModalAktivasi('', true);
      };
      panel.appendChild(tombolLisensi);

      const footer = document.createElement('div');
      footer.style.cssText = `margin-top: 6px; font-size: 10px; text-align: center; color: #64748b;`;
      footer.innerHTML = '© 2026 - <b>Mindspace Studio</b>';
      panel.appendChild(footer);

      document.body.appendChild(panel);
    } catch (e) {
      console.error('[Autofill] Gagal merender panel UI:', e);
    }
  }

  // ------------------------------------------------------------------
  // PENGAWASAN STATUS LISENSI SECARA REAL-TIME
  // ------------------------------------------------------------------
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
              bersihkanSemuaUI();
              tampilkanModalStatusSitus('Lisensi Ditangguhkan', 'Lisensi Anda sedang ditangguhkan sementara. Silakan hubungi Administrator.', 'hold');
            } else if (statusSekarang === 'active') {
              currentDatabaseExpDate = data.exp_date;
              bersihkanSemuaUI();
              mulaiJalankanSkrip();
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
