import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Menu, X, LayoutDashboard, ShoppingCart, 
  Package, Boxes, Landmark, Settings, Bell,
  FileText, Briefcase, PlusCircle, ArrowRightLeft, LogOut
} from "lucide-react";
import { TabType } from "../types";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

const menuItems: { icon: any; label: string; id: TabType }[] = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: ShoppingCart, label: "Penjualan", id: "penjualan" },
  { icon: Package, label: "Pembelian", id: "pembelian" },
  { icon: Boxes, label: "Persediaan", id: "persediaan" },
  { icon: Landmark, label: "Kas & Bank", id: "kas" },
  { icon: ArrowRightLeft, label: "Mutasi & Rekon", id: "rekonsiliasi" },
  { icon: Briefcase, label: "Aset", id: "aset" },
  { icon: FileText, label: "Laporan", id: "laporan" },
  { icon: Settings, label: "Akses Admin", id: "pengaturan" },
];

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onQuickAdd: () => void;
  userProfile?: any;
}

export default function Layout({ children, activeTab, setActiveTab, onQuickAdd, userProfile }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Profile edit states
  const [editName, setEditName] = useState("");
  const [editDivision, setEditDivision] = useState("");
  const [editPhotoURL, setEditPhotoURL] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (isProfileModalOpen && userProfile) {
      setEditName(userProfile.name || "");
      setEditDivision(userProfile.division || "");
      setEditPhotoURL(userProfile.photoURL || "");
    }
  }, [isProfileModalOpen, userProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.id) return;
    
    setIsSavingProfile(true);
    try {
      await updateDoc(doc(db, "users", userProfile.id), {
        name: editName,
        division: editDivision,
        photoURL: editPhotoURL
      });
      setIsProfileModalOpen(false);
    } catch (error) {
      console.error("Gagal update profil", error);
      alert("Gagal menyimpan profil");
    } finally {
      setIsSavingProfile(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavClick = (id: TabType) => {
    setActiveTab(id);
    if (!isDesktop) setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && !isDesktop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-xl lg:shadow-none lg:static lg:flex"
        initial={false}
        animate={{ 
          x: isDesktop ? 0 : (isMobileMenuOpen ? 0 : "-100%") 
        }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xl font-bold text-blue-700">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm overflow-hidden relative">
              <span className="absolute z-10">PF</span>
              <img src="/logo.png" alt="Logo" className="w-full h-full object-cover relative z-20" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0')} />
            </div>
            PUSHDAYA
          </div>
          <button 
            className="lg:hidden text-slate-400 hover:text-slate-600"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4">
          <div className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Menu Utama
          </div>
          <nav className="space-y-1.5">
            {menuItems.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <item.icon className={`h-5 w-5 ${activeTab === item.id ? "text-blue-600" : "text-slate-400"}`} />
                {item.label}
              </motion.button>
            ))}
          </nav>
        </div>

        <div className="border-t border-slate-100 p-4">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/60">
            <p className="text-xs font-bold text-slate-800">PUSHDAYA FINANCE APP</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">Finance Management</p>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-slate-800">PUSHDAYA FINANCE APP</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <button 
              onClick={onQuickAdd}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shadow-sm hover:shadow"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Catat Transaksi</span>
            </button>

            <div className="h-8 w-px bg-slate-200 hidden sm:block" />
            
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            
            <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-slate-200" onClick={() => setIsProfileModalOpen(true)}>
              <div className="hidden md:block text-right">
                <p className="text-sm font-bold text-slate-700">{userProfile?.name || 'Administrator'}</p>
                <p className="text-xs font-medium text-slate-500">{userProfile?.division || (userProfile?.role === 'admin' ? 'Finance Manager' : 'Staff')}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shadow-sm overflow-hidden relative">
                <span className="absolute z-10">{userProfile?.name ? userProfile.name.substring(0,2).toUpperCase() : (userProfile?.role === 'admin' ? 'AD' : 'ST')}</span>
                {userProfile?.photoURL && (
                  <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover relative z-20" />
                )}
              </div>
            </div>
            
            <button 
              onClick={() => signOut(auth)}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors group"
              title="Keluar (Logout)"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50">
          {children}
        </main>
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Profil Saya</h3>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Misal: John Doe"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Divisi</label>
                <input 
                  type="text" 
                  value={editDivision}
                  onChange={(e) => setEditDivision(e.target.value)}
                  placeholder="Misal: Finance"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">URL Foto Profil</label>
                <input 
                  type="url" 
                  value={editPhotoURL}
                  onChange={(e) => setEditPhotoURL(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-500 mt-1.5 leading-snug">Agar foto tampil, silakan masukkan URL gambar langsung (misal dari Google Photos atau media sosial).</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSavingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
