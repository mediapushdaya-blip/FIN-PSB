import React, { useState, useEffect } from "react";
import { Users, CheckCircle2, XCircle, Clock, Search, ShieldCheck, Edit, X, Wallet, Save, Loader2 } from "lucide-react";
import { DAFTAR_REKENING } from "../types";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';

export default function Settings() {
  const [users, setUsers] = useState<any[]>([]);
  const [startingBalances, setStartingBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [savingBalances, setSavingBalances] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList: any[] = [];
      querySnapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      // Sort: pending first, then by email
      usersList.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return a.email.localeCompare(b.email);
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
        setStartingBalances(docSnap.data() as Record<string, number>);
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchStartingBalances()]).finally(() => setLoading(false));
  }, []);

  const handleSaveBalances = async () => {
    setSavingBalances(true);
    try {
      await setDoc(doc(db, "settings", "starting_balances"), startingBalances);
      alert("Saldo awal berhasil disimpan.");
    } catch (error) {
      console.error("Error saving balances:", error);
      alert("Gagal menyimpan saldo awal.");
    } finally {
      setSavingBalances(false);
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

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-10">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Akses & Pengguna</h2>
        <p className="mt-1.5 text-sm font-medium text-slate-500">
          Kelola izin akses pengguna yang mendaftar ke aplikasi.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Posisi Kas Awal</h3>
              <p className="text-xs text-slate-500">Input saldo awal untuk setiap rekening.</p>
            </div>
          </div>
          <button 
            onClick={handleSaveBalances}
            disabled={savingBalances}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            {savingBalances ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Saldo Awal
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {DAFTAR_REKENING.map((rek) => (
            <div key={rek} className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">{rek}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                <input 
                  type="number"
                  value={startingBalances[rek] || ''}
                  onChange={(e) => setStartingBalances({...startingBalances, [rek]: Number(e.target.value)})}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  placeholder="0"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Daftar Pendaftar</h3>
              <p className="text-xs text-slate-500">Setujui atau tolak akses sistem.</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Pengguna (Email)</th>
                <th className="px-6 py-4 font-semibold">Peranan</th>
                <th className="px-6 py-4 font-semibold">Waktu Daftar</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Tindakan Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{u.email}</td>
                    <td className="px-6 py-4">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          Staf/User
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium">
                      {u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {u.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Disetujui
                        </span>
                      )}
                      {u.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                          <Clock className="h-3.5 w-3.5" /> Menunggu
                        </span>
                      )}
                      {u.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                          <XCircle className="h-3.5 w-3.5" /> Ditolak
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 flex gap-2 justify-end">
                      {u.role === 'admin' && u.email === 'media.pushdaya@gmail.com' ? (
                         <span className="text-xs text-slate-400 font-medium italic mt-2">Super Admin</span>
                      ) : (
                        <>
                          {u.status !== 'approved' && (
                            <button 
                              onClick={() => handleUpdateStatus(u.id, 'approved')}
                              className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold text-xs rounded-lg transition-colors border border-emerald-200"
                            >
                              Setujui
                            </button>
                          )}
                          {u.status !== 'rejected' && (
                            <button 
                              onClick={() => handleUpdateStatus(u.id, 'rejected')}
                              className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 font-semibold text-xs rounded-lg transition-colors border border-slate-200 hover:border-red-200"
                            >
                              Tolak
                            </button>
                          )}
                          <button
                            onClick={() => setEditingUser(u)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors border border-slate-200"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
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
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Edit Profil Pengguna</h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Akses</label>
                <input 
                  type="email" 
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Peranan (Role)</label>
                <select 
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">Staf/User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status Akses</label>
                <select 
                  value={editingUser.status}
                  onChange={(e) => setEditingUser({...editingUser, status: e.target.value})}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
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
