# Storefront compatibility checklist (for later)

Do this only when the customer storefront source is available. Nothing here has been verified against it.

1. **Firebase:** same project id `the-chocolate-story`; the storefront must not initialise a second app.
2. **Collections and fields:** compare every collection path and field name the storefront reads or writes with `docs/FIREBASE_DATA_CONTRACT.md` (14 collections plus `users/{uid}/addresses`).
3. **Products:** `slug`, `primaryImage`/`images`, `basePrice`, `deliveryCharge`, `isActive`/`isAvailable`, `trackInventory`/`stockQuantity`/`allowBackorder`. **Options shape:** confirm the storefront understands `{id,name,type:"choice"|"text",required,choices[{label,priceAdjustment}],maxLength,priceAdjustment}` or change one side.
4. **Orders:** shape of `items[]`, `shippingAddress`, `paymentStatus`, `orderNumber`; the storefront (or a backend) must create orders and payments, since the admin cannot.
5. **Shipments:** status words (`pending/shipped/in_transit/delayed/delivered`), date fields and whether customers read `trackingURL`.
6. **Custom requests:** whether the storefront writes the status words this panel uses (`new` is required by the rules) and reads `adminNote`.
7. **Reviews:** only `isApproved == true` is public; decide on a rejected state and rating aggregation (backend).
8. **Content:** banners (`imageURL`, optional `mobileImageURL`, `buttonLink` as a site path or https), highlights/slides (`coverImageURL`, `highlightId`), ordering by `sortOrder`.
9. **Settings:** which `siteSettings/public` fields it reads (`logoURL`, `faviconURL`, `maintenanceMode`, announcement); whether to add delivery-estimate fields (needs a shared schema and rules change).
10. **Images:** the storefront must accept Cloudinary `res.cloudinary.com` URLs.
11. **Rules and backend:** order creation, payment verification, stock handling and audit logging all need a trusted backend and possibly rules changes.
