# duitw — Android (Capacitor)

Aplikasi duitw dibangun dari source web asli (`index.html`, `styles.css`, `app.js`) dan dijalankan dari aset lokal di Android WebView. Tidak ada URL website eksternal, backend, CDN, atau request jaringan yang diperlukan untuk fitur utama.

## Isi proyek

- `index.html`, `styles.css`, `app.js` — UI dan logika web asli; desain dan fitur dipertahankan.
- `native-bridge-src.js` — integrasi native Capacitor untuk status bar, tombol Back Android, dan ekspor file.
- `capacitor.config.json` — app ID, nama, direktori web, splash screen, dan status bar.
- `scripts/build.mjs` — menyiapkan bundle web offline ke `www/`.
- `scripts/patch-android.mjs` — menerapkan ikon launcher, warna system bar, dan konfigurasi keyboard ke proyek Android hasil generate Capacitor.
- `assets/` — ikon dan aset Android.
- `.github/workflows/build.yml` — build APK otomatis dan upload artifact.

## Build APK dengan GitHub Actions

1. Buat repository GitHub baru dan upload seluruh isi folder proyek ini.
2. Pastikan workflow Actions diizinkan pada repository (tab **Actions**).
3. Buka **Actions → Build duitw Android APK**.
4. Pilih **Run workflow** untuk build manual, atau push ke branch `main`/`master`.
5. Setelah job selesai, buka bagian **Artifacts** pada run tersebut dan unduh `duitw-apk`.
6. Ekstrak artifact untuk memperoleh file `duitw.apk`, lalu instal pada perangkat Android.

Workflow melakukan instalasi dependency, menyiapkan web bundle lokal, menghasilkan proyek Android Capacitor, menyinkronkan plugin, menerapkan resource Android, menjalankan Gradle `assembleDebug`, lalu mengunggah `release/duitw.apk`.

APK yang dihasilkan adalah **debug APK** yang dapat dipasang untuk pengujian/pemakaian langsung. Workflow menyimpan debug keystore melalui GitHub Actions cache agar signature tetap konsisten antar-build dan update APK dapat dipasang di atas versi sebelumnya. Jika cache dihapus/tereviksi, APK baru mungkin perlu dipasang ulang setelah backup data. Untuk distribusi Play Store atau rilis publik, buat signing key release dan tambahkan proses signing release secara terpisah; jangan menyimpan keystore atau password di source code.

## Build lokal

Persyaratan: Node.js 22, Java 21, Android SDK (platform/build-tools yang dibutuhkan Gradle), dan koneksi internet saat pertama kali memasang dependency.

```bash
npm install
npm test
npm run build
npx cap add android
npx cap sync android
node scripts/patch-android.mjs
cd android
./gradlew assembleDebug
```

Hasil: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Konfigurasi Android

- Nama aplikasi: `duitw`
- Application ID / package: `id.duitw.app`
- Web runtime: Capacitor Android WebView dengan `webDir: www`
- UI dimuat dari file aplikasi lokal, bukan remote URL.
- Splash screen menggunakan warna dasar `#070b12`.
- Status bar dan navigation bar menggunakan warna gelap yang menyatu dengan UI.
- Keyboard memakai `adjustResize`; CSS mempertahankan safe area Android.
- Tombol Back Android menutup dialog aktif, kembali ke Dashboard, lalu keluar aplikasi bila sudah di Dashboard.

## Offline dan penyimpanan

- Seluruh HTML, CSS, JavaScript, ikon, dan bridge dibundel ke `www/` dan dimuat lokal.
- Data keuangan disimpan di `localStorage` WebView dengan key `duitw_v1`. Data tetap ada setelah aplikasi ditutup atau perangkat direstart, dan tidak dihapus oleh proses update normal selama application ID dan data app tetap sama.
- Tidak ada database/server eksternal atau CDN.
- Backup JSON dan ekspor CSV menggunakan native share sheet Android agar file dapat disimpan/dibagikan. Restore menggunakan pemilih file JSON.
- Selalu simpan backup sebelum uninstall aplikasi atau menghapus data aplikasi; tindakan tersebut dapat menghapus penyimpanan lokal Android.

## Aturan saldo yang dipertahankan

- Transfer dan tarik tunai memindahkan saldo antar rekening, bukan pemasukan/pengeluaran.
- Piutang baru mengurangi saldo rekening dan menambah aset piutang; pembayaran piutang menambah saldo dan mengurangi sisa piutang.
- Kewajiban baru mengikuti model sumber web: dana kewajiban masuk ke rekening, tetapi tidak dihitung sebagai pemasukan; pembayaran kewajiban mengurangi saldo dan dicatat sebagai pengeluaran.
- Pembayaran piutang/kewajiban dihubungkan ke satu data utang/piutang melalui `linkedDebtId`, sehingga sisa dihitung dari pembayaran terkait dan tidak menggandakan transaksi pembuka.

## Pengujian dan batas verifikasi

`npm test` memeriksa sintaks JavaScript dan skrip build/patch. Workflow GitHub Actions menjadi jalur build Android yang sebenarnya. Build APK dan uji perangkat/emulator perlu dijalankan pada runner Android atau perangkat Android; lingkungan pembuatan source ini tidak menyediakan Android SDK/Gradle, sehingga APK biner tidak dapat diklaim sudah berhasil dibangun di sini.

Fitur PDF tetap menggunakan dialog print WebView (`window.print()`); ketersediaan dialog print dapat berbeda menurut versi Android WebView. Uji fungsi print pada perangkat target sebelum distribusi.
