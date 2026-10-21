# The Chocolate Story – Admin Panel

A standalone, installable admin panel for the existing Firebase project **`the-chocolate-story`**. It is plain HTML, CSS and vanilla JavaScript (ES modules): no build step, no npm, no framework. It does **not** need the customer storefront ZIP or the old ORÈVA admin ZIP. Open `index.html` once it is hosted over HTTPS.

**Status: complete (Stage 5 of 5).** Everything below is written. It has been tested against stubbed Firebase in a headless browser and by static review, **not against your live Firebase**. Read "What was and was not tested" before relying on it.

## 1. Quick start (Android friendly)
1. Unzip and upload the folder's contents to any static HTTPS host (for example a GitHub repository with GitHub Pages turned on). Paths are relative, so a project URL like `https://name.github.io/repo/` works.
2. In the Firebase Console for `the-chocolate-story`: **Authentication → Sign-in method → enable Google**, then **Authentication → Settings → Authorized domains → add your hosting domain** (for example `name.github.io`). Without this, sign-in shows "This website address is not on Firebase's authorised domains list".
3. Open the site and sign in with **`thechocolatestory.ind@gmail.com`**. Any other Google account sees "Access denied".
4. Install on Android: open the site in Chrome, then use **Install app** or **Add to Home screen** if Chrome offers it. The wording differs between browsers, and installing needs HTTPS.

For local testing use `http://localhost` (for example `python3 -m http.server` inside this folder). Opening the files directly from storage (`file://`) does not work.

## 2. Folder overview
| Path | What it is |
|---|---|
| `index.html` | Landing page: sends you to login or the dashboard |
| `login.html`, `offline.html` | Google sign-in / access-denied screen; offline fallback (no private data) |
| `dashboard.html` … `settings.html` | One page per section (14 pages, see below) |
| `js/firebase.js` | **The only place with the Firebase config and SDK version (10.14.1).** Nothing else initialises Firebase |
| `js/config.js` | Business constants: admin email, WhatsApp, Cloudinary endpoint/preset, delivery estimate |
| `js/collections.js` | The 14 collection names (exactly as in your export) and the order status rules |
| `js/auth.js` | Google sign-in and the page guard |
| `js/common.js`, `js/ui/` | App shell, safe DOM helper, toasts, dialogs, forms, uploader, image field, lightbox |
| `js/services/` | All Firestore reads/writes and the pure validation logic, one file per area |
| `js/pages/` | The code for each screen |
| `css/` | `base.css` (design tokens, forms, lists), `app.css` (app shell) |
| `assets/` | `logo.jpg` (your exact uploaded logo) and icons made from it |
| `manifest.webmanifest`, `sw.js` | PWA manifest and service worker |
| `docs/` | Input audit, data contract, security notes, asset manifest, QA report, storefront checklist |
| `tests/` | Optional developer checks (see section 9). Not needed to run the app |

Pages: Dashboard, Products (+ editor), Categories, Orders (+ detail), Shipments, Payments, Customers, Custom requests, Reviews, Banners & highlights, Activity log, Store settings.

## 3. Firebase and security
- Project ID **`the-chocolate-story`**; config lives only in `js/firebase.js`. The web config is public by design. No secret of any kind is in this project: no Razorpay secret, no Cloudinary API secret, no service-account JSON.
- **The email allowlist in the browser is only a UI gate.** Anyone can edit JavaScript in their own browser. The real protection is your **Firestore security rules** (`isAdmin()` needs a verified Google sign-in for the owner email). Do not weaken or remove them. This app never changes your rules, indexes or any remote Firebase setting.
- Current rule limits this app respects:
  - Orders cannot be created or deleted from the browser. Admin can change only `status`, `adminNote` and `updatedAt`, and only along valid transitions (pending → confirmed → processing → shipped → delivered; cancel only before shipping).
  - `paymentTransactions` and `adminActivityLogs` are read-only in the browser.
  - Review text/photos, customer profiles and customer-submitted request fields are never edited.
- **A trusted backend is still needed** (not provided, not faked) for: Razorpay order creation, signature verification and webhooks; safe stock reservation (stock numbers here are typed by hand and are not safe against simultaneous checkouts); writing reliable audit-log entries; review rating aggregation; refunds; courier booking or live tracking; sending email.
- **No email service, courier API or Razorpay verification backend is configured.** Tracking details are exactly what you type. WhatsApp links only open WhatsApp; the app cannot send messages and never says one was sent.

## 4. Images (Cloudinary)
Uploads go to `https://api.cloudinary.com/v1_1/dyt6fwvw0/image/upload` with the unsigned preset `Wb_mobile_products`. Only the real `https` URL Cloudinary returns is saved, and only after you save the form. If an upload works but saving fails, the app says the image is on Cloudinary and the record was **not** saved. Allowed: JPG, PNG, WebP, up to 8 MB and 6000 px. Client checks are not security: **restrict the preset in Cloudinary** (allowed formats, maximum size, a fixed folder) before real use. Removing an image in the admin does not delete it from Cloudinary.

## 5. What each section does
- **Products / Categories:** search and filters, per-product delivery charge, options (choice lists or custom text), images, stock fields, SEO. Targeted updates keep fields the form doesn't know. A category still used by products cannot be deleted.
- **Orders:** search, filters, saved items and amounts, customer and address, status changes (confirmed first), internal note. Cancelling warns that no refund is made by the app.
- **Shipments:** manual DTDC-friendly entry; warnings when an order and shipment disagree (nothing is changed for you).
- **Payments:** read-only; inconsistencies in stored records are flagged, nothing is ever marked verified.
- **Customers:** read-only profile, saved addresses, order history.
- **Custom requests:** details, reference images, contact links from the typed number, private note, status.
- **Reviews:** approve or hide (`isApproved` only). A single boolean cannot record "rejected", and no reason can be stored.
- **Banners & highlights:** add/edit/reorder/activate/delete; slides keep the correct `highlightId`; deleting a highlight removes its slides together.
- **Store settings:** the 11 known fields of `siteSettings/public`. The 6–8 day delivery estimate is an app default (that document has no field for it).
- **Activity log:** read-only.
- **Dashboard:** counts from a fresh read (no revenue, no charts, no live labels). No coupon, COD, refund or return features exist.

## 6. How to test it yourself
1. **Auth states:** signed out, open `dashboard.html` directly → you land on login. Sign in with another Google account → "Access denied" and a sign-out button. Sign in as the owner → dashboard. Sign out works.
2. **Deep links:** `order-detail.html?id=…` and every other page redirect to login when signed out.
3. **Create/edit flows:** create a category, then a product with an image; edit it; change an order's status; add a shipment; approve a review; save a setting. Check each in the Firebase Console.
4. **Upload errors:** try a `.gif`, an image over 8 MB, or switch on airplane mode during an upload. You should see a clear message and a Retry button.
5. **Permission errors:** if a rule blocks something you will see "This action is blocked by current Firebase permissions". Nothing should ever say "saved" unless Firestore confirmed it.
6. **Offline:** turn off the network. An "offline" bar appears and saving is paused. Reload a page you already visited to see the cached shell or the offline page.
7. **PWA:** in Chrome DevTools → Application, check the manifest, service worker and that the cache holds only static files (never Firestore data).

## 7. What was and was not tested
See `docs/QA_REPORT.md` for the full list. In short: logic, services and screens were exercised with the Firebase SDK replaced by in-memory stubs, plus static review of every file, link and import. **Not tested:** real Google sign-in, your real Firestore rules and data, real Cloudinary uploads, installing on a real Android phone, and the service worker/offline behaviour in a real browser (it was only reviewed, not run). Treat your own first run as the live test.

## 8. Known limits
Review "reject" cannot be recorded; product ratings/review counts are not recalculated; shipment and custom-request status words (`pending/shipped/in_transit/delayed/delivered`, `new/contacted/quoted/accepted/in_progress/completed/declined`) and the `products.options[]` and order-item shapes are this panel's reading of an export with empty samples; the 6–8 day estimate is not editable for the storefront. Details: `docs/FIREBASE_DATA_CONTRACT.md`, `docs/INPUT_AUDIT.md`.

## 9. Optional developer checks
`tests/` holds Node scripts (`node --import ./tests/register.mjs tests/run.mjs`, `run3.mjs`, `run4.mjs`) that run the service and validation code against an in-memory fake Firestore, and `tests/browser/smoke.cjs` (needs Playwright) that drives headless Chromium with Firebase stubbed. They never touch your real Firebase. You do not need them to use the app.

## 10. Later integration with the storefront
When you eventually supply the customer storefront source, compare its real collection paths, field names, image and content consumers with `docs/FIREBASE_DATA_CONTRACT.md` using `docs/STOREFRONT_COMPATIBILITY_CHECKLIST.md`. **Compatibility with an unseen storefront is not claimed.**
