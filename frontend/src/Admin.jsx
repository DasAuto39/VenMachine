import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Package,
  Settings,
  LogOut,
  Edit,
  Trash2,
  Plus,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowLeft
} from 'lucide-react';

function Admin() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('products'); // 'products', 'transactions', 'analytics'
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Lainnya',
    price: '',
    machine_stock: '',
    warehouse_stock: '',
    location_id: '',
    description: ''
  });

  // Expandable transaction details state
  const [expandedTx, setExpandedTx] = useState(null);
  const [txItems, setTxItems] = useState({});
  const [originalItem, setOriginalItem] = useState(null); // stok asli sebelum diedit

  // Image Upload state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

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
  const [postImageFile, setPostImageFile] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);


  // Fetch all items and transactions
  useEffect(() => {
    // Role verification
    const storedUser = localStorage.getItem('user');
    const authenticated = localStorage.getItem('authenticated');

    if (!storedUser || authenticated !== 'true') {
      navigate('/login');
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      if (user.role !== 'admin') {
        alert('Akses Ditolak: Halaman ini khusus untuk Admin.');
        navigate('/user');
        return;
      }
    } catch (err) {
      console.error('Error parsing stored user:', err);
      navigate('/login');
      return;
    }

    fetchItems();
    fetchTransactions();
    fetchPosts();
    fetchAnalytics();

    // Refresh transactions every 10 seconds
    const interval = setInterval(fetchTransactions, 10000);
    return () => clearInterval(interval);
  }, [navigate]);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/analytics`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/items`, { headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error("Error fetching items:", err);
    }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/posts`, { headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };


  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/transactions`, { headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'machine_stock' || name === 'warehouse_stock' || name === 'location_id' ? parseFloat(value) || '' : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.sku || !formData.price || formData.machine_stock === '' || formData.warehouse_stock === '' || !formData.location_id) {
      alert("Semua field harus diisi!");
      return;
    }

    // === Logika transfer stok gudang → mesin (hanya saat edit) ===
    let finalFormData = { ...formData };
    if (editingId && originalItem) {
      const newMachineStock = Number(formData.machine_stock);
      const oldMachineStock = Number(originalItem.machine_stock);
      const currentWarehouse = Number(formData.warehouse_stock);

      if (newMachineStock > oldMachineStock) {
        // Admin menambah stok mesin → kurangi dari gudang
        const tambahan = newMachineStock - oldMachineStock;
        if (currentWarehouse < tambahan) {
          alert(
            `Stok gudang tidak cukup!\n\n` +
            `Anda ingin menambah ${tambahan} ke mesin, tetapi stok gudang hanya ${currentWarehouse}.\n` +
            `Silakan tambah stok gudang terlebih dahulu.`
          );
          return;
        }
        // Kurangi gudang sebesar tambahan mesin
        finalFormData = {
          ...formData,
          machine_stock: newMachineStock,
          warehouse_stock: currentWarehouse - tambahan
        };
      }
      // Jika machine_stock dikurangi, stok gudang tidak berubah (barang sudah di mesin)
    }
    // =============================================================

    // === Logika upload gambar ===
    if (imageFile) {
      const formDataUpload = new FormData();
      formDataUpload.append('file', imageFile);

      try {
        const uploadRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formDataUpload
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalFormData.image_url = uploadData.url;
        } else {
          alert("Gagal mengupload gambar!");
          return;
        }
      } catch (err) {
        console.error("Error upload:", err);
        alert("Terjadi kesalahan saat upload gambar!");
        return;
      }
    }
    // =============================================================

    try {
      if (editingId) {
        // Update
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/items/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(finalFormData)
        });
        if (res.ok) {
          alert("Produk berhasil diperbarui!");
          setEditingId(null);
          setOriginalItem(null);
        }
      } else {
        // Create — stok langsung dipakai apa adanya
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(finalFormData)
        });
        if (res.ok) {
          alert("Produk berhasil ditambahkan!");
        }
      }

      setFormData({ name: '', sku: '', category: 'Lainnya', price: '', machine_stock: '', warehouse_stock: '', location_id: '', description: '' });
      setImageFile(null);
      setImagePreview(null);
      setShowForm(false);
      fetchItems();
    } catch (err) {
      console.error("Error:", err);
      alert("Terjadi kesalahan!");
    }
  };

  const handleEdit = (item) => {
    setOriginalItem(item); // simpan data asli untuk kalkulasi selisih stok
    setFormData({
      name: item.name,
      sku: item.sku,
      category: item.category || 'Lainnya',
      price: item.price,
      machine_stock: item.machine_stock,
      warehouse_stock: item.warehouse_stock,
      location_id: item.location_id,
      description: item.description || ''
    });
    setImageFile(null);
    setImagePreview(item.image_url ? (item.image_url.includes('/uploads/') ? `${import.meta.env.VITE_API_BASE_URL}${item.image_url.substring(item.image_url.indexOf('/uploads/'))}` : item.image_url) : null);
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleAddToShelf = (locId) => {
    setShowForm(true);
    setEditingId(null);
    setOriginalItem(null);
    setFormData({
      name: '',
      sku: '',
      category: 'Lainnya',
      price: '',
      machine_stock: '',
      warehouse_stock: '',
      location_id: locId,
      description: ''
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleDelete = async (itemId, locId) => {
    if (itemId) {
      if (confirm("Yakin ingin mengosongkan rak ini? (Data barang akan dihapus)")) {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/items/${itemId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) {
            alert("Rak berhasil dikosongkan!");
            fetchItems();
          }
        } catch (err) {
          console.error("Error:", err);
        }
      }
    } else if (locId) {
      if (confirm("Yakin ingin menghapus lokasi rak ini secara permanen?")) {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/locations/${locId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) {
            alert("Lokasi rak berhasil dihapus!");
            fetchItems();
          } else {
            const errData = await res.json();
            alert(`Gagal: ${errData.detail || 'Terjadi kesalahan'}`);
          }
        } catch (err) {
          console.error("Error:", err);
        }
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setOriginalItem(null);
    setImageFile(null);
    setImagePreview(null);
    setFormData({ name: '', sku: '', category: 'Lainnya', price: '', machine_stock: '', warehouse_stock: '', location_id: '', description: '' });
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
      let finalImageUrl = postFormData.image_url || null;
      
      // === Logika upload gambar post ===
      if (postImageFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', postImageFile);

        const uploadRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formDataUpload
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalImageUrl = uploadData.url;
        } else {
          alert("Gagal mengupload gambar post!");
          return;
        }
      }
      // =================================

      const payload = {
        title: postFormData.title,
        content: postFormData.content,
        image_url: finalImageUrl,
        item_id: postFormData.item_id ? parseInt(postFormData.item_id) : null,
        is_published: postFormData.is_published
      };

      const url = editingPostId
        ? `${import.meta.env.VITE_API_BASE_URL}/api/admin/posts/${editingPostId}`
        : `${import.meta.env.VITE_API_BASE_URL}/api/admin/posts`;

      const method = editingPostId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
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
    setPostImageFile(null);
    setPostImagePreview(post.image_url ? (post.image_url.includes('/uploads/') ? `${import.meta.env.VITE_API_BASE_URL}${post.image_url.substring(post.image_url.indexOf('/uploads/'))}` : post.image_url) : null);
    setEditingPostId(post.id);
    setShowPostForm(true);
  };

  const handlePostDelete = async (id) => {
    if (confirm("Yakin ingin menghapus post ini?")) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/posts/${id}`, {
          method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
    setPostImageFile(null);
    setPostImagePreview(null);
  };

  const locationOccupiedBy = showForm && formData.location_id ? items.find(i => i.location_id === parseInt(formData.location_id) && i.id && i.id !== editingId) : null;
  const isLocationOccupied = !!locationOccupiedBy;
  const maxLocId = items.length > 0 ? Math.max(...items.map(i => i.location_id || 0)) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-indigo-50/95 backdrop-blur-xl border-b border-indigo-100 shadow-[0_2px_20px_rgba(99,102,241,0.08)]">
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-500" />

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/25 text-white text-sm font-black">
              A
            </div>
            <h1 className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/user')}
              className="px-4 py-2 rounded-2xl text-sm font-bold bg-white text-indigo-700 border border-indigo-100 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
            >
              Kembali Belanja
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('user');
                localStorage.removeItem('authenticated');
                navigate('/user');
              }}
              className="px-4 py-2 rounded-2xl text-sm font-bold text-rose-500 bg-white border border-rose-100 hover:bg-rose-50 hover:border-rose-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 max-w-7xl mx-auto overflow-x-auto pb-1 hide-scrollbar">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-6 py-2.5 rounded-full font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'products'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30 transform -translate-y-0.5'
              : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200'
              }`}
          >
            <Package className="w-4 h-4" /> Manajemen Produk
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-6 py-2.5 rounded-full font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'transactions'
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 transform -translate-y-0.5'
              : 'bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200'
              }`}
          >
            <Clock className="w-4 h-4" /> Riwayat Pembayaran ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-6 py-2.5 rounded-full font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'posts'
              ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-lg shadow-fuchsia-500/30 transform -translate-y-0.5'
              : 'bg-white text-slate-500 hover:bg-fuchsia-50 hover:text-fuchsia-600 border border-slate-200 hover:border-fuchsia-200'
              }`}
          >
            <ImageIcon className="w-4 h-4" /> Manajemen Informasi ({posts.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-2.5 rounded-full font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'analytics'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 transform -translate-y-0.5'
              : 'bg-white text-slate-500 hover:bg-orange-50 hover:text-orange-600 border border-slate-200 hover:border-orange-200'
              }`}
          >
            <BarChart className="w-4 h-4" /> Analitik Penjualan
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
                const maxLocId = items.length > 0 ? Math.max(...items.map(i => i.location_id || 0)) : 0;
                setFormData(prev => ({ ...prev, location_id: maxLocId + 1 }));
              }}
              className="mb-8 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full font-bold hover:shadow-lg hover:shadow-indigo-500/40 transition-all duration-300 flex items-center gap-2 transform hover:-translate-y-1"
            >
              <Plus className="w-5 h-5" /> Tambah Produk Baru
            </button>

            {/* Form Modal */}
            {showForm && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
                <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2rem] p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto hide-scrollbar shadow-2xl transform transition-all">
                  <h2 className="text-2xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
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
                      <label className="block text-sm font-semibold mb-1">Kategori</label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="Sayuran">Sayuran</option>
                        <option value="Buah">Buah</option>
                        <option value="Bahan Pokok">Bahan Pokok</option>
                        <option value="Minuman">Minuman</option>
                        <option value="Snack">Snack</option>
                        <option value="Daging">Daging</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1">Stok Mesin (Maks 10)</label>
                        <input
                          type="number"
                          name="machine_stock"
                          value={formData.machine_stock}
                          onChange={handleInputChange}
                          min="0"
                          max="10"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="10"
                        />
                        {/* Hint: selisih yang akan diambil dari gudang */}
                        {editingId && originalItem && Number(formData.machine_stock) > Number(originalItem.machine_stock) && (() => {
                          const tambahan = Number(formData.machine_stock) - Number(originalItem.machine_stock);
                          const gudang = Number(formData.warehouse_stock);
                          const cukup = gudang >= tambahan;
                          return (
                            <p className={`mt-1 text-xs font-semibold ${cukup ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {cukup
                                ? `✓ Ambil ${tambahan} dari gudang (sisa gudang: ${gudang - tambahan})`
                                : `✗ Kurang! Butuh ${tambahan}, gudang hanya ${gudang}`}
                            </p>
                          );
                        })()}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Stok Gudang</label>
                        <input
                          type="number"
                          name="warehouse_stock"
                          value={formData.warehouse_stock}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="40"
                        />
                        {editingId && Number(formData.warehouse_stock) === 0 && (
                          <p className="mt-1 text-xs font-semibold text-rose-500">⚠ Stok gudang kosong!</p>
                        )}
                      </div>
                    </div>
                    {/* Info box transfer stok */}
                    {editingId && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 font-medium">
                        ℹ Menambah <strong>Stok Mesin</strong> akan otomatis mengurangi <strong>Stok Gudang</strong> sebesar selisihnya. Mengurangi stok mesin tidak mengembalikan ke gudang.
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold mb-1">Lokasi (Rak)</label>
                      <input
                        type="number"
                        name="location_id"
                        value={formData.location_id}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${isLocationOccupied ? 'border-rose-300 focus:ring-rose-500 bg-rose-50' : 'border-slate-300 focus:ring-emerald-500'}`}
                        placeholder="1"
                      />
                      {isLocationOccupied && (
                        <p className="mt-1 text-xs font-semibold text-rose-500">
                          ⚠ Rak ini sudah terisi oleh produk: {locationOccupiedBy.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">Foto Produk (Opsional)</label>
                      <div className="flex items-center gap-4">
                        {imagePreview && (
                          <div className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden shrink-0">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setImageFile(file);
                              setImagePreview(URL.createObjectURL(file));
                            }
                          }}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">Deskripsi Produk (Opsional)</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows="2"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                        placeholder="Tambahkan deskripsi singkat mengenai produk..."
                      ></textarea>
                    </div>

                    <div className="flex gap-3 pt-6">
                      <button
                        type="submit"
                        disabled={isLocationOccupied}
                        className={`flex-1 text-white py-3 rounded-full font-bold transition-all duration-300 ${
                          isLocationOccupied 
                            ? 'bg-slate-300 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5'
                        }`}
                      >
                        {editingId ? 'Simpan Perubahan' : 'Tambahkan'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-full font-bold hover:bg-slate-200 transition-colors"
                      >
                        Batal
                      </button>
                    </div>

                  </form>
                </div>
              </div>
            )}

            {/* Products Table */}
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-left font-bold text-slate-700">Lokasi Motor</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-700">Nama Produk</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-700">SKU</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-700">Kategori</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-700">Harga</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-700">Stok Mesin</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-700">Stok Gudang</th>
                      <th className="px-6 py-4 text-center font-bold text-slate-700">Rak</th>
                      <th className="px-6 py-4 text-center font-bold text-slate-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id || `empty-${item.location_id}-${index}`} className={`border-b border-slate-200 transition-colors ${!item.id ? 'bg-slate-100/50 hover:bg-slate-100 text-slate-400' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4 font-semibold">{item.location_id || '-'}</td>
                        <td className="px-6 py-4 font-semibold">
                          {!item.id ? (
                            <span className="text-slate-400 italic">Barang Kosong</span>
                          ) : (
                            <span className="text-slate-700">{item.name}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono">{item.sku || '-'}</td>
                        <td className="px-6 py-4">
                          {item.id ? (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">{item.category || 'Lainnya'}</span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold">
                          {item.id ? (
                            <span className="text-emerald-600">Rp {(item.price || 0).toLocaleString('id-ID')}</span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold">
                          {item.id ? (
                            <span className={`px-2 py-1 rounded-lg ${item.machine_stock <= 2 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {String(item.machine_stock || 0)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold">
                          {item.id ? (
                            <span className="text-slate-700">{String(item.warehouse_stock || 0)}</span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-center font-semibold">
                          {item.location_code || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            {item.id && (
                              <button
                                onClick={() => handleEdit(item)}
                                className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 hover:text-indigo-700 transition-all transform hover:-translate-y-0.5"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {!item.id && (
                              <button
                                onClick={() => handleAddToShelf(item.location_id)}
                                className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 hover:text-emerald-700 transition-all transform hover:-translate-y-0.5"
                                title="Isi Rak Ini"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                            {item.id ? (
                                <button
                                  onClick={() => handleDelete(item.id, null)}
                                  className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 hover:text-rose-700 transition-all transform hover:-translate-y-0.5"
                                  title="Kosongkan Rak (Hapus Barang)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                            ) : (
                                item.location_id === maxLocId ? (
                                  <button
                                    onClick={() => handleDelete(null, item.location_id)}
                                    className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 hover:text-rose-700 transition-all transform hover:-translate-y-0.5"
                                    title="Hapus Rak Permanen"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="p-2.5 bg-slate-100 text-slate-300 rounded-xl cursor-not-allowed"
                                    title="Rak kosong hanya bisa dihapus dari urutan paling akhir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )
                            )}
                          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(99,102,241,0.1)] transition-all">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                <p className="text-slate-500 font-semibold mb-2 relative z-10">Total Produk</p>
                <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 relative z-10">{items.length}</p>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(16,185,129,0.1)] transition-all">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                <p className="text-slate-500 font-semibold mb-2 relative z-10">Total Stok</p>
                <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500 relative z-10">
                  {items.reduce((sum, item) => sum + (item.machine_stock || 0) + (item.warehouse_stock || 0), 0)}
                </p>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(244,63,94,0.1)] transition-all">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-rose-100 to-pink-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                <p className="text-slate-500 font-semibold mb-2 relative z-10">Produk Habis</p>
                <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-pink-500 relative z-10">
                  {items.filter(item => (item.machine_stock || 0) === 0 && (item.warehouse_stock || 0) === 0).length}
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
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-12 text-center border border-slate-100">
                <p className="text-slate-500 text-lg font-medium">Belum ada transaksi</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-left font-bold text-slate-700 w-10"></th>
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
                        <React.Fragment key={tx.transaction_id}>
                          <tr
                            className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => toggleTransactionDetail(tx.transaction_id)}
                          >
                            <td className="px-6 py-4 text-slate-400">
                              {expandedTx === tx.transaction_id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </td>
                            <td className="px-6 py-4 text-slate-700 font-mono text-sm">{tx.transaction_code}</td>
                            <td className="px-6 py-4 text-slate-700 font-semibold">Gate {tx.gate_id}</td>
                            <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                              Rp {(tx.total_amount || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {tx.payment_method || '-'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${tx.payment_status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-700'
                                : tx.payment_status === 'PENDING'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>
                                <div className="flex items-center gap-1.5 justify-center">
                                  {tx.payment_status === 'PAID' ? <><CheckCircle2 size={14} /> Dibayar</> :
                                    tx.payment_status === 'PENDING' ? <><Clock size={14} /> Menunggu</> :
                                      <><XCircle size={14} /> Dibatalkan</>}
                                </div>
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-sm">
                              {new Date(tx.created_at).toLocaleString('id-ID')}
                            </td>
                          </tr>
                          {expandedTx === tx.transaction_id && (
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <td colSpan="7" className="px-6 py-4">
                                <div className="pl-14">
                                  <p className="text-sm font-bold text-slate-500 uppercase mb-3">Detail Item</p>
                                  {txItems[tx.transaction_id] ? (
                                    txItems[tx.transaction_id].length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {txItems[tx.transaction_id].map((item, idx) => (
                                          <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                            <div>
                                              <span className="font-semibold text-slate-700 text-sm">{item.item_name}</span>
                                              <span className="text-slate-400 ml-2 text-sm">x{item.quantity}</span>
                                            </div>
                                            <span className="font-bold text-emerald-600 text-sm">
                                              Rp {(item.unit_price * item.quantity).toLocaleString('id-ID')}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-slate-400 italic">Detail item tidak tersedia.</p>
                                    )
                                  ) : (
                                    <div className="flex py-2">
                                      <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin"></div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(59,130,246,0.1)] transition-all">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                <p className="text-slate-500 font-semibold mb-2 relative z-10">Total Transaksi</p>
                <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600 relative z-10">{transactions.length}</p>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(16,185,129,0.1)] transition-all">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                <p className="text-slate-500 font-semibold mb-2 relative z-10">Pembayaran Sukses</p>
                <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500 relative z-10">
                  {transactions.filter(tx => tx.payment_status === 'PAID').length}
                </p>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(245,158,11,0.1)] transition-all">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                <p className="text-slate-500 font-semibold mb-2 relative z-10">Total Pendapatan</p>
                <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-500 relative z-10">
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
              className="mb-8 px-6 py-3 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white rounded-full font-bold hover:shadow-lg hover:shadow-fuchsia-500/40 transition-all duration-300 flex items-center gap-2 transform hover:-translate-y-1"
            >
              <Plus className="w-5 h-5" /> Tambah Informasi Baru
            </button>

            {showPostForm && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
                <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2rem] p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl transform transition-all">
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
                      <label className="block text-sm font-semibold mb-1">Foto Informasi (Opsional)</label>
                      <div className="flex items-center gap-4">
                        {postImagePreview && (
                          <div className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden shrink-0">
                            <img src={postImagePreview} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setPostImageFile(file);
                              setPostImagePreview(URL.createObjectURL(file));
                            }
                          }}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                      </div>
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

                    <div className="flex gap-3 pt-6">
                      <button
                        type="submit"
                        className="flex-1 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white py-3 rounded-full font-bold hover:shadow-lg hover:shadow-fuchsia-500/30 transform hover:-translate-y-0.5 transition-all duration-300"
                      >
                        {editingPostId ? 'Simpan Perubahan' : 'Tambahkan Post'}
                      </button>
                      <button
                        type="button"
                        onClick={handlePostCancel}
                        className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-full font-bold hover:bg-slate-200 transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
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
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${post.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                              }`}>
                              {post.is_published ? 'PUBLISHED' : 'DRAFT'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 text-sm">
                            {new Date(post.created_at).toLocaleDateString('id-ID')}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handlePostEdit(post)}
                                className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 hover:text-indigo-700 transition-all transform hover:-translate-y-0.5"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handlePostDelete(post.id)}
                                className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 hover:text-rose-700 transition-all transform hover:-translate-y-0.5"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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

        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Summary */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
                  <BarChart className="w-5 h-5 text-orange-500" /> Ringkasan Penjualan
                </h3>
                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <span className="font-semibold text-emerald-800">Total Pendapatan</span>
                    <span className="text-2xl font-black text-emerald-600">Rp {Number(analytics.total_sales).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <span className="font-semibold text-blue-800">Total Transaksi</span>
                    <span className="text-2xl font-black text-blue-600">{analytics.total_transactions}</span>
                  </div>
                </div>
              </div>

              {/* Sales over time (Weekly) */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Tren Mingguan</h3>
                <div className="h-56 flex items-end justify-between gap-2 px-2 pb-6 border-b border-slate-100 relative">
                  {analytics.sales_over_time.length > 0 ? analytics.sales_over_time.map((day, idx) => {
                    const maxSales = Math.max(...analytics.sales_over_time.map(d => parseFloat(d.daily_sales)));
                    const height = maxSales > 0 ? (parseFloat(day.daily_sales) / maxSales) * 100 : 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative h-full">
                        <div className="w-full max-w-[64px] mx-auto relative bg-slate-50 rounded-t-xl h-full flex flex-col justify-end overflow-hidden group-hover:bg-slate-100 transition-colors border-b-2 border-slate-200 shadow-sm">
                          <div className="w-full bg-gradient-to-t from-orange-400 to-amber-300 rounded-t-xl transition-all duration-700 ease-out shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]" style={{ height: `${height}%` }}></div>
                        </div>
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                          <div className="bg-slate-800 text-white text-xs font-bold py-1 px-2 rounded-lg whitespace-nowrap shadow-xl">
                            Rp {parseFloat(day.daily_sales).toLocaleString('id-ID')}
                          </div>
                          <div className="w-2 h-2 bg-slate-800 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                        </div>
                        <span className="absolute -bottom-6 text-[10px] sm:text-xs font-bold text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                          {new Date(day.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    );
                  }) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-500 italic text-sm border border-slate-100 w-full max-w-xs">Belum ada data penjualan mingguan</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Top 10 Barang Terjual</h3>
                <div className="space-y-4">
                  {analytics.items_sold.length > 0 ? analytics.items_sold.map((item, idx) => {
                    const maxSold = Math.max(...analytics.items_sold.map(i => i.total_sold));
                    const width = maxSold > 0 ? (item.total_sold / maxSold) * 100 : 0;
                    return (
                      <div key={idx} className="relative group">
                        <div className="flex justify-between items-center text-sm font-semibold mb-1 relative z-10 px-3 py-1">
                          <span className="text-slate-700 truncate max-w-[75%] font-bold">{item.name}</span>
                          <span className="text-emerald-700 bg-white/50 px-2 py-0.5 rounded-md shadow-sm border border-emerald-100/50">{item.total_sold} unit</span>
                        </div>
                        <div className="h-8 w-full bg-slate-50 rounded-xl overflow-hidden absolute top-0 left-0 right-0 border border-slate-100">
                          <div className="h-full bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl transition-all duration-1000 ease-out group-hover:from-emerald-200 group-hover:to-teal-200" style={{ width: `${width}%` }}></div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-500 italic text-sm border border-slate-100">Belum ada data barang terjual</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}      </main>
    </div>
  );
}

export default Admin;
