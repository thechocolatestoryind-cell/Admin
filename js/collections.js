// Canonical collection names, exactly as in the live Firestore export. Do not add parallel names.
export const COL = Object.freeze({
  users: "users",
  products: "products",
  categories: "categories",
  orders: "orders",
  reviews: "reviews",
  wishlists: "wishlists",
  siteSettings: "siteSettings",
  banners: "banners",
  highlights: "highlights",
  highlightItems: "highlightItems",
  paymentTransactions: "paymentTransactions",
  shipments: "shipments",
  customOrderRequests: "customOrderRequests",
  adminActivityLogs: "adminActivityLogs"
});
export const SUB = Object.freeze({ userAddresses: "addresses" }); // users/{uid}/addresses/{id}
export const SITE_SETTINGS_DOC_ID = "public";

// Mirrors the order rules in firestore.rules. The UI may only offer these. Manual lifecycle (no automatic progression):
// pending_payment_verification -> confirmed (Approve Order) -> processing -> shipped -> delivered. "pending" is the legacy status of older orders.
export const ORDER_TRANSITIONS = Object.freeze({
  pending_payment_verification: ["pending_payment_verification", "confirmed", "cancelled"],
  pending: ["pending", "confirmed", "cancelled"],
  confirmed: ["confirmed", "processing", "cancelled"],
  processing: ["processing", "shipped", "cancelled"],
  shipped: ["shipped", "delivered"],
  delivered: ["delivered"],
  cancelled: ["cancelled"]
});
// Orders: admin may change only these keys (rules: changedOnly).
export const ORDER_ADMIN_WRITABLE = Object.freeze(["status", "updatedAt", "adminNote", "paymentStatus", "paymentVerifiedAt", "paymentVerifiedBy", "confirmedAt", "processingAt", "shippedAt", "deliveredAt", "cancelledAt", "cancellationRequest"]);
export const CONTACT_METHODS = Object.freeze(["whatsapp", "instagram", "phone"]);
export const PRODUCT_TYPES = Object.freeze(["fixed", "customizable"]);
