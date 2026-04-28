import React, { useState, useEffect } from "react";
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Settings from "./pages/Settings";
import Laporan from "./pages/Laporan";
import Rekonsiliasi from "./pages/Rekonsiliasi";
import { 
  Transaction, 
  TabType, 
  DAFTAR_REKENING, 
  KATEGORI_PENGELUARAN_DETAIL, 
  isOutflowCategory
} from "./types";
import { CheckCircle2, AlertCircle, Plus, X, Loader2, LogOut } from "lucide-react";
import { supabaseService } from "./services/supabaseService";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startingBalances, setStartingBalances] = useState<Record<string, number>>({});
  const [balanceDate, setBalanceDate] = useState("");
  const [appSettings, setAppSettings] = useState({ name: "MY FINANCING", logo: "", favicon: "" });
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Supabase Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      setDarkMode(savedMode === 'true');
    } else {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    document.title = appSettings.name || "MY FINANCING";
    if (appSettings.favicon) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = appSettings.favicon;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = appSettings.favicon;
        document.head.appendChild(newLink);
      }
    }
  }, [appSettings.name, appSettings.favicon]);

  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success'|'error'}>({show: false, message: '', type: 'success'});
  
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSubmittingQuickAdd, setIsSubmittingQuickAdd] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    jenis: 'Pemasukan',
    tanggal: new Date().toISOString().split('T')[0],
    deskripsi: '',
    nominal: '',
    qty: '',
    hargaModal: '',
    rekening: DAFTAR_REKENING[0],
    kategoriDetail: KATEGORI_PENGELUARAN_DETAIL[0]
  });

  const showToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({show: true, message, type});
    setTimeout(() => setToast({show: false, message: '', type: 'success'}), 5000);
  };

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }

    setIsLoading(true);
    const isAdmin = userProfile?.role === 'admin';
    const unsubscribe = supabaseService.subscribeToTransactions((data) => {
      setTransactions(data);
      setIsLoading(false);
    }, user.id, isAdmin);

    return () => unsubscribe();
  }, [user, userProfile?.role]);

  // Settings from Supabase
  useEffect(() => {
    const fetchSettings = async () => {
      const { data: startingData } = await supabase.from('settings').select('*').eq('key', 'starting_balances').single();
      if (startingData) {
        setStartingBalances(startingData.value.balances || {});
        setBalanceDate(startingData.value.date || "");
      }

      const { data: generalData } = await supabase.from('settings').select('*').eq('key', 'general').single();
      if (generalData) {
        setAppSettings({
          name: generalData.value.name || "MY FINANCING",
          logo: generalData.value.logo || "",
          favicon: generalData.value.favicon || ""
        });
      }
    };

    fetchSettings();
  }, [user]);

  useEffect(() => {
    if (user) {
      setLoadingProfile(true);
      supabaseService.getProfile(user.id)
        .then(profile => {
          setUserProfile(profile);
          setLoadingProfile(false);
        })
        .catch(() => {
          // If profile doesn't exist yet, we'll wait for the trigger or manual creation
          setUserProfile({ email: user.email, role: 'user', status: 'approved' });
          setLoadingProfile(false);
        });
    } else {
      setUserProfile(null);
      setLoadingProfile(false);
    }
  }, [user]);

  const handleAddTransaction = async (tx: Omit<Transaction, 'id'>) => {
    try {
      if (!user) return false;
      await supabaseService.addTransaction(tx, user.id);
      showToast('Data berhasil disimpan');
      return true;
    } catch (error: any) {
      showToast(`Gagal tambah data: ${error?.message || 'Terjadi kesalahan'}`, 'error');
      return false;
    }
  };

  const handleBulkAddTransaction = async (txs: Omit<Transaction, 'id'>[]) => {
    try {
      if (!user) return false;
      await supabaseService.addTransactions(txs, user.id);
      showToast(`${txs.length} data berhasil diimport`);
      return true;
    } catch (error: any) {
      showToast(`Gagal import data: ${error?.message || 'Terjadi kesalahan'}`, 'error');
      return false;
    }
  };

  const handleEditTransaction = async (tx: Transaction) => {
    try {
      await supabaseService.updateTransaction(tx);
      showToast('Data berhasil diperbarui');
      return true;
    } catch (error: any) {
      showToast(`Gagal perbarui data: ${error?.message || 'Terjadi kesalahan'}`, 'error');
      return false;
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await supabaseService.deleteTransaction(id);
      showToast('Data berhasil dihapus');
      return true;
    } catch (error: any) {
      showToast(error?.message || String(error), 'error');
      return false;
    }
  };
  
  const handleBulkEditTransaction = async (ids: string[], updates: Partial<Transaction>) => {
    try {
      await supabaseService.bulkUpdateTransactions(ids, updates);
      showToast(`${ids.length} data berhasil diperbarui`);
      return true;
    } catch (error) {
      showToast("Terjadi kesalahan saat memperbarui data masal.", 'error');
      return false;
    }
  };

  const handleBulkDeleteTransaction = async (ids: string[]) => {
    try {
      await supabaseService.bulkDeleteTransactions(ids);
      showToast(`${ids.length} data berhasil dihapus`);
      return true;
    } catch (error: any) {
      showToast(`Gagal hapus masal: ${error?.message || 'Terjadi kesalahan'}`, 'error');
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveSettings = () => {
    showToast('Pengaturan berhasil disimpan');
  };

  if (loadingAuth || loadingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Memuat data akses pengguna...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Auth onLogin={() => {}} appSettings={appSettings} />
    );
  }

  if (userProfile?.status === 'pending') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center transition-colors duration-300">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-md w-full">
          <div className="h-16 w-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Menunggu Persetujuan</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Akun Anda telah terdaftar namun sedang menunggu disetujui oleh Administrator. Silakan hubungi admin untuk mendapatkan akses.
          </p>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <LogOut className="h-5 w-5" /> Keluar
          </button>
        </div>
      </div>
    );
  }

  if (userProfile?.status === 'rejected') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center transition-colors duration-300">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-md w-full">
          <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Akses Ditolak</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Pendaftaran akun Anda telah ditolak oleh Administrator dan tidak dapat mengakses sistem ini.
          </p>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <LogOut className="h-5 w-5" /> Keluar
          </button>
        </div>
      </div>
    );
  }

  // Jika kita memiliki user dari auth tetapi document firestore tidak ada atau belum terbuat sempurna
  if (user && !userProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center transition-colors duration-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Menyinkronkan akun...</p>
      </div>
    );
  }

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmittingQuickAdd(true);
    try {
      const { jenis, tanggal, deskripsi, nominal, rekening, kategoriDetail, qty, hargaModal } = quickAddData;
      const numNominal = Number(nominal);
      const numQty = Number(qty || 1);
      const numHargaModal = Number(hargaModal || 0);

      // Create main transaction
      let kategori = 'Pemasukan';
      
      if (jenis === 'Rekap Penjualan') {
        kategori = 'Penjualan';
      } else if (jenis === 'Pembelian Stok') {
        kategori = 'Pembelian Stok';
      } else if (jenis === 'Pengeluaran Spesifik') {
        kategori = kategoriDetail;
      } else if (jenis === 'Pembelian') {
        kategori = 'Pembelian';
      } else if (jenis === 'Aset Tetap') {
        kategori = 'Aset Tetap';
      } else if (jenis === 'Modal Awal') {
        kategori = 'Modal Awal';
      }

      const mainTx: Omit<Transaction, 'id'> = {
        tanggal,
        deskripsi,
        kategori,
        nominal: numNominal,
        rekening,
        status: 'Lunas',
        qty: numQty,
        hargaModal: numHargaModal
      };

      await supabaseService.addTransaction(mainTx, user.id);

      // If Rekap Penjualan, we also need to add HPP COGS entry
      if (jenis === 'Rekap Penjualan') {
        const hppTx: Omit<Transaction, 'id'> = {
          tanggal,
          deskripsi: `COGS: ${deskripsi}`,
          kategori: 'HPP / Barang Keluar',
          nominal: numQty * (numHargaModal || 0),
          rekening: 'Internal Storage',
          status: 'Internal',
          qty: numQty,
          hargaModal: numHargaModal
        };
        await supabaseService.addTransaction(hppTx, user.id);
      }

      showToast('Transaksi berhasil ditambahkan');
      setIsQuickAddOpen(false);
      setQuickAddData({
        jenis: 'Pemasukan',
        tanggal: new Date().toISOString().split('T')[0],
        deskripsi: '',
        nominal: '',
        qty: '',
        hargaModal: '',
        rekening: DAFTAR_REKENING[0],
        kategoriDetail: KATEGORI_PENGELUARAN_DETAIL[0]
      });
    } catch (error) {
      showToast('Gagal menambahkan transaksi', 'error');
    } finally {
      setIsSubmittingQuickAdd(false);
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onQuickAdd={() => setIsQuickAddOpen(true)}
      userProfile={userProfile}
      appSettings={appSettings}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
    >
      {activeTab === 'dashboard' && (
        <Dashboard 
          transactions={transactions} 
          startingBalances={startingBalances}
          balanceDate={balanceDate}
          appSettings={appSettings}
          darkMode={darkMode}
        />
      )}

      {activeTab === 'transaksi_semua' && (
        <Transactions 
          title="Semua Transaksi" 
          type="all" 
          transactions={transactions} 
          isLoading={isLoading} 
          onAdd={handleAddTransaction} 
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          onBulkAdd={handleBulkAddTransaction}
          onBulkEdit={handleBulkEditTransaction}
          onBulkDelete={handleBulkDeleteTransaction}
          onRefresh={() => {}} 
        />
      )}
      
      {activeTab === 'penjualan' && (
        <Transactions 
          title="Faktur Penjualan" 
          type="penjualan" 
          transactions={transactions} 
          isLoading={isLoading} 
          onAdd={handleAddTransaction} 
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          onBulkAdd={handleBulkAddTransaction}
          onBulkEdit={handleBulkEditTransaction}
          onBulkDelete={handleBulkDeleteTransaction}
          onRefresh={() => {}} 
        />
      )}
      
      {activeTab === 'pembelian' && (
        <Transactions 
          title="Faktur Pembelian" 
          type="pembelian" 
          transactions={transactions} 
          isLoading={isLoading} 
          onAdd={handleAddTransaction} 
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          onBulkAdd={handleBulkAddTransaction}
          onBulkEdit={handleBulkEditTransaction}
          onBulkDelete={handleBulkDeleteTransaction}
          onRefresh={() => {}} 
        />
      )}
      
      {activeTab === 'persediaan' && (
        <Transactions 
          title="Stok Persediaan" 
          type="persediaan" 
          transactions={transactions} 
          isLoading={isLoading} 
          onAdd={handleAddTransaction} 
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          onBulkAdd={handleBulkAddTransaction}
          onBulkEdit={handleBulkEditTransaction}
          onBulkDelete={handleBulkDeleteTransaction}
          onRefresh={() => {}} 
        />
      )}
      
      {activeTab === 'kas' && (
        <Transactions 
          title="Buku Kas & Bank" 
          type="kas" 
          transactions={transactions} 
          isLoading={isLoading} 
          onAdd={handleAddTransaction} 
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          onBulkAdd={handleBulkAddTransaction}
          onBulkEdit={handleBulkEditTransaction}
          onBulkDelete={handleBulkDeleteTransaction}
          onRefresh={() => {}} 
        />
      )}

      {activeTab === 'rekonsiliasi' && (
        <Rekonsiliasi 
          transactions={transactions} 
          onAdd={handleAddTransaction} 
          onRefresh={() => {}} 
        />
      )}

      {activeTab === 'aset' && (
        <Transactions 
          title="Catatan Aset" 
          type="aset" 
          transactions={transactions} 
          isLoading={isLoading} 
          onAdd={handleAddTransaction} 
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          onBulkAdd={handleBulkAddTransaction}
          onBulkEdit={handleBulkEditTransaction}
          onBulkDelete={handleBulkDeleteTransaction}
          onRefresh={() => {}} 
        />
      )}

      {activeTab === 'laporan' && (
        <Laporan 
          transactions={transactions} 
          startingBalances={startingBalances}
          balanceDate={balanceDate}
        />
      )}
      
      {activeTab === 'pengaturan' && (
        userProfile?.role === 'admin' ? (
          <Settings />
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Akses Terbatas</h3>
            <p className="text-slate-500 dark:text-slate-400">Hanya Administrator yang memiliki akses ke fitur Manajemen Pengguna.</p>
          </div>
        )
      )}

      {/* Quick Add Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Catat Transaksi Cepat
              </h3>
              <button onClick={() => setIsQuickAddOpen(false)} className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleQuickAddSubmit} className="p-6 flex flex-col gap-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Jenis Transaksi</label>
                <select 
                  value={quickAddData.jenis}
                  onChange={(e) => setQuickAddData({...quickAddData, jenis: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Pemasukan">Pemasukan Kas/Lainnya</option>
                  <option value="Rekap Penjualan">Rekap Penjualan Mingguan</option>
                  <option value="Pembelian Stok">Beli Produk (Stok Gudang/Pabrik)</option>
                  <option value="Pengeluaran Spesifik">Semua Jenis Pengeluaran/Biaya</option>
                  <option value="Pembelian">Pembelian Non-Stok (Aset Habis Pakai)</option>
                  <option value="Aset Tetap">Beli Aset Kantor (Laptop/Kendaraan)</option>
                  <option value="Modal Awal">Setor Modal Awal</option>
                </select>
              </div>

              {quickAddData.jenis === 'Pengeluaran Spesifik' && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Rincian Kategori Pengeluaran</label>
                  <select 
                    value={quickAddData.kategoriDetail}
                    onChange={(e) => setQuickAddData({...quickAddData, kategoriDetail: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {KATEGORI_PENGELUARAN_DETAIL.map(kat => (
                      <option key={kat} value={kat}>{kat.replace('Pengeluaran - ', '')}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Rekening Tujuan / Ditarik Dari</label>
                <select 
                  value={quickAddData.rekening}
                  onChange={(e) => setQuickAddData({...quickAddData, rekening: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {DAFTAR_REKENING.map(rek => (
                    <option key={rek} value={rek}>{rek}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Tanggal</label>
                <input 
                  type="date" 
                  required
                  value={quickAddData.tanggal}
                  onChange={(e) => setQuickAddData({...quickAddData, tanggal: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {quickAddData.jenis === 'Rekap Penjualan' ? 'Keterangan/Rentang Waktu' : 'Deskripsi / Keterangan'}
                </label>
                <input 
                  type="text" 
                  required
                  placeholder={quickAddData.jenis === 'Rekap Penjualan' ? "Contoh: Minggu ke-1 (1-7 April)" : "Contoh: Beli ATK / Bayar Listrik / Omset"}
                  value={quickAddData.deskripsi}
                  onChange={(e) => setQuickAddData({...quickAddData, deskripsi: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {quickAddData.jenis === 'Rekap Penjualan' ? 'Penghasilan Bersih (Netto) - Rp' : quickAddData.jenis === 'Pembelian Stok' ? 'Total Harga Beli/Kulakan (Rp)' : 'Nominal (Rp)'}
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                  {quickAddData.jenis === 'Rekap Penjualan' ? 'Total bersih masuk dompet setelah potongan admin marketplace/ongkir.' : 
                   quickAddData.jenis === 'Pembelian Stok' ? 'Total invoice biaya pabrik/gudang.' : ''}
                </p>
                <input 
                  type="number" 
                  required
                  min="0"
                  placeholder="0"
                  value={quickAddData.nominal}
                  onChange={(e) => setQuickAddData({...quickAddData, nominal: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              {['Rekap Penjualan', 'Pembelian Stok'].includes(quickAddData.jenis) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Total Qty (Pcs)
                    </label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      placeholder="Contoh: 150"
                      value={quickAddData.qty}
                      onChange={(e) => setQuickAddData({...quickAddData, qty: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  
                  {quickAddData.jenis === 'Rekap Penjualan' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Harga Penjualan Pokok Satuan (HPP/Pcs - Rp)
                      </label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        placeholder="Contoh: 35000"
                        value={quickAddData.hargaModal}
                        onChange={(e) => setQuickAddData({...quickAddData, hargaModal: e.target.value})}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setIsQuickAddOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingQuickAdd}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70 shadow-sm transition-all hover:shadow"
                >
                  {isSubmittingQuickAdd ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-[70] flex items-center gap-3 rounded-lg bg-slate-800 px-4 py-3 text-white shadow-xl animate-in slide-in-from-bottom-5 fade-in duration-300">
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-400" />
          )}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}
    </Layout>
  );
}
