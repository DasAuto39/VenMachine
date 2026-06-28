import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, LogOut, Newspaper, CheckCircle2, XCircle, Loader2, Package, QrCode, Settings } from 'lucide-react';
import ProductDetail from './ProductDetail';
import Chatbot from './Chatbot';

function App({ onGoToAdmin, onGoToLogin }) {
  const navigate = useNavigate();
  const mqttClientRef = useRef(null);
  const [mqttConnected, setMqttConnected] = useState(false);

  // Optional authentication
  const [user, setUser] = useState(null);

  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [cart, setCart] = useState({}); // Ubah dari array ke object: {itemId: {item, qty}}
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentGate, setCurrentGate] = useState("unknown");
  const [gateDropdownOpen, setGateDropdownOpen] = useState(false);
  const [gateConfirmPending, setGateConfirmPending] = useState(null); // gate yang menunggu konfirmasi
  const [notification, setNotification] = useState(null); // For toast notifications

  // Payment flow states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("QRIS");
  const [paymentStatus, setPaymentStatus] = useState(null); // null, 'success', 'failed'
  const [checkoutError, setCheckoutError] = useState(null);

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
        // Automatically restore the gate in the URL so it's always visible
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('gate', savedGate);
        window.history.replaceState({}, '', newUrl);
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
              const client = window.mqtt.connect('wss://broker.emqx.io:8084/mqtt');

              client.on('connect', () => {
                console.log(' MQTT Connected to broker');
                setMqttConnected(true);
                client.subscribe('vending/+/status');
                client.subscribe('vending/stock');
              });

              client.on('message', async (topic, message) => {
                try {
                  const payload = JSON.parse(message.toString());

                  if (topic === 'vending/stock' && payload.item !== undefined) {
                    const matchedItem = itemsRef.current.find(i => i.id == payload.item);
                    const itemName = matchedItem ? matchedItem.name : `Produk ID ${payload.item}`;
                    console.log(`✅ CROSSCHECK: Barang ${itemName} berhasil dikeluarkan.`);
                    setNotification({ message: `📦 Satu ${itemName} sukses dijatuhkan dari mesin!`, type: 'success' });
                    setTimeout(() => setNotification(null), 4000);
                  } else if (payload.status === 'RESTOCK_DONE' && payload.item_id) {
                    console.log(`Received RESTOCK_DONE for item ${payload.item_id}`);
                    // Trigger backend to update DB
                    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/items/${payload.item_id}/restock`, {
                      method: 'POST'
                    });
                    if (res.ok) {
                      console.log('Successfully processed restock via backend');
                      fetchItems();
                    }
                  }
                } catch (err) {
                  console.error('Error parsing MQTT message:', err);
                }
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
          const client = window.mqtt.connect('wss://broker.emqx.io:8084/mqtt');

          client.on('connect', () => {
            console.log(' MQTT Connected to broker');
            setMqttConnected(true);
            client.subscribe('vending/+/status');
            client.subscribe('vending/stock');
          });

          client.on('message', async (topic, message) => {
            try {
              const payload = JSON.parse(message.toString());

              if (topic === 'vending/stock' && payload.item !== undefined) {
                const matchedItem = itemsRef.current.find(i => i.id == payload.item);
                const itemName = matchedItem ? matchedItem.name : `Produk ID ${payload.item}`;
                console.log(`✅ CROSSCHECK: Barang ${itemName} berhasil dikeluarkan.`);
                setNotification({ message: `📦 Satu ${itemName} sukses dijatuhkan dari mesin!`, type: 'success' });
                setTimeout(() => setNotification(null), 4000);
              } else if (payload.status === 'RESTOCK_DONE' && payload.item_id) {
                console.log(`Received RESTOCK_DONE for item ${payload.item_id}`);
                // Trigger backend to update DB
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/items/${payload.item_id}/restock`, {
                  method: 'POST'
                });
                if (res.ok) {
                  console.log('Successfully processed restock via backend');
                  fetchItems();
                }
              }
            } catch (err) {
              console.error('Error parsing MQTT message:', err);
            }
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

  // Inject Midtrans Snap script
  useEffect(() => {
    const snapScriptUrl = 'https://app.sandbox.midtrans.com/snap/snap.js';
    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;

    if (clientKey && clientKey !== "SB-Mid-client-ganti_dengan_client_key_anda") {
      let scriptTag = document.createElement('script');
      scriptTag.src = snapScriptUrl;
      scriptTag.setAttribute('data-client-key', clientKey);
      document.body.appendChild(scriptTag);

      return () => {
        document.body.removeChild(scriptTag);
      }
    }
  }, []);

  // Handle redirect callback from Midtrans
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const order_id = params.get('order_id');
    const transaction_status = params.get('transaction_status');

    if (order_id && (transaction_status === 'settlement' || transaction_status === 'capture')) {
      // Clear URL params without reloading page
      const url = new URL(window.location);
      url.searchParams.delete('order_id');
      url.searchParams.delete('transaction_status');
      url.searchParams.delete('status_code');
      window.history.pushState({}, '', url);

      setIsProcessing(true);
      setIsPaymentModalOpen(true);
      setPaymentStatus(null);

      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/payment/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id, transaction_status })
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'SUCCESS') {
            setPaymentStatus('success');
            showNotification(' Pembayaran berhasil! Barang Anda Akan Segera Keluar.', 'success');
            setTimeout(async () => {
              setCart({});
              setIsPaymentModalOpen(false);
              setPaymentStatus(null);
              setIsProcessing(false);
              fetchItems();
            }, 3000);
          } else {
            setPaymentStatus('failed');
            showNotification('Gagal memverifikasi pembayaran dengan mesin!', 'error');
            setIsProcessing(false);
          }
        })
        .catch(err => {
          setPaymentStatus('failed');
          showNotification(` Error konfirmasi: ${err.message}`, 'error');
          setIsProcessing(false);
        });
    }
  }, []);

  // Helper function to format gate display
  const formatGateDisplay = (gate) => {
    if (gate === "unknown") return "Belum terhubung ke gate";
    const gateNum = gate.replace(/\D/g, ''); // Extract number
    return `Sekarang Anda Berada di gate ${gateNum}`;
  };

  // Tambah item ke cart atau increment quantity jika sudah ada
  const addToCart = (item) => {
    // Check if item has stock
    if (item.machine_stock <= 0) {
      showNotification(`${item.name} telah habis terjual`, 'error');
      return;
    }

    // Calculate new quantity based on current cart state
    const currentQty = cart[item.id]?.qty || 0;
    const newQty = currentQty + 1;

    // Validate against stock
    if (newQty > item.machine_stock) {
      showNotification(`Stok ${item.name} di mesin hanya tersedia ${item.machine_stock} buah`, 'error');
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

    showNotification(`${item.name} dalam keranjang: ${newQty}`, 'success');
  };

  // Notification helper
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authenticated');
    setUser(null);
    setCart({});
    showNotification('Anda telah logout', 'success');
  };

  // Increment quantity with stock validation
  const incrementQuantity = (itemId) => {
    setCart(prevCart => {
      const currentItem = prevCart[itemId];
      const newQty = currentItem.qty + 1;

      // Check if new quantity exceeds stock
      if (newQty > currentItem.item.machine_stock) {
        showNotification(`Stok ${currentItem.item.name} di mesin hanya ${currentItem.item.machine_stock} buah`, 'error');
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

    setCheckoutError(null);
    setIsProcessing(true);

    try {
      // Step 1: Create transaction di DB
      const gateNum = currentGate.replace(/\D/g, '') || '1';

      const checkoutRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gate_id: parseInt(gateNum),
          items_cart: cart,
          user_id: user?.user_id || null
        })
      });

      if (!checkoutRes.ok) {
        const error = await checkoutRes.json();
        throw new Error(error.detail || 'Gagal membuat transaksi');
      }

      const transactionData = await checkoutRes.json();
      const transaction_id = transactionData.transaction_id;

      // Step 2: Minta Snap Token dari backend
      const tokenRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/midtrans/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: transaction_id
        })
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json();
        throw new Error(errData.detail || "Gagal mendapatkan token Midtrans");
      }

      const tokenData = await tokenRes.json();

      // Tutup keranjang agar UI fokus ke pembayaran
      setIsCartOpen(false);
      setIsProcessing(false);

      // Step 3: Tampilkan Pop-up Midtrans
      if (window.snap) {
        window.snap.pay(tokenData.token, {
          onSuccess: function (result) {
            // Pembayaran Berhasil! Beritahu backend.
            handlePaymentSuccess(transaction_id, result);
          },
          onPending: function (result) {
            showNotification('Pembayaran tertunda. Silakan selesaikan pembayaran Anda.', 'info');
          },
          onError: function (result) {
            showNotification('Pembayaran gagal! Silakan coba lagi.', 'error');
          },
          onClose: async function () {
            showNotification('Anda menutup popup pembayaran. Kunci stok dilepas.', 'error');
            try {
              const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
              await fetch(`${baseUrl}/api/transaction/${transaction_id}/cancel`, { method: 'POST' });
            } catch (e) {
              console.error("Gagal membatalkan transaksi", e);
            }
          }
        })
      } else {
        throw new Error("Midtrans Snap belum dimuat atau Client Key belum di-setup di frontend/.env");
      }

    } catch (err) {
      console.error("Checkout error:", err);
      showNotification(` Error: ${err.message}`, 'error');
      setCheckoutError(err.message);
      setIsProcessing(false);
    }
  };

  const handlePaymentSuccess = async (transaction_id, midtransResult) => {
    setIsProcessing(true);
    // Tampilkan modal dummy kita hanya untuk memunculkan pesan "Pembayaran Berhasil"
    setIsPaymentModalOpen(true);
    setPaymentStatus(null);

    try {
      // Deteksi detail bank/VA jika ada
      let paymentDetail = 'MIDTRANS';
      if (midtransResult) {
        if (midtransResult.payment_type === 'bank_transfer' && midtransResult.va_numbers && midtransResult.va_numbers.length > 0) {
          paymentDetail = `MIDTRANS_VA_${midtransResult.va_numbers[0].bank.toUpperCase()}`;
        } else if (midtransResult.payment_type === 'echannel') {
          paymentDetail = 'MIDTRANS_VA_MANDIRI';
        } else if (midtransResult.payment_type === 'bank_transfer' && midtransResult.permata_va_number) {
          paymentDetail = 'MIDTRANS_VA_PERMATA';
        } else {
          paymentDetail = `MIDTRANS_${midtransResult.payment_type.toUpperCase()}`;
        }
      }

      // Panggil endpoint /api/payment kita untuk memotong stok dan menjatuhkan barang
      const paymentRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: transaction_id,
          payment_method: paymentDetail
        })
      });

      const paymentData = await paymentRes.json();

      if (paymentData.status === 'SUCCESS') {
        setPaymentStatus('success');
        showNotification(' Pembayaran berhasil! Barang Anda Akan Segera Keluar.', 'success');

        // Clear cart and close modal after success
        setTimeout(async () => {
          setCart({});
          setIsPaymentModalOpen(false);
          setPaymentStatus(null);
          setIsProcessing(false);
          await fetchItems();
        }, 3000);
      } else {
        setPaymentStatus('failed');
        showNotification('Gagal memverifikasi pembayaran dengan mesin!', 'error');
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Payment confirmation error:", err);
      setPaymentStatus('failed');
      showNotification(` Error konfirmasi: ${err.message}`, 'error');
      setIsProcessing(false);
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

    // Filter by category from database
    return matchesSearch && item.category === selectedCategory;
  });

  // Build dynamic categories from database items
  const categories = ["Semua", ...new Set(items.map(item => item.category || 'Lainnya').filter(Boolean))];

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

        {/* Toast Notification */}
        {notification && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce-short">
            <div className={`backdrop-blur-md px-6 py-3 rounded-full font-bold shadow-xl border flex items-center gap-2 ${notification.type === 'error'
              ? 'bg-rose-500/90 text-white border-rose-400'
              : 'bg-emerald-500/90 text-white border-emerald-400'
              }`}>
              {notification.type === 'error' ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
              {notification.message}
            </div>
          </div>
        )}

        {/* Modal konfirmasi Gate */}
        {gateConfirmPending && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setGateConfirmPending(null)} />
            {/* Card */}
            <div className="relative bg-white rounded-3xl shadow-2xl shadow-slate-900/20 border border-slate-100 max-w-sm w-full p-7 animate-in">
              {/* Icon */}
              <div className="w-14 h-14 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-center text-lg font-black text-slate-800 mb-1">
                Konfirmasi Lokasi Gate
              </h3>
              <p className="text-center text-sm text-slate-500 font-medium mb-5 leading-relaxed">
                Anda memilih <span className="font-bold text-emerald-700">{gateConfirmPending.label}</span>.
                <br />
                Pastikan Anda <span className="font-bold text-slate-700">benar-benar berada</span> di depan mesin <span className="font-bold text-emerald-700">{gateConfirmPending.label}</span>.
              </p>
              {/* Warning box */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6">
                <p className="text-xs text-amber-700 font-semibold leading-snug text-center">
                  ⚠️ Salah memilih gate dapat menyebabkan barang keluar di mesin yang berbeda dan transaksi gagal dikonfirmasi.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setGateConfirmPending(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    const g = gateConfirmPending;
                    setCurrentGate(g.val);
                    localStorage.setItem('current_gate', g.val);
                    const url = new URL(window.location);
                    url.searchParams.set('gate', g.val);
                    window.history.pushState({}, '', url);
                    setGateConfirmPending(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md shadow-emerald-400/30 transition-all"
                >
                  Ya, Saya di {gateConfirmPending.label}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gate Not Selected — subtle floating ribbon */}
        {currentGate === 'unknown' && (
          <div className="fixed top-[62px] left-0 right-0 z-30 flex justify-center pointer-events-none">
            <div className="bg-gradient-to-r from-rose-500 to-rose-600 text-white text-xs font-semibold px-6 py-1.5 rounded-b-2xl shadow-lg shadow-rose-400/30 tracking-wide">
              Anda belum memilih gate — transaksi tidak dapat diproses
            </div>
          </div>
        )}

        {/* 1. NAVBAR */}
        <header className="fixed top-0 left-0 right-0 z-40 w-full" style={{ minHeight: '62px' }}>
          {/* Gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500" />

          <div className="w-full h-full backdrop-blur-xl bg-emerald-50/95 border-b border-emerald-100 shadow-[0_2px_20px_rgba(16,185,129,0.08)] px-4 md:px-8 flex items-center justify-between" style={{ minHeight: '62px' }}>

            {/* LEFT: logo + gate */}
            <div className="flex items-center gap-4 md:gap-6">
              {/* Logo */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/25 text-white text-sm font-black">
                  F
                </div>
                <span className="text-base font-black tracking-tight text-slate-900 hidden sm:block">
                  FRESH<span className="text-emerald-500">MART</span>
                </span>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-6 bg-slate-200" />

              {/* Gate custom dropdown */}
              <div className="relative">
                <button
                  onClick={() => setGateDropdownOpen(v => !v)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${currentGate === 'unknown'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                >
                  <span className={`w-2 h-2 rounded-full ${currentGate === 'unknown' ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'
                    }`} />
                  <span>
                    {currentGate === 'unknown' ? 'Pilih gate...' : currentGate.replace('gate_', 'Gate ')}
                  </span>
                  <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${gateDropdownOpen ? 'rotate-180' : ''} ${currentGate === 'unknown' ? 'text-rose-400' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {gateDropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-10" onClick={() => setGateDropdownOpen(false)} />
                    {/* Panel */}
                    <div className="absolute left-0 top-full mt-2 z-20 bg-white rounded-2xl shadow-xl shadow-slate-200/80 border border-slate-100 overflow-hidden w-52">
                      <div className="px-4 pt-3.5 pb-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Pilih Lokasi Mesin</p>
                      </div>
                      {[{ val: 'gate_1', label: 'Gate 1', desc: 'Keluaran Tengah' }, { val: 'gate_2', label: 'Gate 2', desc: 'Keluaran Kiri' }, { val: 'gate_3', label: 'Gate 3', desc: 'Keluaran Kanan' }].map(g => (
                        <button
                          key={g.val}
                          onClick={() => {
                            setGateDropdownOpen(false);
                            setGateConfirmPending(g); // tampilkan modal konfirmasi dulu
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${currentGate === g.val
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentGate === g.val ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                          <div>
                            <p className="text-sm font-bold leading-tight">{g.label}</p>
                            <p className="text-xs text-slate-400 font-medium">{g.desc}</p>
                          </div>
                          {currentGate === g.val && (
                            <svg className="ml-auto w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </button>
                      ))}
                      <div className="px-4 pb-3 pt-2">
                        <p className="text-[10px] text-slate-400 font-medium leading-snug">Pastikan gate sesuai dengan posisi fisik mesin yang Anda gunakan.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT: nav buttons — white bg for contrast on mint navbar */}
            <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar snap-x snap-mandatory sm:overflow-visible max-w-[55vw] sm:max-w-none pl-1 py-1">
              {user && (
                <button
                  onClick={() => navigate('/profile')}
                  className="shrink-0 snap-start flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold bg-white text-emerald-800 border border-emerald-100 hover:bg-emerald-50 hover:border-emerald-300 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
                >
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-[10px]">
                    {(user?.full_name?.charAt(0) || user?.username?.charAt(0))?.toUpperCase()}
                  </span>
                  Halo, {user?.full_name?.split(' ')[0] || user?.username}
                </button>
              )}
              {user?.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="shrink-0 snap-start px-4 py-2 rounded-2xl text-sm font-bold bg-white text-emerald-700 border border-emerald-100 hover:bg-emerald-50 hover:border-emerald-300 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
                >
                  Dashboard Admin
                </button>
              )}
              <button
                onClick={() => navigate('/information')}
                className="shrink-0 snap-start px-4 py-2 rounded-2xl text-sm font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
              >
                Info &amp; Promo
              </button>
              <button
                onClick={() => setIsCartOpen(true)}
                className="shrink-0 snap-start relative px-5 py-2 rounded-2xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-md shadow-emerald-500/30 transition-all hover:shadow-lg hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-2"
              >
                <ShoppingCart size={16} />
                Keranjang
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black min-w-[20px] min-h-[20px] flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {cartItemCount}
                  </span>
                )}
              </button>
              {user ? (
                <button
                  onClick={handleLogout}
                  className="shrink-0 snap-start px-4 py-2 rounded-2xl text-sm font-bold text-rose-500 bg-white border border-rose-100 hover:bg-rose-50 hover:border-rose-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap"
                >
                  Keluar
                </button>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="shrink-0 snap-start px-5 py-2 rounded-2xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30 transition-all hover:shadow-lg hover:-translate-y-0.5 whitespace-nowrap"
                >
                  Masuk
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 pt-28">

          {/* 2. HERO BANNER */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-600 to-teal-700 rounded-[2.5rem] p-12 md:p-16 text-white mb-12 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.4)]">
            <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[30rem] h-[30rem] bg-emerald-400/30 rounded-full blur-[100px] animate-float"></div>
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[25rem] h-[25rem] bg-teal-300/20 rounded-full blur-[80px] animate-float-reverse"></div>
            <div className="relative z-10 text-center max-w-3xl mx-auto">
              <span className="inline-block py-2 px-5 rounded-full bg-white/10 border border-white/20 text-xs font-bold tracking-widest mb-6 uppercase backdrop-blur-md shadow-lg shadow-black/5">
                Supermarket Tanpa Antrian
              </span>
              <h1 className="text-5xl md:text-7xl font-black mb-6 leading-[1.1] tracking-tight text-white drop-shadow-md">Belanja Cepat,<br />Tanpa Kasir.</h1>
              <p className="text-lg md:text-xl text-emerald-50 max-w-xl mx-auto font-medium leading-relaxed drop-shadow-sm">Pilih produk favorit Anda dari layar cerdas kami, bayar dengan mudah, dan bawa pulang kesegarannya dalam hitungan detik.</p>
            </div>
          </div>

          {/* Gate location warning card - Overlaps Hero Banner */}
          <div className={`relative z-20 -mt-10 md:-mt-20 mx-auto max-w-4xl mb-8 rounded-3xl border p-5 md:px-6 md:py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-5 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-xl ${currentGate === 'unknown'
            ? 'bg-rose-50/90 border-rose-200'
            : 'bg-amber-50/90 border-amber-200/80'
            }`}>
            <div className="flex gap-4 items-start flex-1">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${currentGate === 'unknown' ? 'bg-rose-100' : 'bg-amber-100'
                }`}>
                <svg className={`w-6 h-6 ${currentGate === 'unknown' ? 'text-rose-500' : 'text-amber-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 mt-1">
                {currentGate === 'unknown' ? (
                  <>
                    <p className="text-base font-black text-rose-700 mb-1">Anda belum memilih gate!</p>
                    <p className="text-sm text-rose-600 font-medium leading-relaxed">
                      Pilih gate terlebih dahulu melalui menu di pojok kiri atas. Pastikan gate yang dipilih sesuai dengan lokasi fisik mesin vending yang sedang Anda gunakan.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-black text-amber-700 mb-1">
                      Anda terhubung ke <span className="text-emerald-700">{currentGate.replace('gate_', 'Gate ')}</span> — pastikan ini sudah benar!
                    </p>
                    <p className="text-sm text-amber-700/80 font-medium leading-relaxed">
                      Periksa nomor atau label gate di mesin vending terdekat. Salah gate dapat mengakibatkan barang keluar di tempat yang berbeda.
                    </p>
                  </>
                )}
              </div>
            </div>
            {currentGate !== 'unknown' && (
              <button
                onClick={() => setGateDropdownOpen(true)}
                className="w-full sm:w-auto shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all whitespace-nowrap mt-2 sm:mt-0 shadow-sm"
              >
                Ganti Gate
              </button>
            )}
          </div>

          {/* Search Bar - Below Warning */}
          <div className="relative group mb-12 max-w-3xl mx-auto w-full z-10 px-6 md:px-0">
            <div className="absolute inset-0 bg-emerald-100/30 blur-xl rounded-full"></div>
            <div className="relative bg-white/80 backdrop-blur-xl border border-slate-200 p-2 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center transition-all duration-300 focus-within:shadow-[0_8px_40px_rgba(16,185,129,0.15)] focus-within:bg-white focus-within:border-emerald-200">
              <div className="pl-6 pr-3 text-emerald-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Cari apel segar, minuman dingin..."
                className="w-full bg-transparent border-none outline-none text-base font-medium text-slate-700 placeholder-slate-400 py-3 pr-6"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white px-8 py-3 rounded-full font-bold shadow-md shadow-emerald-500/25 transition-all hover:shadow-lg hover:-translate-y-0.5 shrink-0 hidden sm:block">
                Cari
              </button>
            </div>
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
                    className={`shrink-0 px-6 py-3 font-bold rounded-2xl transition-all duration-300 ${isSelected
                      ? `bg-gradient-to-r ${colorClass} text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.4)] -translate-y-1`
                      : 'bg-white/80 backdrop-blur border border-slate-100 text-slate-500 hover:text-slate-800 hover:bg-white hover:shadow-md hover:-translate-y-0.5'
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
              <span className="text-sm font-semibold text-slate-500 ml-2">({String(filteredItems.length || 0)} produk)</span>
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
                    className={`bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-4 flex flex-col transition-all duration-500 group ${item.machine_stock === 0
                        ? 'opacity-60 cursor-not-allowed grayscale-[20%]'
                        : 'hover:bg-white hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-2 cursor-pointer'
                      }`}
                    onClick={() => item.machine_stock > 0 && openProductDetail(item)}
                    title={item.description || item.name}
                  >

                    {/* Kotak Gambar dengan Fallback Icon */}
                    <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-50 rounded-3xl mb-5 flex items-center justify-center group-hover:shadow-inner transition-all overflow-hidden text-slate-300">
                      {item.image_url ? (
                        <img
                          src={item.image_url.includes('/uploads/') ? `${import.meta.env.VITE_API_BASE_URL}${item.image_url.substring(item.image_url.indexOf('/uploads/'))}` : item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={item.image_url ? "hidden" : "flex items-center justify-center w-full h-full"}>
                        <Package size={48} />
                      </div>

                      {/* Hover Description Overlay */}
                      {item.description && item.machine_stock > 0 && (
                        <div className="absolute inset-0 bg-emerald-900/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center p-4 text-center z-10 pointer-events-none translate-y-2 group-hover:translate-y-0">
                          <p className="text-white text-xs font-medium line-clamp-4 leading-relaxed drop-shadow-sm">
                            {item.description}
                          </p>
                        </div>
                      )}

                      {/* Out of Stock Overlay */}
                      {item.machine_stock === 0 && (
                        <div className="absolute inset-0 bg-slate-900/40 rounded-3xl flex flex-col items-center justify-center gap-1 backdrop-blur-[2px] z-20">
                          <span className="text-white font-black text-xs bg-rose-600 px-4 py-1.5 rounded-full tracking-wider shadow-lg">STOK HABIS</span>
                        </div>
                      )}
                    </div>

                    <div className="px-2 flex-1 flex flex-col">
                      <h3 className="text-base font-bold text-slate-800 line-clamp-2 leading-snug mb-2 group-hover:text-emerald-600 transition-colors">{item.name}</h3>

                      <div className="mt-auto pt-2 mb-4 border-b border-slate-100 pb-3">
                        <div className="flex flex-col">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Harga & Stok</p>
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <p className="text-lg font-black text-emerald-500 drop-shadow-sm leading-none break-words">
                              Rp {(item.price || 0).toLocaleString('id-ID')}
                            </p>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${item.machine_stock > 5 ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-600'}`}>
                              {item.machine_stock > 0 ? `Sisa ${item.machine_stock}` : 'Habis'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.machine_stock > 0) addToCart(item);
                        }}
                        disabled={item.machine_stock === 0}
                        className={`w-full rounded-2xl flex items-center justify-center font-bold py-3 transition-all gap-2 ${item.machine_stock === 0
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 active:scale-95 shadow-lg shadow-emerald-500/20'
                          }`}
                      >
                        {item.machine_stock === 0 ? (
                          <span className="text-sm uppercase tracking-wider text-xs">Stok Habis</span>
                        ) : (
                          <>
                            <ShoppingCart size={18} />
                            Tambah
                          </>
                        )}
                      </button>
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
                  <p className="text-sm text-slate-500 mt-1">{String(cartItemCount || 0)} barang dipilih</p>
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
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                      <ShoppingCart size={48} />
                    </div>
                    <p className="font-medium">Belum ada barang</p>
                  </div>
                ) : (
                  Object.entries(cart).map(([itemId, { item, qty }]) => (
                    <div key={itemId} className="bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl shrink-0 text-slate-400 overflow-hidden relative">
                            {item.image_url ? (
                              <img
                                src={item.image_url.includes('/uploads/') ? `${import.meta.env.VITE_API_BASE_URL}${item.image_url.substring(item.image_url.indexOf('/uploads/'))}` : item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                              />
                            ) : null}
                            <div className={item.image_url ? "hidden w-full h-full items-center justify-center" : "flex w-full h-full items-center justify-center"}>
                              <Package size={24} />
                            </div>
                          </div>
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
                          <span className="w-8 text-center font-bold text-slate-800">{String(qty || 0)}</span>
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

              {/* Wrapper untuk subtotal & tombol checkout */}
              <div className="p-6 bg-white border-t border-slate-200 mt-auto">
                {checkoutError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-sm font-semibold rounded-xl flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">⚠️</span>
                    <span>{checkoutError}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-500 font-medium">Subtotal</span>
                  <span className="text-slate-800 font-bold">Rp {cartTotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 mb-6">
                  <span className="text-lg font-black text-slate-800">Total Pembayaran</span>
                  <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500">Rp {cartTotal.toLocaleString('id-ID')}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={cartItemCount === 0}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-4 rounded-2xl disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 transition-all duration-300 shadow-lg shadow-emerald-500/30 disabled:shadow-none text-lg transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                >
                  {isProcessing ? 'Memproses...' : 'Checkout & Bayar'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* PAYMENT MODAL (QRIS ONLY) */}
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay Glassmorphism */}
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
              onClick={() => !isProcessing && setIsPaymentModalOpen(false)}
            ></div>

            {/* Modal Panel */}
            <div className="relative bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl p-8 max-w-sm w-full mx-4 transform transition-all">

              {paymentStatus === 'success' && (
                <div className="text-center py-6">
                  <div className="text-emerald-500 mb-6 flex justify-center">
                    <CheckCircle2 size={80} className="animate-bounce drop-shadow-md" />
                  </div>
                  <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500 mb-2">Pembayaran Berhasil!</h3>
                  <p className="text-slate-600 font-medium">Silakan ambil barang Anda di laci bawah mesin.</p>
                </div>
              )}

              {paymentStatus === 'failed' && (
                <div className="text-center py-6">
                  <div className="text-rose-500 mb-6 flex justify-center">
                    <XCircle size={80} className="drop-shadow-md" />
                  </div>
                  <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-pink-500 mb-2">Pembayaran Gagal</h3>
                  <p className="text-slate-600 font-medium mb-8">Waktu pembayaran habis atau terjadi kesalahan jaringan.</p>
                  <button
                    onClick={() => setPaymentStatus(null)}
                    className="w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-full font-bold hover:bg-slate-200 transition-colors"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}

              {!paymentStatus && isProcessing && (
                <div className="text-center py-6">
                  <div className="flex justify-center mb-6">
                    <Loader2 size={60} className="animate-spin text-emerald-500 drop-shadow-md" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Memverifikasi Pembayaran...</h3>
                  <p className="text-slate-500 font-medium">Mohon tunggu sebentar, sistem sedang mencatat transaksi Anda.</p>
                </div>
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

        {/* Chatbot AI Assistant */}
        <Chatbot items={items} onAddToCart={addToCart} />

      </div>
      {/* End of relative z-10 wrapper */}

    </div>
  );
}

export default App;