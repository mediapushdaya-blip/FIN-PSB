import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Download, TrendingUp, Scale, ArrowRightLeft, Wallet, Loader2 } from "lucide-react";
import { 
  Transaction, 
  DAFTAR_REKENING, 
  isExpenseMatch, 
  isCashFlowMatch,
  isOutflowCategory,
  isInflowCategory,
  KATEGORI_BIAYA_PEMASARAN, 
  KATEGORI_UMUM_ADM, 
  KATEGORI_LAIN_LAIN 
} from "../types";
import { formatCurrency } from "../utils";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  transactions: Transaction[];
  startingBalances?: Record<string, number>;
  balanceDate?: string;
}

export default function Laporan({ 
  transactions, 
  startingBalances = {}, 
  balanceDate = "" 
}: Props) {
  const [loading, setLoading] = useState(false);

  // Filter States
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [filters, setFilters] = useState({
    startDate: firstDay,
    endDate: lastDay
  });

  // --- Transactions Splitting ---
  const filteredTransactions = transactions.filter(t => 
    t.tanggal >= filters.startDate && t.tanggal <= filters.endDate
  );

  const transactionsBeforePeriod = transactions.filter(t => {
    const isAfterBalance = balanceDate ? t.tanggal >= balanceDate : true;
    return isAfterBalance && t.tanggal < filters.startDate;
  });

  const transactionsUntilEnd = transactions.filter(t => {
    const isAfterBalance = balanceDate ? t.tanggal >= balanceDate : true;
    return isAfterBalance && t.tanggal <= filters.endDate;
  });

  // --- Helpers ---
  const sumCat = (txs: Transaction[], cats: string[]): number => 
    txs.filter(t => cats.includes(t.kategori)).reduce((a, b) => a + Math.abs(b.nominal), 0);

  // --- Laba Rugi Data (Filtered) ---
  const pendapatan = sumCat(filteredTransactions, ['Penjualan', 'Pendapatan Lain-Lain']);
  const hpp = sumCat(filteredTransactions, ['HPP / Barang Keluar', 'Barang Keluar']);
  const labaKotor = pendapatan - hpp;

  const biayaPemasaran = sumCat(filteredTransactions, KATEGORI_BIAYA_PEMASARAN);
  const biayaPenyusutan = sumCat(filteredTransactions, ['Biaya Penyusutan Peralatan', 'Biaya Penyusutan Aset']);
  const biayaUmumAdm = sumCat(filteredTransactions, KATEGORI_UMUM_ADM);
  const repairAndMaintenance = sumCat(filteredTransactions, ['Biaya Pemeliharaan Peralatan Kantor', 'Maintenance/Perbaikan']);
  
  const totalBebanOperasi = biayaPemasaran + biayaPenyusutan + biayaUmumAdm + repairAndMaintenance;
  const pendapatanOperasi = labaKotor - totalBebanOperasi;

  const pendapatanLainLain = sumCat(filteredTransactions, ['Pendapatan lain', 'Pendapatan Diluar Usaha']);
  const bebanLainLain = sumCat(filteredTransactions, KATEGORI_LAIN_LAIN);
  const totalLainLain = pendapatanLainLain - bebanLainLain;

  const labaBersih = pendapatanOperasi + totalLainLain;

  // --- Neraca Data (Until End Date) ---
  const totalSaldoAwalDoc = Object.values(startingBalances).reduce((a: number, b: number) => a + b, 0) as number;

  const getKasBankByDate = (txsUntil: Transaction[]) => {
    return DAFTAR_REKENING.map(rek => {
      const start = startingBalances[rek] || 0;
      const current = txsUntil
        .filter(t => t.rekening === rek && t.status !== 'Belum Lunas' && isCashFlowMatch(t.kategori))
        .reduce((acc, t) => {
          const val = Math.abs(Number(t.nominal) || 0);
          if (isOutflowCategory(t.kategori)) {
            return acc - val;
          } else if (isInflowCategory(t.kategori)) {
            return acc + val;
          }
          return acc + (Number(t.nominal) || 0);
        }, 0);
      return { name: rek, balance: start + current };
    });
  };

  const kasBankEnd = getKasBankByDate(transactionsUntilEnd);
  const kasBankStart = getKasBankByDate(transactionsBeforePeriod);

  const totalKasBankEnd = kasBankEnd.reduce((a, b) => a + b.balance, 0);
  const totalKasBankStart = kasBankStart.reduce((a, b) => a + b.balance, 0);

  const piutang = transactionsUntilEnd
    .filter(t => t.kategori === 'Penjualan' && t.status === 'Belum Lunas')
    .reduce((a, b) => a + Math.abs(b.nominal), 0);

  const persediaan = transactionsUntilEnd.reduce((acc, t) => {
    if (t.kategori === 'Pembelian Stok' || t.kategori === 'Barang Masuk') return acc + Math.abs(t.nominal);
    if (t.kategori === 'HPP / Barang Keluar' || t.kategori === 'Barang Keluar') return acc - Math.abs(t.nominal);
    return acc;
  }, 0);

  const aktivaLancarLainnya = sumCat(transactionsUntilEnd, ['Perlengkapan', 'Peralatan Studio', 'Digital Tools', 'Sewa Gedung Dibayar Dimuka']);
  const totalAktivaLancar = totalKasBankEnd + piutang + persediaan + aktivaLancarLainnya;

  const aktivaTetap = sumCat(transactionsUntilEnd, ['Aset Tetap', 'Peralatan']);
  const akumulasiDepresiasi = sumCat(transactionsUntilEnd, ['Akumulasi Depresiasi Fixed Asset', 'Akumulasi Penyusutan']);
  const totalAktivaTetap = aktivaTetap - akumulasiDepresiasi;

  const totalAktiva = totalAktivaLancar + totalAktivaTetap;

  const hutangDagang = transactionsUntilEnd
    .filter(t => t.kategori === 'Pembelian' && t.status === 'Belum Lunas')
    .reduce((a, b) => a + Math.abs(b.nominal), 0);

  const kewajibanLancarLain = sumCat(transactionsUntilEnd, ['Hutang Gaji Karyawan', 'Biaya yang Masih Harus Dibayar']);
  const totalKewajiban = hutangDagang + kewajibanLancarLain;
  
  const modal = sumCat(transactionsUntilEnd, ['Modal Awal', 'Modal Disetor']) + totalSaldoAwalDoc;
  const ekuitasLain = sumCat(transactionsUntilEnd, ['OPENING BALANCE EQUITY', 'RETAINED EARNING']);
  const totalEkuitas = modal + labaBersih + ekuitasLain;

  // --- Arus Kas Data ---
  const changes = totalKasBankEnd - totalKasBankStart;
  const aktivaTetapPeriode = sumCat(filteredTransactions, ['Aset Tetap', 'Peralatan']);

  // --- Filter Presets ---
  const applyPreset = (type: string) => {
    const d = new Date();
    if (type === 'thisMonth') {
      setFilters({
        startDate: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      });
    } else if (type === 'lastMonth') {
      setFilters({
        startDate: new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0],
        endDate: new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]
      });
    } else if (type === 'q1') {
      setFilters({ startDate: `${d.getFullYear()}-01-01`, endDate: `${d.getFullYear()}-03-31` });
    } else if (type === 'q2') {
      setFilters({ startDate: `${d.getFullYear()}-04-01`, endDate: `${d.getFullYear()}-06-30` });
    } else if (type === 'q3') {
      setFilters({ startDate: `${d.getFullYear()}-07-01`, endDate: `${d.getFullYear()}-09-30` });
    } else if (type === 'q4') {
      setFilters({ startDate: `${d.getFullYear()}-10-01`, endDate: `${d.getFullYear()}-12-31` });
    } else if (type === 'thisYear') {
      setFilters({ startDate: `${d.getFullYear()}-01-01`, endDate: `${d.getFullYear()}-12-31` });
    }
  };

  // --- PDF Generasi (Updated with Filter) ---
  const addFooter = (doc: jsPDF) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("ACCURATE Accounting System Report", 10, 285);
      doc.text(`Cetak di ${new Date().toLocaleString('id-ID')} - Hal ${i}`, 105, 285, { align: 'center' });
    }
  };

  const handleDownloadPosisiKas = () => {
    const doc = new jsPDF();
    doc.setFontSize(16).setFont("helvetica", "bold").text("Enteros FinTrack", 105, 20, { align: "center" });
    doc.setFontSize(12).text("LAPORAN POSISI KAS & BANK", 105, 28, { align: "center" });
    doc.setFontSize(10).setFont("helvetica", "normal").text(`Per Tanggal: ${filters.endDate}`, 105, 34, { align: "center" });

    const body = kasBankEnd.map(rek => [rek.name, formatCurrency(rek.balance)]);
    autoTable(doc, {
      startY: 45,
      head: [['REKENING / WALLET', 'SALDO']],
      body,
      foot: [['TOTAL KESELURUHAN KAS', formatCurrency(totalKasBankEnd)]],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
    });
    addFooter(doc);
    doc.save(`Posisi_Kas_${filters.endDate}.pdf`);
  };

  const handleDownloadLabaRugi = () => {
    const doc = new jsPDF();
    doc.setFontSize(16).setFont("helvetica", "bold").text("Enteros FinTrack", 105, 20, { align: "center" });
    doc.setFontSize(12).text("Laba/Rugi (Standar)", 105, 28, { align: "center" });
    doc.setFontSize(10).setFont("helvetica", "normal").text(`Periode: ${filters.startDate} s/d ${filters.endDate}`, 105, 34, { align: "center" });

    autoTable(doc, {
      startY: 45,
      body: [
        [{ content: 'Pendapatan', styles: { fontStyle: 'bold' } }, ''],
        ['  Penjualan', formatCurrency(pendapatan)],
        [{ content: 'Harga Pokok Penjualan', styles: { fontStyle: 'bold' } }, ''],
        ['  COGS (HPP)', formatCurrency(hpp)],
        [{ content: 'LABA KOTOR', styles: { fontStyle: 'bold' } }, formatCurrency(labaKotor)],
        [{ content: 'Beban Operasi', styles: { fontStyle: 'bold' } }, ''],
        ['  Biaya Pemasaran', formatCurrency(biayaPemasaran)],
        ['  Biaya Penyusutan & Amortisasi', formatCurrency(biayaPenyusutan)],
        ['  Biaya Umum & Administrasi', formatCurrency(biayaUmumAdm)],
        ['  Repair & Maintenance Expense', formatCurrency(repairAndMaintenance)],
        [{ content: 'Jumlah Beban Operasi', styles: { fontStyle: 'bold' } }, formatCurrency(totalBebanOperasi)],
        [{ content: 'PENDAPATAN OPERASI', styles: { fontStyle: 'bold' } }, formatCurrency(pendapatanOperasi)],
        [{ content: 'Pendapatan dan Beban Lain', styles: { fontStyle: 'bold' } }, ''],
        ['  Pendapatan Lain-Lain', formatCurrency(pendapatanLainLain)],
        ['  Beban Lain-Lain', formatCurrency(bebanLainLain)],
        [{ content: 'LABA BERSIH', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatCurrency(labaBersih), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
      ],
      theme: 'plain',
    });
    addFooter(doc);
    doc.save(`Laba_Rugi_${filters.startDate}_ke_${filters.endDate}.pdf`);
  };

  const handleDownloadNeraca = () => {
    const doc = new jsPDF();
    doc.setFontSize(14).setFont("helvetica", "bold").text("Enteros FinTrack", 105, 15, { align: "center" });
    doc.setFontSize(12).text("Neraca (Induk Skontro)", 105, 22, { align: "center" });
    doc.setFontSize(9).setFont("helvetica", "normal").text(`Per Tgl: ${filters.endDate}`, 105, 27, { align: "center" });

    const aktivaRows = [
      [{ content: 'AKTIVA', colSpan: 2, styles: { fontStyle: 'bold' as const } }],
      [{ content: 'Aktiva Lancar', colSpan: 2, styles: { fontStyle: 'bold' as const } }],
      ['  Kas & Bank', formatCurrency(totalKasBankEnd)],
      ['  Piutang Dagang', formatCurrency(piutang)],
      ['  Persediaan', formatCurrency(persediaan)],
      ['  Aktiva Lancar Lainnya', formatCurrency(aktivaLancarLainnya)],
      [{ content: 'JUMLAH AKTIVA LANCAR', styles: { fontStyle: 'bold' as const } }, formatCurrency(totalAktivaLancar)],
      ['', ''],
      [{ content: 'Aktiva Tetap', colSpan: 2, styles: { fontStyle: 'bold' as const } }],
      ['  Nilai Histori Aset', formatCurrency(aktivaTetap)],
      ['  Akumulasi Penyusutan', formatCurrency(-akumulasiDepresiasi)],
      [{ content: 'JUMLAH AKTIVA TETAP', styles: { fontStyle: 'bold' as const } }, formatCurrency(totalAktivaTetap)],
      ['', ''],
      [{ content: 'TOTAL AKTIVA', styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number] } }, { content: formatCurrency(totalAktiva), styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number] } }],
    ];

    const pasivaRows = [
      [{ content: 'KEWAJIBAN & EKUITAS', colSpan: 2, styles: { fontStyle: 'bold' as const } }],
      [{ content: 'Kewajiban', colSpan: 2, styles: { fontStyle: 'bold' as const } }],
      ['  Hutang Dagang', formatCurrency(hutangDagang)],
      ['  Kewajiban Lancar Lain', formatCurrency(kewajibanLancarLain)],
      [{ content: 'JUMLAH KEWAJIBAN', styles: { fontStyle: 'bold' as const } }, formatCurrency(totalKewajiban)],
      ['', ''],
      [{ content: 'Ekuitas', colSpan: 2, styles: { fontStyle: 'bold' as const } }],
      ['  Modal', formatCurrency(modal)],
      ['  Laba Tahun Ini', formatCurrency(labaBersih)],
      ['  Retained Earning / Equity Other', formatCurrency(ekuitasLain)],
      [{ content: 'JUMLAH EKUITAS', styles: { fontStyle: 'bold' as const } }, formatCurrency(totalEkuitas)],
      ['', ''],
      [{ content: 'TOTAL PASIVA', styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number] } }, { content: formatCurrency(totalKewajiban + totalEkuitas), styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number] } }],
    ];

    autoTable(doc, {
      startY: 35,
      head: [['AKTIVA', 'BALANCE']],
      body: aktivaRows,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      tableWidth: 85,
      margin: { left: 15 }
    });

    autoTable(doc, {
      startY: 35,
      head: [['PASIVA', 'BALANCE']],
      body: pasivaRows,
      theme: 'grid',
      headStyles: { fillColor: [147, 51, 234] },
      tableWidth: 85,
      margin: { left: 110 }
    });

    addFooter(doc);
    doc.save(`Neraca_${filters.endDate}.pdf`);
  };

  const handleDownloadArusKas = () => {
    const doc = new jsPDF();
    doc.setFontSize(16).setFont("helvetica", "bold").text("Enteros FinTrack", 105, 20, { align: "center" });
    doc.setFontSize(12).text("Laporan Arus Kas (Metode Langsung)", 105, 28, { align: "center" });
    doc.setFontSize(10).setFont("helvetica", "normal").text(`Periode: ${filters.startDate} s/d ${filters.endDate}`, 105, 34, { align: "center" });

    autoTable(doc, {
      startY: 45,
      body: [
        [{ content: 'Arus Kas dari Aktivitas Operasi', styles: { fontStyle: 'bold' } }, ''],
        ['  Pendapatan', formatCurrency(pendapatan)],
        ['  Biaya Pemasaran Umum & ADM', formatCurrency(-totalBebanOperasi)],
        ['  Pendapatan/Biaya Luar Usaha', formatCurrency(totalLainLain)],
        [{ content: 'Kas bersih dari Aktivitas Operasi', styles: { fontStyle: 'bold' } }, formatCurrency(pendapatan - totalBebanOperasi + totalLainLain)],
        ['', ''],
        [{ content: 'Arus Kas dari Aktivitas Investasi', styles: { fontStyle: 'bold' } }, ''],
        ['  Pembelian Aktiva Tetap', formatCurrency(-aktivaTetapPeriode)],
        [{ content: 'Kas bersih dari Aktivitas Investasi', styles: { fontStyle: 'bold' } }, formatCurrency(-aktivaTetapPeriode)],
        ['', ''],
        [{ content: 'Perubahan Kas dalam Periode', styles: { fontStyle: 'bold' } }, formatCurrency(changes)],
        ['  Kas pada Awal Periode', formatCurrency(totalKasBankStart)],
        [{ content: 'KAS PADA AKHIR PERIODE', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatCurrency(totalKasBankEnd), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
      ],
      theme: 'plain',
    });
    addFooter(doc);
    doc.save(`Arus_Kas_${filters.startDate}_ke_${filters.endDate}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Memuat data laporan...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Laporan Keuangan</h2>
          <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">
            Filer periode dan download laporan standar Accurate.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => applyPreset('thisMonth')} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Bulan Ini</button>
          <button onClick={() => applyPreset('lastMonth')} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Bulan Lalu</button>
          <button onClick={() => applyPreset('q1')} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Q1</button>
          <button onClick={() => applyPreset('q2')} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Q2</button>
          <button onClick={() => applyPreset('q3')} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Q3</button>
          <button onClick={() => applyPreset('q4')} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Q4</button>
          <button onClick={() => applyPreset('thisYear')} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Tahun Ini</button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-4 transition-colors">
        <div className="flex items-center gap-2">
          <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Dari:</label>
          <input 
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Hingga:</label>
          <input 
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="ml-auto text-xs font-bold text-slate-500 dark:text-slate-400">
          Saldo Awal Terdeteksi: <span className="text-emerald-600 dark:text-emerald-400 font-black">{balanceDate || 'Tidak ada'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Laba Rugi */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Laba Rugi</h3>
            </div>
            <button onClick={handleDownloadLabaRugi} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold">
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Laba Kotor</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold tabular-nums">{formatCurrency(labaKotor)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Beban Operasi</span>
              <span className="text-red-500 dark:text-rose-400 font-bold tabular-nums">-{formatCurrency(totalBebanOperasi)}</span>
            </div>
            <div className="pt-4 mt-auto border-t border-slate-100 dark:border-slate-800 flex justify-between items-center transition-colors">
              <span className="font-bold text-slate-800 dark:text-slate-100">Laba Bersih</span>
              <span className={`text-lg font-extrabold tabular-nums ${labaBersih >= 0 ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'}`}>
                {formatCurrency(labaBersih)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card Neraca */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Scale className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Neraca</h3>
            </div>
            <button onClick={handleDownloadNeraca} className="p-2 text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold">
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Total Aktiva</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold tabular-nums">{formatCurrency(totalAktiva)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Kewajiban</span>
              <span className="text-red-500 dark:text-rose-400 font-bold tabular-nums">{formatCurrency(totalKewajiban)}</span>
            </div>
            <div className="pt-4 mt-auto border-t border-slate-100 dark:border-slate-800 flex justify-between items-center transition-colors">
              <span className="font-bold text-slate-800 dark:text-slate-100">Total Modal</span>
              <span className="text-lg font-extrabold text-purple-700 dark:text-purple-400 tabular-nums">
                {formatCurrency(totalEkuitas)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card Arus Kas */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Arus Kas</h3>
            </div>
            <button onClick={handleDownloadArusKas} className="p-2 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold">
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Kas Awal Period</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold tabular-nums">{formatCurrency(totalKasBankStart)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Perubahan Kas</span>
              <span className={`font-bold tabular-nums ${changes >= 0 ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'}`}>
                {formatCurrency(changes)}
              </span>
            </div>
            <div className="pt-4 mt-auto border-t border-slate-100 dark:border-slate-800 flex justify-between items-center transition-colors">
              <span className="font-bold text-slate-800 dark:text-slate-100">Kas Akhir Period</span>
              <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
                {formatCurrency(totalKasBankEnd)}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Rincian Saldo Kas & Bank (Per Tanggal Akhir)</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo kumulatif hingga {filters.endDate}</p>
            </div>
          </div>
          <button onClick={handleDownloadPosisiKas} className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold">
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
          {kasBankEnd.map((item) => (
            <div key={item.name} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1 leading-tight">{item.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Rp</span>
                <span className={`text-base font-black tabular-nums transition-colors ${item.balance < 0 ? 'text-red-500 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                  {formatCurrency(item.balance).replace('Rp', '').trim()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
