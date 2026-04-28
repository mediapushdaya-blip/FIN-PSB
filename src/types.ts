export type Transaction = {
  id?: string;
  tanggal: string;
  deskripsi: string;
  kategori: string;
  nominal: number;
  status: string;
  rekening?: string;
  qty?: number;
  hargaModal?: number;
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

export const CATEGORY_GROUPS = [
  {
    label: 'PENDAPATAN',
    items: ['Penjualan']
  },
  {
    label: 'PENDAPATAN DILUAR USAHA',
    items: ['Pendapatan Lain-Lain']
  },
  {
    label: 'BIAYA PEMASARAN DAN PENJUALAN',
    items: [
      'Biaya Iklan',
      'Biaya Iklan Komerce',
      'Biaya Komisi',
      'Biaya Pemasaran Influencer',
      'Biaya Layanan E-Commerce',
      'Biaya Pemasaran Lainnya'
    ]
  },
  {
    label: 'GAJI & TUNJANGAN KARYAWAN',
    items: ['Biaya Gaji, Lembur & THR', 'Biaya Konsumsi']
  },
  {
    label: 'BEBAN UTILITI, ADM, SEWA & LAINNYA',
    items: [
      'Biaya Internet',
      'Biaya Perlengkapan Kantor',
      'Biaya Pajak',
      'Biaya Retribusi & Sumbangan',
      'Biaya Umum & Adm Lainnya',
      'Biaya Peralatan'
    ]
  },
  {
    label: 'REPAIR & MAINTENANCE EXPENSE',
    items: ['Biaya Pemeliharaan Peralatan Kantor']
  },
  {
    label: 'BIAYA DILUAR USAHA',
    items: [
      'Biaya Adm Bank & Buku Cek/Giro',
      'Beban Lain-Lain'
    ]
  }
];

export const KATEGORI_PENGELUARAN_BIAYA = CATEGORY_GROUPS
  .filter(g => !g.label.includes('PENDAPATAN'))
  .flatMap(g => g.items);

export const KATEGORI_BIAYA_PEMASARAN = CATEGORY_GROUPS
  .find(g => g.label === 'BIAYA PEMASARAN DAN PENJUALAN')?.items || [];

export const KATEGORI_UMUM_ADM = [
  ...(CATEGORY_GROUPS.find(g => g.label === 'GAJI & TUNJANGAN KARYAWAN')?.items || []),
  ...(CATEGORY_GROUPS.find(g => g.label === 'BEBAN UTILITI, ADM, SEWA & LAINNYA')?.items || []),
  ...(CATEGORY_GROUPS.find(g => g.label === 'REPAIR & MAINTENANCE EXPENSE')?.items || [])
];

export const KATEGORI_LAIN_LAIN = CATEGORY_GROUPS
  .find(g => g.label === 'BIAYA DILUAR USAHA')?.items || [];

export const KATEGORI_PENGELUARAN_DETAIL = [
  ...KATEGORI_PENGELUARAN_BIAYA,
  'Biaya Penyusutan Peralatan',
  'Biaya Penyusutan Aset',
  'HPP / Barang Keluar',
  'Lain-lain',
  'Pembelian',
  'Aset Tetap',
  'Aset Lancar',
  'Mutasi Keluar',
  'Pengeluaran',
  'Prive/Penarikan Modal'
];

export const isExpenseMatch = (k: string) => 
  k === 'Pengeluaran' || 
  k.startsWith('Pengeluaran -') || 
  k.startsWith('Biaya ') || 
  k.startsWith('Beban ') ||
  KATEGORI_PENGELUARAN_DETAIL.includes(k);

export const KATEGORI_NON_KAS = [
  'Biaya Penyusutan Peralatan',
  'Biaya Penyusutan Aset',
  'Akumulasi Depresiasi Fixed Asset',
  'Akumulasi Penyusutan',
  'HPP / Barang Keluar',
  'Barang Keluar'
];

export const isCashFlowMatch = (k: string) => !KATEGORI_NON_KAS.includes(k);

/**
 * Returns true if the category is naturally a cash outflow (negative nominal).
 */
export const isOutflowCategory = (k: string) => {
  if (isExpenseMatch(k)) return true;
  if ([
    'Pembelian', 
    'Pembelian Stok', 
    'Aset Tetap', 
    'Aset Lancar', 
    'Mutasi Keluar', 
    'Prive/Penarikan Modal',
    'Biaya Admin',
    'Pajak'
  ].includes(k)) return true;
  return false;
};

/**
 * Returns true if the category is naturally a cash inflow (positive nominal).
 */
export const isInflowCategory = (k: string) => {
  return [
    'Penjualan', 
    'Pemasukan', 
    'Modal Awal', 
    'Mutasi Masuk', 
    'Pendapatan Lain-Lain', 
    'Pendapatan lain', 
    'Pendapatan Diluar Usaha'
  ].includes(k);
};

export type TabType = 'dashboard' | 'transaksi_semua' | 'penjualan' | 'pembelian' | 'persediaan' | 'kas' | 'aset' | 'rekonsiliasi' | 'laporan' | 'pengaturan';
