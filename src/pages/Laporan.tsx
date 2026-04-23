import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Download, TrendingUp, Scale, ArrowRightLeft, Wallet, Loader2 } from "lucide-react";
import { 
  Transaction, 
  DAFTAR_REKENING, 
  isExpenseMatch, 
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
}

export default function Laporan({ transactions }: Props) {
  const [startingBalances, setStartingBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const docRef = doc(db, "settings", "starting_balances");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setStartingBalances(docSnap.data() as Record<string, number>);
        }
      } catch (error) {
        console.error("Error fetching starting balances:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBalances();
  }, []);

  // --- Helpers ---
  const sumCat = (cats: string[]) => 
    transactions
      .filter(t => cats.includes(t.kategori))
      .reduce((a, b) => a + Math.abs(b.nominal), 0);

  // --- Laba Rugi Data ---
  const pendapatan = sumCat(['Penjualan', 'Pendapatan Lain-Lain']);
  const hpp = sumCat(['HPP / Barang Keluar', 'Barang Keluar']);
  const labaKotor = pendapatan - hpp;

  const biayaPemasaran = sumCat(KATEGORI_BIAYA_PEMASARAN);
  const biayaPenyusutan = sumCat(['Biaya Penyusutan Peralatan', 'Biaya Penyusutan Aset']);
  const biayaUmumAdm = sumCat(KATEGORI_UMUM_ADM);
  const repairAndMaintenance = sumCat(['Biaya Pemeliharaan Peralatan Kantor', 'Maintenance/Perbaikan']);
  
  const totalBebanOperasi = biayaPemasaran + biayaPenyusutan + biayaUmumAdm + repairAndMaintenance;
  const pendapatanOperasi = labaKotor - totalBebanOperasi;

  const pendapatanLainLain = sumCat(['Pendapatan lain', 'Pendapatan Diluar Usaha']);
  const bebanLainLain = sumCat(KATEGORI_LAIN_LAIN);
  const totalLainLain = pendapatanLainLain - bebanLainLain;

  const labaBersih = pendapatanOperasi + totalLainLain;

  // --- Neraca Data ---
  const totalSaldoAwal = Object.values(startingBalances).reduce((a, b) => a + b, 0);
  
  const kasBankList = DAFTAR_REKENING.map(rek => {
    const start = startingBalances[rek] || 0;
    const current = transactions
      .filter(t => t.rekening === rek && t.status !== 'Belum Lunas')
      .reduce((acc, t) => {
        if (['Pemasukan', 'Penjualan', 'Modal Awal', 'Mutasi Masuk'].includes(t.kategori)) {
          return acc + Math.abs(t.nominal);
        } else if (['Pembelian', 'Pembelian Stok', 'Aset Tetap', 'Aset Lancar', 'Mutasi Keluar', 'Biaya Admin'].includes(t.kategori) || isExpenseMatch(t.kategori)) {
          return acc - Math.abs(t.nominal);
        }
        return acc;
      }, 0);
    return { name: rek, balance: start + current };
  });

  const totalKasBank = kasBankList.reduce((a, b) => a + b.balance, 0);

  const piutang = transactions
    .filter(t => t.kategori === 'Penjualan' && t.status === 'Belum Lunas')
    .reduce((a, b) => a + Math.abs(b.nominal), 0);

  const persediaan = transactions.reduce((acc, t) => {
    if (t.kategori === 'Pembelian Stok' || t.kategori === 'Barang Masuk') return acc + Math.abs(t.nominal);
    if (t.kategori === 'HPP / Barang Keluar' || t.kategori === 'Barang Keluar') return acc - Math.abs(t.nominal);
    return acc;
  }, 0);

  const aktivaLancarLainnya = sumCat(['Perlengkapan', 'Peralatan Studio', 'Digital Tools', 'Sewa Gedung Dibayar Dimuka']);
  const totalAktivaLancar = totalKasBank + piutang + persediaan + aktivaLancarLainnya;

  const aktivaTetap = sumCat(['Aset Tetap', 'Peralatan']);
  const akumulasiDepresiasi = sumCat(['Akumulasi Depresiasi Fixed Asset', 'Akumulasi Penyusutan']);
  const totalAktivaTetap = aktivaTetap - akumulasiDepresiasi;

  const totalAktiva = totalAktivaLancar + totalAktivaTetap;

  const hutangDagang = transactions
    .filter(t => t.kategori === 'Pembelian' && t.status === 'Belum Lunas')
    .reduce((a, b) => a + Math.abs(b.nominal), 0);

  const kewajibanLancarLain = sumCat(['Hutang Gaji Karyawan', 'Biaya yang Masih Harus Dibayar']);
  const totalKewajiban = hutangDagang + kewajibanLancarLain;
  
  const modal = sumCat(['Modal Awal', 'Modal Disetor']) + totalSaldoAwal;
  const labaTahunIni = labaBersih;
  const ekuitasLain = sumCat(['OPENING BALANCE EQUITY', 'RETAINED EARNING']);
  const totalEkuitas = modal + labaTahunIni + ekuitasLain;

  // --- Arus Kas Data (Aktivitas Operasi) ---
  const arusKasOperasi = pendapatan - totalBebanOperasi - bebanLainLain + pendapatanLainLain;
  const arusKasInvestasi = -aktivaTetap;
  const perubahanKas = arusKasOperasi + arusKasInvestasi;
  const kasAwalPeriode = totalSaldoAwal;
  const kasAkhirPeriode = totalKasBank;

  // --- PDF Generasi ---
  const addFooter = (doc: jsPDF) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("ACCURATE Accounting System Report", 10, 285);
      doc.text(`Cetak di ${new Date().toLocaleString('id-ID')} - ${i}`, 105, 285, { align: 'center' });
    }
  };

  const handleDownloadPosisiKas = () => {
    const doc = new jsPDF();
    doc.setFontSize(16).setFont("helvetica", "bold").text("Enteros FinTrack", 105, 20, { align: "center" });
    doc.setFontSize(12).text("LAPORAN POSISI KAS & BANK", 105, 28, { align: "center" });
    doc.setFontSize(10).setFont("helvetica", "normal").text(`Per Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 105, 34, { align: "center" });

    const body = kasBankList.map(rek => [rek.name, formatCurrency(rek.balance)]);
    autoTable(doc, {
      startY: 45,
      head: [['REKENING / WALLET', 'SALDO']],
      body,
      foot: [['TOTAL KESELURUHAN KAS', formatCurrency(totalKasBank)]],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
    });
    addFooter(doc);
    doc.save('Laporan_Posisi_Kas.pdf');
  };

  const handleDownloadLabaRugi = () => {
    const doc = new jsPDF();
    doc.setFontSize(16).setFont("helvetica", "bold").text("Enteros FinTrack", 105, 20, { align: "center" });
    doc.setFontSize(12).text("Laba/Rugi (Standar)", 105, 28, { align: "center" });
    doc.setFontSize(10).setFont("helvetica", "normal").text(`Periode: s/d ${new Date().toLocaleDateString('id-ID')}`, 105, 34, { align: "center" });

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
    doc.save('Laporan_Laba_Rugi.pdf');
  };

  const handleDownloadNeraca = () => {
    const doc = new jsPDF();
    doc.setFontSize(14).setFont("helvetica", "bold").text("Enteros FinTrack", 105, 15, { align: "center" });
    doc.setFontSize(12).text("Neraca (Induk Skontro)", 105, 22, { align: "center" });
    doc.setFontSize(9).setFont("helvetica", "normal").text(`Per Tgl: ${new Date().toLocaleDateString('id-ID')}`, 105, 27, { align: "center" });

    // Aktiva side
    const aktivaRows = [
      [{ content: 'AKTIVA', colSpan: 2, styles: { fontStyle: 'bold' } }],
      [{ content: 'Aktiva Lancar', colSpan: 2, styles: { fontStyle: 'bold' } }],
      ['  Kas & Bank', formatCurrency(totalKasBank)],
      ['  Piutang Dagang', formatCurrency(piutang)],
      ['  Persediaan', formatCurrency(persediaan)],
      ['  Aktiva Lancar Lainnya', formatCurrency(aktivaLancarLainnya)],
      [{ content: 'JUMLAH AKTIVA LANCAR', styles: { fontStyle: 'bold' } }, formatCurrency(totalAktivaLancar)],
      ['', ''],
      [{ content: 'Aktiva Tetap', colSpan: 2, styles: { fontStyle: 'bold' } }],
      ['  Nilai Histori Aset', formatCurrency(aktivaTetap)],
      ['  Akumulasi Penyusutan', formatCurrency(-akumulasiDepresiasi)],
      [{ content: 'JUMLAH AKTIVA TETAP', styles: { fontStyle: 'bold' } }, formatCurrency(totalAktivaTetap)],
      ['', ''],
      [{ content: 'TOTAL AKTIVA', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatCurrency(totalAktiva), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ];

    // Kewajiban & Ekuitas side
    const pasivaRows = [
      [{ content: 'KEWAJIBAN & EKUITAS', colSpan: 2, styles: { fontStyle: 'bold' } }],
      [{ content: 'Kewajiban', colSpan: 2, styles: { fontStyle: 'bold' } }],
      ['  Hutang Dagang', formatCurrency(hutangDagang)],
      ['  Kewajiban Lancar Lain', formatCurrency(kewajibanLancarLain)],
      [{ content: 'JUMLAH KEWAJIBAN', styles: { fontStyle: 'bold' } }, formatCurrency(totalKewajiban)],
      ['', ''],
      [{ content: 'Ekuitas', colSpan: 2, styles: { fontStyle: 'bold' } }],
      ['  Modal', formatCurrency(modal)],
      ['  Laba Tahun Ini', formatCurrency(labaTahunIni)],
      ['  Retained Earning / Equity Other', formatCurrency(ekuitasLain)],
      [{ content: 'JUMLAH EKUITAS', styles: { fontStyle: 'bold' } }, formatCurrency(totalEkuitas)],
      ['', ''],
      [{ content: 'TOTAL PASIVA', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatCurrency(totalKewajiban + totalEkuitas), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ];

    // We combine them manually in the UI or use two tables in PDF
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
    doc.save('Laporan_Neraca.pdf');
  };

  const handleDownloadArusKas = () => {
    const doc = new jsPDF();
    doc.setFontSize(16).setFont("helvetica", "bold").text("Enteros FinTrack", 105, 20, { align: "center" });
    doc.setFontSize(12).text("Laporan Arus Kas (Metode Langsung)", 105, 28, { align: "center" });
    doc.setFontSize(10).setFont("helvetica", "normal").text(`Periode: s/d ${new Date().toLocaleDateString('id-ID')}`, 105, 34, { align: "center" });

    autoTable(doc, {
      startY: 45,
      body: [
        [{ content: 'Arus Kas dari Aktivitas Operasi', styles: { fontStyle: 'bold' } }, ''],
        ['  Pendapatan', formatCurrency(pendapatan)],
        ['  Biaya Pemasaran Umum & ADM', formatCurrency(-totalBebanOperasi)],
        ['  Pendapatan/Biaya Luar Usaha', formatCurrency(totalLainLain)],
        [{ content: 'Kas bersih dari Aktivitas Operasi', styles: { fontStyle: 'bold' } }, formatCurrency(arusKasOperasi)],
        ['', ''],
        [{ content: 'Arus Kas dari Aktivitas Investasi', styles: { fontStyle: 'bold' } }, ''],
        ['  Pembelian Aktiva Tetap', formatCurrency(arusKasInvestasi)],
        [{ content: 'Kas bersih dari Aktivitas Investasi', styles: { fontStyle: 'bold' } }, formatCurrency(arusKasInvestasi)],
        ['', ''],
        [{ content: 'Perubahan Kas dalam Periode', styles: { fontStyle: 'bold' } }, formatCurrency(perubahanKas)],
        ['  Kas pada Awal Periode', formatCurrency(kasAwalPeriode)],
        [{ content: 'KAS PADA AKHIR PERIODE', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatCurrency(kasAkhirPeriode), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
      ],
      theme: 'plain',
    });
    addFooter(doc);
    doc.save('Laporan_Arus_Kas.pdf');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500">Memuat data laporan...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Laporan Keuangan</h2>
        <p className="mt-1.5 text-sm font-medium text-slate-500">
          Ringkasan performa keuangan dan posisi aset perusahaan (Format Accurate).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Laba Rugi */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-800">Laba Rugi</h3>
            </div>
            <button onClick={handleDownloadLabaRugi} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold">
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Laba Kotor</span>
              <span className="text-slate-800 font-bold tabular-nums">{formatCurrency(labaKotor)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Beban Operasi</span>
              <span className="text-red-500 font-bold tabular-nums">-{formatCurrency(totalBebanOperasi)}</span>
            </div>
            <div className="pt-4 mt-auto border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-800">Laba Bersih</span>
              <span className={`text-lg font-extrabold tabular-nums ${labaBersih >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(labaBersih)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card Neraca */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <Scale className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-800">Neraca</h3>
            </div>
            <button onClick={handleDownloadNeraca} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold">
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Aktiva Lancar</span>
              <span className="text-slate-800 font-bold tabular-nums">{formatCurrency(totalAktivaLancar)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Kewajiban</span>
              <span className="text-red-500 font-bold tabular-nums">{formatCurrency(totalKewajiban)}</span>
            </div>
            <div className="pt-4 mt-auto border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-800">Total Modal</span>
              <span className="text-lg font-extrabold text-purple-700 tabular-nums">
                {formatCurrency(totalEkuitas)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card Arus Kas */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-800">Arus Kas</h3>
            </div>
            <button onClick={handleDownloadArusKas} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold">
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Kas Awal</span>
              <span className="text-slate-800 font-bold tabular-nums">{formatCurrency(kasAwalPeriode)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Perubahan Bersih</span>
              <span className={`font-bold tabular-nums ${perubahanKas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(perubahanKas)}
              </span>
            </div>
            <div className="pt-4 mt-auto border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-800">Kas Akhir</span>
              <span className="text-lg font-extrabold text-amber-700 tabular-nums">
                {formatCurrency(kasAkhirPeriode)}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Detail Kas per Rekening */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Rincian Posisi Saldo Kas & Bank</h3>
              <p className="text-xs font-medium text-slate-500">Saldo saat ini (Saldo Awal + Arus Transaksi)</p>
            </div>
          </div>
          <button onClick={handleDownloadPosisiKas} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold">
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {kasBankList.map((item) => (
            <div key={item.name} className="p-5 hover:bg-slate-50 transition-colors">
              <p className="text-[10px] uppercase font-black text-slate-400 mb-1 leading-tight">{item.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold text-slate-400">Rp</span>
                <span className={`text-base font-black tabular-nums transition-colors ${item.balance < 0 ? 'text-red-500' : 'text-slate-700'}`}>
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
