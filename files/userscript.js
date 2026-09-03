// ==UserScript==
// @name        SIPGN Autofill - POP
// @namespace   sipgn-autofill
// @version     1.5.17
// @description Isi otomatis form Tugas Pengiriman & Auto Payment QRIS Tokopay
// @match       https://pop-sipgn.bgn.go.id/distribution/*
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_xmlhttpRequest
// @connect     mindspace-id.vercel.app
// @connect     api.qrserver.com
// ==/UserScript==

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // KONFIGURASI API VERCEL & STORAGE
  // ------------------------------------------------------------------
  const VERCEL_API_URL = 'https://mindspace-id.vercel.app/api/tokopay';

  const SECRET_SALT = 'MINDSTUDIO2026';
  const LICENSE_STORAGE_KEY = 'sipgn_license_key';
  const USED_KEYS_STORAGE_KEY = 'sipgn_used_keys_list';
  const DEVICE_STORAGE_KEY = 'sipgn_device_id';
  const STORAGE_KEY = 'sipgnAutofillData';

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

  function dekodePayloadLisensi(licenseKey) {
    if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.startsWith('MIND-')) return null;
    try {
      const rawEncoded = licenseKey.replace('MIND-', '');
      const reversed = rawEncoded.split('').reverse().join('');
      const decodedPayload = atob(reversed);
      const [expDate, deviceId, client, salt] = decodedPayload.split('|');
      return { expDate, deviceId, client, salt };
    } catch (e) {
      return null;
    }
  }

  function buatLicenseKey(expDate, deviceId, client = 'User') {
    const nonce = Math.floor(Math.random() * 16777215).toString(16).toUpperCase();
    const payload = `${expDate}|${deviceId}|${client}|${SECRET_SALT}|${nonce}`;
    const encoded = btoa(payload);
    const reversed = encoded.split('').reverse().join('');
    return `MIND-${reversed}`;
  }

  function verifikasiLisensi(licenseKey) {
    if (!licenseKey) {
      return { valid: false, msg: 'Belum ada lisensi yang terpasang.' };
    }
    const payload = dekodePayloadLisensi(licenseKey);
    if (!payload) {
      return { valid: false, msg: '<b>Format License Key tidak valid!</b>' };
    }

    if (payload.salt !== SECRET_SALT) {
      return { valid: false, msg: 'License Key tidak dikenali!' };
    }

    const currentDevId = dapatkanDeviceID();
    if (payload.deviceId !== currentDevId) {
      return { valid: false, msg: 'License Key ini terikat pada perangkat lain!' };
    }

    const target = new Date();
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const hariIni = `${yyyy}-${mm}-${dd}`;

    if (hariIni > payload.expDate) {
      return { valid: false, msg: `Lisensi telah kadaluarsa pada (${formatTanggalIndo(payload.expDate)})` };
    }

    return {
      valid: true,
      expDate: payload.expDate,
      msg: `Lisensi aktif s/d : <b>${formatTanggalIndo(payload.expDate)}</b>`,
    };
  }

  function prosesAktivasiLisensi(keyBaru) {
    const savedKey = GM_getValue(LICENSE_STORAGE_KEY, '');
    let usedKeys = GM_getValue(USED_KEYS_STORAGE_KEY, []);

    if (typeof usedKeys === 'string') {
      try { usedKeys = JSON.parse(usedKeys); } catch (e) { usedKeys = []; }
    }

    if (usedKeys.includes(keyBaru) || keyBaru === savedKey) {
      const cekAktif = verifikasiLisensi(savedKey);
      return {
        valid: false,
        msg: `<b>LISENSI SUDAH PERNAH DIGUNAKAN!</b><br>Masa aktif Anda saat ini s/d : <b>${formatTanggalIndo(cekAktif.expDate)}</b>`,
        expDate: cekAktif.expDate
      };
    }

    const resBaru = verifikasiLisensi(keyBaru);
    if (!resBaru.valid) {
      return resBaru;
    }

    const payloadBaru = dekodePayloadLisensi(keyBaru);
    const resLama = verifikasiLisensi(savedKey);

    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);

    const expDateBaruObj = new Date(payloadBaru.expDate + 'T00:00:00');
    let durasiHariBaru = Math.round((expDateBaruObj.getTime() - hariIni.getTime()) / (1000 * 60 * 60 * 24));
    if (durasiHariBaru < 1) durasiHariBaru = 1;

    let baseDate = new Date(hariIni);
    let isAkumulasi = false;

    if (resLama.valid && resLama.expDate) {
      const expLamaDate = new Date(resLama.expDate + 'T00:00:00');
      if (expLamaDate >= hariIni) {
        baseDate = expLamaDate;
        isAkumulasi = true;
      }
    }

    baseDate.setDate(baseDate.getDate() + durasiHariBaru);

    const yyyy = baseDate.getFullYear();
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getDate()).padStart(2, '0');
    const expDateHasil = `${yyyy}-${mm}-${dd}`;

    const keyHasil = buatLicenseKey(expDateHasil, dapatkanDeviceID(), payloadBaru.client);

    GM_setValue(LICENSE_STORAGE_KEY, keyHasil);
    if (!usedKeys.includes(keyBaru)) usedKeys.push(keyBaru);
    if (!usedKeys.includes(keyHasil)) usedKeys.push(keyHasil);
    GM_setValue(USED_KEYS_STORAGE_KEY, JSON.stringify(usedKeys));

    const pesanInfo = isAkumulasi
      ? `Masa aktif lisensi bertambah ${durasiHariBaru} hari.<br>Lisensi aktif s/d : <b>${formatTanggalIndo(expDateHasil)}</b>`
      : `<b>AKTIVASI BERHASIL!</b> Lisensi aktif s/d : <b>${formatTanggalIndo(expDateHasil)}</b>`;

    return { valid: true, msg: pesanInfo, expDate: expDateHasil };
  }

  // ------------------------------------------------------------------
  // FUNGSI KOMUNIKASI API VERCEL <-> TOKOPAY
  // ------------------------------------------------------------------
  function ambilDaftarPaketVercel() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${VERCEL_API_URL}?action=get_packages`,
        onload: function (res) {
          try {
            const data = JSON.parse(res.responseText);
            const listPaket = data.packages || data.data || (Array.isArray(data) ? data : null);
            if (Array.isArray(listPaket) && listPaket.length > 0) {
              resolve(listPaket);
            } else {
              reject('Daftar paket kosong atau format tidak sesuai.');
            }
          } catch (e) {
            reject('Respon daftar paket dari Vercel tidak valid.');
          }
        },
        onerror: function () {
          reject('Gagal mengambil daftar paket dari server Vercel.');
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

  function cekStatusVercel(refId) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${VERCEL_API_URL}?ref_id=${encodeURIComponent(refId)}&metode=QRISREALTIME`,
        onload: function (res) {
          try {
            const data = JSON.parse(res.responseText);
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
    const btnBeli = document.getElementById('sipgn-btn-buy-qris');
    const qrContainer = document.getElementById('sipgn-qris-container');
    const wrapperPaket = document.getElementById('sipgn-wrapper-paket');

    if (qrContainer) { qrContainer.style.display = 'none'; qrContainer.innerHTML = ''; }
    if (wrapperPaket) wrapperPaket.style.display = 'block';
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
  }

  function perbaruiTampilanInfoModal() {
    const container = document.getElementById('sipgn-info-exp-container');
    if (!container) return;
    const currentDevId = dapatkanDeviceID();
    const savedKey = GM_getValue(LICENSE_STORAGE_KEY, '');
    const cekLisensi = verifikasiLisensi(savedKey);
    const infoExp = cekLisensi.valid ? `Lisensi Aktif s/d: <b>${formatTanggalIndo(cekLisensi.expDate)}</b>` : '';

    container.innerHTML = `
      <b>Device ID:</b><br><span id="sipgn-dev-id-text" style="font-size: 13px; font-weight: bold; color: #facc15;">${currentDevId}</span>
      ${infoExp ? `<br><span style="color: #4ade80; font-size: 10px; display:inline-block; margin-top:4px;">${infoExp}</span>` : ''}
    `;
  }

  function eksekusiSuksesPembayaran(jumlahHari, devId) {
    hentikanTimerDanPolling();

    const target = new Date();
    target.setDate(target.getDate() + jumlahHari);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const expDateTarget = `${yyyy}-${mm}-${dd}`;

    const autoKey = buatLicenseKey(expDateTarget, devId, 'AutoPayment');
    const hasilAktivasi = prosesAktivasiLisensi(autoKey);

    perbaruiTampilanInfoModal();

    const qrContainer = document.getElementById('sipgn-qris-container');
    const wrapperPaket = document.getElementById('sipgn-wrapper-paket');
    const btnBeli = document.getElementById('sipgn-btn-buy-qris');

    if (wrapperPaket) wrapperPaket.style.display = 'none';
    if (btnBeli) btnBeli.style.display = 'none';

    if (qrContainer) {
      qrContainer.style.display = 'block';
      qrContainer.innerHTML = `
        <div style="background: #064e3b; color: #a7f3d0; padding: 14px; border-radius: 8px; font-size: 12px; margin-top: 10px; border: 1px solid #047857; text-align: center;">
          🎉 <b>PEMBAYARAN BERHASIL!</b><br>
          <div style="margin-top: 6px; font-size: 11px; color: #e2e8f0;">
            ${hasilAktivasi.msg}
          </div>
        </div>
        <button id="sipgn-btn-close-success" style="width: 100%; margin-top: 10px; padding: 8px; border: none; border-radius: 6px; background: #2563eb; color: white; font-weight: bold; cursor: pointer; font-size: 11px;">
          Tutup & Lanjutkan Sesi
        </button>
      `;

      const btnTutup = document.getElementById('sipgn-btn-close-success');
      if (btnTutup) {
        btnTutup.onclick = () => {
          const modalLama = document.getElementById('sipgn-license-modal');
          if (modalLama) modalLama.remove();
          mulaiJalankanSkrip();
        };
      }
    }
  }

  async function prosesPembayaranOtomatis(jumlahHari) {
    const devId = dapatkanDeviceID();
    const refId = Math.floor(Math.random() * 16777215).toString(16).toUpperCase() + Date.now().toString().slice(-6);
    const btnBeli = document.getElementById('sipgn-btn-buy-qris');
    const qrContainer = document.getElementById('sipgn-qris-container');
    const wrapperPaket = document.getElementById('sipgn-wrapper-paket');

    hentikanTimerDanPolling();

    try {
      if (btnBeli) {
        btnBeli.disabled = true;
        btnBeli.textContent = '⏳ Memproses QRIS...';
      }

      const resOrder = await buatOrderVercel(jumlahHari, refId);
      const orderData = resOrder.data || resOrder;

      if (!orderData || (!orderData.qr_link && !orderData.pay_url && !orderData.qr_string)) {
        alert('Gagal membuat transaksi QRIS Tokopay.');
        if (btnBeli) {
          btnBeli.disabled = false;
          btnBeli.textContent = '💳 Bayar via QRIS';
        }
        return;
      }

      const qrData = orderData.qr_string || orderData.qr_link || orderData.pay_url;
      const nominalPembayaran = orderData.total_bayar || orderData.nominal || orderData.price || orderData.total || null;

      if (wrapperPaket) wrapperPaket.style.display = 'none';
      if (btnBeli) btnBeli.style.display = 'none';

      if (qrContainer) {
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
        const teksNominal = nominalPembayaran ? `Rp ${Number(nominalPembayaran).toLocaleString('id-ID')}` : '-';

        qrContainer.style.display = 'block';
        qrContainer.innerHTML = `
          <div style="background: white; padding: 10px; border-radius: 8px; display: inline-block; margin: 8px 0;">
            <img src="${qrImgUrl}" alt="QRIS Tokopay" style="width: 180px; height: 180px; display: block; margin: 0 auto;" />
          </div>
          <div style="font-size: 10px; color: #cbd5e1; margin-bottom: 10px;">
            Total Pembayaran:</br><b style="color: #4ade80; font-size: 20px;">${teksNominal}</b></br>
          </div>
          <div style="font-size: 11px; color: #facc15; font-weight: bold; margin-top: 4px;">
            Selesaikan pembayaran dalam waktu:
          </div>
          <div id="sipgn-timer-display" style="font-size: 18px; font-weight: bold; color: #ef4444; margin-top: 2px; margin-bottom: 6px;">
            10:00
          </div>
          <button id="sipgn-btn-cancel-qris" style="width: 100%; padding: 6px; border: none; border-radius: 6px; background: #991b1b; color: #fecaca; font-weight: bold; cursor: pointer; font-size: 11px;">
            ❌ Batalkan Pembayaran
          </button>
        `;

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
          if (wrapperPaket) wrapperPaket.style.display = 'block';
          if (qrContainer) {
            qrContainer.innerHTML = `
              <div style="background: #7f1d1d; color: #fecaca; padding: 10px; border-radius: 6px; font-size: 11px; margin-top: 8px; border: 1px solid #991b1b;">
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

      intervalPollingPembayaran = setInterval(async () => {
        try {
          const resStatus = await cekStatusVercel(refId);
          const statusVal = resStatus?.data?.status || resStatus?.status;
          const dumpString = JSON.stringify(resStatus || {}).toLowerCase();

          const isLunas =
            statusVal === 'Success' ||
            dumpString.includes('"status":"success"') ||
            dumpString.includes('success') ||
            dumpString.includes('paid') ||
            dumpString.includes('settlement');

          if (isLunas) {
            eksekusiSuksesPembayaran(jumlahHari, devId);
          }
        } catch (e) {
          console.warn('[Autofill] Polling API terganggu:', e);
        }
      }, 3000);

    } catch (err) {
      alert('Error: ' + err);
      if (wrapperPaket) wrapperPaket.style.display = 'block';
      if (btnBeli) {
        btnBeli.disabled = false;
        btnBeli.textContent = '💳 Bayar via QRIS';
      }
    }
  }

  function muatDaftarPaketKeSelect(selectEl, btnBeliEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">⏳ Memuat paket dari server...</option>';
    if (btnBeliEl) btnBeliEl.disabled = true;

    ambilDaftarPaketVercel()
      .then((daftarPaket) => {
        selectEl.innerHTML = '';
        daftarPaket.forEach((p, idx) => {
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

  function tampilkanModalAktivasi(pesanPeringatan = '', bisaDitutup = true, isBerhasil = false) {
    try {
      const modalLama = document.getElementById('sipgn-license-modal');
      if (modalLama) modalLama.remove();

      const currentDevId = dapatkanDeviceID();
      const savedKey = GM_getValue(LICENSE_STORAGE_KEY, '');
      const cekLisensi = verifikasiLisensi(savedKey);
      const infoExp = cekLisensi.valid ? `Masa Aktif s/d: <b>${formatTanggalIndo(cekLisensi.expDate)}</b>` : '';

      const overlay = document.createElement('div');
      overlay.id = 'sipgn-license-modal';
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(11, 30, 63, 0.88); backdrop-filter: blur(4px);
        z-index: 999999; display: flex; align-items: center; justify-content: center;
        font-family: sans-serif;
      `;

      overlay.innerHTML = `
        <div style="position: relative; background: #0f172a; border: 1px solid #334155; color: white; padding: 24px; border-radius: 12px; width: 350px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          ${
            bisaDitutup
              ? `<button id="sipgn-btn-close-x" style="position: absolute; top: 10px; right: 12px; background: transparent; border: none; color: #94a3b8; font-size: 18px; font-weight: bold; cursor: pointer;">✕</button>`
              : ''
          }
          <h3 style="margin-top:0; font-size: 18px; font-weight: bold; color: #f8fafc;">Pengaturan Lisensi SIPGN</h3>
          <p style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">Pilih metode aktivasi atau perpanjangan lisensi Anda.</p>

          <div id="sipgn-info-exp-container" style="background: #1e293b; padding: 8px; border-radius: 6px; font-size: 11px; margin-bottom: 12px; border: 1px solid #334155; color: #38bdf8; word-break: break-all;">
            <b>Device ID:</b><br><span id="sipgn-dev-id-text" style="font-size: 13px; font-weight: bold; color: #facc15;">${currentDevId}</span>
            ${infoExp ? `<br><span style="color: #4ade80; font-size: 10px; display:inline-block; margin-top:4px;">${infoExp}</span>` : ''}
          </div>

          ${
            pesanPeringatan
              ? `<div style="background: ${isBerhasil ? '#064e3b' : '#7f1d1d'}; color: ${isBerhasil ? '#a7f3d0' : '#fecaca'}; padding: 8px; border-radius: 6px; font-size: 11px; margin-bottom: 12px; border: 1px solid ${isBerhasil ? '#047857' : '#991b1b'};">
                  ${pesanPeringatan}
                 </div>`
              : ''
          }

          <div style="display: flex; gap: 6px; margin-bottom: 12px;">
            <button id="sipgn-tab-btn-qris" style="flex: 1; padding: 8px 4px; border: none; border-radius: 6px; background: #059669; color: white; font-weight: bold; cursor: pointer; font-size: 10px;">
              💳 Beli / Topup Otomatis (QRIS)
            </button>
            <button id="sipgn-tab-btn-manual" style="flex: 1; padding: 8px 4px; border: none; border-radius: 6px; background: #334155; color: #cbd5e1; font-weight: bold; cursor: pointer; font-size: 10px;">
              🔑 Input License Key
            </button>
          </div>

          <div id="sipgn-sec-qris" style="display: block; background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 10px;">
            <div id="sipgn-wrapper-paket">
              <label style="display: block; font-size: 11px; color: #cbd5e1; margin-bottom: 6px; text-align: left;">Pilih Paket Durasi:</label>
              <select id="sipgn-select-paket" style="width: 100%; padding: 7px; border-radius: 5px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 11px; margin-bottom: 8px;">
                <option value="">⏳ Memuat paket...</option>
              </select>
            </div>

            <button id="sipgn-btn-buy-qris" style="width: 100%; padding: 9px; border: none; border-radius: 6px; background: #10b981; color: white; font-weight: bold; cursor: pointer; font-size: 11px;">
              💳 Bayar via QRIS
            </button>

            <div id="sipgn-qris-container" style="display: none; text-align: center;"></div>
          </div>

          <div id="sipgn-sec-manual" style="display: none; background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 10px;">
            <textarea id="sipgn-key-input" placeholder="Tempel License Key (MIND-...) di sini"
                      style="width: 100%; height: 50px; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #38bdf8; margin-bottom: 8px; text-align: center; font-family: monospace; font-size: 11px; resize: none;"></textarea>

            <button id="sipgn-btn-activate" style="width: 100%; padding: 9px; border: none; border-radius: 6px; background: #2563eb; color: white; font-weight: bold; cursor: pointer; font-size: 11px;">
              Aktivasi Lisensi Manual
            </button>
          </div>

          <div style="margin-top: 12px; font-size: 10px; color: #64748b;">© 2026 - <b>Mindspace Studio</b></div>
        </div>
      `;

      document.body.appendChild(overlay);

      const btnTabQris = document.getElementById('sipgn-tab-btn-qris');
      const btnTabManual = document.getElementById('sipgn-tab-btn-manual');
      const secQris = document.getElementById('sipgn-sec-qris');
      const secManual = document.getElementById('sipgn-sec-manual');
      const selectPaket = document.getElementById('sipgn-select-paket');
      const btnBeli = document.getElementById('sipgn-btn-buy-qris');

      muatDaftarPaketKeSelect(selectPaket, btnBeli);

      btnTabQris.onclick = () => {
        secQris.style.display = 'block';
        secManual.style.display = 'none';
        btnTabQris.style.background = '#059669';
        btnTabQris.style.color = 'white';
        btnTabManual.style.background = '#334155';
        btnTabManual.style.color = '#cbd5e1';
      };

      btnTabManual.onclick = () => {
        secQris.style.display = 'none';
        secManual.style.display = 'block';
        btnTabManual.style.background = '#2563eb';
        btnTabManual.style.color = 'white';
        btnTabQris.style.background = '#334155';
        btnTabQris.style.color = '#cbd5e1';
      };

      if (bisaDitutup || isBerhasil) {
        const btnCloseX = document.getElementById('sipgn-btn-close-x');
        if (btnCloseX) {
          btnCloseX.onclick = () => {
            hentikanTimerDanPolling();
            overlay.remove();
          };
        }
      }

      document.getElementById('sipgn-btn-activate').onclick = () => {
        const inputKey = document.getElementById('sipgn-key-input');
        const key = inputKey.value.trim();
        const res = prosesAktivasiLisensi(key);

        if (res.valid) {
          perbaruiTampilanInfoModal();
          tampilkanModalAktivasi(res.msg, true, true);
          mulaiJalankanSkrip();
        } else {
          tampilkanModalAktivasi(res.msg, true, false);
        }
      };

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

  // ------------------------------------------------------------------
  // CORE LOGIC FORM FILLER & SPINNER
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
      Version: '1.5.17',
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
    } catch (e) { /* abaikan */ }
    try {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    } catch (e) { /* abaikan */ }
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    } catch (e) { /* abaikan */ }
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

  function buatFormInput(labelTeks, idInput, placeholder = '') {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom: 6px;';
    const label = document.createElement('label');
    label.textContent = labelTeks;
    label.style.cssText = 'display:block; font-size: 11px; margin-bottom: 2px; color: #cbd5e1;';
    const input = document.createElement('input');
    input.id = idInput;
    input.placeholder = placeholder;
    input.style.cssText = `
      width: 100%; box-sizing: border-box; padding: 6px; border-radius: 5px;
      border: 1px solid #334155; font-size: 12px; background: #0f172a; color: white;
    `;
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return wrapper;
  }

  function isiFormDenganData(data) {
    document.getElementById('sipgn-in-sekolah').value = data?.sekolah || '';
    document.getElementById('sipgn-in-ritase').value = data?.ritase || '';
    document.getElementById('sipgn-in-batasWaktu').value = data?.batasWaktu || '';
    document.getElementById('sipgn-in-porsiBesar').value = data?.porsiBesar || '';
    document.getElementById('sipgn-in-porsiKecil').value = data?.porsiKecil || '';
    document.getElementById('sipgn-in-porsiBalita').value = data?.porsiBalita || '';
    document.getElementById('sipgn-in-porsiIbuMenyusui').value = data?.porsiIbuMenyusui || '';
    document.getElementById('sipgn-in-porsiIbuHamil').value = data?.porsiIbuHamil || '';
    document.getElementById('sipgn-in-namaKurir').value = data?.namaKurir || '';
    document.getElementById('sipgn-in-platNomor').value = data?.platNomor || '';
    document.getElementById('sipgn-in-jamKeberangkatan').value = data?.jamKeberangkatan || '';
    document.getElementById('sipgn-in-jamTibaTujuan').value = data?.jamTibaTujuan || '';
    document.getElementById('sipgn-in-jamJadwalPengambilan').value = data?.jamJadwalPengambilan || '';
    document.getElementById('sipgn-in-jamOmprengKembaliSPPG').value = data?.jamOmprengKembaliSPPG || '';
    document.getElementById('sipgn-in-jamMulaiCuci').value = data?.jamMulaiCuci || '';
  }

  function simpanFormData() {
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

    if (indexSedangDiedit !== null) {
      dataForm.terpakai = dataPenugasan[indexSedangDiedit].terpakai;
      dataPenugasan[indexSedangDiedit] = dataForm;
      indexTerpilih = indexSedangDiedit;
    } else {
      dataForm.terpakai = false;
      dataPenugasan.push(dataForm);
      indexTerpilih = dataPenugasan.length - 1;
    }

    simpanData(dataPenugasan);
    indexSedangDiedit = null;
    renderPanel();
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
        position: fixed; top: 80px; right: 20px; z-index: 99999;
        background: #0b1e3f; color: white; padding: 12px;
        border-radius: 10px; font-family: sans-serif; font-size: 13px;
        width: 270px; max-height: 85vh; overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;

      const halamanTugasBaru = cekHalamanTugasBaru();

      const judul = document.createElement('div');
      judul.textContent = 'SIPGN - Autofill Script';
      judul.style.cssText = 'margin-top: 5px; font-weight: bold; text-align: center; font-size: 18px;';
      panel.appendChild(judul);

      const deskripsi = document.createElement('div');
      deskripsi.textContent = 'Latest Version : v1.5.17';
      deskripsi.style.cssText = 'margin-bottom: 8px; text-align: center; font-size: 10px; color: #38bdf8;';
      panel.appendChild(deskripsi);

      const garis2 = document.createElement('hr');
      garis2.style.cssText = 'border-color: #334155; margin: 10px 0;';
      panel.appendChild(garis2);

      const indikatorHalaman = document.createElement('div');
      indikatorHalaman.textContent = halamanTugasBaru
        ? '📍 Halaman: Buat Penugasan'
        : '📍 Halaman: Detail Distribusi';
      indikatorHalaman.style.cssText = 'font-size: 10px; color: #94a3b8; margin-bottom: 10px;';
      panel.appendChild(indikatorHalaman);

      function jenisKPM(data) {
        return (data.porsiBalita || data.porsiIbuMenyusui || data.porsiIbuHamil) ? 'posyandu' : 'sekolah';
      }

      function teksOpsi(data) {
        return `${data.terpakai ? '✅ ' : ''}${data.sekolah}${data.terpakai ? ' (sudah digunakan)' : ''}`;
      }

      let selectSekolah = null;
      let selectPosyandu = null;

      function buatSelectKPM(labelTeks, jenisTarget) {
        const labelSelect = document.createElement('div');
        labelSelect.textContent = labelTeks;
        labelSelect.style.cssText = 'font-size: 10px; color: #94a3b8; margin-bottom: 2px;';
        panel.appendChild(labelSelect);

        const sel = document.createElement('select');
        sel.style.cssText = `
          width: 100%; padding: 6px; border-radius: 5px; margin-bottom: 8px;
          border: 1px solid #334155; font-size: 12px; background: white; color: #0f172a;
        `;
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
          placeholder.textContent = `(belum ada data ${labelTeks})`;
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

      const barisBackup = document.createElement('div');
      barisBackup.style.cssText = 'display: flex; gap: 4px; margin-bottom: 8px;';
      const tombolDownload = document.createElement('button');
      tombolDownload.textContent = '↓ Download Backup';
      tombolDownload.style.cssText = `
        flex: 1; padding: 6px; border: none; border-radius: 6px;
        background: #475569; color: white; cursor: pointer; font-size: 10px;
      `;
      tombolDownload.onclick = downloadBackupData;

      const inputImport = document.createElement('input');
      inputImport.type = 'file';
      inputImport.accept = 'application/json,.json';
      inputImport.style.display = 'none';
      inputImport.onchange = () => {
        importBackupData(inputImport.files?.[0]);
        inputImport.value = '';
      };
      const tombolImport = document.createElement('button');
      tombolImport.textContent = '↑ Import Backup';
      tombolImport.style.cssText = `
        flex: 1; padding: 6px; border: none; border-radius: 6px;
        background: #475569; color: white; cursor: pointer; font-size: 10px;
      `;
      tombolImport.onclick = () => inputImport.click();
      barisBackup.appendChild(tombolDownload);
      barisBackup.appendChild(tombolImport);
      panel.appendChild(barisBackup);
      panel.appendChild(inputImport);

      const jumlahKPMTerpakai = dataPenugasan.filter((d) => d.terpakai).length;
      const tombolHapusSemuaTanda = document.createElement('button');
      tombolHapusSemuaTanda.textContent = `Hapus Semua Tanda${jumlahKPMTerpakai > 0 ? ` (${jumlahKPMTerpakai})` : ''}`;
      tombolHapusSemuaTanda.disabled = jumlahKPMTerpakai === 0;
      tombolHapusSemuaTanda.style.cssText = `
        width: 100%; padding: 6px; border: none; border-radius: 6px;
        background: ${jumlahKPMTerpakai > 0 ? '#334155' : '#1e293b'};
        color: ${jumlahKPMTerpakai > 0 ? 'white' : '#64748b'};
        cursor: ${jumlahKPMTerpakai > 0 ? 'pointer' : 'not-allowed'};
        font-size: 10px; margin-bottom: 8px;
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
        barisPenugasan.style.cssText = 'display: flex; margin-bottom: 6px;';
        const tombolPenugasan = document.createElement('button');
        tombolPenugasan.textContent = 'Isi Penugasan';
        tombolPenugasan.disabled = !bisaIsiPenugasan;
        tombolPenugasan.style.cssText = `
          width: 100%; padding: 8px; border: none; border-radius: 6px;
          background: ${bisaIsiPenugasan ? '#6d28d9' : '#475569'}; color: white;
          cursor: ${bisaIsiPenugasan ? 'pointer' : 'not-allowed'}; font-size: 11px;
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
        barisJam.style.cssText = 'display: flex; gap: 4px; margin-bottom: 6px;';

        if (adaWaktuKeberangkatan) {
          const tombolJam = document.createElement('button');
          tombolJam.textContent = 'Set Jam Berangkat';
          tombolJam.disabled = !bisaSetJam;
          tombolJam.style.cssText = `
            flex: 1; padding: 8px; border: none; border-radius: 6px;
            background: ${bisaSetJam ? '#0e7490' : '#475569'}; color: white;
            cursor: ${bisaSetJam ? 'pointer' : 'not-allowed'}; font-size: 11px;
          `;
          tombolJam.onclick = async () => {
            if (!bisaSetJam) return;
            tombolJam.disabled = true;
            tombolJam.textContent = 'Mengatur...';
            const berhasil = await aturWaktuKeberangkatan(dataPenugasan[indexTerpilih]?.jamKeberangkatan, 'Waktu Keberangkatan');
            tombolJam.textContent = berhasil ? 'Jam Tersimpan' : 'Gagal Set Jam';
            await wait(1200);
            tombolJam.textContent = 'Set Jam Berangkat';
            tombolJam.disabled = !bisaSetJam;
          };
          barisJam.appendChild(tombolJam);
        }

        if (adaWaktuDiterima) {
          const tombolJamTiba = document.createElement('button');
          tombolJamTiba.textContent = 'Set Jam Tiba';
          tombolJamTiba.disabled = !bisaSetJamTiba;
          tombolJamTiba.style.cssText = `
            flex: 1; padding: 8px; border: none; border-radius: 6px;
            background: ${bisaSetJamTiba ? '#15803d' : '#475569'}; color: white;
            cursor: ${bisaSetJamTiba ? 'pointer' : 'not-allowed'}; font-size: 11px;
          `;
          tombolJamTiba.onclick = async () => {
            if (!bisaSetJamTiba) return;
            tombolJamTiba.disabled = true;
            tombolJamTiba.textContent = 'Mengatur...';
            const berhasil = await aturWaktuKeberangkatan(
              dataPenugasan[indexTerpilih]?.jamTibaTujuan,
              'Waktu Diterima di Tujuan'
            );
            tombolJamTiba.textContent = berhasil ? 'Jam Tiba Tersimpan' : 'Gagal Set Jam';
            await wait(1200);
            tombolJamTiba.textContent = 'Set Jam Tiba';
            tombolJamTiba.disabled = !bisaSetJamTiba;
          };
          barisJam.appendChild(tombolJamTiba);
        }

        panel.appendChild(barisJam);
      }

      if (adaFormPengambilan) {
        const barisPengambilan = document.createElement('div');
        barisPengambilan.style.cssText = 'display: flex; margin-bottom: 6px;';
        const tombolPengambilan = document.createElement('button');
        tombolPengambilan.textContent = 'Isi Pengambilan Ompreng';
        tombolPengambilan.disabled = !bisaIsiPengambilan;
        tombolPengambilan.style.cssText = `
          width: 100%; padding: 8px; border: none; border-radius: 6px;
          background: ${bisaIsiPengambilan ? '#7c3aed' : '#475569'}; color: white;
          cursor: ${bisaIsiPengambilan ? 'pointer' : 'not-allowed'}; font-size: 11px;
        `;
        tombolPengambilan.onclick = async () => {
          if (!bisaIsiPengambilan) return;
          tombolPengambilan.disabled = true;
          tombolPengambilan.textContent = 'Mengisi...';
          const berhasil = await isiPengambilanOmpreng(indexTerpilih);
          tombolPengambilan.textContent = berhasil ? 'Pengambilan Terisi' : 'Gagal Mengisi';
          await wait(1200);
          tombolPengambilan.textContent = 'Isi Pengambilan Ompreng';
          tombolPengambilan.disabled = !bisaIsiPengambilan;
        };
        barisPengambilan.appendChild(tombolPengambilan);
        panel.appendChild(barisPengambilan);
      }

      if (adaWaktuKembaliSPPG) {
        const barisWaktuKembali = document.createElement('div');
        barisWaktuKembali.style.cssText = 'display: flex; margin-bottom: 6px;';
        const tombolWaktuKembali = document.createElement('button');
        tombolWaktuKembali.textContent = 'Set Ompreng Kembali';
        tombolWaktuKembali.disabled = !bisaSetWaktuKembali;
        tombolWaktuKembali.style.cssText = `
          width: 100%; padding: 8px; border: none; border-radius: 6px;
          background: ${bisaSetWaktuKembali ? '#0f766e' : '#475569'}; color: white;
          cursor: ${bisaSetWaktuKembali ? 'pointer' : 'not-allowed'}; font-size: 11px;
        `;
        tombolWaktuKembali.onclick = async () => {
          if (!bisaSetWaktuKembali) return;
          tombolWaktuKembali.disabled = true;
          tombolWaktuKembali.textContent = 'Mengatur...';
          const berhasil = await aturWaktuKeberangkatan(
            dataPenugasan[indexTerpilih]?.jamOmprengKembaliSPPG,
            'Waktu Ompreng Kembali di SPPG'
          );
          tombolWaktuKembali.textContent = berhasil ? 'Waktu Kembali Tersimpan' : 'Gagal Set Waktu';
          await wait(1200);
          tombolWaktuKembali.textContent = 'Set Ompreng Kembali';
          tombolWaktuKembali.disabled = !bisaSetWaktuKembali;
        };
        barisWaktuKembali.appendChild(tombolWaktuKembali);
        panel.appendChild(barisWaktuKembali);
      }

      if (adaFormPencucian) {
        const barisPencucian = document.createElement('div');
        barisPencucian.style.cssText = 'display: flex; margin-bottom: 6px;';
        const tombolPencucian = document.createElement('button');
        tombolPencucian.textContent = 'Isi Mulai Pencucian';
        tombolPencucian.disabled = !bisaIsiPencucian;
        tombolPencucian.style.cssText = `
          width: 100%; padding: 8px; border: none; border-radius: 6px;
          background: ${bisaIsiPencucian ? '#0369a1' : '#475569'}; color: white;
          cursor: ${bisaIsiPencucian ? 'pointer' : 'not-allowed'}; font-size: 11px;
        `;
        tombolPencucian.onclick = async () => {
          if (!bisaIsiPencucian) return;
          tombolPencucian.disabled = true;
          tombolPencucian.textContent = 'Mengisi...';
          const berhasil = await isiMulaiPencucian(indexTerpilih);
          tombolPencucian.textContent = berhasil ? 'Pencucian Terisi' : 'Gagal Mengisi';
          await wait(1200);
          tombolPencucian.textContent = 'Isi Mulai Pencucian';
          tombolPencucian.disabled = !bisaIsiPencucian;
        };
        barisPencucian.appendChild(tombolPencucian);
        panel.appendChild(barisPencucian);
      }

      const barisAksi = document.createElement('div');
      barisAksi.style.cssText = 'display: flex; gap: 4px; margin-bottom: 6px;';

      const tombolEdit = document.createElement('button');
      tombolEdit.textContent = 'Edit Data Sekolah';
      tombolEdit.disabled = indexTerpilih < 0;
      tombolEdit.style.cssText = `
        flex: 1; padding: 8px; border: none; border-radius: 6px;
        background: #1e3a8a; color: white; cursor: pointer; font-size: 12px;
      `;
      tombolEdit.onclick = () => {
        indexSedangDiedit = indexTerpilih;
        isiFormDenganData(dataPenugasan[indexTerpilih]);
        formWrapper.style.display = 'block';
        tombolToggleForm.textContent = 'Batal Edit';
        tombolSimpanData.textContent = 'Update Data';
      };

      const tombolHapus = document.createElement('button');
      tombolHapus.textContent = 'Hapus Data';
      tombolHapus.disabled = indexTerpilih < 0;
      tombolHapus.style.cssText = `
        padding: 8px; border: none; border-radius: 6px;
        background: #7f1d1d; color: white; cursor: pointer; font-size: 12px;
      `;
      tombolHapus.onclick = hapusDataTerpilih;

      barisAksi.appendChild(tombolEdit);
      barisAksi.appendChild(tombolHapus);
      panel.appendChild(barisAksi);

      if (indexTerpilih >= 0 && dataPenugasan[indexTerpilih]?.terpakai) {
        const tombolReset = document.createElement('button');
        tombolReset.textContent = 'Tandai Belum Dipakai';
        tombolReset.style.cssText = `
          width: 100%; padding: 6px; border: none; border-radius: 6px;
          background: #334155; color: white; cursor: pointer; font-size: 11px; margin-bottom: 8px;
        `;
        tombolReset.onclick = () => tandaiUlangStatus(false);
        panel.appendChild(tombolReset);
      }

      const garis = document.createElement('hr');
      garis.style.cssText = 'border-color: #334155; margin: 10px 0;';
      panel.appendChild(garis);

      var tombolToggleForm = document.createElement('button');
      tombolToggleForm.textContent = '+ Tambah Data Sekolah / 3B';
      tombolToggleForm.style.cssText = `
        width: 100%; padding: 8px; border: none; border-radius: 6px;
        background: #1e3a8a; color: white; cursor: pointer; font-size: 12px; margin-bottom: 8px;
      `;

      var formWrapper = document.createElement('div');
      formWrapper.style.display = 'none';

      formWrapper.appendChild(buatFormInput('Nama Sekolah/KPM', 'sipgn-in-sekolah', 'SMAN 1 MEDAN'));
      formWrapper.appendChild(buatFormInput('Ritase', 'sipgn-in-ritase', '1'));
      formWrapper.appendChild(buatFormInput('Batas Waktu (HH:MM)', 'sipgn-in-batasWaktu', '10:00'));
      formWrapper.appendChild(buatFormInput('Porsi Besar (KPM Sekolah)', 'sipgn-in-porsiBesar', '5'));
      formWrapper.appendChild(buatFormInput('Porsi Kecil (KPM Sekolah)', 'sipgn-in-porsiKecil', '5'));
      formWrapper.appendChild(buatFormInput('Porsi Balita (KPM Posyandu)', 'sipgn-in-porsiBalita', '0'));
      formWrapper.appendChild(buatFormInput('Porsi Ibu Menyusui (KPM Posyandu)', 'sipgn-in-porsiIbuMenyusui', '0'));
      formWrapper.appendChild(buatFormInput('Porsi Ibu Hamil (KPM Posyandu)', 'sipgn-in-porsiIbuHamil', '0'));
      formWrapper.appendChild(buatFormInput('Nama Kurir', 'sipgn-in-namaKurir', 'Budiawan Sutarjo'));
      formWrapper.appendChild(buatFormInput('Plat Nomor', 'sipgn-in-platNomor', 'BK1234ABC'));
      formWrapper.appendChild(buatFormInput('Jam Keberangkatan (HH:MM)', 'sipgn-in-jamKeberangkatan', '10:00'));
      formWrapper.appendChild(buatFormInput('Waktu Tiba di Tujuan (HH:MM)', 'sipgn-in-jamTibaTujuan', '10:30'));
      formWrapper.appendChild(buatFormInput('Jadwal Pengambilan Ompreng (HH:MM)', 'sipgn-in-jamJadwalPengambilan', '11:00'));
      formWrapper.appendChild(buatFormInput('Waktu Ompreng Kembali di SPPG (HH:MM)', 'sipgn-in-jamOmprengKembaliSPPG', '12:00'));
      formWrapper.appendChild(buatFormInput('Waktu Mulai Cuci (HH:MM)', 'sipgn-in-jamMulaiCuci', '12:30'));

      var tombolSimpanData = document.createElement('button');
      tombolSimpanData.textContent = indexSedangDiedit !== null ? 'Update Data' : 'Simpan Data';
      tombolSimpanData.style.cssText = `
        width: 100%; padding: 8px; border: none; border-radius: 6px;
        background: #15803d; color: white; cursor: pointer; font-size: 12px; margin-top: 4px; margin-bottom: 5px;
      `;
      tombolSimpanData.onclick = simpanFormData;
      formWrapper.appendChild(tombolSimpanData);

      tombolToggleForm.onclick = () => {
        const sedangTerbuka = formWrapper.style.display === 'block';
        if (sedangTerbuka) {
          formWrapper.style.display = 'none';
          indexSedangDiedit = null;
          tombolToggleForm.textContent = '+ Tambah Data Sekolah / 3B';
        } else {
          indexSedangDiedit = null;
          isiFormDenganData(null);
          formWrapper.style.display = 'block';
          tombolToggleForm.textContent = 'Tutup Form';
          tombolSimpanData.textContent = 'Simpan Data';
        }
      };

      panel.appendChild(tombolToggleForm);
      panel.appendChild(formWrapper);

      const tombolLisensi = document.createElement('button');
      tombolLisensi.textContent = '🔑 Pengaturan Lisensi / Top-Up';
      tombolLisensi.style.cssText = `
        width: 100%; padding: 6px; border: none; border-radius: 6px;
        background: #334155; color: white; cursor: pointer; font-size: 11px; margin-top: 4px; margin-bottom: 8px;
      `;
      tombolLisensi.onclick = () => {
        tampilkanModalAktivasi('', true);
      };
      panel.appendChild(tombolLisensi);

      const footer = document.createElement('div');
      footer.style.cssText = `margin-top: 5px; margin-bottom: 5px; font-size: 10px; text-align: center; color: #64748b;`;
      footer.innerHTML = '© 2026 - <b>Mindspace Studio</b>';
      panel.appendChild(footer);

      document.body.appendChild(panel);
    } catch (e) {
      console.error('[Autofill] Gagal merender panel UI:', e);
    }
  }

  function inialisasiSistem() {
    try {
      const savedKey = GM_getValue(LICENSE_STORAGE_KEY, '');
      const res = verifikasiLisensi(savedKey);

      if (!res.valid) {
        tampilkanModalAktivasi(savedKey ? res.msg : '', false);
        return;
      }

      mulaiJalankanSkrip();
    } catch (e) {
      console.error('[Autoflog] Gagal inisialisasi, membuka modal aktivasi:', e);
      tampilkanModalAktivasi('', false);
    }
  }

  setTimeout(() => {
    inialisasiSistem();
  }, 500);
})();
