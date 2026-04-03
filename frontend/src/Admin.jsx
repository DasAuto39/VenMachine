import { useState, useEffect } from 'react';

function Admin() {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: '',
    stock_quantity: '',
    location_id: ''
  });

  // Fetch all items
  useEffect(() => {
    fetchItems();
    fetchLocations();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/admin/items");
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error("Error fetching items:", err);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/admin/items");
      const data = await res.json();
      const uniqueLocations = [...new Set(data.map(item => item.location_id))].filter(Boolean);
      setLocations(uniqueLocations);
    } catch (err) {
      console.error("Error fetching locations:", err);
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
        const res = await fetch(`http://127.0.0.1:8000/api/admin/items/${editingId}`, {
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
        const res = await fetch("http://127.0.0.1:8000/api/admin/items", {
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
        const res = await fetch(`http://127.0.0.1:8000/api/admin/items/${id}`, {
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black text-slate-900">📦 Admin Panel - Manajemen Produk</h1>
          <a 
            href="/user"
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
          >
            ← Kembali ke Belanja
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
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
                {editingId ? '✏️ Edit Produk' : '➕ Tambah Produk Baru'}
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
                      {item.gate_code || '-'}
                    </td>
                    <td className="px-6 py-4 text-center space-x-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-1 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600 transition-colors"
                      >
                        🗑️ Hapus
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
      </main>
    </div>
  );
}

export default Admin;
