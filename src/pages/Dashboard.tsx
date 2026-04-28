import { motion } from "motion/react";
import { 
  Landmark, Receipt, Package, AlertCircle, 
  ArrowUpRight, ArrowDownRight, Activity, BarChart3,
  TrendingUp, TrendingDown
} from "lucide-react";
import { 
  Transaction, 
  isExpenseMatch, 
  isCashFlowMatch,
  isOutflowCategory,
  isInflowCategory
} from "../types";
import { formatCurrency, formatNumber } from "../utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
  transactions,
  startingBalances = {},
  balanceDate = "",
  appSettings,
  darkMode = false
}: { 
  transactions: Transaction[],
  startingBalances?: Record<string, number>,
  balanceDate?: string,
  appSettings?: { name: string },
  darkMode?: boolean
}) {
  // Calculate real metrics from transactions
  const totalKas = transactions.reduce((acc, curr) => {
    const isAfterBalance = balanceDate ? curr.tanggal >= balanceDate : true;
    if (isAfterBalance && curr.status !== 'Belum Lunas' && isCashFlowMatch(curr.kategori) && curr.rekening) {
      const val = Math.abs(Number(curr.nominal) || 0);
      if (isOutflowCategory(curr.kategori)) return acc - val;
      if (isInflowCategory(curr.kategori)) return acc + val;
      return acc + (Number(curr.nominal) || 0);
    }
    return acc;
  }, Object.values(startingBalances).reduce((a: number, b: number) => a + b, 0));

  const piutang = transactions
    .filter(t => t.kategori === 'Penjualan' && t.status === 'Belum Lunas')
    .reduce((acc, curr) => acc + Math.abs(curr.nominal), 0);

  const tagihanJatuhTempo = transactions
    .filter(t => t.kategori === 'Pembelian' && t.status === 'Belum Lunas')
    .length;

  const totalStok = transactions
    .reduce((acc, curr) => {
      if (['Barang Masuk', 'Pembelian Stok'].includes(curr.kategori)) return acc + (curr.qty || 0);
      if (['Barang Keluar', 'HPP / Barang Keluar'].includes(curr.kategori)) return acc - (curr.qty || 0);
      return acc;
    }, 0);

  // Chart Data: Last 7 Days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(date => {
    const inVal = transactions
      .filter(t => t.tanggal === date && isInflowCategory(t.kategori) && t.status !== 'Belum Lunas')
      .reduce((acc, t) => acc + Math.abs(t.nominal), 0);
    const outVal = transactions
      .filter(t => t.tanggal === date && isOutflowCategory(t.kategori) && t.status !== 'Belum Lunas')
      .reduce((acc, t) => acc + Math.abs(t.nominal), 0);
    return {
      name: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      income: inVal,
      expense: outVal
    };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Ringkasan Bisnis</h2>
          <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
            Pantau performa keuangan dan operasional {appSettings?.name || 'PT Putra Serayu Berdaya'} secara real-time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 px-3 py-1.5 rounded-full uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            Live Updates
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
        <MetricCard icon={Landmark} label="Total Saldo Kas" value={totalKas} color="green" trend="Stabil" />
        <MetricCard icon={Receipt} label="Piutang (Faktur)" value={piutang} color="amber" trend="Tagihan" />
        <MetricCard icon={Package} label="Stok Barang" value={totalStok} color="blue" isUnit unit="Pcs" />
        <MetricCard icon={AlertCircle} label="Tagihan (Hutang)" value={tagihanJatuhTempo} color="rose" isUnit unit="Faktur" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 flex flex-col"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Tren Arus Kas (7 Hari)
              </h3>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">Perbandingan Pemasukan & Pengeluaran</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                Masuk
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
                <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                Keluar
              </div>
            </div>
          </div>
          
          <div className="flex-1 h-[300px] -ml-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#f1f5f9'} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: darkMode ? '#94a3b8' : '#64748b' }} 
                  dy={10}
                />
                <YAxis 
                  hide 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: darkMode ? '#f1f5f9' : '#0f172a'
                  }} 
                  itemStyle={{
                    color: darkMode ? '#f1f5f9' : '#0f172a'
                  }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorIn)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="expense" 
                  stroke={document.documentElement.classList.contains('dark') ? '#334155' : '#e2e8f0'} 
                  strokeWidth={3}
                  fill="transparent" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Side Section: Quick Stats or Activity */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col shadow-xl"
        >
          <div className="mb-8">
            <h3 className="text-lg font-black flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Aktivitas Terbaru
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Transaksi 24 jam terakhir</p>
          </div>
          
          <div className="flex-1 space-y-6">
            {transactions.slice(0, 4).map((tx, i) => (
              <div key={i} className="flex gap-4 group">
                <div className={`mt-1 h-8 w-px rounded-full ${tx.nominal >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <p className="text-xs font-black truncate pr-2 tracking-tight uppercase">{tx.deskripsi}</p>
                    <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${tx.nominal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCurrency(tx.nominal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 tracking-wider">
                      {tx.tanggal} • {tx.kategori}
                    </p>
                    <p className="text-[9px] font-black text-slate-500 uppercase">{tx.rekening || 'Kas'}</p>
                  </div>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="h-full flex items-center justify-center text-xs font-bold text-slate-500 uppercase tracking-widest italic">
                Belum ada data
              </div>
            )}
          </div>
          
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black">Efisiensi Kas</p>
                <p className="text-[10px] font-bold text-slate-400 truncate">Sistem berjalan optimal.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, isUnit = false, unit = "", trend = "" }: any) {
  const colors = {
    green: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800",
    rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800"
  };

  return (
    <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative group hover:shadow-md transition-all duration-300 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${colors[color as keyof typeof colors]}`}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <span className="text-[10px] font-black tracking-widest uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-slate-500 dark:text-slate-400">
            {trend}
          </span>
        )}
      </div>
      <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
        {isUnit ? formatNumber(value as number) : formatCurrency(value as number)}
        {isUnit && <span className="text-xs font-bold text-slate-400 ml-1.5 uppercase">{unit}</span>}
      </h3>
    </motion.div>
  );
}
