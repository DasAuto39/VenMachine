import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper, LogOut, Mail, Phone, ShoppingBag, ShoppingCart, CheckCircle2, Clock, XCircle, ArrowLeft, ChevronDown, ChevronUp, Settings, Bot, Save, Edit3, X, Camera } from 'lucide-react';
import smdLogo from './images/smd.jpeg';

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTx, setExpandedTx] = useState(null);
  const [txItems, setTxItems] = useState({});
  const [aiPreferences, setAiPreferences] = useState('');
  const [savedAiPreferences, setSavedAiPreferences] = useState('');
  const [tags, setTags] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isEditingPrefs, setIsEditingPrefs] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({ full_name: '', phone: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Authentication check
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const authenticated = localStorage.getItem('authenticated');

    if (storedUser && authenticated === 'true') {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setProfileData({ full_name: parsedUser.full_name || '', phone: parsedUser.phone || '' });
        fetchUserProfile();
        fetchTransactions(parsedUser.user_id);
        fetchPreferences();
      } catch (err) {
        console.error('Error parsing stored user:', err);
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(prev => ({ ...prev, ...data }));
        setProfileData({ full_name: data.full_name || '', phone: data.phone || '' });
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/preferences`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        const prefStr = data.ai_preferences || '';
        setAiPreferences(prefStr);
        setSavedAiPreferences(prefStr);
        setTags(prefStr ? prefStr.split(', ') : []);
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
  };

  const savePreferences = async () => {
    setIsSavingPrefs(true);
    setSaveMessage('');
    const compiledPrefs = tags.join(', ');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ ai_preferences: compiledPrefs })
      });
      if (res.ok) {
        setSavedAiPreferences(compiledPrefs);
        setAiPreferences(compiledPrefs);
        setIsEditingPrefs(false);
        setSaveMessage('Preferensi berhasil disimpan!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage('Gagal menyimpan preferensi.');
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
      setSaveMessage('Gagal menyimpan preferensi.');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const saveUserProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(profileData)
      });
      if (res.ok) {
        const data = await res.json();
        setUser(prev => {
          const newUser = { ...prev, full_name: data.full_name, phone: data.phone };
          localStorage.setItem('user', JSON.stringify(newUser));
          return newUser;
        });
        setIsEditingProfile(false);
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const uploadProfilePicture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    
    setIsUploadingImage(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile-picture`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setUser(prev => {
          const newUser = { ...prev, profile_picture: data.profile_picture };
          localStorage.setItem('user', JSON.stringify(newUser));
          return newUser;
        });
      }
    } catch (err) {
      console.error('Error uploading profile picture:', err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const fetchTransactions = async (userId) => {
    try {
      setIsLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user/${userId}/transactions`, { headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      } else {
        console.error('Failed to fetch transactions');
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authenticated');
    navigate('/user');
  };

  const toggleTransactionDetail = async (txId) => {
    if (expandedTx === txId) {
      setExpandedTx(null);
      return;
    }
    setExpandedTx(txId);
    // Fetch items if not already cached
    if (!txItems[txId]) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/transaction/${txId}/items`, { headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
        if (res.ok) {
          const data = await res.json();
          setTxItems(prev => ({ ...prev, [txId]: data }));
        }
      } catch (err) {
        console.error('Error fetching transaction items:', err);
      }
    }
  };

  if (!user) return null; // or a loading spinner

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-teal-50 text-slate-800 font-sans selection:bg-teal-200 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-teal-200 rounded-none-full blur-3xl opacity-20 animate-float"></div>
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-80 h-80 bg-teal-200 rounded-none-full blur-3xl opacity-15 animate-float-reverse"></div>
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-40 w-full" style={{ minHeight: '62px' }}>
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-teal-400 via-teal-400 to-teal-500" />
          <div className="w-full h-full backdrop-blur-xl bg-teal-50/95 border-b border-teal-100 shadow-[0_2px_20px_rgba(16,185,129,0.08)] px-2 sm:px-4 md:px-8 flex items-center justify-between gap-2" style={{ minHeight: '62px' }}>
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div className="h-10 w-auto bg-white p-1 shadow-sm shrink-0 border border-slate-100 flex items-center justify-center">
                <img src={smdLogo} alt="SMD Logo" className="h-full w-auto object-contain" />
              </div>
              <div className="hidden sm:flex flex-col leading-none justify-center">
                <span className="text-sm font-black tracking-[0.15em] text-teal-800 uppercase">
                  Smart Minimarket
                </span>
                <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase mt-0.5">
                  Drive Thru
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {user?.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 rounded-none-none text-sm font-bold bg-white text-teal-700 border border-teal-100 hover:bg-teal-50 hover:border-teal-300 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
                >
                  Dashboard Admin
                </button>
              )}
              <button
                onClick={() => navigate('/information')}
                className="px-3.5 py-1.5 rounded-none-none text-sm font-bold bg-white text-teal-700 border border-teal-200 hover:bg-teal-50 hover:border-teal-400 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap hidden sm:block"
              >
                Info &amp; Promo
              </button>
              <button
                onClick={() => {
                  const savedGate = localStorage.getItem('current_gate');
                  navigate(savedGate ? `/user?gate=${savedGate}` : '/user');
                }}
                className="px-3.5 py-1.5 rounded-none-none text-sm font-bold bg-white text-teal-700 border border-teal-200 hover:bg-teal-50 hover:border-teal-400 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
              >
                Kembali Belanja
              </button>
              <button
                onClick={handleLogout}
                className="px-3.5 py-1.5 rounded-none-none text-sm font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all whitespace-nowrap"
              >
                Keluar
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8 pt-40 sm:pt-32 md:pt-28 space-y-8">

          {/* User Info Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-none-none p-8 shadow-xl shadow-teal-600/10 border border-white/40">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              
              <div className="relative group shrink-0 mx-auto sm:mx-0">
                {user?.profile_picture ? (
                  <img src={`${import.meta.env.VITE_API_BASE_URL}${user.profile_picture}`} alt="Profile" className="w-24 h-24 sm:w-28 sm:h-28 rounded-none-full object-cover shadow-lg shadow-teal-500/30 border-4 border-white" />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-teal-400 to-teal-500 rounded-none-full flex items-center justify-center text-4xl text-white font-black shadow-lg shadow-teal-500/30 border-4 border-white">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.username.charAt(0).toUpperCase()}
                  </div>
                )}
                
                {/* Upload overlay */}
                <label className={`absolute inset-0 bg-black/40 text-white rounded-none-full flex flex-col items-center justify-center cursor-pointer transition-opacity ${isUploadingImage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {isUploadingImage ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-none-full animate-spin"></div>
                  ) : (
                    <>
                      <Camera size={24} />
                      <span className="text-[10px] font-semibold mt-1">Ubah Foto</span>
                      <input type="file" accept="image/*" className="hidden" onChange={uploadProfilePicture} disabled={isUploadingImage} />
                    </>
                  )}
                </label>
              </div>

              <div className="flex-1 text-center sm:text-left">
                {isEditingProfile ? (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Nama Lengkap</label>
                      <input 
                        type="text" 
                        value={profileData.full_name} 
                        onChange={e => setProfileData(p => ({ ...p, full_name: e.target.value }))}
                        className="w-full sm:max-w-md px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-400 text-slate-800"
                        placeholder="Nama Lengkap"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Nomor Telepon</label>
                      <input 
                        type="text" 
                        value={profileData.phone} 
                        onChange={e => setProfileData(p => ({ ...p, phone: e.target.value }))}
                        className="w-full sm:max-w-md px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-400 text-slate-800"
                        placeholder="Nomor Telepon"
                      />
                    </div>
                    
                    <div className="flex gap-2 justify-center sm:justify-start pt-2">
                      <button onClick={() => {
                        setProfileData({ full_name: user?.full_name || '', phone: user?.phone || '' });
                        setIsEditingProfile(false);
                      }} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                        Batal
                      </button>
                      <button onClick={saveUserProfile} disabled={isSavingProfile} className="px-4 py-2 text-sm font-bold bg-teal-500 text-white hover:bg-teal-600 rounded-lg transition-colors flex items-center gap-2 shadow-md shadow-teal-500/20">
                        {isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                      <h1 className="text-3xl font-black text-slate-800 leading-none">{user?.full_name || 'Pengguna'}</h1>
                      <button onClick={() => setIsEditingProfile(true)} className="mx-auto sm:mx-0 p-1.5 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors text-sm font-semibold flex items-center gap-1.5 w-fit">
                        <Edit3 size={14} /> Edit Profil
                      </button>
                    </div>
                    
                    <p className="text-teal-600 font-semibold mb-3">@{user?.username}</p>
                    
                    <div className="flex flex-wrap justify-center sm:justify-start gap-3 text-sm text-slate-600">
                      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg font-medium border border-slate-200">
                        <Mail size={16} className="text-slate-400" />
                        {user?.email || 'Tidak ada email'}
                      </div>
                      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg font-medium border border-slate-200">
                        <Phone size={16} className="text-slate-400" />
                        {user?.phone || 'Belum ada nomor telepon'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* AI Preferences */}
          <div className="bg-white/90 backdrop-blur-sm rounded-none-none p-8 shadow-xl shadow-indigo-600/10 border border-indigo-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-3">
                  <Bot className="text-indigo-500" />
                  <span>Preferensi Asisten AI</span>
                </h2>
                <p className="text-sm text-slate-500">Ceritakan gaya belanja, tujuan, atau pantangan diet Anda. AI akan menyesuaikan rekomendasi khusus untuk Anda.</p>
              </div>
              {!isEditingPrefs && (
                <button
                  onClick={() => setIsEditingPrefs(true)}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2 font-semibold text-sm"
                >
                  <Edit3 size={18} />
                  Ubah
                </button>
              )}
            </div>
            
            {isEditingPrefs ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-slate-50 p-4 rounded-xl border border-indigo-200 shadow-inner flex flex-col gap-3">
                  <label className="text-sm font-bold text-slate-700">Preferensi Anda (Maksimal 8)</label>
                  <div className="bg-white border border-slate-300 rounded-lg p-2 min-h-[48px] flex flex-wrap gap-2 items-center focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition-all shadow-sm">
                    {tags.map((tag, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-200">
                        {tag}
                        <button 
                          onClick={() => setTags(tags.filter(t => t !== tag))}
                          className="hover:bg-indigo-200 text-indigo-500 hover:text-indigo-700 rounded-full p-0.5 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      disabled={tags.length >= 8}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const newTag = inputValue.trim();
                          if (newTag && !tags.includes(newTag) && tags.length < 8) {
                            setTags([...tags, newTag]);
                          }
                          setInputValue('');
                        }
                      }}
                      placeholder={tags.length >= 8 ? "Batas maksimal tercapai" : "Ketik preferensi lalu tekan Enter..."}
                      className="flex-1 min-w-[150px] px-2 py-1 border-none bg-transparent outline-none focus:ring-0 text-slate-700 placeholder-slate-400 text-sm"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">*Tekan <kbd className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono">Enter</kbd> untuk menambah</span>
                    <span className={`font-semibold ${tags.length >= 8 ? 'text-rose-500' : 'text-slate-500'}`}>{tags.length}/8 Preferensi</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${saveMessage.includes('Gagal') ? 'text-rose-500' : 'text-green-500'}`}>
                    {saveMessage}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setTags(savedAiPreferences ? savedAiPreferences.split(', ') : []);
                        setInputValue('');
                        setIsEditingPrefs(false);
                      }}
                      className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold transition-all text-sm"
                    >
                      Batal
                    </button>
                    <button
                      onClick={savePreferences}
                      disabled={isSavingPrefs}
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 text-sm shadow-md hover:shadow-lg"
                    >
                      <Save size={16} />
                      {isSavingPrefs ? 'Menyimpan...' : 'Simpan Profil'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                {savedAiPreferences ? (
                  <div className="flex flex-wrap gap-2">
                    {savedAiPreferences.split(', ').filter(Boolean).map((tag, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-white text-indigo-700 rounded-full text-sm font-semibold border border-indigo-200 shadow-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-slate-400 text-sm italic mb-3">Anda belum mengatur preferensi AI.</p>
                    <button
                      onClick={() => setIsEditingPrefs(true)}
                      className="text-indigo-600 text-sm font-bold hover:underline"
                    >
                      + Tambah Preferensi Sekarang
                    </button>
                  </div>
                )}
                {saveMessage && !isEditingPrefs && (
                  <div className="mt-3 text-sm font-semibold text-green-500">{saveMessage}</div>
                )}
              </div>
            )}
          </div>

          {/* Transaction History */}
          <div className="bg-white/90 backdrop-blur-sm rounded-none-none p-8 shadow-xl shadow-teal-600/10 border border-white/40">
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
              <ShoppingBag className="text-teal-500" />
              <span>Riwayat Pembelian</span>
            </h2>

            {isLoading ? (
              <div className="text-center py-12 text-slate-500">
                <p className="animate-pulse font-semibold">Memuat riwayat...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-none-none border border-slate-100">
                <div className="flex justify-center text-slate-300 mb-4">
                  <ShoppingCart size={48} />
                </div>
                <p className="text-lg font-semibold text-slate-600">Belum ada riwayat pembelian.</p>
                <p className="text-sm text-slate-400 mt-1">Ayo mulai belanja di Smart Minimarket!</p>
                <button
                  onClick={() => {
                    const savedGate = localStorage.getItem('current_gate');
                    navigate(savedGate ? `/user?gate=${savedGate}` : '/user');
                  }}
                  className="mt-4 px-6 py-2 bg-teal-500 text-white rounded-none-none font-bold hover:bg-teal-600 transition-colors shadow-md shadow-teal-500/20"
                >
                  Belanja Sekarang
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div key={tx.transaction_id} className="bg-white border border-slate-200 rounded-none-none p-5 hover:border-teal-300 transition-colors shadow-sm">
                    <div
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                      onClick={() => toggleTransactionDetail(tx.transaction_id)}
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-none">
                            {tx.transaction_code}
                          </span>
                          <span className={`px-3 py-1 rounded-none-full text-xs font-bold flex items-center gap-1 ${tx.payment_status === 'PAID'
                            ? 'bg-teal-100 text-teal-700'
                            : tx.payment_status === 'PENDING'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                            }`}>
                            {tx.payment_status === 'PAID' ? <><CheckCircle2 size={12} /> Berhasil</> :
                              tx.payment_status === 'PENDING' ? <><Clock size={12} /> Menunggu</> :
                                <><XCircle size={12} /> Batal</>}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          {new Date(tx.created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                          <span className="mx-2">•</span>
                          Gate {tx.gate_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-slate-500 mb-1">Total Belanja</p>
                          <p className="text-xl font-black text-teal-600">
                            Rp {(tx.total_amount || 0).toLocaleString('id-ID')}
                          </p>
                          {tx.payment_method && (
                            <p className="text-xs text-slate-500 mt-1">Metode: {tx.payment_method}</p>
                          )}
                        </div>
                        {expandedTx === tx.transaction_id
                          ? <ChevronUp size={20} className="text-slate-400" />
                          : <ChevronDown size={20} className="text-slate-400" />}
                      </div>
                    </div>
                    {/* Expandable detail */}
                    {expandedTx === tx.transaction_id && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-3">Detail Belanjaan</p>
                        {txItems[tx.transaction_id] ? (
                          txItems[tx.transaction_id].length > 0 ? (
                            <div className="space-y-2">
                              {txItems[tx.transaction_id].map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm bg-slate-50 px-4 py-2.5 rounded-none-none">
                                  <div>
                                    <span className="font-semibold text-slate-700">{item.item_name}</span>
                                    <span className="text-slate-400 ml-2">x{item.quantity}</span>
                                  </div>
                                  <span className="font-bold text-teal-600">
                                    Rp {(item.unit_price * item.quantity).toLocaleString('id-ID')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400 italic">Detail item tidak tersedia untuk transaksi lama.</p>
                          )
                        ) : (
                          <div className="flex justify-center py-3">
                            <div className="w-5 h-5 border-2 border-teal-300 border-t-teal-600 rounded-none-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}

export default Profile;
