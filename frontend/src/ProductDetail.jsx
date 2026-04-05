import React from 'react';
import { getProductImage } from './productImages';

function ProductDetail({ product, isOpen, onClose, onAddToCart }) {
  if (!isOpen || !product) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Container - Optimized for Mobile */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
        <div className="max-h-[90vh] md:max-h-[80vh] w-full md:w-[600px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-y-auto pointer-events-auto">
          
          {/* Header dengan Close Button */}
          <div className="sticky top-0 z-10 bg-gradient-to-b from-white to-white/80 px-6 py-4 flex items-center justify-between border-b border-slate-100">
            <h2 className="text-lg font-black text-slate-900 truncate">{product.name}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0 text-slate-600 hover:text-slate-900"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            
            {/* Gambar Produk - Besar */}
            <div className="w-full aspect-square bg-slate-50 rounded-3xl flex items-center justify-center overflow-hidden shadow-md relative group">
              {product.image_url && product.image_url.trim() ? (
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.dataset.hasError = 'true';
                  }}
                />
              ) : null}
              {!product.image_url || !product.image_url.trim() || product.image_url?.error ? (
                <div className="w-full h-full flex items-center justify-center text-9xl">
                  {getProductImage(product.sku)}
                </div>
              ) : null}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-600 font-semibold mb-1">Harga</p>
                <p className="text-lg font-black text-emerald-600">
                  Rp {(product.price || 0).toLocaleString('id-ID')}
                </p>
              </div>
              <div className={`rounded-2xl p-4 text-center ${product.stock_quantity > 5 ? 'bg-emerald-50' : product.stock_quantity > 0 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                <p className="text-xs text-slate-600 font-semibold mb-1">Stok</p>
                <p className={`text-lg font-black ${product.stock_quantity > 5 ? 'text-emerald-600' : product.stock_quantity > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {product.stock_quantity > 0 ? `${product.stock_quantity}× Ada` : 'Habis'}
                </p>
              </div>
              <div className="bg-slate-100 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-600 font-semibold mb-1">SKU</p>
                <p className="text-sm font-mono font-black text-slate-700">{product.sku}</p>
              </div>
            </div>

            {/* Deskripsi Lengkap */}
            {product.description && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Deskripsi Produk</p>
                <p className="text-sm text-slate-700 leading-relaxed">{product.description}</p>
              </div>
            )}

          </div>

          {/* Action Buttons - Sticky di Bottom */}
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 space-y-2">
            <button
              onClick={() => {
                onAddToCart();
                onClose();
              }}
              disabled={product.stock_quantity === 0}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold py-3 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
            >
              Tambah ke Keranjang
            </button>
            <button
              onClick={onClose}
              className="w-full bg-slate-100 text-slate-900 rounded-2xl font-bold py-3 hover:bg-slate-200 transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductDetail;
