import { motion } from "motion/react";
import { 
  Landmark, Receipt, Package, AlertCircle, 
  ArrowUpRight, ArrowDownRight, Activity, BarChart3 
} from "lucide-react";
import { Transaction, isExpenseMatch } from "../types";
import { formatCurrency, formatNumber } from "../utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

export default function Dashboard({ 
  transactions 
}: { 
  transactions: Transaction[]
}) {
  // Calculate real metrics from transactions
  const totalKas = transactions.reduce((acc, curr) => {
    // Only count actual cash flow
    if ((['Pemasukan', 'Penjualan', 'Pembelian', 'Pembelian Stok', 'Modal Awal', 'Mutasi Masuk', 'Mutasi Keluar', 'Biaya Admin'].includes(curr.kategori) || isExpenseMatch(curr.kategori)) && curr.status !== 'Belum Lunas') {
      return acc + curr.nominal;
    }
    // Aset purchase assumes cash drain
    if (['Aset Tetap', 'Aset Lancar'].includes(curr.kategori) && curr.status !== 'Belum Lunas') {
      return acc - Math.abs(curr.nominal);
    }
    return acc;
  }, 0);

  const piutang = transactions
    .filter(t => t.kategori === 'Penjualan' && t.status === 'Belum Lunas')
    .reduce((acc, curr) => acc + Math.abs(curr.nominal), 0);

  const tagihanJatuhTempo = transactions
    .filter(t => t.kategori === 'Pembelian' && t.status === 'Belum Lunas')
    .length;

  const totalStok = transactions
    .reduce((acc, curr) => {
      if (['Barang Masuk', 'Pembelian Stok'].includes(curr.kategori)) {
        return acc + (curr.qty || 0);
      }
      if (['Barang Keluar', 'HPP / Barang Keluar'].includes(curr.kategori)) {
        return acc - (curr.qty || 0);
      }
      return acc;
    }, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Ringkasan Bisnis</h2>
          <p className="mt-1.5 text-sm font-medium text-slate-500">
            Pantau performa keuangan dan operasional PT Putra Serayu Berdaya hari ini.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Data Real-time
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
      >
        {/* Card 1: Kas */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 bg-green-50 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
              <Landmark className="h-5 w-5" />
            </div>
            {totalKas >= 0 ? (
              <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md">
                <ArrowUpRight className="h-3 w-3" /> Surplus
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-md">
                <ArrowDownRight className="h-3 w-3" /> Defisit
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-500 mb-1">Total Saldo Kas</p>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">{formatCurrency(totalKas)}</h3>
        </motion.div>

        {/* Card 2: Piutang */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 bg-amber-50 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
              Menunggu Pembayaran
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-500 mb-1">Piutang Belum Tertagih</p>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">{formatCurrency(piutang)}</h3>
        </motion.div>

        {/* Card 3: Stok */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 bg-blue-50 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-500 mb-1">Total Stok Barang</p>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">{formatNumber(totalStok)} <span className="text-base font-semibold text-slate-500">Pcs</span></h3>
        </motion.div>

        {/* Card 4: Tagihan */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 bg-rose-50 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-md">
              Perlu Tindakan
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-500 mb-1">Tagihan Belum Dibayar</p>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">{tagihanJatuhTempo} <span className="text-base font-semibold text-slate-500">Faktur</span></h3>
        </motion.div>
      </motion.div>

      {/* Placeholder Sections */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 24 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[350px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Grafik Arus Kas
            </h3>
            <select className="text-sm font-medium border border-slate-200 rounded-lg text-slate-600 bg-slate-50 px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
              <option>7 Hari Terakhir</option>
              <option>30 Hari Terakhir</option>
              <option>Bulan Ini</option>
            </select>
          </div>
          <div className="flex-1 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50/50">
            <p className="text-sm text-slate-400 font-semibold">Area Grafik Arus Kas (Dalam Pengembangan)</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[350px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Aktivitas Terakhir
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 font-semibold">
                Belum ada aktivitas
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.slice(0, 5).map((tx, i) => (
                  <div key={i} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0">
                    <div className={`mt-0.5 h-2 w-2 rounded-full ${tx.nominal >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{tx.deskripsi}</p>
                      <p className="text-xs text-slate-500">{tx.tanggal} • {tx.kategori}</p>
                    </div>
                    <div className="ml-auto text-sm font-bold text-slate-700 tabular-nums">
                      {formatCurrency(tx.nominal)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
