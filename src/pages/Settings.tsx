import React, { useState, useEffect } from "react";
import { Users, CheckCircle2, XCircle, Clock, Search, ShieldCheck, Edit, X, Wallet, Save, Loader2, Settings as SettingsIcon, Image as ImageIcon, UploadCloud } from "lucide-react";
import { DAFTAR_REKENING } from "../types";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';

export default function Settings() {
  const [users, setUsers] = useState<any[]>([]);
  const [startingBalances, setStartingBalances] = useState<Record<string, number>>({});
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [appSettings, setAppSettings] = useState({ name: "MY FINANCING", logo: "", favicon: "" });
  const [loading, setLoading] = useState(true);
  const [savingBalances, setSavingBalances] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.email) {
          usersList.push({ id: doc.id, ...data });
        }
      });
      // Sort: pending first, then by email
      usersList.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return (a.email || "").localeCompare(b.email || "");
      });
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchStartingBalances = async () => {
    try {
      const docRef = doc(db, "settings", "starting_balances");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStartingBalances(data.balances || {});
        setBalanceDate(data.date || new Date().toISOString().split('T')[0]);
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  const fetchGeneralSettings = async () => {
    try {
      const docRef = doc(db, "settings", "general");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAppSettings({
          name: data.name || "MY FINANCING",
          logo: data.logo || "",
          favicon: data.favicon || ""
        });
      }
    } catch (error) {
      console.error("Error fetching general settings:", error);
    }
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchStartingBalances(), fetchGeneralSettings()]).finally(() => setLoading(false));
  }, []);

  const handleSaveBalances = async () => {
    setSavingBalances(true);
    try {
      await setDoc(doc(db, "settings", "starting_balances"), {
        balances: startingBalances,
        date: balanceDate
      });
      alert("Saldo awal dan tanggal berhasil disimpan.");
    } catch (error) {
      console.error("Error saving balances:", error);
      alert("Gagal menyimpan saldo awal.");
    } finally {
      setSavingBalances(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) {
      alert("Ukuran file terlalu besar. Maksimal 800KB agar aplikasi tetap cepat.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAppSettings(prev => ({ ...prev, [type]: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await setDoc(doc(db, "settings", "general"), {
        name: appSettings.name,
        logo: appSettings.logo,
        favicon: appSettings.favicon
      });
      alert("Pengaturan umum berhasil disimpan. Perubahan pada Favicon akan terlihat setelah refresh.");
    } catch (error) {
      console.error("Error saving general settings:", error);
      alert("Gagal menyimpan pengaturan umum.");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, "users", userId), {
        status: newStatus
      });
      // Refresh local state without refetching for speed
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error("Error updating user status:", error);
      alert("Gagal mengupdate status user. " + error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      await updateDoc(doc(db, "users", editingUser.id), {
        email: editingUser.email,
        role: editingUser.role,
        status: editingUser.status
      });
      setUsers(users.map(u => u.id === editingUser.id ? { ...editingUser } : u));
      setEditingUser(null);
      alert("Profil pengguna berhasil diperbarui.");
    } catch (error) {
      console.error("Error updating user profile:", error);
      alert("Gagal mengupdate profil pengguna.");
    }
  };

  const filteredUsers = users.filter(u => 
    u.email && u.email.toLowerCase().includes((searchTerm || "").toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-10">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Akses & Pengguna</h2>
        <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">
          Kelola izin akses pengguna yang mendaftar ke aplikasi.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
        <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <SettingsIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Pengaturan Umum</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sesuaikan identitas aplikasi Anda.</p>
            </div>
          </div>
          <button 
            onClick={handleSaveGeneral}
            disabled={savingGeneral}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-200 hover:shadow-md h-[40px]"
          >
            {savingGeneral ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pengaturan
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Nama Aplikasi</label>
              <input 
                type="text"
                value={appSettings.name}
                onChange={(e) => setAppSettings({...appSettings, name: e.target.value})}
                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all font-semibold"
                placeholder="MY FINANCING"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">URL Favicon (Tab Browser)</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={appSettings.favicon}
                  onChange={(e) => setAppSettings({...appSettings, favicon: e.target.value})}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all font-medium"
                  placeholder="https://example.com/favicon.ico"
                />
                <label className="cursor-pointer flex items-center justify-center px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors">
                  <UploadCloud className="h-4 w-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'favicon')} />
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">URL Logo Utama (Sidebar & Login)</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={appSettings.logo}
                  onChange={(e) => setAppSettings({...appSettings, logo: e.target.value})}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all font-medium"
                  placeholder="https://example.com/logo.png"
                />
                <label className="cursor-pointer flex items-center justify-center px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors">
                  <UploadCloud className="h-4 w-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
                </label>
              </div>
              <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-medium italic">Gunakan link gambar atau upload langsung (Max 800KB).</p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center justify-center text-center transition-colors">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mb-4">Preview Logo</p>
            {appSettings.logo ? (
              <img 
                src={appSettings.logo} 
                alt="App Logo Logo" 
                className="h-20 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Logo+Error';
                }}
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              </div>
            )}
            <p className="mt-4 text-xs font-bold text-slate-600 dark:text-slate-300">{appSettings.name}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
        <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Posisi Kas Awal</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Input saldo awal untuk setiap rekening.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase leading-none">Tanggal Saldo Awal</label>
              <input 
                type="date"
                value={balanceDate}
                onChange={(e) => setBalanceDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 transition-colors"
              />
            </div>
            <button 
              onClick={handleSaveBalances}
              disabled={savingBalances}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm shadow-emerald-200 dark:shadow-none hover:shadow-md h-[40px]"
            >
              {savingBalances ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Saldo Awal
            </button>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {DAFTAR_REKENING.map((rek) => (
            <div key={rek} className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{rek}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">Rp</span>
                <input 
                  type="number"
                  value={startingBalances[rek] || ''}
                  onChange={(e) => setStartingBalances({...startingBalances, [rek]: Number(e.target.value)})}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="0"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
        <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Daftar Pendaftar</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Setujui atau tolak akses sistem.</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 font-medium">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-black tracking-wider border-b border-slate-100 dark:border-slate-800 transition-colors">
              <tr>
                <th className="px-6 py-4">Pengguna (Email)</th>
                <th className="px-6 py-4 text-center">Peranan</th>
                <th className="px-6 py-4 text-center">Waktu Daftar</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Tindakan Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{u.email}</td>
                    <td className="px-6 py-4 text-center">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          Staf/User
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[11px] font-bold text-center tabular-nums">
                      {u.createdAt && typeof u.createdAt.seconds === 'number' 
                        ? new Date(u.createdAt.seconds * 1000).toLocaleString('id-ID') 
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {u.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Disetujui
                        </span>
                      )}
                      {u.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 rounded-full">
                          <Clock className="h-3.5 w-3.5" /> Menunggu
                        </span>
                      )}
                      {u.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2.5 py-1 rounded-full">
                          <XCircle className="h-3.5 w-3.5" /> Ditolak
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-end">
                        {u.role === 'admin' && u.email === 'media.pushdaya@gmail.com' ? (
                           <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic mt-2">Super Admin</span>
                        ) : (
                          <>
                            {u.status !== 'approved' && (
                              <button 
                                onClick={() => handleUpdateStatus(u.id, 'approved')}
                                className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-widest rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800"
                              >
                                Setujui
                              </button>
                            )}
                            {u.status !== 'rejected' && (
                              <button 
                                onClick={() => handleUpdateStatus(u.id, 'rejected')}
                                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-bold text-[10px] uppercase tracking-widest rounded-lg transition-colors border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-800"
                              >
                                Tolak
                              </button>
                            )}
                            <button
                              onClick={() => setEditingUser(u)}
                              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] uppercase tracking-widest rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Edit Profil Pengguna</h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Akses</label>
                <input 
                  type="email" 
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Peranan (Role)</label>
                <select 
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="user">Staf/User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Status Akses</label>
                <select 
                  value={editingUser.status}
                  onChange={(e) => setEditingUser({...editingUser, status: e.target.value})}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="pending">Menunggu (Pending)</option>
                  <option value="approved">Disetujui (Approved)</option>
                  <option value="rejected">Ditolak (Rejected)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white shadow-sm transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
