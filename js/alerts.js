// Live "needs attention" markers for the menu: red count on Orders / Custom requests / Reviews,
// and a red dot on the mobile menu button. Read-only: it only listens to data the dashboard already reads.
// If anything here fails, the page keeps working and simply shows no markers.
import { db, collection, query, where, onSnapshot } from "./firebase.js";
import { COL } from "./collections.js";

const SEEN_KEY = "tcs-admin-seen-reviews";      // only used for reviews (see below)
const toMs = v => { try { const d = v && typeof v.toDate === "function" ? v.toDate() : (v ? new Date(v) : null); const t = d ? d.getTime() : NaN; return Number.isFinite(t) ? t : 0; } catch (_) { return 0; } };
const readSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch (_) { return 0; } };
const writeSeen = () => { try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch (_) { /* storage blocked: ignore */ } };

export function startNavAlerts({ sidebar, menuBtn, pageKey, toast }) {
  if (!sidebar || !menuBtn) return;
  const baseTitle = document.title;
  const counts = { orders: 0, requests: 0, reviews: 0 };
  const loaded = { orders: false, requests: false, reviews: false };
  const LABEL = { orders: "New order needs your attention.", requests: "New custom request received.", reviews: "New review is waiting." };
  const LINKS = { orders: "orders.html", requests: "custom-orders.html", reviews: "reviews.html" };

  const dot = document.createElement("span");
  dot.className = "menu-dot"; dot.hidden = true; dot.setAttribute("aria-hidden", "true");
  menuBtn.append(dot);

  const paint = () => {
    for (const k of Object.keys(LINKS)) {
      const a = sidebar.querySelector('a.nav-link[href="' + LINKS[k] + '"]');
      if (!a) continue;
      let b = a.querySelector(".nav-badge");
      if (!counts[k]) { if (b) b.remove(); continue; }
      if (!b) { b = document.createElement("span"); b.className = "nav-badge"; a.append(b); }
      b.textContent = counts[k] > 99 ? "99+" : String(counts[k]);
      b.setAttribute("aria-label", counts[k] + " need attention");
    }
    const total = counts.orders + counts.requests + counts.reviews;
    dot.hidden = !total;
    menuBtn.setAttribute("aria-label", total ? "Open menu (" + total + " need attention)" : "Open menu");
    document.title = (total ? "(" + total + ") " : "") + baseTitle;
    try { if (navigator.setAppBadge) { total ? navigator.setAppBadge(total) : navigator.clearAppBadge(); } } catch (_) { /* not supported */ }
  };

  const update = (key, n) => {
    const rose = loaded[key] && n > counts[key];
    counts[key] = n; loaded[key] = true; paint();
    if (rose && typeof toast === "function") toast(LABEL[key], "info");
  };
  const listen = (key, q, count) => onSnapshot(q, snap => update(key, count(snap)), () => { /* permission/network: show nothing */ });

  // Orders: same rule as the dashboard's "Need your attention" (payment to verify + confirmed + processing).
  listen("orders", query(collection(db, COL.orders), where("status", "in", ["pending_payment_verification", "pending", "confirmed", "processing"])), s => s.size);
  // Custom requests: status "new".
  listen("requests", query(collection(db, COL.customOrderRequests), where("status", "==", "new")), s => s.size);
  // Reviews: waiting reviews that arrived since this device last opened the Reviews page.
  // (A hidden review is stored the same way as a waiting one, so a plain count would never clear.)
  if (pageKey === "reviews") writeSeen();
  listen("reviews", query(collection(db, COL.reviews), where("isApproved", "==", false)), s => {
    if (pageKey === "reviews") { writeSeen(); return 0; }
    const seen = readSeen();
    return s.docs.filter(d => toMs(d.data().createdAt) > seen).length;
  });
}
