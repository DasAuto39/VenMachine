import { useState } from 'react';
import App from './App';
import Admin from './Admin';

function Root() {
  const [page, setPage] = useState('shop');

  if (page === 'admin') {
    return <Admin />;
  }

  return <App onGoToAdmin={() => setPage('admin')} />;
}

export default Root;
