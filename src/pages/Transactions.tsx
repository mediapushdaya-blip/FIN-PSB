import React, { useState, useMemo } from "react";
import { 
  Search, Filter, Download, Plus, Loader2, CheckCircle2, 
  AlertCircle, X, FileSpreadsheet, UploadCloud, 
  ChevronUp, ChevronDown, Trash2, Edit2, CheckSquare, Square, 
  Calendar, CreditCard, Tag
} from "lucide-react";
import { Transaction, DAFTAR_REKENING, KATEGORI_PENGELUARAN_DETAIL, isExpenseMatch } from "../types";
import { formatCurrency, formatNumber, getLocalDateString, parseDateForInput } from "../utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ImportPDFModal from "../components/ImportPDFModal";

interface Props {
  title: string;
  type: 'penjualan' | 'pembelian' | 'kas' | 'persediaan' | 'aset';
  transactions: Transaction[];
  isLoading: boolean;
  onAdd: (tx: Omit<Transaction, 'id'>) => Promise<boolean>;
  onEdit?: (tx: Transaction) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
  onBulkEdit?: (ids: string[], updates: Partial<Transaction>) => Promise<boolean>;
  onBulkDelete?: (ids: string[]) => Promise<boolean>;
  onRefresh: () => void;
}

export default function Transactions({ title, type, transactions, isLoading, onAdd, onEdit, onDelete, onBulkEdit, onBulkDelete, onRefresh }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [filterKategori, setFilterKategori] = useState('Semua');
  const [filterRekening, setFilterRekening] = useState('Semua');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction, direction: 'asc' | 'desc' }>({
    key: 'tanggal',
    direction: 'desc'
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFormData, setBulkFormData] = useState<Partial<Transaction>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportPDFOpen, setIsImportPDFOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isPenjualan = type === 'penjualan';
  const isPembelian = type === 'pembelian';
  const isKas = type === 'kas';
  const isPersediaan = type === 'persediaan';
  const isAset = type === 'aset';

  const [formData, setFormData] = useState({
    tanggal: getLocalDateString(),
    deskripsi: '',
    kategori: isPenjualan ? 'Penjualan' : isPembelian ? 'Pembelian' : isPersediaan ? 'Barang Masuk' : isAset ? 'Aset Tetap' : 'Pemasukan',
    nominal: '',
    qty: '',
    status: isKas ? 'Verified' : (isPersediaan || isAset) ? 'Selesai' : 'Lunas',
    rekening: DAFTAR_REKENING[0]
  });

  const filteredTransactions = useMemo(() => {
    let result = transactions.filter(tx => {
      // Filter by module type
      if (isPenjualan && tx.kategori !== 'Penjualan') return false;
      if (isPembelian && tx.kategori !== 'Pembelian') return false;
      if (isKas && !(['Pemasukan', 'Penjualan', 'Pembelian', 'Modal Awal', 'Mutasi Masuk', 'Mutasi Keluar', 'Biaya Admin', 'Aset Tetap', 'Aset Lancar', 'Pembelian Stok'].includes(tx.kategori) || isExpenseMatch(tx.kategori))) return false;
      if (isPersediaan && !['Barang Masuk', 'Barang Keluar', 'Persediaan'].includes(tx.kategori)) return false;
      if (isAset && !['Aset Tetap', 'Aset Lancar'].includes(tx.kategori)) return false;
      
      // Filter by search
      const matchesSearch = tx.deskripsi.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      
      // Filter by status
      if (filterStatus !== 'Semua' && tx.status !== filterStatus) return false;

      // Filter by kategori
      if (filterKategori !== 'Semua' && tx.kategori !== filterKategori) return false;

      // Filter by rekening
      if (filterRekening !== 'Semua' && tx.rekening !== filterRekening) return false;

      // Filter by date range
      if (filterDateStart && tx.tanggal < filterDateStart) return false;
      if (filterDateEnd && tx.tanggal > filterDateEnd) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      const aValue = a[sortConfig.key] ?? '';
      const bValue = b[sortConfig.key] ?? '';

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [transactions, type, searchQuery, filterStatus, filterKategori, filterRekening, filterDateStart, filterDateEnd, sortConfig]);

  const handleSort = (key: keyof Transaction) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const ids = filteredTransactions.map(tx => tx.id).filter(Boolean) as string[];
      setSelectedIds(ids);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(current => 
      current.includes(id) ? current.filter(i => i !== id) : [...current, id]
    );
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onBulkEdit || selectedIds.length === 0) return;
    
    setIsSubmitting(true);
    const success = await onBulkEdit(selectedIds, bulkFormData);
    if (success) {
      setIsBulkModalOpen(false);
      setSelectedIds([]);
      setBulkFormData({});
    }
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    let finalKategori = formData.kategori;
    let finalNominal = Number(formData.nominal);

    if (isPenjualan) {
      finalKategori = 'Penjualan';
      finalNominal = Math.abs(finalNominal);
    } else if (isPembelian) {
      finalKategori = 'Pembelian';
      finalNominal = -Math.abs(finalNominal);
    } else if (isKas) {
      finalNominal = isExpenseMatch(formData.kategori) || ['Mutasi Keluar', 'Biaya Admin', 'Pembelian', 'Aset Tetap', 'Aset Lancar', 'Pembelian Stok'].includes(formData.kategori) ? -Math.abs(finalNominal) : Math.abs(finalNominal);
    } else if (isPersediaan) {
      finalNominal = formData.kategori === 'Barang Keluar' ? -Math.abs(finalNominal) : Math.abs(finalNominal);
    } else if (isAset) {
      finalNominal = Math.abs(finalNominal); // Aset is always positive value in this context
    }

    let success = false;
    const txData = {
      tanggal: formData.tanggal,
      deskripsi: formData.deskripsi,
      kategori: finalKategori,
      nominal: finalNominal,
      qty: formData.qty ? Number(formData.qty) : undefined,
      status: formData.status,
      rekening: isKas ? formData.rekening : undefined
    };

    if (editingId && onEdit) {
      success = await onEdit({ id: editingId, ...txData });
    } else {
      success = await onAdd(txData);
    }

    if (success) {
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ ...formData, deskripsi: '', nominal: '', qty: '' });
    }
    setIsSubmitting(false);
  };

  const handleOpenNewModal = () => {
    setEditingId(null);
    setFormData({
      tanggal: getLocalDateString(),
      deskripsi: '',
      kategori: isPenjualan ? 'Penjualan' : isPembelian ? 'Pembelian' : isPersediaan ? 'Barang Masuk' : isAset ? 'Aset Tetap' : 'Pemasukan',
      nominal: '',
      qty: '',
      status: isKas ? 'Verified' : (isPersediaan || isAset) ? 'Selesai' : 'Lunas',
      rekening: DAFTAR_REKENING[0]
    });
    setIsModalOpen(true);
  };

  const handleDownload = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PT Putra Serayu Berdaya", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(`LAPORAN ${title.toUpperCase()}`, 105, 28, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Diekstrak: ${new Date().toLocaleDateString('id-ID')}`, 105, 34, { align: "center" });

    const headers = [['Tanggal', isPersediaan ? 'Nama Barang' : (isAset ? 'Nama Aset' : (isPenjualan ? 'Pelanggan' : (isPembelian ? 'Vendor' : 'Deskripsi'))), 'Kategori', isKas ? 'Rekening' : '', 'Status', 'Nominal (Rp)'].filter(Boolean)];
    
    const body = filteredTransactions.map(t => {
      const row = [
        t.tanggal, 
        t.qty ? `${t.deskripsi} (${t.qty} Pcs)` : t.deskripsi, 
        t.kategori
      ];
      if (isKas) row.push(t.rekening || '-');
      row.push(t.status);
      row.push(formatCurrency(t.nominal));
      return row;
    });

    autoTable(doc, {
      startY: 45,
      head: headers,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // Blue 500
      styles: { fontSize: 8 },
    });

    const filename = `Laporan_${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
          <p className="mt-1.5 text-sm font-medium text-slate-500">
            Kelola data {title.toLowerCase()} perusahaan Anda di sini.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isKas && (
            <button 
              onClick={() => setIsImportPDFOpen(true)}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-100 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-200 shadow-sm transition-all hover:shadow"
            >
              <UploadCloud className="h-4 w-4" /> Import Excel/PDF
            </button>
          )}
          <button 
            onClick={handleOpenNewModal}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-all hover:shadow"
          >
            <Plus className="h-4 w-4" /> Buat Baru
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col min-h-[500px]">
        <div className="border-b border-slate-200 p-5 space-y-4 bg-white rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cari deskripsi..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <CheckCircle2 className="h-4 w-4 text-slate-400" />
                  </span>
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white min-w-[140px]"
                  >
                    <option value="Semua">Semua Status</option>
                    {isKas ? (
                      <>
                        <option value="Verified">Verified</option>
                        <option value="Pending">Pending</option>
                      </>
                    ) : (isPersediaan || isAset) ? (
                      <option value="Selesai">Selesai</option>
                    ) : (
                      <>
                        <option value="Lunas">Lunas</option>
                        <option value="Belum Lunas">Belum Lunas</option>
                      </>
                    )}
                  </select>
                </div>

                {isKas && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">
                      <CreditCard className="h-4 w-4 text-slate-400" />
                    </span>
                    <select 
                      value={filterRekening}
                      onChange={(e) => setFilterRekening(e.target.value)}
                      className="pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white min-w-[160px]"
                    >
                      <option value="Semua">Semua Rekening</option>
                      {DAFTAR_REKENING.map(rek => <option key={rek} value={rek}>{rek}</option>)}
                    </select>
                  </div>
                )}

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Tag className="h-4 w-4 text-slate-400" />
                  </span>
                  <select 
                    value={filterKategori}
                    onChange={(e) => setFilterKategori(e.target.value)}
                    className="pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white min-w-[140px]"
                  >
                    <option value="Semua">Semua Kategori</option>
                    {Array.from(new Set(transactions.map(t => t.kategori))).sort().map(kat => (
                      <option key={kat} value={kat}>{kat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <>
                  {onBulkEdit && (
                    <button 
                      onClick={() => setIsBulkModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit {selectedIds.length} Data
                    </button>
                  )}
                  {onBulkDelete && (
                    <button 
                      disabled={isSubmitting}
                      onClick={async () => {
                        if (window.confirm(`Yakin ingin menghapus ${selectedIds.length} data yang dipilih?`)) {
                          setIsSubmitting(true);
                          try {
                            const success = await onBulkDelete(selectedIds);
                            if (success) setSelectedIds([]);
                          } finally {
                            setIsSubmitting(false);
                          }
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm transition-all text-center disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Hapus {selectedIds.length}
                    </button>
                  )}
                </>
              )}
              <button onClick={onRefresh} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Loader2 className="h-4 w-4" />}
                Refresh
              </button>
              <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                Export
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Rentang Tanggal:</span>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-400">s/d</span>
                <input 
                  type="date" 
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {(filterDateStart || filterDateEnd) && (
                  <button 
                    onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); }}
                    className="text-xs text-red-500 font-semibold hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="border-b border-slate-200 px-4 py-3 w-10">
                  <div className="flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll}
                      checked={selectedIds.length === filteredTransactions.length && filteredTransactions.length > 0}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                </th>
                <th 
                  className="border-b border-slate-200 px-6 py-3 text-xs font-semibold uppercase text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('tanggal')}
                >
                  <div className="flex items-center gap-1">
                    Tanggal
                    {sortConfig.key === 'tanggal' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th 
                  className="border-b border-slate-200 px-6 py-3 text-xs font-semibold uppercase text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('deskripsi')}
                >
                  <div className="flex items-center gap-1">
                    {isPersediaan ? 'Nama Barang' : (isAset ? 'Nama Aset' : (isPenjualan ? 'Pelanggan' : (isPembelian ? 'Vendor' : 'Deskripsi')))}
                    {sortConfig.key === 'deskripsi' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th 
                  className="border-b border-slate-200 px-6 py-3 text-xs font-semibold uppercase text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('kategori')}
                >
                  <div className="flex items-center gap-1">
                    Kategori
                    {sortConfig.key === 'kategori' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                {isKas && (
                  <th 
                    className="border-b border-slate-200 px-6 py-3 text-xs font-semibold uppercase text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('rekening')}
                  >
                    <div className="flex items-center gap-1">
                      Rekening
                      {sortConfig.key === 'rekening' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </div>
                  </th>
                )}
                <th 
                  className="border-b border-slate-200 px-6 py-3 text-xs font-semibold uppercase text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th 
                  className="border-b border-slate-200 px-6 py-3 text-xs font-semibold uppercase text-slate-500 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('nominal')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Nominal (Rp)
                    {sortConfig.key === 'nominal' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th className="border-b border-slate-200 px-6 py-3 text-xs font-semibold uppercase text-slate-500 text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={isKas ? 8 : 7} className="px-6 py-12 text-center text-sm text-slate-500">
                    Tidak ada data yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, i) => (
                  <tr key={tx.id || i} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(tx.id!) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center">
                         <input 
                           type="checkbox" 
                           checked={selectedIds.includes(tx.id!)}
                           onChange={() => handleSelectRow(tx.id!)}
                           className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                         />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{tx.tanggal}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      {tx.deskripsi}
                      {tx.qty ? <span className="ml-2 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">{tx.qty} Pcs</span> : null}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        ['Pemasukan', 'Penjualan', 'Barang Masuk', 'Aset Tetap', 'Aset Lancar', 'Modal Awal', 'Mutasi Masuk'].includes(tx.kategori) ? 'bg-green-100 text-green-700' :
                        (['Pembelian', 'Barang Keluar', 'Mutasi Keluar', 'Biaya Admin'].includes(tx.kategori) || isExpenseMatch(tx.kategori)) ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {tx.kategori}
                      </span>
                    </td>
                    {isKas && (
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {tx.rekening || '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm">
                      <span className={`flex items-center gap-1.5 ${['Verified', 'Lunas', 'Selesai'].includes(tx.status) ? 'text-green-600' : 'text-amber-600'}`}>
                        {['Verified', 'Lunas', 'Selesai'].includes(tx.status) ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4" />}
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                      <span className={`tabular-nums ${tx.nominal < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {formatCurrency(tx.nominal)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                         <button 
                           onClick={() => {
                             setEditingId(tx.id || null);
                             setFormData({
                               tanggal: parseDateForInput(tx.tanggal),
                               deskripsi: tx.deskripsi,
                               kategori: tx.kategori,
                               nominal: String(Math.abs(tx.nominal)),
                               qty: tx.qty ? String(tx.qty) : '',
                               status: tx.status,
                               rekening: tx.rekening || DAFTAR_REKENING[0]
                             });
                             setIsModalOpen(true);
                           }}
                           className="text-blue-600 hover:text-blue-800 text-xs font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                         >
                           Edit
                         </button>
                         {onDelete && tx.id && (
                           <button 
                             onClick={async () => {
                               console.log("Delete button clicked for ID:", tx.id);
                               if (window.confirm("Yakin ingin menghapus data ini?")) {
                                 setDeletingId(tx.id!);
                                 try {
                                   const success = await onDelete(tx.id!);
                                   if (!success) {
                                      console.log("onDelete returned false");
                                   }
                                 } catch (err: any) {
                                   console.error("onDelete threw error:", err);
                                   alert("Error sistem saat menghapus: " + err.message);
                                 } finally {
                                   setDeletingId(null);
                                 }
                               }
                             }}
                             disabled={deletingId === tx.id}
                             className="text-red-600 hover:text-red-800 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                           >
                             {deletingId === tx.id ? 'Hapus...' : 'Hapus'}
                           </button>
                         )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 p-4 bg-slate-50 rounded-b-xl flex justify-between items-center text-sm text-slate-500">
          <span>Menampilkan {filteredTransactions.length} data</span>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 p-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" /> {editingId ? 'Edit' : 'Buat'} {title} {editingId ? '' : 'Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="rounded-full p-1.5 hover:bg-slate-200 text-slate-500 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tanggal</label>
                  <input 
                    type="date" 
                    required
                    value={formData.tanggal}
                    onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    {isKas || isPersediaan || isAset ? 'Kategori' : 'Status'}
                  </label>
                  {isKas ? (
                    <select 
                      value={formData.kategori}
                      onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white"
                    >
                      <option value="Pemasukan">Pemasukan (Lainnya)</option>
                      <option disabled>--- Pengeluaran Spesifik ---</option>
                      {KATEGORI_PENGELUARAN_DETAIL.map(kat => (
                        <option key={kat} value={kat}>{kat.replace('Pengeluaran - ', '')}</option>
                      ))}
                      <option disabled>--- Transaksi Operasional ---</option>
                      <option value="Biaya Admin">Biaya Admin Platform</option>
                      <option value="Pengeluaran Lainnya">Pengeluaran Lainnya</option>
                    </select>
                  ) : isPersediaan ? (
                    <select 
                      value={formData.kategori}
                      onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white"
                    >
                      <option value="Barang Masuk">Barang Masuk</option>
                      <option value="Barang Keluar">Barang Keluar</option>
                    </select>
                  ) : isAset ? (
                    <select 
                      value={formData.kategori}
                      onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white"
                    >
                      <option value="Aset Tetap">Aset Tetap (Kendaraan, Mesin, dll)</option>
                      <option value="Aset Lancar">Aset Lancar (Investasi Jangka Pendek)</option>
                    </select>
                  ) : (
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white"
                    >
                      <option value="Lunas">Lunas</option>
                      <option value="Belum Lunas">Belum Lunas</option>
                    </select>
                  )}
                </div>
              </div>
              
              {isKas && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Rekening</label>
                  <select 
                    value={formData.rekening}
                    onChange={(e) => setFormData({...formData, rekening: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white"
                  >
                    {DAFTAR_REKENING.map(rek => (
                      <option key={rek} value={rek}>{rek}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  {isPersediaan ? 'Nama Barang' : (isAset ? 'Nama Aset' : (isPenjualan ? 'Nama Pelanggan / No. Faktur' : (isPembelian ? 'Nama Vendor / No. Faktur' : 'Deskripsi Transaksi')))}
                </label>
                <input 
                  type="text" 
                  required
                  placeholder={isPersediaan ? "Contoh: Enteros 100ml" : (isAset ? "Contoh: Mobil Box GranMax" : "Contoh: Pembayaran Invoice #INV-001")}
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div className={`grid ${isPersediaan || ['Penjualan', 'Pembelian'].includes(formData.kategori) || isPenjualan || isPembelian ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'} gap-5`}>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Nominal / Total Rp
                  </label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    placeholder="0"
                    value={formData.nominal}
                    onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                  />
                </div>
                
                {(isPersediaan || ['Penjualan', 'Pembelian'].includes(formData.kategori) || isPenjualan || isPembelian) && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Jumlah Qty (Pcs)
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      placeholder="Contoh: 15"
                      value={formData.qty}
                      onChange={(e) => setFormData({...formData, qty: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    {isKas || isPersediaan || isAset ? 'Status' : 'Kategori'}
                  </label>
                  {isKas ? (
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white"
                    >
                      <option value="Verified">Verified (Selesai)</option>
                      <option value="Pending">Pending (Menunggu)</option>
                    </select>
                  ) : (isPersediaan || isAset) ? (
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white"
                    >
                      <option value="Selesai">Selesai</option>
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      disabled
                      value={isPenjualan ? 'Penjualan' : 'Pembelian'}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500"
                    />
                  )}
                </div>
              </div>

              <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70 shadow-sm transition-all hover:shadow"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {editingId ? 'Simpan Perubahan' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Masal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-blue-600" />
                Edit Masal ({selectedIds.length} Data)
              </h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleBulkSubmit} className="p-5 space-y-5">
              <p className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
                Pilih field yang ingin diubah secara bersamaan untuk semua data yang dipilih. Field yang dikosongkan tidak akan diubah.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Kategori</label>
                  <select 
                    onChange={(e) => setBulkFormData({...bulkFormData, kategori: e.target.value || undefined})}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    <option value="">-- Tetap (Tidak Berubah) --</option>
                    {isKas ? (
                      <>
                        <option value="Pemasukan">Pemasukan</option>
                        <option value="Modal Awal">Modal Awal</option>
                        <option value="Mutasi Masuk">Mutasi Masuk</option>
                        <option value="Mutasi Keluar">Mutasi Keluar</option>
                        <option value="Biaya Admin">Biaya Admin</option>
                        {KATEGORI_PENGELUARAN_DETAIL.map(kat => (
                          <option key={kat} value={kat}>{kat}</option>
                        ))}
                      </>
                    ) : isPersediaan ? (
                      <>
                        <option value="Barang Masuk">Barang Masuk</option>
                        <option value="Barang Keluar">Barang Keluar</option>
                        <option value="Persediaan">Persediaan</option>
                      </>
                    ) : isAset ? (
                      <>
                        <option value="Aset Tetap">Aset Tetap</option>
                        <option value="Aset Lancar">Aset Lancar</option>
                      </>
                    ) : (
                      <option value={isPenjualan ? 'Penjualan' : 'Pembelian'}>{isPenjualan ? 'Penjualan' : 'Pembelian'}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Rekening</label>
                  <select 
                    onChange={(e) => setBulkFormData({...bulkFormData, rekening: e.target.value || undefined})}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    <option value="">-- Tetap (Tidak Berubah) --</option>
                    {DAFTAR_REKENING.map(rek => (
                      <option key={rek} value={rek}>{rek}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Status</label>
                  <select 
                    onChange={(e) => setBulkFormData({...bulkFormData, status: e.target.value || undefined})}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    <option value="">-- Tetap (Tidak Berubah) --</option>
                    {isKas ? (
                      <>
                        <option value="Verified">Verified</option>
                        <option value="Pending">Pending</option>
                      </>
                    ) : (isPersediaan || isAset) ? (
                      <option value="Selesai">Selesai</option>
                    ) : (
                      <>
                        <option value="Lunas">Lunas</option>
                        <option value="Belum Lunas">Belum Lunas</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsBulkModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || Object.keys(bulkFormData).length === 0}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70 shadow-sm transition-all hover:shadow"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportPDFModal 
        isOpen={isImportPDFOpen} 
        onClose={() => setIsImportPDFOpen(false)} 
        onConfirm={async (txs) => {
          for(const tx of txs) {
            await onAdd(tx);
          }
          setIsImportPDFOpen(false);
          onRefresh();
        }}
      />
    </div>
  );
}
