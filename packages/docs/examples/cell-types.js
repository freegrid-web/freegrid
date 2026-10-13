import FreeGrid from '@freegrid/core';
import '@freegrid/core/dist/freegrid.full.css';

export default function createGrid(container) {
  return new FreeGrid(container, {
    data: [
      { product: 'Laptop', price: 1299.99, released: '2026-03-14', inStock: true, category: 'Computers', city: 'Vilnius', code: 'secret1' },
      { product: 'Monitor', price: 249.5, released: '2025-11-02', inStock: false, category: 'Displays', city: 'Kaunas', code: 'secret2' },
      { product: 'Keyboard', price: 79, released: '2024-06-21', inStock: true, category: 'Accessories', city: 'Klaipėda', code: 'secret3' },
      { product: 'Mouse', price: 39.9, released: '2025-01-09', inStock: true, category: 'Accessories', city: 'Riga', code: 'secret4' },
    ],
    colHeaders: ['Product', 'Price', 'Released', 'In stock', 'Category', 'City', 'Code'],
    columns: [
      { data: 'product' },
      { data: 'price', type: 'numeric', numericFormat: { pattern: '0,0.00 $' } },
      { data: 'released', type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true },
      { data: 'inStock', type: 'checkbox', className: 'fg-center' },
      { data: 'category', type: 'dropdown', source: ['Computers', 'Displays', 'Accessories', 'Software'] },
      { data: 'city', type: 'autocomplete', source: ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Riga', 'Tallinn', 'Warsaw'], strict: false },
      { data: 'code', type: 'password' },
    ],
    stretchH: 'all',
  });
}
