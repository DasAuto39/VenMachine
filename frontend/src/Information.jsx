import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Newspaper, Tag, LogOut } from 'lucide-react';
import smdLogo from './images/smd.jpeg';
function Information() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  let user = null;
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      user = JSON.parse(storedUser);
    }
  } catch (err) {
    console.error('Error parsing user data:', err);
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/posts`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      } else {
        console.error('Failed to fetch posts');
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
        <header className="fixed top-0 left-0 right-0 z-40 w-full" style={{minHeight: '62px'}}>
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-teal-400 via-teal-400 to-teal-500" />
          <div className="w-full h-full backdrop-blur-xl bg-teal-50/95 border-b border-teal-100 shadow-[0_2px_20px_rgba(16,185,129,0.08)] px-4 md:px-8 flex items-center justify-between" style={{minHeight: '62px'}}>
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

            <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar sm:overflow-visible pl-1 py-1">
              {user && (
                <button
                  onClick={() => navigate('/profile')}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-none-none text-sm font-bold bg-white text-teal-800 border border-teal-100 hover:bg-teal-50 hover:border-teal-300 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
                >
                  <span className="w-5 h-5 rounded-none-full bg-gradient-to-br from-teal-400 to-teal-500 text-white flex items-center justify-center text-[10px]">
                    {(user?.full_name?.charAt(0) || user?.username?.charAt(0))?.toUpperCase()}
                  </span>
                  Halo, {user?.full_name?.split(' ')[0] || user?.username}
                </button>
              )}
              {user?.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="shrink-0 px-4 py-2 rounded-none-none text-sm font-bold bg-white text-teal-700 border border-teal-100 hover:bg-teal-50 hover:border-teal-300 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
                >
                  Dashboard Admin
                </button>
              )}
              <button
                onClick={() => {
                  const savedGate = localStorage.getItem('current_gate');
                  navigate(savedGate ? `/user?gate=${savedGate}` : '/user');
                }}
                className="shrink-0 px-5 py-2 rounded-none-none text-sm font-bold bg-gradient-to-r from-teal-500 to-teal-500 text-white shadow-md shadow-teal-500/30 transition-all hover:shadow-lg hover:-translate-y-0.5 whitespace-nowrap"
              >
                Kembali Belanja
              </button>
              {localStorage.getItem('authenticated') === 'true' && (
                <button
                  onClick={() => {
                    localStorage.removeItem('user');
                    localStorage.removeItem('authenticated');
                    navigate('/user');
                  }}
                  className="shrink-0 px-4 py-2 rounded-none-none text-sm font-bold text-rose-500 bg-white border border-rose-100 hover:bg-rose-50 hover:border-rose-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
                >
                  Keluar
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8 pt-28 space-y-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-slate-800 mb-4">Pusat Informasi & Promo</h1>
            <p className="text-lg text-slate-600">Dapatkan berita terbaru, promo menarik, dan informasi produk pilihan kami.</p>
          </div>

          {isLoading ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-500 rounded-none-full animate-spin mx-auto mb-4"></div>
              <p className="text-teal-600 font-bold animate-pulse">Memuat informasi...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-md rounded-none-none p-12 text-center shadow-xl shadow-teal-600/10 border border-white/40">
              <div className="flex justify-center mb-4">
                <Newspaper size={64} className="text-teal-200" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Belum ada informasi</h2>
              <p className="text-slate-500">Nantikan update terbaru dari Smart Minimarket segera!</p>
            </div>
          ) : (
            <div className="grid gap-8">
              {posts.map((post) => (
                <article key={post.id} className="bg-white/90 backdrop-blur-sm rounded-none-none overflow-hidden shadow-xl shadow-teal-600/10 border border-white/40 flex flex-col hover:shadow-teal-600/20 transition-shadow">
                  {post.image_url && (
                    <div className="w-full h-64 md:h-80 bg-slate-100 relative overflow-hidden">
                      <img 
                        src={post.image_url.includes('/uploads/') ? `${import.meta.env.VITE_API_BASE_URL}${post.image_url.substring(post.image_url.indexOf('/uploads/'))}` : post.image_url} 
                        alt={post.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-none-full uppercase tracking-wider">
                        Informasi
                      </span>
                      <time className="text-sm font-semibold text-slate-400">
                        {new Date(post.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </time>
                    </div>
                    
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">{post.title}</h2>
                    
                    {post.item_name && (
                      <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-none-none">
                        <Tag size={18} className="text-teal-500" />
                        <span className="text-sm font-bold text-slate-700">Terkait Produk: {post.item_name}</span>
                      </div>
                    )}
                    
                    <div className="prose prose-slate prose-teal max-w-none text-slate-600">
                      <ReactMarkdown>{post.content}</ReactMarkdown>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Information;
