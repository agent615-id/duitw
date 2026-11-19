# duitw — Android + Capacitor

Aplikasi pencatatan keuangan pribadi offline. Source web asli (`index.html`, `styles.css`, `app.js`) dipertahankan; Capacitor membungkusnya menjadi aplikasi Android.

## Fitur yang dipertahankan

- Dashboard saldo, pemasukan, pengeluaran, piutang, dan kewajiban.
- Rekening; transaksi pemasukan/pengeluaran/transfer/tarik tunai.
- Piutang dan kewajiban terintegrasi dengan saldo rekening.
- Pencarian, filter, pengurutan transaksi, dan laporan.
- Ekspor CSV, cetak/Simpan sebagai PDF, backup dan restore JSON.
- Antarmuka dark premium, mobile-first, bottom navigation, bottom sheet, dan grafik.
- Semua data tetap offline di `localStorage` perangkat; tidak ada backend atau sinkronisasi cloud.

## Penyimpanan data di Android

Aplikasi tetap menggunakan key `duitw_v1` dan mekanisme `localStorage` yang sudah ada. Capacitor menjalankan konten pada origin lokal HTTPS yang stabil (`https://localhost`), sehingga WebView menyimpan data secara persisten di penyimpanan privat aplikasi dan data tetap ada setelah aplikasi ditutup/dibuka kembali.

**Penting:** jangan menghapus data aplikasi atau uninstall aplikasi, karena tindakan tersebut dapat menghapus penyimpanan lokal. Gunakan menu Backup JSON secara berkala untuk salinan cadangan. Data aplikasi tidak disinkronkan ke perangkat lain.

## Build lokal (Windows / macOS / Linux)

Prasyarat: Node.js 22, Java JDK 21, Android Studio + Android SDK (platform/build tools yang sesuai), dan koneksi internet saat pertama kali memasang dependency.

1. Ekstrak source code.
2. Dari folder proyek jalankan:

   ```bash
   npm install
   npx cap add android
   npx cap sync android
   ```

3. Salin ikon launcher dan resource adaptive icon:

   **Linux/macOS (Bash):**
   ```bash
   RES="android/app/src/main/res"
   for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
     mkdir -p "$RES/mipmap-$density"
     cp "resources/android/icon-$density.png" "$RES/mipmap-$density/ic_launcher.png"
     cp "resources/android/icon-$density.png" "$RES/mipmap-$density/ic_launcher_round.png"
   done
   mkdir -p "$RES/drawable" "$RES/mipmap-anydpi-v26" "$RES/values"
   cp resources/android/ic_launcher_foreground.png "$RES/drawable/"
   cp resources/android/launcher_colors.xml "$RES/values/"
   cp resources/android/ic_launcher.xml "$RES/mipmap-anydpi-v26/"
   cp resources/android/ic_launcher_round.xml "$RES/mipmap-anydpi-v26/"
   ```

   Pada Windows PowerShell, salin file yang sama ke folder Android dengan nama tujuan yang sama.

4. Build APK debug:

   ```bash
   cd android
   ./gradlew assembleDebug
   ```

   Windows:
   ```powershell
   cd android
   .\gradlew.bat assembleDebug
   ```

APK berada di `android/app/build/outputs/apk/debug/app-debug.apk`.

## Build otomatis melalui GitHub Actions

Workflow sudah tersedia di `.github/workflows/build.yml`.

1. Buat repository GitHub baru lalu upload/push seluruh isi folder proyek ini.
2. Buka tab **Actions** pada repository.
3. Pilih workflow **Build Android APK**.
4. Klik **Run workflow** (atau push commit ke branch `main`/`master`).
5. Tunggu job **Build duitw APK** selesai dengan status hijau.
6. Buka halaman run yang berhasil, gulir ke bagian **Artifacts**, lalu unduh **duitw-android-apk**.
7. Ekstrak ZIP artifact; file di dalamnya bernama `app-debug.apk`.

Artifact disimpan selama 30 hari. APK debug cocok untuk instalasi/pengujian langsung; distribusi Play Store memerlukan APK/AAB release yang ditandatangani dengan keystore milik Anda.

## Identitas aplikasi

- Nama aplikasi: `duitw`
- Application ID: `com.duitw.app`
- Capacitor: 7.x
- Web directory: `www/` (salinan web dari source root; menghindari folder Android ikut tersalin ke WebView)
- Android scheme: HTTPS lokal

## Catatan kompatibilitas

- Tidak ada framework web atau CDN tambahan; UI dan logika aplikasi asli digunakan apa adanya.
- `localStorage` tetap berada pada sandbox aplikasi Android.
- Ekspor PDF memakai dialog print WebView/Android; ketersediaannya bergantung pada layanan print Android.
- Build GitHub Actions menghasilkan **debug APK**. Tidak diperlukan secret signing untuk artifact ini.
