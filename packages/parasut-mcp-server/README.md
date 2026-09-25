# @yigitkonur/parasut-mcp-server

[![npm version](https://img.shields.io/npm/v/@yigitkonur/parasut-mcp-server.svg?style=flat-square)](https://www.npmjs.com/package/@yigitkonur/parasut-mcp-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

> **UNOFFICIAL** Model Context Protocol (MCP) Server for the [Paraşüt](https://www.parasut.com/) API V4.
>
> **Not affiliated with Paraşüt.** This is a community-maintained project.

Use Claude AI, Cursor, or any MCP client to manage your Turkish accounting: invoices, contacts, products, bank/cash accounts, e-fatura, and financial operations through natural conversation.

---

## Features

- **34 AI-Optimized Tools** — Intent-first design covering all core accounting workflows.
- **Preview & Confirmation Pattern** — Read-only dry-run by default for all write/mutation operations (`confirm=true` required).
- **Double Confirmation for GİB Submissions** — Mandatory double confirmation (`confirm=true` and `i_understand_this_is_irreversible="YES"`) for official e-invoices, e-archives, and e-SMM.
- **Token-Based & OAuth Auth** — Support for both username/password flow and pre-generated access/refresh tokens.
- **Automatic Company ID Auto-Discovery** — Discovers your company ID automatically via `GET /v4/me` if not explicitly provided.
- **Transparent 401 Token Refresh** — Automatically handles OAuth token expirations and retries requests seamlessly.
- **Smart Responses with Guided Next Steps** — Every tool response suggests context-aware next actions.

---

## Installation & Running

### Using `npx` (Recommended)
```bash
npx @yigitkonur/parasut-mcp-server
```

### Global Install
```bash
pnpm add -g @yigitkonur/parasut-mcp-server
# or
npm install -g @yigitkonur/parasut-mcp-server
```

---

## Configuration

The server supports two authentication modes.

### Option 1: Username & Password (OAuth2 Password Flow)
```bash
PARASUT_CLIENT_ID="your-client-id"
PARASUT_CLIENT_SECRET="your-client-secret"
PARASUT_USERNAME="your-email@example.com"
PARASUT_PASSWORD="your-password"
PARASUT_COMPANY_ID="123456" # Optional: Auto-discovered if omitted
```

### Option 2: Token-Based Auth (Access Token & Refresh Token)
```bash
PARASUT_ACCESS_TOKEN="your-access-token"
PARASUT_REFRESH_TOKEN="your-refresh-token" # Optional: Enables auto 401 refresh
PARASUT_CLIENT_ID="your-client-id"         # Required for refresh
PARASUT_CLIENT_SECRET="your-client-secret" # Required for refresh
PARASUT_COMPANY_ID="123456"               # Optional
```

### Optional Settings
```bash
PARASUT_BASE_URL="https://api.parasut.com/v4" # Default
DEBUG="false"                                 # Set to "true" for debug logs on stderr
```

---

## Client Setup

### Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "parasut": {
      "command": "npx",
      "args": ["-y", "@yigitkonur/parasut-mcp-server"],
      "env": {
        "PARASUT_CLIENT_ID": "your-client-id",
        "PARASUT_CLIENT_SECRET": "your-client-secret",
        "PARASUT_USERNAME": "your-username",
        "PARASUT_PASSWORD": "your-password"
      }
    }
  }
}
```

### Cursor
Add under `.cursor/mcp.json` or Cursor MCP settings:
```json
{
  "mcpServers": {
    "parasut": {
      "command": "npx",
      "args": ["-y", "@yigitkonur/parasut-mcp-server"],
      "env": {
        "PARASUT_CLIENT_ID": "your-client-id",
        "PARASUT_CLIENT_SECRET": "your-client-secret",
        "PARASUT_USERNAME": "your-username",
        "PARASUT_PASSWORD": "your-password"
      }
    }
  }
}
```

---

## Available Tools (34 Araç - Tam Türkçe Liste)

### 1. Kişiler / Cari Hesaplar (Contacts - 4 tools)
| Araç (Tool) | Mod | Açıklama (Türkçe) |
|---|:---:|---|
| `search_contacts` | 🔍 | Müşteri veya tedarikçileri isim, VKN/TCKN, e-posta veya şehre göre arar. |
| `get_contact` | 🔍 | Belirtilen cari kartın tüm detaylarını, adres ve bakiye bilgilerini getirir. |
| `create_contact` | ⚠️ | Yeni bir müşteri/tedarikçi kartı oluşturur (`confirm=true` gerektirir). |
| `update_contact` | ⚠️ | Mevcut cari kartın iletişim ve fatura bilgilerini günceller (`PUT /contacts/{id}`). |

### 2. Satış Faturaları (Sales Invoices - 7 tools)
| Araç (Tool) | Mod | Açıklama (Türkçe) |
|---|:---:|---|
| `search_invoices` | 🔍 | Faturaları müşteri, fatura numarası, tarih ve ödeme durumuna göre sorgular. |
| `get_invoice` | 🔍 | Satış faturasının detaylarını, kalemlerini ve bağlı e-belgesini getirir. |
| `create_invoice` | ⚠️ | Yeni satış faturası oluşturur (`confirm=true` gerektirir). |
| `cancel_invoice` | ⚠️ | Henüz resmileşmemiş faturayı iptal eder veya siler (`DELETE /sales_invoices/{id}`). |
| `recover_invoice` | ⚠️ | İptal edilen faturayı tekrar aktif hale getirir (`PATCH /sales_invoices/{id}/recover`). |
| `invoice_pdf` | 🔍 | Faturanın resmî e-Arşiv veya e-Fatura PDF bağlantısını döner. |
| `record_invoice_payment` | ⚠️ | Satış faturasına tahsilat (ödeme) işler (`confirm=true` gerektirir). |

### 3. Alış Faturaları & Gider Fişleri (Purchase Bills - 4 tools)
| Araç (Tool) | Mod | Açıklama (Türkçe) |
|---|:---:|---|
| `search_bills` | 🔍 | Alış faturalarını ve tedarikçi giderlerini filtreler. |
| `get_bill` | 🔍 | Alış faturasının ve masraf kalemlerinin detayını getirir. |
| `create_bill` | ⚠️ | Yeni alış faturası/masraf fişi kaydeder (`confirm=true` gerektirir). |
| `record_bill_payment` | ⚠️ | Tedarikçiye yapılan ödemeyi kaydeder (`confirm=true` gerektirir). |

### 4. Ürünler & Hizmetler (Products - 4 tools)
| Araç (Tool) | Mod | Açıklama (Türkçe) |
|---|:---:|---|
| `search_products` | 🔍 | Ürün ve hizmetleri isim veya stok koduna göre arar. |
| `get_product` | 🔍 | Ürünün alış/satış fiyatı, birimi ve KDV oranını getirir. |
| `create_product` | ⚠️ | Yeni ürün veya hizmet kartı açar (`confirm=true` gerektirir). |
| `update_product` | ⚠️ | Ürün kartı bilgilerini günceller (`PUT /products/{id}`). |

### 5. Resmî E-Belgeler (E-Documents - 4 tools)
| Araç (Tool) | Mod | Açıklama (Türkçe) |
|---|:---:|---|
| `check_einvoice_inbox` | 🔍 | VKN/TCKN numarasının GİB e-Fatura mükellefiyetini ve posta kutusunu denetler. |
| `send_einvoice` | 🚨 | Satış faturasını GİB e-Fatura olarak gönderir (**Geri alınamaz, Çift Onay**). |
| `send_earchive` | 🚨 | Satış faturasını resmî e-Arşiv olarak düzenler ve GİB'e iletir (**Çift Onay**). |
| `send_esmm` | 🚨 | Elektronik Serbest Meslek Makbuzunu GİB'e iletir (**Çift Onay**). |

### 6. Finans & Kasa/Banka (Financial - 4 tools)
| Araç (Tool) | Mod | Açıklama (Türkçe) |
|---|:---:|---|
| `list_accounts` | 🔍 | Kasa, banka ve POS hesaplarının güncel bakiyelerini listeler. |
| `search_transactions` | 🔍 | Banka/kasa hesap hareketlerini görüntüler. |
| `create_bank_fee` | ⚠️ | Banka masrafı veya komisyon kaydı oluşturur (`confirm=true` gerektirir). |
| `get_financial_summary` | 🔍 | Toplam nakit, bekleyen alacak ve ödenecek borçların finansal özetini çıkarır. |

### 7. Stok & Depo (Inventory - 2 tools)
| Araç (Tool) | Mod | Açıklama (Türkçe) |
|---|:---:|---|
| `get_stock_levels` | 🔍 | Ürünlerin depolardaki anlık stok seviyelerini listeler. |
| `search_stock_movements` | 🔍 | Stok giriş ve çıkış geçmişini listeler. |

### 8. Organizasyon & Bordro (Organization - 5 tools)
| Araç (Tool) | Mod | Açıklama (Türkçe) |
|---|:---:|---|
| `list_categories` | 🔍 | Ürün ve masraf kategorilerini hiyerarşik olarak listeler. |
| `list_tags` | 🔍 | Gruplama etiketlerini listeler. |
| `list_employees` | 🔍 | Şirket çalışanlarını listeler. |
| `create_salary` | ⚠️ | Personele maaş/avans ödemesi kaydeder (`confirm=true` gerektirir). |
| `create_tax` | ⚠️ | KDV, stopaj veya SGK vergi ödemesini kaydeder (`confirm=true` gerektirir). |

---

## License

MIT
