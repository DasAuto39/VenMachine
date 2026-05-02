import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

function Information() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
              onClick={() => {
                const savedGate = localStorage.getItem('current_gate');
                navigate(savedGate ? `/user?gate=${savedGate}` : '/user');
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-400 px-5 py-2.5 rounded-2xl font-bold text-emerald-700 hover:text-emerald-800 hover:bg-gradient-to-r hover:from-emerald-100 hover:to-teal-100 transition-all shadow-sm hover:shadow-md"
            >
              ← Kembali Belanja
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8 pt-28 space-y-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-slate-800 mb-4">Pusat Informasi & Promo</h1>
            <p className="text-lg text-slate-600">Dapatkan berita terbaru, promo menarik, dan informasi produk pilihan kami.</p>
          </div>

          {isLoading ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-emerald-600 font-bold animate-pulse">Memuat informasi...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-md rounded-3xl p-12 text-center shadow-xl shadow-emerald-600/10 border border-white/40">
              <div className="text-6xl mb-4">📰</div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Belum ada informasi</h2>
              <p className="text-slate-500">Nantikan update terbaru dari FreshMart segera!</p>
            </div>
          ) : (
            <div className="grid gap-8">
              {posts.map((post) => (
                <article key={post.id} className="bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden shadow-xl shadow-emerald-600/10 border border-white/40 flex flex-col hover:shadow-emerald-600/20 transition-shadow">
                  {post.image_url && (
                    <div className="w-full h-64 md:h-80 bg-slate-100 relative overflow-hidden">
                      <img 
                        src={post.image_url} 
                        alt={post.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
                        Informasi
                      </span>
                      <time className="text-sm font-semibold text-slate-400">
                        {new Date(post.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </time>
                    </div>
                    
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">{post.title}</h2>
                    
                    {post.item_name && (
                      <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-xl">🏷️</span>
                        <span className="text-sm font-bold text-slate-700">Terkait Produk: {post.item_name}</span>
                      </div>
                    )}
                    
                    <div className="prose prose-slate prose-emerald max-w-none text-slate-600">
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
