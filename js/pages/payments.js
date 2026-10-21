import { el, formatDateTime, formatINR } from "../common.js";
import { input, select, stateBox } from "../ui/forms.js";
import { badge, flags, note, pager } from "../ui/bits.js";
import { listTransactions } from "../services/payments.js";
import { listOrders } from "../services/orders.js";
import { transactionFlags } from "../services/order-logic.js";
import { describeError } from "../services/util.js";

export async function render(body) {
  let txs = [], orders = [], orderErr = "";
  const search = input({ type: "search", placeholder: "Razorpay id, order id or customer id", "aria-label": "Search transactions" });
  const fStatus = select([["", "Any status"]], ""), fFlag = select([["", "All records"], ["flagged", "Flagged only"]], "");
  for (const c of [search, fStatus, fFlag]) c.addEventListener("input", draw);
  const count = el("p", { class: "small muted", role: "status", "aria-live": "polite" }), list = el("div");
  body.append(note("Read-only. The current Firestore rules block every browser write to payment records, and no trusted Razorpay verifier is connected. This page only shows what is stored; it never marks a payment as verified."),
    el("div", { class: "toolbar" }, el("button", { class: "btn btn-quiet", type: "button", text: "Refresh", onclick: load })), el("div", { class: "filters" }, search, fStatus, fFlag), count, list);
  const orderOf = id => orders.find(o => o.id === id);
  async function load() {
    list.replaceChildren(el("p", { class: "muted", role: "status", text: "Loading transactions\u2026" }));
    try {
      txs = await listTransactions();
      try { orders = await listOrders(); orderErr = ""; } catch (e) { orders = []; orderErr = "Orders could not be loaded, so amounts and customers were not cross-checked. " + describeError(e); }
      const sts = [...new Set(txs.map(t => t.status).filter(Boolean))].sort(), keep = fStatus.value;
      fStatus.replaceChildren(el("option", { value: "", text: "Any status" }), ...sts.map(s => el("option", { value: s, text: s }))); fStatus.value = sts.includes(keep) ? keep : ""; draw();
    } catch (e) { list.replaceChildren(stateBox("Could not load payment records", describeError(e), el("button", { class: "btn", type: "button", text: "Try again", onclick: load }))); }
  }
  function draw() {
    const t = search.value.trim().toLowerCase();
    const rows = txs.map(x => ({ x, fl: transactionFlags(x, orderOf(x.orderId)) })).filter(({ x, fl }) =>
      (!t || [x.razorpayOrderId, x.razorpayPaymentId, x.orderId, x.userId, x.id].some(v => String(v || "").toLowerCase().includes(t))) && (!fStatus.value || x.status === fStatus.value) && (fFlag.value !== "flagged" || fl.length));
    count.textContent = "Showing " + rows.length + " of " + txs.length + " records." + (orderErr ? " " + orderErr : "");
    if (!txs.length) { list.replaceChildren(stateBox("No payment records", "Records are created by a trusted backend when customers pay. Nothing can be added here.")); return; }
    if (!rows.length) { list.replaceChildren(stateBox("No records match", "Try clearing a filter or the search.")); return; }
    pager(rows, 30, ({ x, fl }) => { const o = orderOf(x.orderId);
      return el("li", { class: "row-card" }, el("div", { class: "grow" },
        el("p", { class: "row-title" }, formatINR(x.amount) + " "), el("p", { class: "badges" }, badge("Status: " + (x.status || "unknown")), badge("Signature flag: " + String(x.signatureVerified === true), x.signatureVerified === true ? "badge-ok" : "badge-warn"), badge(x.provider || "provider unknown")),
        el("p", { class: "small wrap muted", text: "Razorpay order: " + (x.razorpayOrderId || "none") + " \u2013 payment: " + (x.razorpayPaymentId || "none") }),
        el("p", { class: "small muted", text: "Created " + formatDateTime(x.createdAt) + " \u2013 verified time stored: " + formatDateTime(x.verifiedAt) }),
        el("p", { class: "small" }, "Order: ", x.orderId ? el("a", { href: "order-detail.html?id=" + encodeURIComponent(x.orderId), text: o ? (o.orderNumber || x.orderId) : x.orderId }) : "none"), flags(fl))); }, list);
  }
  await load();
}
