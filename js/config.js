// Business constants. No secrets belong in this file.
export const ADMIN_EMAIL = "thechocolatestory.ind@gmail.com";
export const BRAND = {
  name: "The Chocolate Story",
  adminName: "Chocolate Story Admin",
  currency: "INR",
  currencySymbol: "\u20B9",
  whatsappDigits: "918847050895",
  whatsappDisplay: "+91 88470 50895",
  deliveryEstimateDays: { min: 6, max: 8 } // application default; an estimate, not a guarantee
};
export const CLOUDINARY = {
  // Used from Stage 2. Unsigned preset only - there is no API secret in this app.
  uploadUrl: "https://api.cloudinary.com/v1_1/dyt6fwvw0/image/upload",
  uploadPreset: "Wb_mobile_products"
};
