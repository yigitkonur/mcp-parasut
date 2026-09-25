# Paraşüt MCP & Node.js SDK

Resmî olmayan (unofficial), tam tip güvenli (type-safe) TypeScript **Node.js SDK** ve **Model Context Protocol (MCP) Sunucusu**. 

Paraşüt REST API V4 altyapısı üzerine inşa edilmiştir. Claude Desktop, Cursor, Claude Code, Windsurf veya herhangi bir MCP istemcisi üzerinden Türkçe doğal dil komutlarıyla cari hesapları, satış/alış faturalarını, kasa/banka hareketlerini, stokları ve GİB resmî e-belgelerini (e-Fatura, e-Arşiv, e-SMM) yönetmenizi sağlar.

```bash
# Node.js SDK Kurulumu
npm install @yigitkonur/parasut-node-sdk
```

```bash
# MCP Sunucusunu Doğrudan Çalıştırma
npx @yigitkonur/parasut-mcp-server
```

[![npm version](https://img.shields.io/npm/v/@yigitkonur/parasut-mcp-server.svg?style=flat-square)](https://www.npmjs.com/package/@yigitkonur/parasut-mcp-server)
[![npm sdk](https://img.shields.io/npm/v/@yigitkonur/parasut-node-sdk.svg?style=flat-square)](https://www.npmjs.com/package/@yigitkonur/parasut-node-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## 📦 Paket Mimarisi

Bu repo `pnpm workspace` tabanlı bir monorepo olup iki ana paketten oluşur:

1. **`@yigitkonur/parasut-node-sdk`**
   - Paraşüt REST API V4'ü saran hafif ve sıfır çalışma zamanı bağımlılığına (zero runtime dependencies) sahip TypeScript SDK.
   - Yerel `fetch` API'si, JSON:API v1.0 standardı serileştirme/ayrıştırma, Token Bucket rate limiting (10 istek / 10 saniye), exponential backoff retry mekanizması ve otomatik 401 token yenileme (`onUnauthorized`) içerir.
2. **`@yigitkonur/parasut-mcp-server`**
   - Claude Desktop, Cursor, Claude Code ve diğer MCP uyumlu yapay zeka istemcilerine stdio üzerinden **34 adet AI-optimize araç** sunar.
   - Finansal işlemlerde kazara veri kaybını önlemek için **Önizleme (Preview/Dry-run)** ve GİB e-belgelerinde **Çift Aşamalı Teyit (Double Confirmation)** mekanizmasına sahiptir.

> [!NOTE]
> Bu proje Paraşüt Yazılım Teknolojileri A.Ş. ile resmî bir bağlantıya sahip değildir; açık kaynak topluluk projesidir.

---

## 🔐 Kimlik Doğrulama Yöntemleri (Authentication)

SDK ve MCP sunucusu iki farklı kimlik doğrulama yöntemini tam olarak destekler:

### 1. Kullanıcı Adı & Şifre (OAuth2 Resource Owner Password Flow)
Paraşüt API Client ID/Secret ve kullanıcı giriş bilgilerinizle doğrudan oturum açar:
```bash
PARASUT_CLIENT_ID="your-client-id"
PARASUT_CLIENT_SECRET="your-client-secret"
PARASUT_USERNAME="user@example.com"
PARASUT_PASSWORD="your-password"
PARASUT_COMPANY_ID="123456" # Opsiyonel: Verilmezse otomatik tespit edilir
```

### 2. Token Tabanlı Kimlik Doğrulama (Access & Refresh Token)
Önceden alınmış OAuth token'ları veya harici servislerle entegrasyon için kullanıcı adı/şifre gerekmeden çalışır:
```bash
PARASUT_ACCESS_TOKEN="your-access-token"
PARASUT_REFRESH_TOKEN="your-refresh-token" # Opsiyonel: 401 yenileme için önerilir
PARASUT_CLIENT_ID="your-client-id"         # Refresh token kullanıldığında gereklidir
PARASUT_CLIENT_SECRET="your-client-secret" # Refresh token kullanıldığında gereklidir
PARASUT_COMPANY_ID="123456"               # Opsiyonel: Otomatik tespit edilebilir
```

### ⚡ Öne Çıkan Kimlik Doğrulama Özellikleri
- **Otomatik Şirket (Company ID) Tespiti**: `PARASUT_COMPANY_ID` belirtilmediğinde SDK ve MCP sunucusu `GET /v4/me` uç noktasına bağlanarak kullanıcının erişim yetkisi olan ilk şirket ID'sini otomatik olarak keşfeder ve isteklerde kullanır.
- **Otomatik 401 Token Yenileme (Transparent Refresh & Retry)**: Paraşüt API'sinde access token süresi (2 saat) dolup `401 Unauthorized` döndüğünde, SDK arka planda refresh token ile yeni bir access token temin eder, authorization başlığını günceller ve başarısız olan isteği otomatik olarak yeniden dener.

---

## 🛠️ MCP Sunucusu Kurulumu

### Claude Desktop Kurulumu
Aşağıdaki yapılandırmayı işletim sisteminize göre ilgili dosyaya ekleyin:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "parasut": {
      "command": "npx",
      "args": ["-y", "@yigitkonur/parasut-mcp-server"],
      "env": {
        "PARASUT_CLIENT_ID": "your-client-id",
        "PARASUT_CLIENT_SECRET": "your-client-secret",
        "PARASUT_USERNAME": "your-email@example.com",
        "PARASUT_PASSWORD": "your-password",
        "PARASUT_COMPANY_ID": "123456"
      }
    }
  }
}
```

*Alternatif olarak Token tabanlı kurulum:*
```json
{
  "mcpServers": {
    "parasut": {
      "command": "npx",
      "args": ["-y", "@yigitkonur/parasut-mcp-server"],
      "env": {
        "PARASUT_ACCESS_TOKEN": "your-access-token",
        "PARASUT_REFRESH_TOKEN": "your-refresh-token",
        "PARASUT_CLIENT_ID": "your-client-id",
        "PARASUT_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### Cursor Kurulumu
Cursor ayarlarında (`Features > MCP Servers`) veya `.cursor/mcp.json` dosyasında tanımlayabilirsiniz:
```json
{
  "mcpServers": {
    "parasut": {
      "command": "npx",
      "args": ["-y", "@yigitkonur/parasut-mcp-server"],
      "env": {
        "PARASUT_CLIENT_ID": "your-client-id",
        "PARASUT_CLIENT_SECRET": "your-client-secret",
        "PARASUT_USERNAME": "your-email@example.com",
        "PARASUT_PASSWORD": "your-password"
      }
    }
  }
}
```

### `mcpc` CLI ile Canlı Test ve Kullanım
```bash
# Sunucu bağlantısını test etme ve araçları listeleme (stdio modu)
mcpc connect "npx -y @yigitkonur/parasut-mcp-server" @parasut-local
mcpc @parasut-local tools-list

# Canlı araç çağrısı örneği
mcpc @parasut-local tools-call get_financial_summary
```

### 🌐 URL Tabanlı Dağıtım & Streamable HTTP Modu (Docker / Dokploy / Remote MCP)

Sunucu, standart `stdio` taşıma katmanının yanı sıra resmî MCP spesifikasyonuna tam uyumlu **Streamable HTTP** taşıma protokolünü (`2024-11-05`, `2025-11-25`, `2026-07-28`) destekler. Bu mod sayesinde MCP sunucusunu Docker, Dokploy, Kubernetes veya VPS üzerinde bağımsız bir web servisi olarak barındırabilir ve yapay zeka ajanlarınıza güvenli bir HTTP uç noktası sunabilirsiniz.

#### HTTP Taşıma Katmanını Başlatma

Aşağıdaki komutlardan veya ortam değişkenlerinden biriyle HTTP modu otomatik olarak devreye girer:

```bash
# 1. Ortam değişkeni ile başlatma
MCP_TRANSPORT=http PORT=3000 node packages/parasut-mcp-server/dist/server.js

# 2. CLI parametresi ile başlatma
parasut-mcp --http --port 3000

# 3. Bağımsız binary ile başlatma
parasut-mcp-http --port 3000
```

#### HTTP Uç Noktaları (Endpoints)

- `POST /mcp` — MCP protokol başlatma (initialize), araç listeleme ve JSON-RPC mesaj alışverişi.
- `GET /mcp` — Server-Sent Events (SSE) stream akışı ve bağlantı sürdürülebilirliği (resumability).
- `DELETE /mcp` — Oturum sonlandırma (`mcp-session-id` başlığı ile).
- `GET /health` — Liveness & readiness sağlık kontrolü (aktif oturum sayısı ve versiyon bilgisi döner).
- `GET /` — Sunucu kök meta verisi ve yetkilendirme durumu.

#### İsteğe Bağlı API Anahtarı Koruması (Bearer Auth)

HTTP sunucusunu dış dünyadan korumak için `MCP_API_KEY` tanımlayabilirsiniz. Tanımlandığında, `/mcp` uç noktasına yapılan tüm isteklere `Authorization: Bearer <MCP_API_KEY>` başlığı zorunlu hale gelir.

```bash
MCP_TRANSPORT=http
PORT=3000
MCP_API_KEY=gizli-guclu-api-anahtari
```

#### 🛡️ Resmî OAuth 2.0 / 2.1 Yetkilendirme (RFC 9728, RFC 8414, RFC 7591)

Paraşüt MCP Sunucusu, IETF ve Model Context Protocol yetkilendirme spesifikasyonlarını eksiksiz uygular:

- **RFC 9728 Protected Resource Metadata**: `GET /.well-known/oauth-protected-resource` uç noktası üzerinden sunucunun kaynak URI'si, yetkilendirme sunucuları ve desteklenen kapsamları (`scopes_supported`) yayınlanır.
- **RFC 8414 Authorization Server Metadata**: `GET /.well-known/oauth-authorization-server` üzerinden uç noktalar, desteklenen grant türleri (`authorization_code`, `client_credentials`, `refresh_token`), PKCE yöntemleri (`S256`) ve kimlik doğrulama biçimleri ilan edilir.
- **RFC 7591 Dynamic Client Registration (DCR)**: `POST /oauth/register` ile istemciler (mcpc, Claude Desktop, Cursor vb.) dinamik olarak istemci kaydı oluşturabilir.
- **RFC 7636 PKCE ile Yetkilendirme Kodu Akışı**: `GET /oauth/authorize` ve `POST /oauth/token` ile interaktif tarayıcı onay ekranı veya otomatik onay.
- **M2M / CI/CD için Client Credentials**: `POST /oauth/token` (`grant_type=client_credentials`) ile CLI ve otomasyon ajanları doğrudan access token temin edebilir.
- **RFC 6750 WWW-Authenticate Başlığı**: Yetkisiz (401) isteklerde istemciye `WWW-Authenticate: Bearer error="invalid_token", resource_metadata="..."` başlığı dönülerek istemcinin dinamik yetkilendirme akışını otomatik başlatması sağlanır.
- **RFC 7009 Token Revocation**: `POST /oauth/revoke` ile token iptali.

##### `mcpc` CLI ile OAuth Üzerinden Bağlanma
```bash
# 1. OAuth Client Credentials ile giriş yapma ve profil kaydetme
mcpc login https://parasut-mcp.example.com/mcp \
  --grant client-credentials \
  --client-id mcpc-default \
  --client-secret your-mcp-api-key \
  --profile parasut-oauth

# 2. Kaydedilen OAuth profiliyle güvenli bağlantı kurma
mcpc connect https://parasut-mcp.example.com/mcp @parasut-oauth --profile parasut-oauth

# 3. Oturum üzerinden canlı araç çalıştırma
mcpc @parasut-oauth tools-call get_financial_summary
mcpc @parasut-oauth tools-call list_accounts
```


#### Docker ve Dokploy ile Dağıtım

Monorepo kökünde bulunan `Dockerfile` çok aşamalı (multi-stage) ve optimize edilmiş `node:22-alpine` imajı üretir:

```bash
# Docker imajı derleme
docker build -t parasut-mcp:latest .

# Docker container çalıştırma
docker run -d \
  --name parasut-mcp \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e MCP_TRANSPORT=http \
  -e PORT=3000 \
  -e PARASUT_CLIENT_ID="your-client-id" \
  -e PARASUT_CLIENT_SECRET="your-client-secret" \
  -e PARASUT_ACCESS_TOKEN="your-access-token" \
  -e PARASUT_REFRESH_TOKEN="your-refresh-token" \
  parasut-mcp:latest
```

**Dokploy Compose Örneği:**

```yaml
services:
  parasut-mcp:
    image: parasut-mcp:latest
    pull_policy: never
    restart: unless-stopped
    init: true
    stop_grace_period: 15s
    environment:
      NODE_ENV: production
      MCP_TRANSPORT: http
      HOST: 0.0.0.0
      PORT: "3000"
      PARASUT_CLIENT_ID: ${PARASUT_CLIENT_ID}
      PARASUT_CLIENT_SECRET: ${PARASUT_CLIENT_SECRET}
      PARASUT_ACCESS_TOKEN: ${PARASUT_ACCESS_TOKEN}
      PARASUT_REFRESH_TOKEN: ${PARASUT_REFRESH_TOKEN}
      MCP_API_KEY: ${MCP_API_KEY:-}
    networks:
      default: {}
      dokploy-network: {}
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3

networks:
  dokploy-network:
    external: true
```

#### Uzaktan `mcpc` Bağlantısı

Canlı HTTP uç noktanıza doğrudan `mcpc` veya MCP istemcileri üzerinden bağlanabilirsiniz:

```bash
# Canlı Streamable HTTP uç noktasına bağlanma
mcpc connect https://parasut-mcp.example.com/mcp @parasut-remote

# Oturum durumunu kontrol etme ve ping atma
mcpc @parasut-remote ping

# Uzak sunucudaki araçları listeleme
mcpc @parasut-remote tools-list
```

---


## 🧰 MCP Araçları Kataloğu (34 Araç - Detaylı Türkçe Rehber)

MCP sunucusu 8 ana faaliyet alanında toplam **34 aracı** kullanıma sunar. Tüm yazma/güncelleme araçları varsayılan olarak **Önizleme (Preview/Dry-Run)** modunda çalışarak yanlış işlem yapılmasını engeller.

```
Güvenlik Seviyeleri:
🔍 Salt Okunur   : Veri okur, sistemde değişiklik yapmaz. Doğrudan çalışır.
⚠️ Önizleme Korumalı: confirm=true verilmedikçe sadece yapılacak işlemin özetini sunar.
🚨 Çift Onay Korumalı: confirm=true VE i_understand_this_is_irreversible="YES" gerektirir (GİB e-Belge).
```

### 1. Cari Hesaplar & İletişim (Contacts - 4 Araç)

Müşteri ve tedarikçi kayıtlarını aramak, görüntülemek, yeni cari kart açmak ve güncellemek için kullanılır.

| Araç Adı | Güvenlik | Ne İşe Yarar / Açıklama | Temel Parametreler |
| :--- | :---: | :--- | :--- |
| `search_contacts` | 🔍 | İsim, vergi dairesi/numarası, e-posta veya şehre göre müşteri ve tedarikçileri arar ve listeler. | `query` (arama metni), `type` (`customer`, `supplier`), `page`, `per_page` |
| `get_contact` | 🔍 | Belirtilen ID'ye sahip cari hesabın tüm detaylarını, adreslerini, bakiye ve iletişim bilgilerini getirir. | `id` (Cari hesap ID'si) |
| `create_contact` | ⚠️ | Yeni bir müşteri veya tedarikçi kartı oluşturur. `confirm=true` verilmezse önizleme döner. | `name`, `contact_type` (`company`, `person`), `tax_number`, `tax_office`, `email`, `city`, `confirm` |
| `update_contact` | ⚠️ | Mevcut bir cari kartın bilgilerini (adres, telefon, vergi no vb.) günceller (`PUT /contacts/{id}`). | `id`, `name`, `email`, `phone`, `address`, `confirm` |

---

### 2. Satış Faturaları (Sales Invoices - 7 Araç)

Satış faturalarını listeleme, filtreleme, yeni fatura kesme, iptal etme, arşivden çıkarma, PDF alma ve tahsilat ekleme işlemleri.

| Araç Adı | Güvenlik | Ne İşe Yarar / Açıklama | Temel Parametreler |
| :--- | :---: | :--- | :--- |
| `search_invoices` | 🔍 | Satış faturalarını müşteri, fatura numarası, tarih aralığı ve ödeme durumuna (`paid`, `overdue`, `unpaid`, `not_due`) göre filtreler. | `query`, `status`, `start_date`, `end_date`, `page`, `per_page` |
| `get_invoice` | 🔍 | Fatura detaylarını, kalemlerini, KDV/vergi dağılımını ve varsa bağlı e-belge ilişkilerini getirir. | `id` (Fatura ID'si) |
| `create_invoice` | ⚠️ | Yeni satış faturası oluşturur. Ürün kalemleri, KDV oranları, iskonto ve vade tarihi tanımlanabilir. | `contact_id`, `description`, `issue_date`, `due_date`, `details` (ürün kalemleri), `confirm` |
| `cancel_invoice` | ⚠️ | Henüz resmîleşmemiş faturayı iptal durumuna çeker veya faturayı siler (`DELETE /sales_invoices/{id}`). | `id`, `confirm` |
| `recover_invoice` | ⚠️ | İptal edilmiş bir faturayı yeniden aktif duruma getirir (`PATCH /sales_invoices/{id}/recover`). | `id`, `confirm` |
| `invoice_pdf` | 🔍 | Faturanın resmî e-Arşiv veya e-Fatura PDF bağlantısını döner. API V4'e uygun olarak `active_e_document` üzerinden PDF URL'ini veya UBL dosyasını temin eder. | `id` (Fatura ID'si) |
| `record_invoice_payment` | ⚠️ | Satış faturasına nakit, banka veya POS hesabı üzerinden tahsilat (ödeme) kaydeder. | `invoice_id`, `account_id`, `amount`, `date`, `description`, `confirm` |

---

### 3. Alış Faturaları & Gider Fişleri (Purchase Bills - 4 Araç)

Tedarikçilerden gelen faturaların ve işletme gider fişlerinin takibi, sisteme işlenmesi ve ödemelerinin kaydedilmesi.

| Araç Adı | Güvenlik | Ne İşe Yarar / Açıklama | Temel Parametreler |
| :--- | :---: | :--- | :--- |
| `search_bills` | 🔍 | Alış faturalarını ve gider fişlerini tedarikçi, tarih, fatura no ve ödeme durumuna göre sorgular. | `query`, `status`, `start_date`, `end_date`, `page`, `per_page` |
| `get_bill` | 🔍 | Belirli bir alış faturasının veya gider fişinin detaylarını ve kalemlerini getirir. | `id` (Fiş/Fatura ID'si) |
| `create_bill` | ⚠️ | Yeni bir alış faturası veya masraf fişi kaydeder (`item_type: 'purchase_bill'`). Vade tarihi girilmezse düzenleme tarihi esas alınır. | `contact_id`, `issue_date`, `due_date`, `details` (kalemler), `total_amount`, `confirm` |
| `record_bill_payment` | ⚠️ | Alış faturasına istinaden kasa veya banka hesabından tedarikçiye yapılan ödemeyi kaydeder. | `bill_id`, `account_id`, `amount`, `date`, `description`, `confirm` |

---

### 4. Ürün & Hizmet Yönetimi (Products - 4 Araç)

Stok kartları, satılan mal ve hizmetlerin tanımlanması, birim fiyat ve KDV oranlarının yönetimi.

| Araç Adı | Güvenlik | Ne İşe Yarar / Açıklama | Temel Parametreler |
| :--- | :---: | :--- | :--- |
| `search_products` | 🔍 | Ürün ve hizmetleri isim, ürün kodu (barkod/stok kodu) veya kategoriye göre arar. | `query`, `page`, `per_page` |
| `get_product` | 🔍 | Ürünün alış/satış fiyatı, stok takibi durumu, birimi (adet, kg, saat vb.) ve KDV oranını getirir. | `id` (Ürün ID'si) |
| `create_product` | ⚠️ | Yeni bir ürün veya hizmet kartı açar. Alış/satış fiyatları, KDV ve stok takibi belirlenebilir. | `name`, `code`, `vat_rate`, `unit`, `list_price`, `inventory_tracking`, `confirm` |
| `update_product` | ⚠️ | Mevcut ürünün fiyatını, adını veya vergi bilgilerini günceller (`PUT /products/{id}`). | `id`, `name`, `list_price`, `vat_rate`, `confirm` |

---

### 5. Resmî E-Belgeler & GİB Entegrasyonu (E-Documents - 4 Araç)

Gelir İdaresi Başkanlığı (GİB) e-Fatura mükellefiyet sorgulama ve e-Fatura / e-Arşiv / e-SMM düzenleme ve gönderme işlemleri.

> [!CAUTION]
> E-Belge gönderme araçları resmî mali mühür ile imzalanıp GİB portalına iletildiğinden **kesinlikle geri alınamaz**. Bu araçlar güvenliğiniz için **Çift Aşamalı Teyit** gerektirir.

| Araç Adı | Güvenlik | Ne İşe Yarar / Açıklama | Temel Parametreler |
| :--- | :---: | :--- | :--- |
| `check_einvoice_inbox` | 🔍 | Verilen VKN/TCKN numarasının GİB e-Fatura mükellefi olup olmadığını ve posta kutusu (PK/GB) adresini sorgular. | `vkn` (Vergi / TC Kimlik No) |
| `send_einvoice` | 🚨 | Satış faturasını GİB e-Fatura olarak alıcının posta kutusuna gönderir ve asenkron işin sonucunu bekler. | `invoice_id`, `note`, `scenario` (`commercial`, `basic`), `confirm: true`, `i_understand_this_is_irreversible: "YES"` |
| `send_earchive` | 🚨 | Satış faturasını resmî e-Arşiv Fatura olarak düzenler, GİB'e iletir ve PDF'ini hazır hale getirir. | `invoice_id`, `note`, `confirm: true`, `i_understand_this_is_irreversible: "YES"` |
| `send_esmm` | 🚨 | Serbest Meslek Makbuzunu (e-SMM) elektronik ortamda GİB onayına sunar. | `invoice_id`, `note`, `confirm: true`, `i_understand_this_is_irreversible: "YES"` |

---

### 6. Finans, Kasa/Banka & Raporlar (Financial - 4 Araç)

Nakit akışı, banka hesapları, hesap hareketleri, banka masrafları ve anlık finansal durum özeti.

| Araç Adı | Güvenlik | Ne İşe Yarar / Açıklama | Temel Parametreler |
| :--- | :---: | :--- | :--- |
| `list_accounts` | 🔍 | Tanımlı tüm banka, kasa ve POS hesaplarını, döviz cinslerini ve güncel bakiyelerini listeler. | — |
| `search_transactions` | 🔍 | Belirli bir banka/kasa hesabının hesap hareketlerini (gelen/giden ödemeler, transferler) listeler. `account_id` verilmezse varsayılan hesabı otomatik seçer. | `account_id`, `start_date`, `end_date`, `page`, `per_page` |
| `create_bank_fee` | ⚠️ | Banka masrafı, EFT/havale komisyonu veya hesap işletim ücreti gibi giderleri ilgili hesaba kaydeder. | `account_id`, `amount`, `date`, `description`, `confirm` |
| `get_financial_summary` | 🔍 | **Şirketin anlık finansal röntgenini çeker**: Kasa ve bankalardaki toplam nakit, vadesi gelmiş/geçecek alacaklar, ödenecek borçlar ve net finansal pozisyonu tek bir özet tabloda sunar. | — |

---

### 7. Stok & Depo Hareketleri (Inventory - 2 Araç)

Depolardaki anlık stok miktarları ve stok giriş/çıkış hareketlerinin incelenmesi.

| Araç Adı | Güvenlik | Ne İşe Yarar / Açıklama | Temel Parametreler |
| :--- | :---: | :--- | :--- |
| `get_stock_levels` | 🔍 | Belirtilen ürün veya depodaki anlık stok seviyesini (`inventory_levels`) listeler. | `product_id`, `warehouse_id` |
| `search_stock_movements` | 🔍 | İrsaliye, fatura veya manuel düzeltmelerle gerçekleşen stok giriş/çıkış hareketlerini tarih sırasıyla gösterir. | `product_id`, `start_date`, `end_date`, `page`, `per_page` |

---

### 8. Şirket, Kategori & Bordro (Organization - 5 Araç)

Kategoriler, etiketler, çalışan listesi, maaş ödemeleri ve vergi/SGK tahakkuklarının kaydı.

| Araç Adı | Güvenlik | Ne İşe Yarar / Açıklama | Temel Parametreler |
| :--- | :---: | :--- | :--- |
| `list_categories` | 🔍 | Gelir ve giderlerde kullanılan ürün ve masraf kategorilerini ağaç yapısıyla listeler. | `category_type` (`product`, `contact`, `employee`) |
| `list_tags` | 🔍 | Belgeleri ve cari hesapları gruplamak için tanımlanmış etiketleri listeler. | — |
| `list_employees` | 🔍 | Şirkette kayıtlı personelleri, iletişim ve işe başlama bilgilerini listeler. | — |
| `create_salary` | ⚠️ | Bir personele yapılan maaş ödemesini veya avansı ilgili kasa/banka hesabından düşerek işler. | `employee_id`, `account_id`, `amount`, `date`, `description`, `confirm` |
| `create_tax` | ⚠️ | KDV, Muhtasar/Stopaj, SGK primi veya Kurumlar Vergisi gibi resmi vergi ödemelerini sisteme kaydeder. | `tax_type`, `account_id`, `amount`, `date`, `description`, `confirm` |

---

## 💻 SDK Doğrudan Kullanım Örnekleri

TypeScript projenizde doğrudan `@yigitkonur/parasut-node-sdk` kullanmak isterseniz:

```typescript
import { ParasutClient } from '@yigitkonur/parasut-node-sdk';

// 1. İstemci Tanımlama (Token veya Kullanıcı Adı/Şifre ile)
const client = new ParasutClient({
  accessToken: process.env.PARASUT_ACCESS_TOKEN,
  refreshToken: process.env.PARASUT_REFRESH_TOKEN,
  credentials: {
    clientId: process.env.PARASUT_CLIENT_ID!,
    clientSecret: process.env.PARASUT_CLIENT_SECRET!,
  },
  // companyId verilmezse client.resolveCompanyId() ile otomatik keşfedilir
});

// 2. Müşteri Sorgulama
const contacts = await client.contacts.list({
  filter: { name: 'Acme' },
  page: { number: 1, size: 25 },
});

// 3. Fatura Oluşturma
const newInvoice = await client.salesInvoices.create({
  contact_id: 12345,
  description: 'Yazılım Danışmanlık Hizmeti',
  issue_date: '2026-09-25',
  due_date: '2026-10-25',
  details: [
    {
      product_id: 67890,
      quantity: 1,
      unit_price: 15000,
      vat_rate: 20,
    },
  ],
});

// 4. Otomatik Sayfalama (Async Iterator ile Bellek Dostu Tarama)
for await (const product of client.products.iterate()) {
  console.log(`Ürün: ${product.attributes.name} - Stok Kodu: ${product.attributes.code}`);
}

// 5. GİB e-Fatura Gönderme ve Asenkron Takip
const eInv = await client.eInvoices.submitAndWait(newInvoice.data.id, {
  scenario: 'commercial',
  to: 'urn:mail:defaultpk@parasut.com',
});
console.log('e-Fatura GİB Onayı Tamamlandı, Belge No:', eInv.data.attributes.invoice_number);
```

---

## 🔒 Güvenlik İlkeleri & Gizlilik Garantisi

- **Sıfır İstem Dışı Finansal İşlem**: Bütün yazma işlemleri (`create_invoice`, `record_bill_payment`, `create_salary` vb.) varsayılan olarak `confirm=false` kabul eder ve kullanıcıya yalnızca işlem simülasyonu sunar. Kullanıcı onaylamadıkça veritabanına hiçbir kayıt yazılmaz.
- **Resmî Belge İptal Edilemezlik Güvencesi**: GİB e-Fatura ve e-Arşiv bildirimlerinde yanlışlıkla resmî beyanda bulunmayı önlemek için iki aşamalı güvenlik sorusu (`i_understand_this_is_irreversible="YES"`) uygulanır.
- **Sıfır Gizli Anahtar / Özel Veri Sızıntısı**: Bu açık kaynak kod tabanında veya git geçmişinde hiçbir üçüncü taraf şirket bilgisi, staging ortamı veya gerçek gizli anahtar (secret) bulunmaz. `.env` yerel dosyası git tarafından tamamen yoksayılır.

---

## 🧪 Geliştirme ve Test

```bash
# Bağımlılıkları yükle
pnpm install

# Tüm paketleri derle (TypeScript tsc)
pnpm build

# Birim ve entegrasyon testlerini çalıştır
pnpm test

# mcpc CLI ile smoke check
mcpc packages/parasut-mcp-server/dist/index.js tools-list
```

---

## 📄 Lisans

Bu proje **MIT** lisansı ile dağıtılmaktadır. Detaylar için [LICENSE](LICENSE) dosyasına göz atabilirsiniz.
