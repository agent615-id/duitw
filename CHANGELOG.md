# Changelog
## 2.0.0 — Redesign UI/UX
- Navigasi mobile: bottom navigation dengan tombol tambah transaksi di tengah; sidebar tetap di desktop.
- Dashboard baru: kartu saldo + rasio masuk/keluar, aksi cepat, kartu piutang & kewajiban, rekening bergaya kartu (geser horizontal), grafik arus kas 14 hari dengan tooltip, aktivitas terbaru.
- Transaksi: feed dikelompokkan per hari, ikon berwarna per jenis, chip filter, ketuk baris untuk Edit/Hapus, ringkasan hasil filter.
- Rekening: kartu dompet bergradien per jenis (Bank, E-wallet, Tunai, Lainnya) dan porsi saldo.
- Piutang & Kewajiban: tema warna berbeda, ringkasan total, ring progres, status Aktif / Segera / Terlambat / Lunas.
- Laporan: ringkasan selisih arus kas, grafik batang harian, donat + rincian kategori.
- Form menjadi bottom sheet di HP; tap area gelap untuk menutup.
- Ikon SVG inline menggantikan simbol teks; tetap tanpa library/CDN dan dapat dipakai offline.
- Aksesibilitas: fokus keyboard terlihat, label aria, reduced-motion, safe-area iPhone.
- Perbaikan: tanggal "hari ini"/"bulan ini" kini memakai zona waktu lokal (sebelumnya UTC sehingga bisa mundur sehari pada dini hari WIB).
- Perbaikan: grafik arus kas 14 hari kini memakai seluruh transaksi 14 hari terakhir (sebelumnya hanya bulan berjalan) dan menghitung pembayaran kewajiban sebagai pengeluaran, konsisten dengan kartu ringkasan.
- Tidak berubah: rumus saldo, piutang, kewajiban, struktur data, dan kunci penyimpanan `duitw_v1` — data lama tetap terbaca.

## 1.0.0
- Initial duitw offline personal finance app.
- LocalStorage persistence.
- Accounts, transactions, transfers, cash withdrawal.
- Receivables and liabilities with linked payments.
- Dashboard and financial reports.
- CSV + browser PDF export.
- JSON backup/restore.
- Responsive dark UI.
