import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Authentication check
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const authenticated = localStorage.getItem('authenticated');

    if (storedUser && authenticated === 'true') {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        fetchTransactions(parsedUser.user_id);
      } catch (err) {
        console.error('Error parsing stored user:', err);
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchTransactions = async (userId) => {
    try {
      setIsLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user/${userId}/transactions`);
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

  if (!user) return null; // or a loading spinner

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 text-slate-800 font-sans selection:bg-emerald-200 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-emerald-200 rounded-full blur-3xl opacity-20 animate-float"></div>
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-80 h-80 bg-teal-200 rounded-full blur-3xl opacity-15 animate-float-reverse"></div>
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-40 w-full backdrop-blur-lg bg-white/80 border-b border-slate-200 px-6 py-4 flex items-center justify-between transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-emerald-500/30 shadow-lg text-white text-lg font-black">
              F
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900">
                FRESH<span className="text-emerald-500">MART</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/information')}
              className="relative flex items-center gap-2 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 hover:border-purple-400 px-5 py-2.5 rounded-2xl font-bold text-purple-700 hover:text-purple-800 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 transition-all shadow-sm hover:shadow-md"
            >
              <span>📰 Info & Promo</span>
            </button>
            <button
              onClick={() => {
                const savedGate = localStorage.getItem('current_gate');
                navigate(savedGate ? `/user?gate=${savedGate}` : '/user');
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-400 px-5 py-2.5 rounded-2xl font-bold text-emerald-700 hover:text-emerald-800 hover:bg-gradient-to-r hover:from-emerald-100 hover:to-teal-100 transition-all shadow-sm hover:shadow-md"
            >
              ← Kembali Belanja
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-5 py-2.5 rounded-2xl font-bold text-rose-700 hover:text-rose-800 hover:border-rose-400 hover:bg-rose-100 transition-all"
            >
              🚪 Logout
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8 pt-28 space-y-8">
          
          {/* User Info Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl shadow-emerald-600/10 border border-white/40">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-4xl text-white font-black shadow-lg shadow-emerald-500/30">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-800 mb-1">{user.full_name || 'Pengguna'}</h1>
                <p className="text-emerald-600 font-semibold mb-2">@{user.username}</p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg">
                    <span>📧</span> {user.email || 'Tidak ada email'}
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg">
                      <span>📱</span> {user.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl shadow-emerald-600/10 border border-white/40">
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <span>🛍️</span> Riwayat Pembelian
            </h2>
            
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">
                <p className="animate-pulse font-semibold">Memuat riwayat...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-4xl mb-3">🛒</div>
                <p className="text-lg font-semibold text-slate-600">Belum ada riwayat pembelian.</p>
                <p className="text-sm text-slate-400 mt-1">Ayo mulai belanja di FreshMart!</p>
                <button 
                  onClick={() => {
                    const savedGate = localStorage.getItem('current_gate');
                    navigate(savedGate ? `/user?gate=${savedGate}` : '/user');
                  }}
                  className="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-500/20"
                >
                  Belanja Sekarang
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div key={tx.transaction_id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-300 transition-colors shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                            {tx.transaction_code}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            tx.payment_status === 'PAID' 
                              ? 'bg-emerald-100 text-emerald-700'
                              : tx.payment_status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {tx.payment_status === 'PAID' ? '✅ Berhasil' : 
                             tx.payment_status === 'PENDING' ? '⏳ Menunggu' : 
                             '❌ Gagal/Batal'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          {new Date(tx.created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                          <span className="mx-2">•</span> 
                          Gate {tx.gate_id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Total Belanja</p>
                        <p className="text-xl font-black text-emerald-600">
                          Rp {(tx.total_amount || 0).toLocaleString('id-ID')}
                        </p>
                        {tx.payment_method && (
                          <p className="text-xs text-slate-500 mt-1">Metode: {tx.payment_method}</p>
                        )}
                      </div>
                    </div>
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
