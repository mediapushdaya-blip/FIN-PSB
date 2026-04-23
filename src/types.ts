export type Transaction = {
  id?: string;
  tanggal: string;
  deskripsi: string;
  kategori: string;
  nominal: number;
  status: string;
  rekening?: string;
  qty?: number;
};

export const DAFTAR_REKENING = [
  'Bank Mandiri Utama (1800055999553)',
  'Bank Mandiri Operasional (1800055599908)',
  'Shopee Enteros.id',
  'Shopee Enteros Official',
  'TikTok Shop Enteros Official',
  'Aggregator - Komship',
  'Aggregator - Lincah',
  'Aggregator - Kirimin Aja',
  'Aggregator - Mengantar',
  'Kas Kecil (Tunai)'
];

export const KATEGORI_PENDAPATAN = [
  'Penjualan',
  'Pendapatan Lain-Lain'
];

export const KATEGORI_BIAYA_PEMASARAN = [
  'Biaya Iklan',
  'Biaya Iklan Komerce',
  'Biaya Komisi',
  'Biaya Pemasaran Influencer',
  'Biaya Layanan E-Commerce',
  'Biaya Pemasaran Lainnya'
];

export const KATEGORI_UMUM_ADM = [
  'Biaya Gaji, Lembur & THR',
  'Biaya Konsumsi',
  'Biaya Internet',
  'Biaya Perlengkapan Kantor',
  'Biaya Pajak',
  'Biaya Retribusi & Sumbangan',
  'Biaya Sewa Gedung',
  'Biaya Umum & Adm Lainnya',
  'Biaya Digital Tools',
  'Biaya Peralatan',
  'Biaya Pemeliharaan Peralatan Kantor'
];

export const KATEGORI_LAIN_LAIN = [
  'Biaya Adm Bank & Buku Cek/Giro',
  'Beban Lain-Lain'
];

export const KATEGORI_PENGELUARAN_DETAIL = [
  ...KATEGORI_BIAYA_PEMASARAN,
  ...KATEGORI_UMUM_ADM,
  ...KATEGORI_LAIN_LAIN,
  'Biaya Penyusutan Peralatan',
  'HPP / Barang Keluar',
  'Lain-lain'
];

export const isExpenseMatch = (k: string) => 
  k === 'Pengeluaran' || 
  k.startsWith('Pengeluaran -') || 
  k.startsWith('Biaya ') || 
  k.startsWith('Beban ') ||
  KATEGORI_PENGELUARAN_DETAIL.includes(k);

export type TabType = 'dashboard' | 'penjualan' | 'pembelian' | 'persediaan' | 'kas' | 'aset' | 'rekonsiliasi' | 'laporan' | 'pengaturan';
