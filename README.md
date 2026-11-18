# TAWAGOLD – tawagold.store on Vercel

Pixel-identical copy of the Shopify store, running the **original Shopify theme** (`theme/`) with a
Shopify-compatible Liquid engine (`lib/engine.js`). Same URLs for every product, collection and page.
Payments via **Stripe Checkout**.

| Path | What |
|---|---|
| `theme/` | Original Shopify theme (unchanged). Edit sections/snippets/CSS here like before. |
| `data/products.json` | All products (prices, stock, images, texts). Active = `"status": "active"`. |
| `data/collections.json`, `collection-order.json` | Collections and their product order |
| `data/pages.json`, `menus.json`, `policies.json`, `redirects.json` | Pages, menus, legal policies, 301 redirects |
| `public/images/` | Product images (WebP, several widths) |
| `lib/` | Engine, router (all URLs), cart, Stripe checkout, forms, stock, Google feed |
| `api/index.js` | The single Vercel function |

**URLs kept 1:1:** `/products/<handle>`, `/collections/<handle>`, `/collections/<handle>/<tag>`, `/pages/<handle>`,
`/policies/<handle>`, `/search`, `/cart`, `/cart.js`, `/cart/add.js` …, `/sitemap.xml`, `/robots.txt`.

**Google:** `/feeds/google.xml` = Merchant Center feed (same item IDs `shopify_ZZ_<product>_<variant>`).
Google tag + Ads conversions (page view, view item, add to cart, begin checkout, purchase) are built in.

Local preview: `npm install && node scripts/build.js && node scripts/dev.js` → http://localhost:3000

Environment variables: see `.env.example`.
