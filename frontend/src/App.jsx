import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductDetail from './ProductDetail';

function App({ onGoToAdmin, onGoToLogin }) {
  const navigate = useNavigate();
  const mqttClientRef = useRef(null);
  const [mqttConnected, setMqttConnected] = useState(false);

  // Optional authentication
  const [user, setUser] = useState(null);

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [cart, setCart] = useState({}); // Ubah dari array ke object: {itemId: {item, qty}}
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentGate, setCurrentGate] = useState("unknown");
  const [notification, setNotification] = useState(null); // For toast notifications

  // Payment flow states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("QRIS");
  const [paymentStatus, setPaymentStatus] = useState(null); // null, 'success', 'failed'

  // Read gate from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gateFromUrl = params.get('gate');
    if (gateFromUrl) {
      setCurrentGate(gateFromUrl);
      localStorage.setItem('current_gate', gateFromUrl);
      console.log('Gate detected:', gateFromUrl);
    } else {
      const savedGate = localStorage.getItem('current_gate');
      if (savedGate) {
        setCurrentGate(savedGate);
      }
    }
  }, []);

  // Initialize MQTT connection
  useEffect(() => {
    const connectMQTT = async () => {
      try {
        // Load mqtt.js library from CDN
        const scriptId = 'mqtt-script';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://cdn.jsdelivr.net/npm/mqtt@5.0.0/dist/mqtt.min.js';
          script.onload = () => {
            if (window.mqtt) {
              const client = window.mqtt.connect('ws://broker.hivemq.com:8000/mqtt');
              
              client.on('connect', () => {
                console.log(' MQTT Connected to broker');
                setMqttConnected(true);
              });
              
              client.on('error', (err) => {
                console.error(' MQTT Error:', err);
              });
              
              client.on('disconnect', () => {
                console.log(' MQTT Disconnected');
                setMqttConnected(false);
              });
              
              mqttClientRef.current = client;
            }
          };
          document.head.appendChild(script);
        } else if (window.mqtt && !mqttClientRef.current) {
          // Library already loaded
          const client = window.mqtt.connect('ws://broker.hivemq.com:8000/mqtt');
          
          client.on('connect', () => {
            console.log(' MQTT Connected to broker');
            setMqttConnected(true);
          });
          
          client.on('error', (err) => {
            console.error(' MQTT Error:', err);
          });
          
          client.on('disconnect', () => {
            console.log(' MQTT Disconnected');
            setMqttConnected(false);
          });
          
          mqttClientRef.current = client;
        }
      } catch (err) {
        console.error('MQTT connection error:', err);
      }
    };

    connectMQTT();

    return () => {
      if (mqttClientRef.current) {
        mqttClientRef.current.end();
      }
    };
  }, []);

  // Check for authenticated user (optional)
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const authenticated = localStorage.getItem('authenticated');

    if (storedUser && authenticated === 'true') {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Error parsing stored user:', err);
        localStorage.removeItem('user');
        localStorage.removeItem('authenticated');
      }
    }
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/items`)
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch((err) => console.error("Gagal mengambil data:", err));
  }, []);

  // Function to fetch items (reusable)
  const fetchItems = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/items`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  // Helper function to format gate display
  const formatGateDisplay = (gate) => {
    if (gate === "unknown") return "Belum terhubung ke gate";
    const gateNum = gate.replace(/\D/g, ''); // Extract number
    return `Sekarang Anda Berada di gate ${gateNum}`;
  };

  // Tambah item ke cart atau increment quantity jika sudah ada
  const addToCart = (item) => {
    // Check if item has stock
    if (item.stock_quantity <= 0) {
      showNotification(`❌ ${item.name} telah habis terjual`);
      return;
    }

    // Calculate new quantity based on current cart state
    const currentQty = cart[item.id]?.qty || 0;
    const newQty = currentQty + 1;

    // Validate against stock
    if (newQty > item.stock_quantity) {
      showNotification(`❌ Stok ${item.name} hanya tersedia ${item.stock_quantity} buah`);
      return;
    }

    // Update cart
    setCart(prevCart => {
      if (prevCart[item.id]) {
        return {
          ...prevCart,
          [item.id]: {
            ...prevCart[item.id],
            qty: newQty
          }
        };
      } else {
        return {
          ...prevCart,
          [item.id]: { item, qty: newQty }
        };
      }
    });

    // Show notification with correct quantity
    showNotification(`✅ ${item.name} dalam keranjang: ${newQty}`);
  };

  // Notification helper
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authenticated');
    setUser(null);
    setCart({});
    showNotification('Anda telah logout');
  };

  // Increment quantity with stock validation
  const incrementQuantity = (itemId) => {
    setCart(prevCart => {
      const currentItem = prevCart[itemId];
      const newQty = currentItem.qty + 1;
      
      // Check if new quantity exceeds stock
      if (newQty > currentItem.item.stock_quantity) {
        showNotification(`❌ Stok ${currentItem.item.name} hanya ${currentItem.item.stock_quantity} buah`);
        return prevCart;
      }
      
      return {
        ...prevCart,
        [itemId]: {
          ...prevCart[itemId],
          qty: newQty
        }
      };
    });
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

  // Buka product detail modal
  const openProductDetail = (product) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  };

  // Tutup product detail modal
  const closeProductDetail = () => {
    setIsDetailOpen(false);
    setSelectedProduct(null);
  };

  // Add to cart dari detail modal
  const addToCartFromDetail = () => {
    if (selectedProduct) {
      addToCart(selectedProduct);
    }
  };

  const handleCheckout = async () => {
    if (Object.keys(cart).length === 0) return;

    setIsProcessing(true);

    try {
      // Step 1: Create transaction
      const gateNum = currentGate.replace(/\D/g, '') || '1';

      const checkoutRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gate_id: parseInt(gateNum),
          items_cart: cart,
          user_id: user?.user_id || null  // Pass user_id if logged in, null for guest
        })
      });

      if (!checkoutRes.ok) {
        const error = await checkoutRes.json();
        throw new Error(error.detail || 'Gagal membuat transaksi');
      }

      const transactionData = await checkoutRes.json();
      setTransactionId(transactionData.transaction_id);
      setIsPaymentModalOpen(true);
      setIsProcessing(false);
      setIsCartOpen(false);

      console.log(' Transaction created:', transactionData);
    } catch (err) {
      console.error("Checkout error:", err);
      showNotification(` Error: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!transactionId) return;

    setIsProcessing(true);

    try {
      // Step 2: Process payment
      const paymentRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: transactionId,
          payment_method: paymentMethod
        })
      });

      const paymentData = await paymentRes.json();

      if (paymentData.status === 'SUCCESS') {
        setPaymentStatus('success');
        showNotification(' Pembayaran berhasil! Barang Anda Akan Segera Keluar.');

        // Send MQTT command to ESP32
        sendToMachine(cart, currentGate);

        // Clear cart and close modal after success
        setTimeout(async () => {
          setCart({});
          setIsPaymentModalOpen(false);
          setPaymentStatus(null);
          setTransactionId(null);
          setIsProcessing(false);

          // Dispense items (trigger hardware)
          await dispenseItems();

          // Refresh items
          await fetchItems();
        }, 2000);
      } else {
        setPaymentStatus('failed');
        showNotification('Pembayaran gagal! Silahkan coba lagi.');
        setIsProcessing(false);
      }

      console.log('💳 Payment response:', paymentData);
    } catch (err) {
      console.error("Payment error:", err);
      setPaymentStatus('failed');
      showNotification(` Error pembayaran: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const dispenseItems = async () => {
    try {
      for (const itemId in cart) {
        const { qty } = cart[itemId];
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/dispense`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_id: parseInt(itemId),
            requested_qty: qty
          })
        });
      }
    } catch (err) {
      console.error("Dispense error:", err);
    }
  };

  const sendToMachine = (cartData, gateId) => {
    if (!mqttClientRef.current || !mqttClientRef.current.connected) {
      console.warn(' MQTT not connected, skipping send');
      return;
    }

    try {
      // Build items array - for qty > 1, duplicate the item ID
      const items = [];
      for (const itemId in cartData) {
        const { qty } = cartData[itemId];
        for (let i = 0; i < qty; i++) {
          items.push(parseInt(itemId));
        }
      }

      // Get machine ID from gate (e.g., "gate_1" -> "VM001")
      const numStr = String(gateId).replace(/\D/g, '') || '1';
      const machineId = `VM${numStr.padStart(3, '0')}`;

      // MQTT topic and simple payload
      const topic = `vending/${machineId}/cmd`;
      const payload = {
        items: items
      };

      mqttClientRef.current.publish(topic, JSON.stringify(payload));
      console.log(' MQTT sent to ESP32:', { topic, payload });
    } catch (err) {
      console.error(' Error sending MQTT:', err);
    }
  };

  // Hitung total harga
  const cartTotal = Object.values(cart).reduce((sum, { item, qty }) => sum + (item.price * qty), 0);
  const cartItemCount = Object.values(cart).reduce((sum, { qty }) => sum + qty, 0);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());

    if (selectedCategory === "Semua") {
      return matchesSearch;
    }

    // Map kategori ke jenis produk
    const categoryMap = {
      "Sayuran Segar": ["bayam", "wortel", "brokoli"],
      "Buah Pilihan": ["apel", "pisang", "jeruk"],
      "Sembako": ["beras", "minyak", "gula"],
      "Minuman": ["susu", "jus", "air mineral"],
      "Snack": ["chips", "kacang", "coklat"],
      "Daging": []
    };

    const itemNameLower = item.name.toLowerCase();
    const categoryItems = categoryMap[selectedCategory] || [];
    const matchesCategory = categoryItems.some(cat => itemNameLower.includes(cat));

    return matchesSearch && matchesCategory;
  });

  const categories = ["Semua", "Sayuran Segar", "Buah Pilihan", "Sembako", "Minuman", "Snack", "Daging"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 text-slate-800 font-sans selection:bg-emerald-200 relative overflow-hidden">

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Large floating blob - top right */}
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-emerald-200 rounded-full blur-3xl opacity-20 animate-float"></div>

        {/* Medium blob - bottom left */}
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-80 h-80 bg-teal-200 rounded-full blur-3xl opacity-15 animate-float-reverse"></div>

        {/* Small blob - center right */}
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-emerald-300 rounded-full blur-3xl opacity-10 animate-float" style={{ animationDelay: '1s' }}></div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      {/* Content wrapper with relative positioning */}
      <div className="relative z-10">

        {/* Notification Toast */}
        {notification && (
          <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-lg font-semibold z-50 animate-bounce">
            {notification}
          </div>
        )}

        {/* 1. NAVBAR (Glassmorphism Effect) - FIXED at top */}
        <header className="fixed top-0 left-0 right-0 z-40 w-full backdrop-blur-lg bg-white/80 border-b border-slate-200 px-6 py-4 flex items-center justify-between transition-all">
          {/* Logo and Gate */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-emerald-500/30 shadow-lg text-white text-lg font-black">
              F
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900">
                FRESH<span className="text-emerald-500">MART</span>
              </span>
              <div className="text-xs text-emerald-600 font-semibold">
                {formatGateDisplay(currentGate)}
              </div>
            </div>
          </div>

          {/* Cart and Auth Buttons */}
          <div className="flex items-center gap-3">
            {user && (
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all shadow-sm border border-slate-200"
              >
                <span className="text-sm text-slate-700 font-bold">👤 {user?.full_name || user?.username}</span>
              </button>
            )}
            <button
              onClick={() => navigate('/information')}
              className="relative flex items-center gap-2 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 hover:border-purple-400 px-5 py-2.5 rounded-2xl font-bold text-purple-700 hover:text-purple-800 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 transition-all shadow-sm hover:shadow-md"
            >
              <span>📰 Info & Promo</span>
            </button>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-400 px-5 py-2.5 rounded-2xl font-bold text-emerald-700 hover:text-emerald-800 hover:bg-gradient-to-r hover:from-emerald-100 hover:to-teal-100 transition-all shadow-sm hover:shadow-md"
            >
              <span>🛒 Keranjang</span>
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                  {cartItemCount}
                </span>
              )}
            </button>
            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-5 py-2.5 rounded-2xl font-bold text-rose-700 hover:text-rose-800 hover:border-rose-400 hover:bg-rose-100 transition-all"
              >
                🚪 Logout
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-5 py-2.5 rounded-2xl font-bold text-blue-700 hover:text-blue-800 hover:border-blue-400 hover:bg-blue-100 transition-all"
              >
                🔐 Login
              </button>
            )}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 pt-28">

          {/* 2. HERO BANNER */}
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-12 text-white mb-12 shadow-xl shadow-emerald-600/20">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-80 h-80 bg-teal-400 opacity-5 rounded-full blur-3xl"></div>
            <div className="relative z-10 text-center max-w-3xl mx-auto">
              <span className="inline-block py-2 px-4 rounded-full bg-white/10 border border-white/20 text-xs font-bold tracking-wider mb-6 uppercase backdrop-blur-sm">
                Supermarket Otomatis
              </span>
              <h1 className="text-5xl md:text-6xl font-black mb-6 leading-tight">Belanja Cepat,<br />Tanpa Antre Kasir.</h1>
              <p className="text-lg text-emerald-50 opacity-95 mx-auto">Pilih dari layar, bayar, dan ambil bahan makanan segar Anda langsung dari rak otomatis.</p>
            </div>
          </div>

          {/* Search Bar - Below Hero Banner, Full Width */}
          <div className="relative group mb-10 max-w-2xl mx-auto w-full">
            <input
              type="text"
              placeholder="Cari apel, beras, atau minyak..."
              className="w-full pl-12 pr-4 py-3 bg-slate-100/50 border border-slate-200 rounded-2xl outline-none text-sm transition-all focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <svg className="absolute left-4 top-3.5 w-5 h-5 opacity-50 group-focus-within:opacity-100 group-focus-within:text-emerald-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* 3. KATEGORI */}
          <div className="mb-10">
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {categories.map((cat, idx) => {
                const colors = [
                  'from-emerald-500 to-teal-600',
                  'from-blue-500 to-cyan-600',
                  'from-purple-500 to-pink-600',
                  'from-orange-500 to-rose-600',
                  'from-indigo-500 to-blue-600',
                  'from-lime-500 to-emerald-600',
                ];
                const colorClass = colors[idx % colors.length];
                const isSelected = selectedCategory === cat;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 px-6 py-3 font-semibold rounded-2xl transition-all ${isSelected
                        ? `bg-gradient-to-r ${colorClass} text-white shadow-lg shadow-emerald-500/30`
                        : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:shadow-md hover:-translate-y-1'
                      }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. GRID PRODUK (Clean & Proper) */}
          <div>
            <h2 className="text-xl font-black text-slate-800 mb-6">
              Etalase Produk {selectedCategory !== "Semua" && `- ${selectedCategory}`}
              <span className="text-sm font-semibold text-slate-500 ml-2">({filteredItems.length} produk)</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {filteredItems.length === 0 ? (
                <div className="col-span-2 md:col-span-4 lg:col-span-5 text-center py-12 text-slate-400">
                  <p className="text-lg font-semibold">Tidak ada produk yang cocok</p>
                  <p className="text-sm">Coba ubah kategori atau search term</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white border border-slate-200 rounded-3xl p-3 flex flex-col hover:shadow-xl hover:shadow-slate-200/50 hover:border-emerald-200 transition-all duration-300 group ${
                      item.stock_quantity === 0 ? 'opacity-50 hover:border-slate-200 hover:shadow-slate-200/30' : ''
                    }`}
                    onClick={() => item.stock_quantity > 0 && openProductDetail(item)}
                    title={item.description || item.name}
                  >

                    {/* Kotak Gambar dengan Fallback Emoji */}
                    <div className="relative w-full aspect-square bg-slate-50 rounded-2xl mb-4 flex items-center justify-center text-5xl group-hover:bg-emerald-50 transition-colors overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span
                        className={item.image_url ? "hidden" : "flex"}
                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                      >
                        🛒
                      </span>
                      {/* Out of Stock Badge */}
                      {item.stock_quantity === 0 && (
                        <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                          <span className="text-white font-black text-lg bg-red-600 px-4 py-2 rounded-full">HABIS</span>
                        </div>
                      )}
                    </div>

                    <div className="px-2 flex-1 flex flex-col">
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug mb-1">{item.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mb-4">{item.sku}</p>

                      {/* Deskripsi singkat */}
                      {item.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-2 italic">{item.description}</p>
                      )}

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
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item);
                          }}
                          disabled={item.stock_quantity === 0}
                          className="w-full bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold py-2 hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-slate-900"
                        >
                          + Keranjang
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
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
              </div> {/* <-- PERBAIKAN 2: Menutup div area scroll keranjang dengan benar */}

              {/* PERBAIKAN 3: Merapikan wrapper untuk subtotal & tombol checkout */}
              <div className="p-6 bg-white border-t border-slate-200 mt-auto">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-500 font-medium">Subtotal</span>
                  <span className="text-slate-800 font-bold">Rp {cartTotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 mb-6">
                  <span className="text-lg font-black text-slate-800">Total Pembayaran</span>
                  <span className="text-2xl font-black text-emerald-600">Rp {cartTotal.toLocaleString('id-ID')}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={cartItemCount === 0}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl disabled:bg-slate-300 disabled:text-slate-500 transition-all shadow-lg shadow-emerald-500/30 disabled:shadow-none text-lg active:scale-[0.98]"
                >
                  {isProcessing ? ' Memproses...' : ' Lanjut ke Pembayaran'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* PAYMENT MODAL */}
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay Gelap */}
            <div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => !isProcessing && setIsPaymentModalOpen(false)}
            ></div>

            {/* Modal Panel */}
            <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-black mb-6 text-center"> Pilih Metode Pembayaran</h2>

              {paymentStatus === 'success' && (
                <div className="text-center py-8">
                  <p className="text-6xl mb-4 animate-bounce">✅</p>
                  <h3 className="text-xl font-black text-emerald-600 mb-2">Pembayaran Berhasil!</h3>
                  <p className="text-slate-600">Silahkan ambil barang Anda dari mesin</p>
                </div>
              )}

              {paymentStatus === 'failed' && (
                <div className="text-center py-8">
                  <p className="text-6xl mb-4">❌</p>
                  <h3 className="text-xl font-black text-red-600 mb-2">Pembayaran Gagal</h3>
                  <p className="text-slate-600 mb-6">Silahkan coba metode pembayaran lain</p>
                  <button
                    onClick={() => setPaymentStatus(null)}
                    className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-all"
                  >
                    Kembali
                  </button>
                </div>
              )}

              {!paymentStatus && (
                <>
                  <div className="space-y-3 mb-6">
                    {[
                      { value: 'QRIS', label: ' QRIS', desc: 'Scan QR Code' },
                      { value: 'TRANSFER', label: ' Transfer Bank', desc: 'Transfer ATM/Mobile Banking' },
                      { value: 'CARD', label: ' Kartu Kredit', desc: 'Visa, Mastercard, dll' },
                      { value: 'CASH', label: ' Tunai', desc: 'Bayar dengan uang tunai' },
                    ].map(method => (
                      <button
                        key={method.value}
                        onClick={() => setPaymentMethod(method.value)}
                        className={`w-full p-4 rounded-2xl font-bold border-2 transition-all text-left ${paymentMethod === method.value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{method.label}</span>
                          {paymentMethod === method.value && <span className="text-lg">✓</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{method.desc}</p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handlePayment}
                      disabled={isProcessing}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30"
                    >
                      {isProcessing ? '⏳ Memproses...' : '✓ Bayar Sekarang'}
                    </button>

                    <button
                      onClick={() => {
                        setIsPaymentModalOpen(false);
                        setTransactionId(null);
                        setPaymentStatus(null);
                        setIsCartOpen(true);
                      }}
                      disabled={isProcessing}
                      className="w-full py-3 border-2 border-slate-300 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      Batal
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Product Detail Modal */}
        <ProductDetail
          product={selectedProduct}
          isOpen={isDetailOpen}
          onClose={closeProductDetail}
          onAddToCart={addToCartFromDetail}
        />

      </div>
      {/* End of relative z-10 wrapper */}

    </div>
  );
}

export default App;