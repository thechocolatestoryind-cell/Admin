# Firebase data contract (from the supplied JSON and rules)

Source of truth is the uploaded export and rules, not the (unseen) storefront. Collection names live in `js/collections.js`.

| Collection | Fields seen in export | Admin access (rules) |
|---|---|---|
| `users/{uid}` | isActive, displayName, photoURL, phoneNumber, email, defaultAddressId, createdAt, updatedAt | get, list; update allowed by rules but not used |
| `users/{uid}/addresses/{id}` | fullName, phone, addressLine1, addressLine2, landmark, city, state, pincode, country, isDefault, createdAt, updatedAt | read |
| `products/{id}` | name, slug, description, shortDescription, seoTitle, seoDescription, categoryId, productType (`fixed`/`customizable`), basePrice, deliveryCharge, images[], primaryImage, options[], tags[], searchKeywords[], trackInventory, stockQuantity, lowStockThreshold, allowBackorder, isAvailable, isActive, isFeatured, sortOrder, reviewCount, averageRating, createdAt, updatedAt | full |
| `categories/{id}` | name, slug, description, imageURL, sortOrder, isActive, createdAt, updatedAt | full |
| `orders/{id}` | orderNumber, userId, customerName, customerEmail, customerPhone, shippingAddress{}, items[], subtotal, deliveryCharge, totalAmount, currency, paymentMethod, paymentStatus, status, customerNote, createdAt, updatedAt (+ `adminNote` allowed by rules) | read; update only status, updatedAt, adminNote on valid transitions |
| `reviews/{id}` | productId, orderId, userId, rating, reviewText, imageURLs[], isApproved, isVerifiedPurchase, createdAt, updatedAt | full |
| `wishlists/{id}` | userId, productIds[], createdAt, updatedAt | read |
| `siteSettings/public` | siteName, contactEmail, whatsappNumber, instagramURL, currency, currencySymbol, maintenanceMode, announcementEnabled, announcementText, logoURL, faviconURL, updatedAt | read, write |
| `banners/{id}` | title, subtitle, imageURL, mobileImageURL, buttonText, buttonLink, sortOrder, isActive, createdAt, updatedAt | full |
| `highlights/{id}` | title, coverImageURL, sortOrder, isActive, createdAt, updatedAt | full |
| `highlightItems/{id}` | highlightId, imageURL, caption, linkURL, sortOrder, isActive, createdAt, updatedAt | full |
| `paymentTransactions/{id}` | provider, razorpayOrderId, razorpayPaymentId, orderId, userId, amount, currency, status, signatureVerified, verifiedAt, createdAt, updatedAt | read only |
| `shipments/{id}` | orderId, userId, courierName, trackingNumber, trackingURL, status, estimatedDeliveryDate, shippedAt, deliveredAt, delayReason, createdAt, updatedAt | full |
| `customOrderRequests/{id}` | customerName, phoneNumber, contactMethod (`whatsapp`/`instagram`/`phone`), userId, productDescription, budget, requestedDate, referenceImageURLs[], status (`new` seen), adminNote, createdAt, updatedAt | read, update, delete |
| `adminActivityLogs/{id}` | action, description, targetCollection, targetDocumentId, adminEmail, adminUid, createdAt | read only |

## Known unknowns
- Shape of `products.options[]` items: the sample is empty, so Stage 2 defines the shape below for NEW records. Existing options in any other shape are preserved unchanged. The storefront must be checked against this later.
- Full set of `status` values for shipments and custom requests (only `pending` and `new` seen). This admin writes shipment statuses `pending`, `shipped`, `in_transit`, `delayed`, `delivered`; they are not confirmed against the storefront.
- Shape of `orders.items[]` (the sample is empty). The order page reads common key names (name/productName, quantity, price, selectedOptions) and shows any other keys as plain text.
- Whether the storefront reads `logoURL`, `faviconURL`, or other fields; unverified.
- Delivery estimate (6–8 days) has no field in `siteSettings/public`; it is an app default.

## `products.options[]` shape written by this admin (new records)
```
{ "id": "size", "name": "Size", "type": "choice", "required": true,
  "choices": [ { "label": "500 g", "priceAdjustment": 0 }, { "label": "1 kg", "priceAdjustment": 300 } ] }
{ "id": "message", "name": "Message on cake", "type": "text", "required": false, "maxLength": 100, "priceAdjustment": 0 }
```
`id` is a slug of the name, unique within the product. `priceAdjustment` is in rupees and is added to `basePrice` by the storefront (unverified).
Product writes: create sets `reviewCount: 0`, `averageRating: 0`, `createdAt` and `updatedAt` (server timestamps); updates change only submitted fields plus `updatedAt`.
Category writes: `name, slug, description, imageURL, sortOrder, isActive` plus timestamps.

## Writes made by Stage 3
- `orders/{id}`: `status`, `adminNote`, `updatedAt` only (server timestamp), and only along `validOrderTransition`.
- `shipments`: create sets orderId, userId (copied from the order), courierName, trackingNumber, trackingURL, status, estimatedDeliveryDate, shippedAt, deliveredAt (dates as India-midnight timestamps, or null), delayReason, createdAt, updatedAt. Updates never change orderId or userId.
- `paymentTransactions`, `users` and addresses: no writes exist in the code.

## Writes made by Stage 4
- `banners`, `highlights`, `highlightItems`: create/update/delete with the exact field names above plus `createdAt`/`updatedAt`. Activation toggles and reordering write only `isActive` / `sortOrder` (+ `updatedAt`). Highlight deletion removes the highlight and its slides in one batch.
- `reviews/{id}`: `isApproved` and `updatedAt` only (delete is available for spam). `rating`, `reviewText`, `imageURLs`, `productId`, `orderId`, `userId`, `isVerifiedPurchase` are never written. The `rejected` state does not exist in the schema.
- `customOrderRequests/{id}`: `status`, `adminNote`, `updatedAt` only. Status words used by this admin: `new`, `contacted`, `quoted`, `accepted`, `in_progress`, `completed`, `declined` (not validated by the rules; unconfirmed against the storefront).
- `siteSettings/public`: the 11 known fields, changed fields only, plus `updatedAt`; created with `setDoc` only if the document is missing.
- `adminActivityLogs`, `paymentTransactions`, `users`: no writes exist in the code.
## Schema or rule work still needed (not done here)
- A rejected/pending distinction and rejection reason for reviews.
- Shared delivery-estimate fields in `siteSettings/public`.
- Server-side review rating aggregation, audit logging, payment verification and safe stock handling (trusted backend).
