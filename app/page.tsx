'use client';

import { useState, useEffect, useCallback } from 'react';

interface ProductData {
  url: string;
  name: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  inStock: boolean;
  seller: string;
  rating?: string;
  reviewCount?: string;
  lastChecked: Date;
  imageUrl?: string;
}

interface TrackedProduct extends ProductData {
  id: string;
  addedAt: Date;
  notifications: boolean;
  priceHistory: { price: string; date: Date }[];
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trackedProducts, setTrackedProducts] = useState<TrackedProduct[]>([]);
  const [checking, setChecking] = useState<string | null>(null);

  // LocalStorage'dan ürünleri yükle
  useEffect(() => {
    const saved = localStorage.getItem('trackedProducts');
    if (saved) {
      interface SavedPriceHistory {
        price: string;
        date: string;
      }
      interface SavedProduct {
        id: string;
        url: string;
        name: string;
        price: string;
        originalPrice?: string;
        discount?: string;
        inStock: boolean;
        seller: string;
        rating?: string;
        reviewCount?: string;
        lastChecked: string;
        imageUrl?: string;
        addedAt: string;
        notifications: boolean;
        priceHistory: SavedPriceHistory[];
      }
      const parsed: SavedProduct[] = JSON.parse(saved);
      setTrackedProducts(parsed.map((p) => ({
        ...p,
        lastChecked: new Date(p.lastChecked),
        addedAt: new Date(p.addedAt),
        priceHistory: p.priceHistory.map((h) => ({
          price: h.price,
          date: new Date(h.date)
        }))
      })));
    }
  }, []);

  // LocalStorage'a kaydet
  useEffect(() => {
    if (trackedProducts.length > 0) {
      localStorage.setItem('trackedProducts', JSON.stringify(trackedProducts));
    }
  }, [trackedProducts]);

  const checkProduct = useCallback(async (productUrl: string): Promise<ProductData> => {
    const response = await fetch('/api/check-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: productUrl })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Ürün kontrol edilemedi');
    }

    return response.json();
  }, []);

  const addProduct = async () => {
    if (!url.trim()) {
      setError('Lütfen bir URL girin');
      return;
    }

    if (!url.includes('trendyol.com')) {
      setError('Lütfen geçerli bir Trendyol linki girin');
      return;
    }

    // Zaten ekli mi kontrol et
    if (trackedProducts.some(p => p.url === url)) {
      setError('Bu ürün zaten takip listesinde');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const productData = await checkProduct(url);
      
      const newProduct: TrackedProduct = {
        ...productData,
        id: Date.now().toString(),
        addedAt: new Date(),
        notifications: true,
        priceHistory: [{ price: productData.price, date: new Date() }]
      };

      setTrackedProducts(prev => [newProduct, ...prev]);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const refreshProduct = async (id: string) => {
    const product = trackedProducts.find(p => p.id === id);
    if (!product) return;

    setChecking(id);

    try {
      const updatedData = await checkProduct(product.url);
      
      setTrackedProducts(prev => prev.map(p => {
        if (p.id !== id) return p;
        
        const priceChanged = p.price !== updatedData.price;
        const newHistory = priceChanged 
          ? [...p.priceHistory, { price: updatedData.price, date: new Date() }]
          : p.priceHistory;

        return {
          ...p,
          ...updatedData,
          priceHistory: newHistory,
          lastChecked: new Date()
        };
      }));
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setChecking(null);
    }
  };

  const removeProduct = (id: string) => {
    setTrackedProducts(prev => prev.filter(p => p.id !== id));
    if (trackedProducts.length === 1) {
      localStorage.removeItem('trackedProducts');
    }
  };

  const toggleNotifications = (id: string) => {
    setTrackedProducts(prev => prev.map(p => 
      p.id === id ? { ...p, notifications: !p.notifications } : p
    ));
  };

  const refreshAll = async () => {
    for (const product of trackedProducts) {
      await refreshProduct(product.id);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0b]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Stok Takip</h1>
                <p className="text-xs text-white/50">Trendyol Ürün Takibi</p>
              </div>
            </div>
            {trackedProducts.length > 0 && (
              <button
                onClick={refreshAll}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Tümünü Güncelle
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* URL Input Section */}
        <section className="mb-12">
          <div className="bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-medium mb-4">Yeni Ürün Ekle</h2>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addProduct()}
                  placeholder="Trendyol ürün linkini yapıştırın..."
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                />
                {url && (
                  <button
                    onClick={() => setUrl('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={addProduct}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 disabled:from-orange-500/50 disabled:to-orange-600/50 rounded-xl font-medium transition-all flex items-center gap-2 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Kontrol Ediliyor
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Ekle
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </p>
            )}
          </div>
        </section>

        {/* Products Grid */}
        {trackedProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/5 flex items-center justify-center">
              <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-white/60 mb-2">Henüz ürün eklenmedi</h3>
            <p className="text-white/40">Takip etmek istediğiniz Trendyol ürünlerinin linkini ekleyin</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {trackedProducts.map((product) => (
              <div
                key={product.id}
                className={`group bg-gradient-to-b from-white/[0.06] to-white/[0.02] border rounded-2xl p-5 transition-all hover:border-white/20 ${
                  product.inStock ? 'border-white/10' : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex gap-5">
                  {/* Product Image */}
                  {product.imageUrl && (
                    <div className="w-24 h-24 rounded-xl bg-white/5 overflow-hidden flex-shrink-0">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-medium text-white/90 truncate mb-1">
                          {product.name}
                        </h3>
                        <p className="text-sm text-white/40 mb-3">{product.seller}</p>
                      </div>
                      
                      {/* Stock Badge */}
                      <div className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${
                        product.inStock 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {product.inStock ? 'Stokta' : 'Tükendi'}
                      </div>
                    </div>

                    {/* Price & Details */}
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-semibold text-white">{product.price}</span>
                          {product.originalPrice && product.originalPrice !== product.price && (
                            <span className="text-sm text-white/40 line-through">{product.originalPrice}</span>
                          )}
                          {product.discount && (
                            <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
                              {product.discount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/30 mt-1">
                          Son kontrol: {formatDate(product.lastChecked)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleNotifications(product.id)}
                          className={`p-2 rounded-lg transition-all ${
                            product.notifications 
                              ? 'bg-orange-500/20 text-orange-400' 
                              : 'bg-white/5 text-white/30 hover:text-white/60'
                          }`}
                          title={product.notifications ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </button>
                        <button
                          onClick={() => refreshProduct(product.id)}
                          disabled={checking === product.id}
                          className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
                          title="Yenile"
                        >
                          <svg className={`w-5 h-5 ${checking === product.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                          title="Ürüne git"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Kaldır"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price History */}
                {product.priceHistory.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-xs text-white/40 mb-2">Fiyat Geçmişi</p>
                    <div className="flex gap-2 flex-wrap">
                      {product.priceHistory.slice(-5).map((h, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-white/5 rounded-md text-white/60">
                          {h.price}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {trackedProducts.length > 0 && (
          <section className="mt-8 grid grid-cols-3 gap-4">
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-semibold text-white">{trackedProducts.length}</p>
              <p className="text-sm text-white/40">Toplam Ürün</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-semibold text-emerald-400">
                {trackedProducts.filter(p => p.inStock).length}
              </p>
              <p className="text-sm text-white/40">Stokta</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-semibold text-red-400">
                {trackedProducts.filter(p => !p.inStock).length}
              </p>
              <p className="text-sm text-white/40">Tükenen</p>
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-sm text-white/30">
          Trendyol Stok Takip © 2025
        </div>
      </footer>
    </main>
  );
}
