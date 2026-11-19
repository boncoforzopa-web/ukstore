# The Christmas Sweet Shop – UK seasonal decorations store

Online shop for Christmas trees, decorations, greenery, lighting and seasonal collections. Runs on Vercel as one
serverless function that renders a Liquid theme (`theme/`) from JSON data (`data/`). Payments through Stripe.
English, pounds sterling, UK delivery.

| Path | What |
|---|---|
| `theme/` | Storefront: `sections/`, `snippets/`, `templates/`, `assets/store.css`, `assets/tw.js` |
| `theme/config/settings_data.json` | Shop name, colours, company details, delivery charge, tax note |
| `theme/templates/index.json` | Homepage sections, in order (hero, service strip, category tiles, product rows, story…) |
| `theme/sections/header-group.json` | Announcement bar messages (each can have a start and end date) |
| `data/collections.json` | Categories. `parent` nests them, `rule: "sale" \| "new"` fills them automatically |
| `data/menus.json` | Main menu (mega menu) and footer menus |
| `data/pages.json` | Policy and help pages. `[[COMPANY]]`, `[[ADDRESS]]`, `[[EMAIL]]` are filled from company details |
| `data/products.json` | Products (prices in GBP) |
| `lib/` | Engine, router, basket, checkout, e-mails, stock, admin, Google feed |
| `lib/shop.js` | One place for name, currency, VAT rate and delivery charge |

## Adding a product

Add an object to `data/products.json`:

```json
{
  "id": "1001", "handle": "balmoral-fir-6ft", "title": "Balmoral Fir Tree 6ft", "status": "active",
  "vendor": "Brand name", "product_type": "Artificial tree", "tags": ["New"],
  "summary": "One line shown under the price.",
  "description_html": "<p>Full description.</p>",
  "collections": ["pre-lit-trees"],
  "attributes": { "Height": "6ft", "Lighting": "Pre-lit warm white", "Shape": "Full", "Use": "Indoor" },
  "images": [{ "src": "https://…/photo.jpg", "alt": "Balmoral Fir tree in a living room", "width": 1600, "height": 2000 }],
  "options": [{ "name": "Title", "values": ["Default Title"] }],
  "variants": [{ "id": "10011", "title": "Default Title", "price": "249.00", "compare_at_price": null, "sku": "BF-6",
                 "inventory_tracked": true, "inventory_quantity": 10, "options": {} }],
  "created_at": "2026-11-18T00:00:00Z"
}
```

- A product appears in every category listed in `collections`, and in that category's parent.
- `attributes` become the specifications table and the category filters (Height, Size, Colour, Lighting, Shape, Style, Material, Use, Season).
- Tag `Pre-order` (with optional `"release_date": "2026-12-05"`) marks a pre-order. Tag `New` adds a "New" label.
- A `compare_at_price` above `price` puts the product in Sale.

## Running it

`npm install && node scripts/build.js && node scripts/dev.js` → http://localhost:3000

Environment variables: see `.env.example`. Without Stripe keys the checkout says payment is unavailable;
without Resend/Redis the contact form, newsletter and order tracking stay hidden rather than pretending to work.

## Before launch

- Company name, address, contact e-mail, company and VAT numbers in `theme/config/settings_data.json`.
- If VAT-registered: `"tax_note": "Includes VAT"` there and `"vatRate": 20` in `data/shop.json`.
- Delivery charge (`delivery_fee_pence`, `free_shipping_threshold`) and the wording on the Delivery page.
- Have the policy pages in `data/pages.json` checked for the business.
- Stripe test order end to end, then live keys.
