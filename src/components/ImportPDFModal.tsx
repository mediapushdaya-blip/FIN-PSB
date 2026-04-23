import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, UploadCloud, FileText, Check, AlertCircle, Edit, Save, Loader2, Trash2 } from 'lucide-react';
import { ExtractedTransaction, parseMandiriStatement } from '../utils/pdfParser';
import { DAFTAR_REKENING, KATEGORI_PENGELUARAN_DETAIL, Transaction } from '../types';

interface ExtendedExtractedTx extends ExtractedTransaction {
  rekening: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (transactions: Omit<Transaction, 'id'>[]) => Promise<void>;
}

export default function ImportPDFModal({ isOpen, onClose, onConfirm }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtendedExtractedTx[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setIsExtracting(true);
      try {
        const data = await parseMandiriStatement(selectedFile);
        const extendedData = data.map(item => ({ ...item, rekening: DAFTAR_REKENING[1] })); // Default Mandiri 2
        setExtractedData(extendedData);
      } catch (error) {
        alert("Gagal membaca PDF. Pastikan format Rekening Koran Mandiri valid.");
      } finally {
        setIsExtracting(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.type !== 'application/pdf') {
        alert("Hanya format PDF yang didukung.");
        return;
      }
      setFile(selectedFile);
      setIsExtracting(true);
      try {
        const data = await parseMandiriStatement(selectedFile);
        const extendedData = data.map(item => ({ ...item, rekening: DAFTAR_REKENING[1] })); // Default Mandiri 2
        setExtractedData(extendedData);
      } catch (error) {
         alert("Gagal membaca file.");
      } finally {
        setIsExtracting(false);
      }
    }
  };

  const updateItem = (id: string, field: keyof ExtendedExtractedTx, value: any) => {
    if(!extractedData) return;
    setExtractedData(extractedData.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        // Reset category if type shifts
        if (field === 'tipe') {
          updatedItem.kategori = value === 'Masuk' ? 'Pemasukan' : 'Mutasi Keluar';
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    if(!extractedData) return;
    setExtractedData(extractedData.filter(item => item.id !== id));
  };

  const handleSubmit = async () => {
    if(!extractedData || extractedData.length === 0) return;
    setIsSubmitting(true);
    try {
      const formattedTxs: Omit<Transaction, 'id'>[] = extractedData.map(item => ({
        tanggal: item.tanggal, // expected YYYY-MM-DD
        deskripsi: item.deskripsi,
        kategori: item.kategori,
        nominal: item.tipe === 'Keluar' ? -Math.abs(item.nominal) : Math.abs(item.nominal),
        status: 'Verified',
        rekening: item.rekening // use selected rekening per row
      }));
      await onConfirm(formattedTxs);
      onClose();
      setFile(null);
      setExtractedData(null);
    } catch (error) {
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl w-full max-w-5xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Import Rekening Koran PDF</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Sistem otomatis mendeteksi transaksi dari PDF Bank Mandiri</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 bg-slate-50 rounded-full hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {!extractedData ? (
             <div 
               onDragOver={handleDragOver}
               onDrop={handleDrop}
               className="border-2 border-dashed border-slate-300 rounded-2xl p-10 flex flex-col items-center justify-center text-center bg-white hover:bg-slate-50/50 transition-colors cursor-pointer group"
               onClick={() => fileInputRef.current?.click()}
             >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".pdf" 
                  className="hidden" 
                  onChange={handleFileChange} 
                />
                
                {isExtracting ? (
                  <>
                    <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                    <h4 className="text-lg font-bold text-slate-800 mb-2">Mengekstrak Data PDF...</h4>
                    <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto">Kami sedang memindai baris per baris transaksi dari rekening koran Anda.</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-100 transition-all">
                      <UploadCloud className="h-8 w-8" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-2">Unggah File PDF</h4>
                    <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto mb-6">Tarik dan letakkan file PDF Mandiri Statement ke area ini, atau klik untuk memilih file dari komputer Anda.</p>
                    <span className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-sm">Pilih File PDF</span>
                  </>
                )}
             </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                     <Check className="h-5 w-5" />
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-800">Ekstraksi Selesai!</h4>
                     <p className="text-sm font-medium text-slate-500">Ditemukan {extractedData.length} baris transaksi.</p>
                   </div>
                 </div>
                 <button 
                  onClick={() => { setExtractedData(null); setFile(null); }}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline"
                 >
                   Ganti File
                 </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                 <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Tanggal</th>
                          <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider min-w-[300px]">Deskripsi</th>
                          <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Rekening Tujuan / Sumber</th>
                          <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Jenis Transaksi</th>
                          <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Kategori</th>
                          <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">Nominal</th>
                          <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {extractedData.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-medium">
                              Tidak ada transaksi yang dapat dibaca. Pastikan format PDF Mandiri Statement / Kopra yang asli.
                            </td>
                          </tr>
                        )}
                        {extractedData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <input 
                                type="date"
                                value={item.tanggal}
                                onChange={(e) => updateItem(item.id, 'tanggal', e.target.value)}
                                className="w-32 text-sm border-slate-200 rounded p-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="text"
                                value={item.deskripsi}
                                onChange={(e) => updateItem(item.id, 'deskripsi', e.target.value)}
                                className="w-full text-sm border border-transparent hover:border-slate-300 focus:border-blue-500 rounded p-1.5 focus:ring-blue-500 transition-colors"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select 
                                value={item.rekening}
                                onChange={(e) => updateItem(item.id, 'rekening', e.target.value)}
                                className="text-sm border-slate-200 rounded p-1.5 focus:ring-blue-500 w-40"
                              >
                                {DAFTAR_REKENING.map((rek) => (
                                  <option key={rek} value={rek}>{rek}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <select 
                                value={item.tipe}
                                onChange={(e) => updateItem(item.id, 'tipe', e.target.value)}
                                className={`text-sm rounded p-1 font-semibold focus:ring-blue-500 ${item.tipe === 'Masuk' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                              >
                                <option value="Masuk">Masuk (Debit)</option>
                                <option value="Keluar">Keluar (Kredit)</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <select 
                                value={item.kategori}
                                onChange={(e) => updateItem(item.id, 'kategori', e.target.value)}
                                className="text-sm border-slate-200 rounded p-1.5 focus:ring-blue-500 w-40"
                              >
                                {item.tipe === 'Masuk' ? (
                                  <>
                                    <option value="Pemasukan">Pemasukan (Umum)</option>
                                    <option value="Penjualan">Penjualan</option>
                                    <option value="Modal Awal">Modal Awal</option>
                                    <option value="Mutasi Masuk">Mutasi Masuk</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="Mutasi Keluar">Mutasi Keluar (WD/TF)</option>
                                    <option value="Pembelian">Pembelian Barang/Stok</option>
                                    <option value="Biaya Admin">Biaya Admin</option>
                                    {KATEGORI_PENGELUARAN_DETAIL.map(k => <option key={k} value={k}>{k}</option>)}
                                  </>
                                )}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input 
                                type="number"
                                value={item.nominal}
                                onChange={(e) => updateItem(item.id, 'nominal', Number(e.target.value))}
                                className="w-32 text-sm border-slate-200 rounded p-1 text-right focus:ring-blue-500 tabular-nums"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button 
                                onClick={() => removeItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Hapus Baris"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </div>
            </div>
          )}
        </div>

        {extractedData && extractedData.length > 0 && (
          <div className="p-6 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> 
              Mohon periksa dan konfirmasi tabel di atas sebelum disimpan.
            </p>
            <div className="flex gap-3">
               <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Import ke Database
                </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
