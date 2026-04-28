import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Menu, X, LayoutDashboard, ShoppingCart, 
  Package, Boxes, Landmark, Settings, Bell,
  FileText, Briefcase, PlusCircle, ArrowRightLeft, LogOut,
  Image as ImageIcon, List, Moon, Sun
} from "lucide-react";
import { TabType } from "../types";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

const menuItems: { icon: any; label: string; id: TabType }[] = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: List, label: "Semua Transaksi", id: "transaksi_semua" },
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
  appSettings: { name: string; logo: string; favicon: string };
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export default function Layout({ children, activeTab, setActiveTab, onQuickAdd, userProfile, appSettings, darkMode, setDarkMode }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Profile edit states
  const [editName, setEditName] = useState("");
  const [editDivision, setEditDivision] = useState("");
  const [editPhotoURL, setEditPhotoURL] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Ukuran file terlalu besar (Maks 2MB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
    <div className={`${darkMode ? 'dark' : ''} h-screen w-full overflow-hidden font-sans`}>
      <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-300">
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
        className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#0f172a] text-slate-400 shadow-2xl lg:static lg:flex"
        initial={false}
        animate={{ 
          x: isDesktop ? 0 : (isMobileMenuOpen ? 0 : "-100%") 
        }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      >
        <div className="flex h-20 items-center justify-between px-8 border-b border-white/5 bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-blue-600 shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-2 transition-colors">
              <img 
                src={appSettings.logo || "/logo.png"} 
                alt="App Logo" 
                className="w-full h-full object-contain" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(appSettings.name || 'P')}&background=ffffff&color=2563eb`;
                }} 
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-white leading-tight tracking-tight uppercase truncate">{appSettings.name || 'Pushdaya'}</p>
              <p className="text-[10px] font-black text-blue-400 leading-none mt-1.5 tracking-[0.2em] uppercase opacity-80">Intelligence</p>
            </div>
          </div>
          <button 
            className="lg:hidden text-slate-500 hover:text-white p-2"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pt-8 px-4 pb-10 space-y-8 custom-scrollbar">
          <nav className="space-y-6">
            <div>
              <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4">Core Analytics</p>
              <div className="space-y-1">
                {menuItems.filter(i => ['dashboard', 'transaksi_semua'].includes(i.id)).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[11px] font-black tracking-widest uppercase transition-all ${
                      activeTab === item.id
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${activeTab === item.id ? "text-white" : "text-slate-500"}`} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4">Bank & Cash</p>
              <div className="space-y-1">
                {menuItems.filter(i => ['kas', 'rekonsiliasi'].includes(i.id)).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[11px] font-black tracking-widest uppercase transition-all ${
                      activeTab === item.id
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${activeTab === item.id ? "text-white" : "text-slate-500"}`} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4">Invoicing</p>
              <div className="space-y-1">
                {menuItems.filter(i => ['penjualan', 'pembelian'].includes(i.id)).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[11px] font-black tracking-widest uppercase transition-all ${
                      activeTab === item.id
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${activeTab === item.id ? "text-white" : "text-slate-500"}`} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4">Operations</p>
              <div className="space-y-1">
                {menuItems.filter(i => ['persediaan', 'aset'].includes(i.id)).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[11px] font-black tracking-widest uppercase transition-all ${
                      activeTab === item.id
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${activeTab === item.id ? "text-white" : "text-slate-500"}`} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4">Reporting</p>
              <div className="space-y-1">
                {menuItems.filter(i => ['laporan', 'pengaturan'].includes(i.id)).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[11px] font-black tracking-widest uppercase transition-all ${
                      activeTab === item.id
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${activeTab === item.id ? "text-white" : "text-slate-500"}`} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </div>

        <div className="px-6 py-6 border-t border-white/5 bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="User" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-black text-slate-500">
                  {userProfile?.name?.substring(0,1) || 'A'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white truncate">{userProfile?.name || 'Administrator'}</p>
              <p className="text-[10px] font-bold text-slate-500 truncate uppercase tracking-widest">{userProfile?.role || 'Staff'}</p>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all"
              title="Keluar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 z-10 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">{appSettings.name || 'PUSHDAYA FINANCE APP'}</h1>
            </div>
          </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
                title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <button 
                onClick={onQuickAdd}
                className="flex items-center gap-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                <PlusCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Catat Transaksi</span>
              </button>
              
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              
              <button className="relative p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
              </button>
              
              <div 
                className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-lg transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 group" 
                onClick={() => setIsProfileModalOpen(true)}
              >
                <div className="h-8 w-8 rounded-lg bg-blue-600 border border-blue-700 flex items-center justify-center text-white font-black text-xs shadow-sm overflow-hidden relative group-hover:scale-105 transition-transform">
                  {userProfile?.photoURL ? (
                    <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{userProfile?.name ? userProfile.name.substring(0,2).toUpperCase() : 'AD'}</span>
                  )}
                </div>
                <div className="hidden md:block select-none">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">{userProfile?.name || 'Administrator'}</p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-tight">{userProfile?.division || 'Finance'}</p>
                </div>
              </div>
            </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50 dark:bg-slate-950/20">
          {children}
        </main>
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-xl overflow-hidden border dark:border-slate-800"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Profil Saya</h3>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Misal: John Doe"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Divisi</label>
                <input 
                  type="text" 
                  value={editDivision}
                  onChange={(e) => setEditDivision(e.target.value)}
                  placeholder="Misal: Finance"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Foto Profil</label>
                <div className="flex items-center gap-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="h-20 w-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                  >
                    {editPhotoURL ? (
                      <img src={editPhotoURL} alt="Preview" className="h-full w-full object-cover group-hover:opacity-75 transition-opacity" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400 dark:text-slate-500">
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-[10px] font-bold mt-1">UPLOAD</span>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Unggah Foto Langsung</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                      Klik kotak di samping untuk mengunggah file foto (JPG/PNG). Foto akan disimpan langsung ke database profil Anda.
                    </p>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 w-full" />
                    <input 
                      type="url" 
                      value={editPhotoURL}
                      onChange={(e) => setEditPhotoURL(e.target.value)}
                      placeholder="Atau tempel URL di sini..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
    </div>
  );
}
