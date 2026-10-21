# Admin security notes

1. **The email check in the browser is only a UI gate.** Anyone can edit JavaScript in their own browser. Real protection is the Firestore rules (`isAdmin()` requires a verified Google sign-in for the owner email). Keep those rules deployed.
2. Google sign-in only. The guard (`js/auth.js`) requires: provider `google.com`, a verified email, and an exact match with the owner email. Other accounts get an access-denied screen and no data is requested.
3. No admin flag is stored in localStorage/sessionStorage. Firebase's own session is the identity source.
4. If Firestore returns `permission-denied`, pages must show that truthfully rather than faking success.
5. No secrets in this project: no Razorpay secret, Cloudinary API secret or service-account JSON. The Firebase web config is public by design; the Cloudinary upload preset (Stage 2) is unsigned and **must be restricted in the Cloudinary dashboard** (allowed formats, folder, size).
6. Database text is rendered with `textContent` only. External links must pass `safeUrl()` (http/https).
7. The service worker caches only the static shell listed in `sw.js`, never Firestore data, tokens, or other-origin requests.
8. Needs a trusted backend (not provided): Razorpay order creation/signature verification/webhooks, audit-log writing, safe stock reservation, courier APIs, email sending.
9. Add your hosting domain under Firebase Console → Authentication → Settings → Authorized domains, or Google sign-in will fail with `auth/unauthorized-domain`.
10. Cloudinary: uploads are unsigned, so anyone who learns the preset name could upload to your account. In Cloudinary settings restrict the preset (allowed formats, max size, a fixed folder) and keep an eye on usage. Images removed in the admin stay in Cloudinary.
11. Order status is checked in the browser AND by the rules. If the page's copy is stale the rules may reject a change; the app reports that instead of pretending it worked. Refunds, payment verification and courier updates all happen outside this app.
12. Customer contact links: WhatsApp and phone links are built only from digits; 10-digit numbers are assumed to be Indian mobiles (+91).
13. Links entered for banners, slides and buttons are limited to site paths or http(s) addresses, and external links shown in the panel go through `safeUrl()`. Instagram settings accept only instagram.com links.
14. Review moderation and request notes are admin-only writes of single fields; the app never edits customer-submitted text, images or contact details.
