# duitw

Aplikasi Android native Kotlin untuk pencatatan keuangan pribadi **offline-first**. Proyek ini merupakan pengembangan dari source awal, bukan dibuat ulang dari nol.

## Fitur
- Dashboard: total saldo, pemasukan/pengeluaran bulan berjalan, arus kas, rekening, transaksi terbaru.
- Rekening/dompet: tunai, bank, e-wallet, dan lainnya; saldo awal; edit/hapus dengan validasi.
- Transaksi: pemasukan, pengeluaran, transfer; tanggal; kategori; catatan; edit/hapus; pencarian dan filter.
- Kategori: kategori pemasukan/pengeluaran dapat ditambah, diubah, dan dihapus.
- Piutang dan kewajiban: nominal, pihak, tanggal, catatan, status terbayar, riwayat pembayaran. Pembayaran otomatis menjadi transaksi yang memengaruhi saldo.
- Laporan: hari, minggu, bulan, tahun, periode custom; pemasukan, pengeluaran, selisih, dan pengeluaran per kategori.
- Backup/restore JSON offline dengan validasi dan konfirmasi sebelum menimpa data.
- Pengaturan nama pengguna dan informasi aplikasi.
- Tidak memerlukan akun, server, internet, analytics, atau izin akses penyimpanan khusus.
- Database SQLite dengan migration dari schema versi awal.

## Aturan saldo
- Pemasukan menambah saldo rekening.
- Pengeluaran mengurangi saldo rekening.
- Transfer hanya memindahkan saldo dan tidak masuk pemasukan/pengeluaran.
- Piutang/kewajiban yang baru dicatat tidak mengubah saldo.
- Pembayaran piutang menambah saldo; pembayaran kewajiban mengurangi saldo.
- Saldo rekening dihitung ulang dari riwayat transaksi sehingga perubahan/edit/hapus tidak meninggalkan saldo lama.

## Build APK
Workflow `.github/workflows/build-apk.yml` menjalankan build debug melalui GitHub Actions.

1. Upload seluruh isi proyek ke repository GitHub, termasuk `.github`.
2. Push ke branch `main`, atau buka **Actions → Build duitw APK → Run workflow**.
3. Artifact `duitw-debug-apk` berisi `app-debug.apk`.

Teknologi: Kotlin, Android SDK 35, minimum SDK 26, SQLiteOpenHelper, Java 17.
Application ID: `com.duitw.app`.

## Catatan
Data aplikasi tersimpan lokal di perangkat. Backup JSON sebaiknya disimpan di tempat aman karena file tersebut berisi seluruh data keuangan aplikasi.
