import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  ArrowRightLeft, RefreshCw, Send, AlertCircle, 
  CheckCircle2, Download, Calendar, Search, CreditCard
} from "lucide-react";
import { Transaction, DAFTAR_REKENING, isExpenseMatch } from "../types";
import { formatCurrency } from "../utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  transactions: Transaction[];
  onAdd: (tx: Omit<Transaction, 'id'>) => Promise<boolean>;
  onRefresh: () => void;
}

export default function Rekonsiliasi({ transactions, onAdd, onRefresh }: Props) {
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    sumber: DAFTAR_REKENING[2], // Default Shopee
    tujuan: DAFTAR_REKENING[1], // Default Mandiri 2
    nominal: '',
    biayaAdmin: '0',
    deskripsi: 'Pencairan Saldo (Withdrawal)',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadPeriod, setDownloadPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [rekeningSearch, setRekeningSearch] = useState("");

  const handleDownloadRekening = (rekName: string) => {
    const filteredTxs = transactions.filter(t => 
      t.rekening === rekName && 
      t.tanggal >= downloadPeriod.start && 
      t.tanggal <= downloadPeriod.end
    ).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PT Putra Serayu Berdaya", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(`RINCIAN TRANSAKSI - ${rekName.toUpperCase()}`, 105, 28, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${downloadPeriod.start} s/d ${downloadPeriod.end}`, 105, 34, { align: "center" });

    const totalIn = filteredTxs.filter(t => t.nominal > 0).reduce((acc, t) => acc + t.nominal, 0);
    const totalOut = filteredTxs.filter(t => t.nominal < 0).reduce((acc, t) => acc + Math.abs(t.nominal), 0);
    const net = totalIn - totalOut;

    const body = filteredTxs.map(t => [
      t.tanggal,
      t.deskripsi,
      t.kategori,
      t.status,
      formatCurrency(t.nominal)
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Tanggal', 'Keterangan', 'Kategori', 'Status', 'Nominal']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8 },
      foot: [
        ['', 'TOTAL MASUK', '', '', formatCurrency(totalIn)],
        ['', 'TOTAL KELUAR', '', '', formatCurrency(-totalOut)],
        ['', 'PERUBAHAN NETTO', '', '', formatCurrency(net)],
      ],
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
    });

    doc.save(`Rekening_${rekName.replace(/\//g, '-')}_${downloadPeriod.start}_to_${downloadPeriod.end}.pdf`);
  };

  // Kalkulasi saldo terkini
  const saldoPerRekening = DAFTAR_REKENING.reduce((acc, rek) => {
    acc[rek] = 0;
    return acc;
  }, {} as Record<string, number>);

  transactions.forEach(t => {
    if (t.rekening && saldoPerRekening[t.rekening] !== undefined && t.status !== 'Belum Lunas') {
      if (['Pemasukan', 'Penjualan', 'Modal Awal', 'Mutasi Masuk'].includes(t.kategori)) {
        saldoPerRekening[t.rekening] += Math.abs(t.nominal);
      } else if (['Pembelian', 'Aset Tetap', 'Aset Lancar', 'Mutasi Keluar', 'Biaya Admin'].includes(t.kategori) || isExpenseMatch(t.kategori)) {
        saldoPerRekening[t.rekening] -= Math.abs(t.nominal);
      }
    }
  });

  const handleMutasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.sumber === formData.tujuan) {
      alert("Rekening sumber dan tujuan tidak boleh sama!");
      return;
    }

    const ditarik = Number(formData.nominal);
    const biaya = Number(formData.biayaAdmin || 0);
    const masuk = ditarik - biaya;

    if (ditarik <= 0 || masuk < 0) {
      alert("Nominal tidak valid!");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Catat Pengeluaran dari Rekening Sumber
      await onAdd({
        tanggal: formData.tanggal,
        deskripsi: `${formData.deskripsi} ke ${formData.tujuan}`,
        kategori: 'Mutasi Keluar',
        nominal: -Math.abs(ditarik),
        status: 'Verified',
        rekening: formData.sumber
      });

      // 2. Catat Pemasukan di Rekening Tujuan
      await onAdd({
        tanggal: formData.tanggal,
        deskripsi: `${formData.deskripsi} dari ${formData.sumber}`,
        kategori: 'Mutasi Masuk',
        nominal: Math.abs(masuk),
        status: 'Verified',
        rekening: formData.tujuan
      });

      // 3. Catat Biaya Admin jika ada (sebagai pengeluaran terpisah di rekening sumber agar matching)
      if (biaya > 0) {
        await onAdd({
          tanggal: formData.tanggal,
          deskripsi: `Biaya Admin Pencairan ${formData.sumber}`,
          kategori: 'Biaya Admin',
          nominal: -Math.abs(biaya),
          status: 'Verified',
          rekening: formData.sumber
        });
      }

      setFormData({ ...formData, nominal: '', biayaAdmin: '0' });
      onRefresh();
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat memproses mutasi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Kas, Bank & Mutasi</h2>
          <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 max-w-2xl transition-colors">
            Kelola penarikan dana dari platform Marketplace/Agregator ke rekening Bank Perusahaan 
            serta unduh riwayat transaksi per akun.
          </p>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input 
              type="date"
              value={downloadPeriod.start}
              onChange={(e) => setDownloadPeriod({...downloadPeriod, start: e.target.value})}
              className="px-2 py-1 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            />
            <span className="text-slate-300 dark:text-slate-600">-</span>
            <input 
              type="date"
              value={downloadPeriod.end}
              onChange={(e) => setDownloadPeriod({...downloadPeriod, end: e.target.value})}
              className="px-2 py-1 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Kolom Kiri: Form Mutasi */}
        <div className="lg:col-span-5 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Form Pindah Buku / Pencairan
              </h3>
            </div>
            <form onSubmit={handleMutasi} className="p-6 flex flex-col gap-5">
              
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Tanggal Pencairan</label>
                <input 
                  type="date" 
                  required
                  value={formData.tanggal}
                  onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Dari (Sumber)</label>
                  <select 
                    value={formData.sumber}
                    onChange={(e) => setFormData({...formData, sumber: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {DAFTAR_REKENING.map(rek => <option key={rek} value={rek}>{rek}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Ke (Tujuan)</label>
                  <select 
                    value={formData.tujuan}
                    onChange={(e) => setFormData({...formData, tujuan: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {DAFTAR_REKENING.map(rek => <option key={rek} value={rek}>{rek}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Nominal Ditarik (Dari Sumber)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 dark:text-slate-400 font-semibold text-sm">Rp</span>
                  <input 
                    type="number" 
                    required min="1"
                    placeholder="0"
                    value={formData.nominal}
                    onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 pl-10 pr-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono tracking-wider tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Biaya Admin Platform (Opsional)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 dark:text-slate-400 font-semibold text-sm">Rp</span>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="0"
                    value={formData.biayaAdmin}
                    onChange={(e) => setFormData({...formData, biayaAdmin: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 pl-10 pr-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono tracking-wider tabular-nums"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Nominal bersih yang masuk ke rekening tujuan: <span className="font-bold text-emerald-600 dark:text-emerald-400">Rp {(Number(formData.nominal) - Number(formData.biayaAdmin)).toLocaleString('id-ID')}</span></p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Catatan</label>
                <input 
                  type="text" 
                  required
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-70 shadow-sm transition-all"
              >
                {isSubmitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ArrowRightLeft className="h-5 w-5" />}
                Proses Pindah Buku
              </button>

            </form>
          </motion.div>
        </div>

        {/* Kolom Kanan: Panduan Rekonsiliasi & Mutasi */}
        <div className="lg:col-span-7 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-6 transition-colors"
          >
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-1 leading-tight">Panduan Pindah Buku (Withdrawal)</h4>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300 leading-relaxed opacity-90">
                  Gunakan form ini untuk mencatat perpindahan saldo dari Shopee, TikTok, atau Agregator 
                  ke rekening Mandiri. Sistem akan otomatis membagi nominal menjadi mutasi dan biaya admin.
                </p>
              </div>
            </div>
          </motion.div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
             <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
               <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Daftar Rekening & Wallet</h3>
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">Pantau saldo dan unduh laporan per akun</p>
               </div>
               <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cari rekening..." 
                  value={rekeningSearch}
                  onChange={(e) => setRekeningSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-40"
                />
               </div>
             </div>
             
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                     <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nama Rekening</th>
                     <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Saldo Saat Ini</th>
                     <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center w-24">Aksi</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {DAFTAR_REKENING.filter(r => r.toLowerCase().includes(rekeningSearch.toLowerCase())).map((rek) => (
                      <tr key={rek} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              <CreditCard className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{rek}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-sm font-extrabold tabular-nums ${saldoPerRekening[rek] < 0 ? 'text-red-500 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                            {formatCurrency(saldoPerRekening[rek])}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button 
                            onClick={() => handleDownloadRekening(rek)}
                            title="Unduh Rincian Periode"
                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
             
             <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Kas & Bank Keseluruhan</span>
                  <span className="text-base font-black text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatCurrency(Object.values(saldoPerRekening).reduce((a,b) => a + b, 0))}
                  </span>
                </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
