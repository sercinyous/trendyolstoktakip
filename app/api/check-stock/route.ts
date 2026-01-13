import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const maxDuration = 30;

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

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('trendyol.com')) {
      return NextResponse.json(
        { error: 'Geçerli bir Trendyol linki giriniz' },
        { status: 400 }
      );
    }

    // URL'yi temizle
    const cleanUrl = url.split('?')[0];

    // Trendyol'dan sayfayı çek
    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Ürün sayfasına erişilemedi' },
        { status: 502 }
      );
    }

    const html = await response.text();

    // JSON-LD verisini çıkar
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    let productData: ProductData | null = null;

    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        const product = Array.isArray(jsonLd) ? jsonLd.find((item: Record<string, unknown>) => item['@type'] === 'Product') : jsonLd;
        
        if (product && product['@type'] === 'Product') {
          const offers = product.offers || {};
          const availability = offers.availability || '';
          
          productData = {
            url: cleanUrl,
            name: product.name || 'Ürün Adı Bulunamadı',
            price: offers.price ? `${offers.price} TL` : 'Fiyat Bulunamadı',
            inStock: availability.includes('InStock'),
            seller: offers.seller?.name || 'Satıcı Bulunamadı',
            imageUrl: product.image || undefined,
            lastChecked: new Date(),
          };
        }
      } catch (parseError) {
        console.error('JSON-LD parse error:', parseError);
      }
    }

    // Eğer JSON-LD yoksa veya başarısız olduysa, HTML'den çıkar
    if (!productData) {
      // Ürün adı
      const nameMatch = html.match(/<h1[^>]*class="[^"]*pr-new-br[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<title>([^<|]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : 'Ürün Adı Bulunamadı';

      // Fiyat
      const priceMatch = html.match(/"price":\s*"?(\d+(?:\.\d+)?)"?/i) ||
                        html.match(/prc-dsc[^>]*>([^<]+)</i) ||
                        html.match(/"prc-org"[^>]*>([^<]+)</i);
      const price = priceMatch ? `${priceMatch[1].replace(/[^\d,]/g, '')} TL` : 'Fiyat Bulunamadı';

      // Orijinal fiyat
      const originalPriceMatch = html.match(/prc-org[^>]*>([^<]+)</i);
      const originalPrice = originalPriceMatch ? originalPriceMatch[1].trim() : undefined;

      // İndirim
      const discountMatch = html.match(/prc-dsc[^>]*>%(\d+)/i) ||
                           html.match(/"discount(?:Ratio)?":\s*"?(\d+)"?/i);
      const discount = discountMatch ? `%${discountMatch[1]}` : undefined;

      // Stok durumu
      const outOfStockIndicators = [
        'sold-out',
        'tükendi',
        'stokta yok',
        'out-of-stock',
        '"inStock":false',
        '"availability":"OutOfStock"',
        'add-to-bs-disabled',
        'notify-me-btn'
      ];
      const inStock = !outOfStockIndicators.some(indicator => 
        html.toLowerCase().includes(indicator.toLowerCase())
      );

      // Satıcı
      const sellerMatch = html.match(/"seller":\s*{\s*"name":\s*"([^"]+)"/i) ||
                         html.match(/merchant-name[^>]*>([^<]+)</i) ||
                         html.match(/"sellerName":\s*"([^"]+)"/i);
      const seller = sellerMatch ? sellerMatch[1].trim() : 'Trendyol';

      // Resim
      const imageMatch = html.match(/"image":\s*"([^"]+)"/i) ||
                        html.match(/og:image[^>]*content="([^"]+)"/i);
      const imageUrl = imageMatch ? imageMatch[1] : undefined;

      // Rating
      const ratingMatch = html.match(/"ratingValue":\s*"?([^",}]+)"?/i);
      const rating = ratingMatch ? ratingMatch[1] : undefined;

      // Review count
      const reviewMatch = html.match(/"reviewCount":\s*"?(\d+)"?/i);
      const reviewCount = reviewMatch ? reviewMatch[1] : undefined;

      productData = {
        url: cleanUrl,
        name,
        price,
        originalPrice,
        discount,
        inStock,
        seller,
        rating,
        reviewCount,
        imageUrl,
        lastChecked: new Date(),
      };
    }

    return NextResponse.json(productData);

  } catch (error) {
    console.error('Stock check error:', error);
    return NextResponse.json(
      { error: 'Ürün bilgileri alınırken bir hata oluştu' },
      { status: 500 }
    );
  }
}
