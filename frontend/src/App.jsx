import { useState, useEffect } from 'react';

function App() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({}); // Ubah dari array ke object: {itemId: {item, qty}}
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/items")
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch((err) => console.error("Gagal mengambil data:", err));
  }, []);

  // Tambah item ke cart atau increment quantity jika sudah ada
  const addToCart = (item) => {
    setCart(prevCart => {
      if (prevCart[item.id]) {
        return {
          ...prevCart,
          [item.id]: {
            ...prevCart[item.id],
            qty: prevCart[item.id].qty + 1
          }
        };
      } else {
        return {
          ...prevCart,
          [item.id]: { item, qty: 1 }
        };
      }
    });
  };

  // Increment quantity
  const incrementQuantity = (itemId) => {
    setCart(prevCart => ({
      ...prevCart,
      [itemId]: {
        ...prevCart[itemId],
        qty: prevCart[itemId].qty + 1
      }
    }));
  };

  // Decrement quantity atau hapus jika qty jadi 0
  const decrementQuantity = (itemId) => {
    setCart(prevCart => {
      if (prevCart[itemId].qty > 1) {
        return {
          ...prevCart,
          [itemId]: {
            ...prevCart[itemId],
            qty: prevCart[itemId].qty - 1
          }
        };
      } else {
        const newCart = { ...prevCart };
        delete newCart[itemId];
        return newCart;
      }
    });
  };

  // Hapus item dari cart
  const removeFromCart = (itemId) => {
    setCart(prevCart => {
      const newCart = { ...prevCart };
      delete newCart[itemId];
      return newCart;
    });
  };

  const handleCheckout = async () => {
    if (Object.keys(cart).length === 0) return;
    for (const itemId in cart) {
      const { item, qty } = cart[itemId];
      await fetch("http://127.0.0.1:8000/api/dispense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id, requested_qty: qty })
      });
    }
    const totalItems = Object.values(cart).reduce((sum, { qty }) => sum + qty, 0);
    alert(`Transaksi Sukses! ${totalItems} barang sedang disiapkan di rak.`);
    setCart({});
    setIsCartOpen(false);
  };

  // Hitung total harga
  const cartTotal = Object.values(cart).reduce((sum, { item, qty }) => sum + (item.price * qty), 0);
  const cartItemCount = Object.values(cart).reduce((sum, { qty }) => sum + qty, 0);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.sku.toLowerCase().includes(search.toLowerCase())
  );

  const categories = ["Semua", "Sayuran Segar", "Buah Pilihan", "Sembako", "Minuman", "Snack", "Daging"];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-emerald-200">
      
      {/* 1. NAVBAR (Glassmorphism Effect) */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-white/80 border-b border-slate-200 px-6 py-4 flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-emerald-500/30 shadow-lg text-white text-xl">
            🥬
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900">
            FRESH<span className="text-emerald-500">MART</span>
          </span>
        </div>
        
        <div className="hidden md:block flex-1 max-w-2xl px-8">
          <div className="relative group">
            <input 
              type="text" 
              placeholder="Cari apel, beras, atau minyak..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-100/50 border border-slate-200 rounded-2xl outline-none text-sm transition-all focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="absolute left-4 top-3 text-xl opacity-50 group-focus-within:text-emerald-500 transition-colors">🔍</span>
          </div>
        </div>

        <button 
          onClick={() => setIsCartOpen(true)}
          className="relative flex items-center gap-2 bg-white border border-slate-200 hover:border-emerald-300 px-5 py-2.5 rounded-2xl font-bold text-slate-700 hover:text-emerald-600 transition-all shadow-sm hover:shadow-md"
        >
          <span>Keranjang</span>
          {cartItemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
              {cartItemCount}
            </span>
          )}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* 2. HERO BANNER */}
        <div className="relative overflow-hidden bg-emerald-600 rounded-3xl p-10 text-white mb-12 shadow-xl shadow-emerald-600/20">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
          <div className="relative z-10 max-w-lg">
            <span className="inline-block py-1 px-3 rounded-full bg-emerald-500/50 border border-emerald-400/50 text-xs font-bold tracking-wider mb-4 uppercase backdrop-blur-sm">
              Supermarket Otomatis
            </span>
            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">Belanja Cepat, <br/>Tanpa Antre Kasir.</h1>
            <p className="text-emerald-50 text-lg opacity-90">Pilih dari layar, bayar, dan ambil bahan makanan segar Anda langsung dari rak otomatis.</p>
          </div>
        </div>

        {/* 3. KATEGORI */}
        <div className="mb-10">
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
            {categories.map((cat, idx) => (
              <button key={idx} className="shrink-0 bg-white border border-slate-200 rounded-2xl px-6 py-3 font-semibold text-slate-600 hover:text-emerald-600 hover:border-emerald-300 hover:shadow-md hover:-translate-y-1 transition-all">
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 4. GRID PRODUK (Clean & Proper) */}
        <div>
          <h2 className="text-xl font-black text-slate-800 mb-6">Etalase Produk</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredItems.map((item) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-3xl p-3 flex flex-col hover:shadow-xl hover:shadow-slate-200/50 hover:border-emerald-200 transition-all duration-300 group">
                
                {/* Kotak Gambar Presisi */}
                <div className="w-full aspect-square bg-slate-50 rounded-2xl mb-4 flex items-center justify-center text-5xl group-hover:bg-emerald-50 transition-colors">
                  🛒
                </div>
                
                <div className="px-2 flex-1 flex flex-col">
                  {/* Badge Rak */}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Lokasi: Rak {item.gate_code}
                  </span>
                  
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug mb-1">{item.name}</h3>
                  <p className="text-xs text-slate-400 font-mono mb-4">{item.sku}</p>
                  
                  <div className="mt-auto pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-500">Harga</span>
                        <span className="text-sm font-black text-emerald-600">
                          Rp {(item.price || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-xs text-slate-500">Stok</span>
                        <span className={`text-sm font-black ${item.stock_quantity > 5 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {item.stock_quantity > 0 ? `${item.stock_quantity}` : 'Habis'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => addToCart(item)}
                      disabled={item.stock_quantity === 0}
                      className="w-full bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold py-2 hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-slate-900"
                    >
                      + Keranjang
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 5. MODAL KERANJANG (Proper Overlay & Slide) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay Gelap */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsCartOpen(false)}
          ></div>
          
          {/* Panel Putih */}
          <div className="relative w-full md:w-[420px] bg-white h-full shadow-2xl flex flex-col animate-slide-in border-l border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800">Keranjang Anda</h2>
                <p className="text-sm text-slate-500 mt-1">{cartItemCount} barang dipilih</p>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)} 
                className="w-10 h-10 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-500 rounded-full flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {cartItemCount === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-4xl mb-4">🛒</div>
                  <p className="font-medium">Belum ada barang</p>
                </div>
              ) : (
                Object.entries(cart).map(([itemId, { item, qty }]) => (
                  <div key={itemId} className="bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl shrink-0">📦</div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{item.name}</p>
                          <p className="text-xs font-semibold text-emerald-600 mt-0.5">Rp {(item.price || 0).toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFromCart(parseInt(itemId))} 
                        className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="text-sm font-bold text-slate-800">
                        Total: Rp {(item.price * qty).toLocaleString('id-ID')}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => decrementQuantity(parseInt(itemId))}
                          className="w-7 h-7 bg-slate-200 hover:bg-rose-200 text-slate-700 hover:text-rose-700 rounded-lg flex items-center justify-center transition-colors text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-bold text-slate-800">{qty}</span>
                        <button
                          onClick={() => incrementQuantity(parseInt(itemId))}
                          className="w-7 h-7 bg-slate-200 hover:bg-emerald-200 text-slate-700 hover:text-emerald-700 rounded-lg flex items-center justify-center transition-colors text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-3">
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600 font-semibold">Subtotal</span>
                  <span className="text-slate-800 font-bold">Rp {cartTotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-lg font-black text-slate-800">Total Pembayaran</span>
                  <span className="text-2xl font-black text-emerald-600">Rp {cartTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>
              <button 
                onClick={handleCheckout}
                disabled={cartItemCount === 0}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl disabled:bg-slate-300 disabled:text-slate-500 transition-all shadow-lg shadow-emerald-500/30 disabled:shadow-none text-lg active:scale-[0.98]"
              >
                Ambil Barang Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;