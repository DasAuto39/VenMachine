/**
 * Local Product Images Mapping
 * Gunakan SKU sebagai key untuk mengakses gambar produk
 * 
 * Cara menambah gambar:
 * 1. Letakkan gambar di folder /src/images/ dengan nama SKU (contoh: SKU001.jpg, SKU002.png)
 * 2. Import di sini
 * 3. Tambah ke object images
 */

// Placeholder - tambah import real images di sini
// Contoh: import sku001 from './images/SKU001.jpg';

const images = {
  // Sayuran (1-3)
  'SKU001': '🥬', // Bayam - placeholder emoji sampai gambar ditambah
  'SKU002': '🥕', // Wortel - placeholder emoji
  'SKU003': '🥦', // Brokoli - placeholder emoji

  // Buah (4-6)
  'SKU004': '🍎', // Apel - placeholder emoji
  'SKU005': '🍌', // Pisang - placeholder emoji
  'SKU006': '🍊', // Jeruk - placeholder emoji

  // Sembako (7-9)
  'SKU007': '🍚', // Beras - placeholder emoji
  'SKU008': '🛢️', // Minyak - placeholder emoji
  'SKU009': '🍬', // Gula - placeholder emoji

  // Minuman (10-12)
  'SKU010': '🥛', // Susu - placeholder emoji
  'SKU011': '🧃', // Jus - placeholder emoji
  'SKU012': '💧', // Air Mineral - placeholder emoji

  // Snack (13-15)
  'SKU013': '🥔', // Chips - placeholder emoji
  'SKU014': '🥜', // Kacang - placeholder emoji
  'SKU015': '🍫', // Coklat - placeholder emoji
};

export function getProductImage(sku) {
  return images[sku] || '📦'; // Default ke emoji kotak jika tidak ada
}

export default images;
