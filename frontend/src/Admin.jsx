import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Admin() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'transactions'
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: '',
    stock_quantity: '',
    location_id: ''
  });

  // Posts state
  const [posts, setPosts] = useState([]);
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [postFormData, setPostFormData] = useState({
    title: '',
    content: '',
    image_url: '',
    item_id: '',
    is_published: true
  });

  // Fetch all items and transactions
  useEffect(() => {
    fetchItems();
    fetchTransactions();
    fetchPosts();
    
    // Refresh transactions every 10 seconds
    const interval = setInterval(fetchTransactions, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/items`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error("Error fetching items:", err);
    }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/posts`);
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/transactions`);
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'stock_quantity' || name === 'location_id' ? parseFloat(value) || '' : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.sku || !formData.price || formData.stock_quantity === '' || !formData.location_id) {
      alert("Semua field harus diisi!");
      return;
    }

    try {
      if (editingId) {
        // Update
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/items/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          alert("Produk berhasil diperbarui!");
          setEditingId(null);
        }
      } else {
        // Create
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          alert("Produk berhasil ditambahkan!");
        }
      }
      
      setFormData({ name: '', sku: '', price: '', stock_quantity: '', location_id: '' });
      setShowForm(false);
      fetchItems();
    } catch (err) {
      console.error("Error:", err);
      alert("Terjadi kesalahan!");
    }
  };

  const handleEdit = (item) => {
    setFormData({
      name: item.name,
      sku: item.sku,
      price: item.price,
      stock_quantity: item.stock_quantity,
      location_id: item.location_id
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Yakin ingin menghapus produk ini?")) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/items/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          alert("Produk berhasil dihapus!");
          fetchItems();
        }
      } catch (err) {
        console.error("Error:", err);
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', sku: '', price: '', stock_quantity: '', location_id: '' });
  };

  const handlePostInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPostFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!postFormData.title || !postFormData.content) {
      alert("Title dan Content harus diisi!");
      return;
    }
    try {
      const payload = {
        title: postFormData.title,
        content: postFormData.content,
        image_url: postFormData.image_url || null,
        item_id: postFormData.item_id ? parseInt(postFormData.item_id) : null,
        is_published: postFormData.is_published
      };
      
      const url = editingPostId 
        ? `${import.meta.env.VITE_API_BASE_URL}/api/admin/posts/${editingPostId}`
        : `${import.meta.env.VITE_API_BASE_URL}/api/admin/posts`;
      
      const method = editingPostId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert(`Post berhasil ${editingPostId ? 'diperbarui' : 'ditambahkan'}!`);
        handlePostCancel();
        fetchPosts();
      } else {
        const errData = await res.json();
        alert(`Gagal: ${errData.detail || 'Terjadi kesalahan'}`);
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Terjadi kesalahan!");
    }
  };

  const handlePostEdit = (post) => {
    setPostFormData({
      title: post.title,
      content: post.content,
      image_url: post.image_url || '',
      item_id: post.item_id || '',
      is_published: post.is_published
    });
    setEditingPostId(post.id);
    setShowPostForm(true);
  };

  const handlePostDelete = async (id) => {
    if (confirm("Yakin ingin menghapus post ini?")) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/posts/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          alert("Post berhasil dihapus!");
          fetchPosts();
        }
      } catch (err) {
        console.error("Error:", err);
      }
    }
  };

  const handlePostCancel = () => {
    setShowPostForm(false);
    setEditingPostId(null);
    setPostFormData({ title: '', content: '', image_url: '', item_id: '', is_published: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-4">
          <h1 className="text-2xl font-black text-slate-900">Admin Panel</h1>
          <button 
            onClick={() => navigate('/user')}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
          >
            ← Kembali ke Belanja
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${
              activeTab === 'products'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Manajemen Produk
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${
              activeTab === 'transactions'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Riwayat Pembayaran ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${
              activeTab === 'posts'
                ? 'bg-purple-500 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Manajemen Informasi ({posts.length})
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <>
        
        {/* Add Button */}
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
          }}
          className="mb-6 px-6 py-3 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 transition-colors"
        >
          + Tambah Produk Baru
        </button>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">
                {editingId ? ' Edit Produk' : ' Tambah Produk Baru'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Nama Produk</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Contoh: Bayam Segar"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">SKU</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Contoh: SKU001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Harga (Rp)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="15000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Stok</label>
                  <input
                    type="number"
                    name="stock_quantity"
                    value={formData.stock_quantity}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Lokasi (Rak)</label>
                  <input
                    type="number"
                    name="location_id"
                    value={formData.location_id}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="1"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-500 text-white py-2 rounded-lg font-bold hover:bg-emerald-600 transition-colors"
                  >
                    {editingId ? 'Simpan Perubahan' : 'Tambahkan'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-slate-300 text-slate-700 py-2 rounded-lg font-bold hover:bg-slate-400 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="px-6 py-4 text-left font-bold text-slate-700">ID</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700">Nama Produk</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700">SKU</th>
                  <th className="px-6 py-4 text-right font-bold text-slate-700">Harga</th>
                  <th className="px-6 py-4 text-right font-bold text-slate-700">Stok</th>
                  <th className="px-6 py-4 text-center font-bold text-slate-700">Rak</th>
                  <th className="px-6 py-4 text-center font-bold text-slate-700">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-700 font-semibold">{item.id}</td>
                    <td className="px-6 py-4 text-slate-700 font-semibold">{item.name}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono">{item.sku}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                      Rp {(item.price || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right font-bold">
                      <span className={item.stock_quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {item.stock_quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-600 font-semibold">
                      {item.location_code || '-'}
                    </td>
                    <td className="px-6 py-4 text-center space-x-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors"
                      >
                         Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-1 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600 transition-colors"
                      >
                         Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg font-semibold">Belum ada produk</p>
              <p className="text-sm">Klik "Tambah Produk Baru" untuk memulai</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
            <p className="text-blue-600 font-semibold mb-2">Total Produk</p>
            <p className="text-3xl font-black text-blue-700">{items.length}</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-6 border-2 border-emerald-200">
            <p className="text-emerald-600 font-semibold mb-2">Total Stok</p>
            <p className="text-3xl font-black text-emerald-700">
              {items.reduce((sum, item) => sum + item.stock_quantity, 0)}
            </p>
          </div>
          <div className="bg-rose-50 rounded-2xl p-6 border-2 border-rose-200">
            <p className="text-rose-600 font-semibold mb-2">Produk Habis</p>
            <p className="text-3xl font-black text-rose-700">
              {items.filter(item => item.stock_quantity === 0).length}
            </p>
          </div>
        </div>
          </>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-6">Riwayat Pembayaran</h2>
            
            {transactions.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <p className="text-slate-600 text-lg">Belum ada transaksi</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="px-6 py-4 text-left font-bold text-slate-700">ID Transaksi</th>
                        <th className="px-6 py-4 text-left font-bold text-slate-700">Gate</th>
                        <th className="px-6 py-4 text-right font-bold text-slate-700">Jumlah</th>
                        <th className="px-6 py-4 text-left font-bold text-slate-700">Metode Bayar</th>
                        <th className="px-6 py-4 text-left font-bold text-slate-700">Status</th>
                        <th className="px-6 py-4 text-left font-bold text-slate-700">Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.transaction_id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-700 font-mono text-sm">{tx.transaction_code}</td>
                          <td className="px-6 py-4 text-slate-700 font-semibold">Gate {tx.gate_id}</td>
                          <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                            Rp {(tx.total_amount || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {tx.payment_method || '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              tx.payment_status === 'PAID' 
                                ? 'bg-emerald-100 text-emerald-700'
                                : tx.payment_status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {tx.payment_status === 'PAID' ? '✅ Dibayar' : 
                               tx.payment_status === 'PENDING' ? '⏳ Menunggu' : 
                               '❌ Dibatalkan'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 text-sm">
                            {new Date(tx.created_at).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
                <p className="text-blue-600 font-semibold mb-2">Total Transaksi</p>
                <p className="text-3xl font-black text-blue-700">{transactions.length}</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-6 border-2 border-emerald-200">
                <p className="text-emerald-600 font-semibold mb-2">Pembayaran Sukses</p>
                <p className="text-3xl font-black text-emerald-700">
                  {transactions.filter(tx => tx.payment_status === 'PAID').length}
                </p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-6 border-2 border-amber-200">
                <p className="text-amber-600 font-semibold mb-2">Total Pendapatan</p>
                <p className="text-3xl font-black text-amber-700">
                  Rp {transactions
                    .filter(tx => tx.payment_status === 'PAID')
                    .reduce((sum, tx) => sum + (tx.total_amount || 0), 0)
                    .toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* POSTS TAB */}
        {activeTab === 'posts' && (
          <>
            <button
              onClick={() => {
                setShowPostForm(true);
                setEditingPostId(null);
              }}
              className="mb-6 px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
            >
              + Tambah Post Baru
            </button>

            {showPostForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl font-bold mb-4">
                    {editingPostId ? ' Edit Post' : ' Tambah Post Baru'}
                  </h2>

                  <form onSubmit={handlePostSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Judul Post</label>
                      <input
                        type="text"
                        name="title"
                        value={postFormData.title}
                        onChange={handlePostInputChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="Contoh: Promo Bayam Segar"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">Konten (Mendukung Markdown)</label>
                      <textarea
                        name="content"
                        value={postFormData.content}
                        onChange={handlePostInputChange}
                        rows={6}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="Tulis informasi atau promo di sini..."
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">URL Gambar (Opsional)</label>
                      <input
                        type="text"
                        name="image_url"
                        value={postFormData.image_url}
                        onChange={handlePostInputChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">Terkait Produk (Opsional)</label>
                      <select
                        name="item_id"
                        value={postFormData.item_id}
                        onChange={handlePostInputChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                        <option value="">-- Pilih Produk --</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_published"
                        name="is_published"
                        checked={postFormData.is_published}
                        onChange={handlePostInputChange}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="is_published" className="text-sm font-semibold">Publikasikan</label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-purple-500 text-white py-2 rounded-lg font-bold hover:bg-purple-600 transition-colors"
                      >
                        {editingPostId ? 'Simpan Perubahan' : 'Tambahkan Post'}
                      </button>
                      <button
                        type="button"
                        onClick={handlePostCancel}
                        className="flex-1 bg-slate-300 text-slate-700 py-2 rounded-lg font-bold hover:bg-slate-400 transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-6 py-4 text-left font-bold text-slate-700">ID</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-700">Judul</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-700">Status</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-700">Tanggal</th>
                      <th className="px-6 py-4 text-center font-bold text-slate-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                          Belum ada post informasi.
                        </td>
                      </tr>
                    ) : (
                      posts.map((post) => (
                        <tr key={post.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-700 font-semibold">{post.id}</td>
                          <td className="px-6 py-4 text-slate-700 font-semibold max-w-xs truncate" title={post.title}>{post.title}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              post.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {post.is_published ? 'PUBLISHED' : 'DRAFT'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 text-sm">
                            {new Date(post.created_at).toLocaleDateString('id-ID')}
                          </td>
                          <td className="px-6 py-4 text-center space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => handlePostEdit(post)}
                              className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handlePostDelete(post.id)}
                              className="px-3 py-1 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600 transition-colors"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default Admin;
