import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Register form
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: ''
  });
  
  // Login form
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterForm(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.full_name) {
      setError('Semua field harus diisi');
      setLoading(false);
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Password tidak cocok');
      setLoading(false);
      return;
    }

    if (registerForm.password.length < 6) {
      setError('Password minimal 6 karakter');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: registerForm.username,
          email: registerForm.email,
          password: registerForm.password,
          full_name: registerForm.full_name,
          phone: registerForm.phone
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Registrasi gagal');
      } else {
        setError('');
        // Switch to login form
        setIsRegister(false);
        setLoginForm({ 
          username: registerForm.username, 
          password: '' 
        });
        setRegisterForm({
          username: '',
          email: '',
          password: '',
          confirmPassword: '',
          full_name: '',
          phone: ''
        });
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!loginForm.username || !loginForm.password) {
      setError('Username dan password harus diisi');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Login gagal');
      } else {
        // Store user info
        const user = {
          user_id: data.user_id,
          username: data.username,
          email: data.email,
          full_name: data.full_name
        };
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('authenticated', 'true');
        // Navigate to shopping page
        navigate('/user');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 text-slate-800 font-sans selection:bg-emerald-200 relative overflow-hidden flex items-center justify-center">
      
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Large floating blob - top right */}
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-emerald-200 rounded-full blur-3xl opacity-20 animate-float"></div>
        
        {/* Medium blob - bottom left */}
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-80 h-80 bg-teal-200 rounded-full blur-3xl opacity-15 animate-float-reverse"></div>
        
        {/* Small blob - center */}
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-emerald-300 rounded-full blur-3xl opacity-10 animate-float" style={{animationDelay: '1s'}}></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/80 backdrop-blur-lg border border-white/20 rounded-3xl shadow-2xl p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white text-2xl font-black mx-auto mb-4">
              F
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
              FRESH<span className="text-emerald-500">MART</span>
            </h1>
            <p className="text-sm text-slate-500 font-semibold">Smart Vending System</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-rose-100/80 border border-rose-300 text-rose-700 px-4 py-3 rounded-xl mb-6 font-medium text-sm">
              <p className="flex items-center gap-2">
                <span>⚠️</span> {error}
              </p>
            </div>
          )}

          {!isRegister ? (
            // LOGIN FORM
            <form onSubmit={handleLoginSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-bold text-slate-700 mb-2">Username</label>
                <input
                  type="text"
                  name="username"
                  value={loginForm.username}
                  onChange={handleLoginChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  placeholder="Masukkan username"
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                <input
                  type="password"
                  name="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  placeholder="Masukkan password"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-black py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/30 disabled:shadow-none active:scale-[0.98] text-base"
              >
                {loading ? '⏳ Loading...' : '🔐 Login'}
              </button>

              <p className="text-center text-slate-600 mt-6 text-sm">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setError('');
                    setLoginForm({ username: '', password: '' });
                  }}
                  className="text-emerald-600 font-bold hover:text-emerald-700 underline"
                >
                  Daftar di sini
                </button>
              </p>
            </form>
          ) : (
            // REGISTER FORM
            <form onSubmit={handleRegisterSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Username</label>
                <input
                  type="text"
                  name="username"
                  value={registerForm.username}
                  onChange={handleRegisterChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50 hover:bg-slate-50 transition-colors text-sm"
                  placeholder="3-30 karakter (alphanumeric)"
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={registerForm.email}
                  onChange={handleRegisterChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50 hover:bg-slate-50 transition-colors text-sm"
                  placeholder="email@example.com"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Nama Lengkap</label>
                <input
                  type="text"
                  name="full_name"
                  value={registerForm.full_name}
                  onChange={handleRegisterChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50 hover:bg-slate-50 transition-colors text-sm"
                  placeholder="Nama lengkap Anda"
                  disabled={loading}
                  autoComplete="name"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Nomor Telepon <span className="text-slate-400 font-normal">(Optional)</span></label>
                <input
                  type="tel"
                  name="phone"
                  value={registerForm.phone}
                  onChange={handleRegisterChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50 hover:bg-slate-50 transition-colors text-sm"
                  placeholder="08xx xxxx xxxx"
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                <input
                  type="password"
                  name="password"
                  value={registerForm.password}
                  onChange={handleRegisterChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50 hover:bg-slate-50 transition-colors text-sm"
                  placeholder="Minimal 6 karakter"
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">Konfirmasi Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={registerForm.confirmPassword}
                  onChange={handleRegisterChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50 hover:bg-slate-50 transition-colors text-sm"
                  placeholder="Ulangi password"
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-black py-3 px-4 rounded-xl transition-all shadow-lg shadow-green-500/30 disabled:shadow-none active:scale-[0.98] text-base"
              >
                {loading ? '⏳ Loading...' : '✓ Daftar'}
              </button>

              <p className="text-center text-slate-600 mt-6 text-sm">
                Sudah punya akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setError('');
                    setRegisterForm({
                      username: '',
                      email: '',
                      password: '',
                      confirmPassword: '',
                      full_name: '',
                      phone: ''
                    });
                  }}
                  className="text-emerald-600 font-bold hover:text-emerald-700 underline"
                >
                  Login di sini
                </button>
              </p>
            </form>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200/50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              🔒 Password Anda aman terlindungi dengan enkripsi
            </p>
            <button
              onClick={() => navigate('/user')}
              className="text-xs text-slate-500 hover:text-slate-700 font-semibold underline"
            >
              ← Kembali
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
