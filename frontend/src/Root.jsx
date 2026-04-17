import { useState, useEffect } from 'react';
import App from './App';
import Admin from './Admin';
import Login from './Login';

function Root() {
  const [page, setPage] = useState('shop');

  // Check URL path on mount
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin') {
      setPage('admin');
    } else if (path === '/login') {
      setPage('login');
    } else {
      setPage('shop');
    }
  }, []);

  if (page === 'admin') {
    return <Admin />;
  }

  if (page === 'login') {
    return (
      <Login 
        onLoginSuccess={(user) => {
          setPage('shop');
        }} 
      />
    );
  }

  return (
    <App 
      onGoToAdmin={() => setPage('admin')} 
      onGoToLogin={() => setPage('login')}
    />
  );
}

export default Root;
