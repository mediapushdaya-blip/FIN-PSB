import React, { useState } from "react";
import { motion } from "motion/react";
import { ArrowRightLeft, RefreshCw, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { Transaction, DAFTAR_REKENING, isExpenseMatch } from "../types";
import { formatCurrency } from "../utils";

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
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Mutasi & Pencairan</h2>
        <p className="mt-1.5 text-sm font-medium text-slate-500">
          Kelola penarikan dana dari platform Marketplace/Agregator ke rekening Bank Perusahaan.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Kolom Kiri: Form Mutasi */}
        <div className="lg:col-span-5 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600" />
                Form Pindah Buku / Pencairan
              </h3>
            </div>
            <form onSubmit={handleMutasi} className="p-6 flex flex-col gap-5">
              
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tanggal Pencairan</label>
                <input 
                  type="date" 
                  required
                  value={formData.tanggal}
                  onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Dari (Sumber)</label>
                  <select 
                    value={formData.sumber}
                    onChange={(e) => setFormData({...formData, sumber: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    {DAFTAR_REKENING.map(rek => <option key={rek} value={rek}>{rek}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Ke (Tujuan)</label>
                  <select 
                    value={formData.tujuan}
                    onChange={(e) => setFormData({...formData, tujuan: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    {DAFTAR_REKENING.map(rek => <option key={rek} value={rek}>{rek}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nominal Ditarik (Dari Sumber)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-semibold text-sm">Rp</span>
                  <input 
                    type="number" 
                    required min="1"
                    placeholder="0"
                    value={formData.nominal}
                    onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 pl-10 pr-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono tracking-wider tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Biaya Admin Platform (Opsional)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-semibold text-sm">Rp</span>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="0"
                    value={formData.biayaAdmin}
                    onChange={(e) => setFormData({...formData, biayaAdmin: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 pl-10 pr-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono tracking-wider tabular-nums"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500 font-medium">Nominal bersih yang masuk ke rekening tujuan: <span className="font-bold text-emerald-600">Rp {(Number(formData.nominal) - Number(formData.biayaAdmin)).toLocaleString('id-ID')}</span></p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Catatan</label>
                <input 
                  type="text" 
                  required
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            className="bg-sky-50 border border-sky-100 rounded-2xl p-6"
          >
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-sky-600 shrink-0" />
              <div>
                <h4 className="font-bold text-sky-900 mb-1">Panduan Penggunaan Fitur Ini</h4>
                <p className="text-sm font-medium text-sky-800 leading-relaxed">
                  Fitur ini dirancang khusus untuk memindahkan saldo mengendap di dompet platform 
                  (seperti Saldo Shopee, TikTok, atau saldo Agregator Komship) ke rekening operasional / utama Mandiri Anda, yang umumnya dicairkan 1 bulan sekali.
                </p>
                <ul className="mt-3 space-y-2 text-sm text-sky-700">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-sky-500" /> Transaksi ini tidak memengaruhi Laba/Rugi.</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-sky-500" /> Akan tercatat otomatis sebagai "Mutasi Keluar" dan "Mutasi Masuk".</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-sky-500" /> Biaya admin (jika ada) langsung terhitung sebagai pengeluaran perusahaan secara otomatis.</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Menampilkan Status Saldo Singkat (opsional, karena sudah ada di Laporan, tapi bagus untuk crosscheck) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-100 bg-slate-50/50">
               <h3 className="font-bold text-slate-800 text-sm">Status Saldo Platform Terkini</h3>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                {['Shopee Enteros.id', 'TikTok Shop Enteros Official', 'Aggregator - Komship'].map((rek) => (
                  <div key={rek} className="p-4">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest line-clamp-1 truncate" title={rek}>{rek}</p>
                    <p className={`mt-1 text-sm font-extrabold tabular-nums ${saldoPerRekening[rek] < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      {formatCurrency(saldoPerRekening[rek])}
                    </p>
                  </div>
                ))}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
