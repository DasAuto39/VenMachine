import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper, LogOut, Mail, Phone, ShoppingBag, ShoppingCart, CheckCircle2, Clock, XCircle, ArrowLeft, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import smdLogo from './images/smd.jpeg';

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTx, setExpandedTx] = useState(null);
  const [txItems, setTxItems] = useState({});

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
          <div className="w-full h-full backdrop-blur-xl bg-teal-50/95 border-b border-teal-100 shadow-[0_2px_20px_rgba(16,185,129,0.08)] px-4 md:px-8 flex items-center justify-between" style={{ minHeight: '62px' }}>
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="h-10 w-auto bg-white p-1 rounded-xl shadow-sm shrink-0 border border-slate-100 flex items-center justify-center">
                <img src={smdLogo} alt="SMD Logo" className="h-full w-auto object-contain rounded-lg" />
              </div>
              <div className="hidden sm:flex flex-col leading-none justify-center">
                <span className="text-sm font-black tracking-tight text-teal-600">
                  Smart Minimarket
                </span>
                <span className="text-[11px] font-bold text-slate-900">
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

        <main className="max-w-4xl mx-auto px-6 py-8 pt-28 space-y-8">

          {/* User Info Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-none-none p-8 shadow-xl shadow-teal-600/10 border border-white/40">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gradient-to-br from-teal-400 to-teal-500 rounded-none-full flex items-center justify-center text-4xl text-white font-black shadow-lg shadow-teal-500/30">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-800 mb-1">{user.full_name || 'Pengguna'}</h1>
                <p className="text-teal-600 font-semibold mb-2">@{user.username}</p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-600 mt-3">
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-none-none font-medium">
                    <Mail size={16} className="text-slate-400" />
                    {user.email || 'Tidak ada email'}
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-none-none font-medium">
                      <Phone size={16} className="text-slate-400" />
                      {user.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
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
