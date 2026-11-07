import { el, toast, confirmDialog, formatDateTime, formatDate, formatINR, safeUrl } from "../common.js";
import { textarea, stateBox } from "../ui/forms.js";
import { orderBadge, payBadge, shipBadge, kv, flags, note, badge } from "../ui/bits.js";
import { getOrder, updateOrder, changeOrderStatus, resolveCancellation } from "../services/orders.js";
import { shipmentsForOrder } from "../services/shipments.js";
import { transactionsForOrder } from "../services/payments.js";
import { nextStatuses, STATUS_LABEL, ACTION_LABEL, PAYMENT_LABEL, TIMELINE, STATUS_TIME_FIELD, CANCELLABLE_STATUSES, cancellationOf, describeItem, whatsappDigits, phoneDigits, shipmentWarnings, transactionFlags } from "../services/order-logic.js";
import { describeError } from "../services/util.js";
import { BRAND } from "../config.js";

const ASK = {
  confirmed: ["Approve this order?", "Only approve after you have checked your real bank/UPI account and the money has actually arrived, and the amount matches this order's total and the current product prices. The payment will be marked Verified under your admin email.", false],
  processing: ["Start processing?", "The order will be marked Processing.", false],
  shipped: ["Mark as shipped?", "Only do this once the parcel has actually been handed to the courier. After this, the customer can no longer request cancellation. Add courier and tracking details in Shipments.", false],
  delivered: ["Mark as delivered?", "Only do this once the courier has delivered it. Delivered orders cannot be changed again.", false],
  cancelled: ["Cancel this order?", "This cannot be undone. If the customer has a cancellation request open it will be marked accepted. This app does not refund payments; handle any refund outside the app.", true]
};

export async function render(body) {
  const raw = new URLSearchParams(location.search).get("id"), id = raw && /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : null;
  const back = el("a", { class: "btn", href: "orders.html", text: "Back to orders" });
  if (!id) { body.append(stateBox("No order selected", "Open an order from the orders list.", back)); return; }
  body.append(el("p", { class: "muted", role: "status", text: "Loading order\u2026" }));
  let order;
  try { order = await getOrder(id); } catch (e) { body.replaceChildren(stateBox("Could not load this order", describeError(e), el("button", { class: "btn", type: "button", text: "Try again", onclick: () => location.reload() }), back)); return; }
  if (!order) { body.replaceChildren(stateBox("Order not found", "It may not exist or the link is wrong.", back)); return; }
  let busy = false; const root = el("div", { class: "detail-grid" }); body.replaceChildren(root);
  const shipBox = el("section", { class: "card" }, el("h2", { text: "Shipments" }), el("p", { class: "muted", text: "Loading\u2026" }));
  const payBox = el("section", { class: "card" }, el("h2", { text: "Payment records" }), el("p", { class: "muted", text: "Loading\u2026" }));
  let ships = null;

  function draw() {
    const a = order.shippingAddress || {}, items = Array.isArray(order.items) ? order.items : [], next = nextStatuses(order.status);
    const phone = order.customerPhone || a.phone, email = order.customerEmail, wa = whatsappDigits(phone), tel = phoneDigits(phone);
    const noteBox = textarea({ rows: 3, maxlength: 1000, "aria-label": "Internal note" }); noteBox.value = order.adminNote || "";
    const saveNote = el("button", { class: "btn btn-quiet", type: "button", text: "Save note", onclick: () => act(() => updateOrder(order, { adminNote: noteBox.value.trim() }), "Note saved.") });
    const cr = cancellationOf(order), openReq = cr && cr.status === "requested";
    const btnFor = st => el("button", { class: "btn " + (st === "cancelled" ? "btn-danger" : ""), type: "button", disabled: busy, text: ACTION_LABEL[st] || ("Mark " + (STATUS_LABEL[st] || st).toLowerCase()), onclick: () => change(st) });
    const statusCard = el("section", { class: "card" }, el("h2", { text: "Status" }),
      el("p", { class: "badges" }, orderBadge(order.status), payBadge(order.paymentStatus), openReq ? badge("Cancellation requested", "badge-warn") : null),
      order.status === "pending_payment_verification" ? note("Check your bank/UPI account for the customer's payment (they send a screenshot on WhatsApp, but a screenshot alone is not proof). Compare the received amount with the Total below and with current product prices. Approve only when the money has really arrived.") : null,
      next.length ? el("div", {}, el("p", { class: "small muted", text: "Next step:" }), el("div", { class: "row" }, next.map(btnFor)))
        : el("p", { class: "muted small", text: order.status in STATUS_LABEL ? "No further status changes are possible for this order." : "This order has an unrecognised status, so no changes are offered." }),
      note("Statuses change only when you click. Nothing is automatic, and the estimated delivery period never changes a status. Payment is marked Verified only by Approve Order. This app does not issue refunds."),
      el("h3", { text: "Internal note" }), noteBox, saveNote);
    const timeline = el("section", { class: "card" }, el("h2", { text: "Status history" }),
      el("ul", { class: "plain" }, TIMELINE.filter(k => k === "pending_payment_verification" || order[STATUS_TIME_FIELD[k]]).map(k => el("li", {}, el("strong", { text: STATUS_LABEL[k] }), el("p", { class: "small muted", text: formatDateTime(k === "pending_payment_verification" ? order.createdAt : order[STATUS_TIME_FIELD[k]]) + (k === "confirmed" && order.paymentVerifiedBy ? " \u2013 payment verified by " + order.paymentVerifiedBy : "") })))
        .concat(order.cancelledAt ? [el("li", {}, el("strong", { text: "Cancelled" }), el("p", { class: "small muted", text: formatDateTime(order.cancelledAt) }))] : [])));
    const cancelCard = cr ? el("section", { class: "card" }, el("h2", { text: "Cancellation request" }),
      kv([["Request status", { requested: "Awaiting your decision", accepted: "Accepted (order cancelled)", declined: "Declined" }[cr.status] || cr.status], ["Requested", formatDateTime(cr.requestedAt)], ["Customer's reason", cr.reason], ["Resolved", cr.resolvedAt ? formatDateTime(cr.resolvedAt) + (cr.resolvedBy ? " by " + cr.resolvedBy : "") : ""]]),
      openReq ? el("div", { class: "row" },
        CANCELLABLE_STATUSES.includes(order.status) ? el("button", { class: "btn btn-danger", type: "button", disabled: busy, text: "Accept and cancel order", onclick: () => decide("accepted") }) : null,
        el("button", { class: "btn btn-quiet", type: "button", disabled: busy, text: "Decline request", onclick: () => decide("declined") })) : null) : null;
    const itemsCard = el("section", { class: "card" }, el("h2", { text: "Items" }),
      items.length ? el("ul", { class: "plain" }, items.map(it => { const d = describeItem(it);
        return el("li", {}, el("strong", { class: "wrap", text: d.name }), el("span", { text: d.qty != null ? "  \u00D7 " + d.qty : "" }),
          d.unit != null ? el("p", { class: "small muted", text: formatINR(d.unit) + " each" + (d.line != null ? " \u2013 line " + formatINR(d.line) : "") }) : null,
          d.options.length ? el("p", { class: "small wrap", text: d.options.join(" \u2022 ") }) : null, d.extra ? el("p", { class: "small muted wrap", text: d.extra }) : null); }))
        : el("p", { class: "muted", text: "No item snapshot is stored on this order." }),
      kv([["Subtotal", formatINR(order.subtotal)], ["Delivery", formatINR(order.deliveryCharge)], ["Total", formatINR(order.totalAmount)], ["Currency", order.currency]]),
      note("These are the amounts saved when the order was placed. They are never recalculated from today's prices."));
    const custCard = el("section", { class: "card" }, el("h2", { text: "Customer and delivery" }),
      kv([["Name", order.customerName || a.fullName], ["Phone", phone], ["Email", email],
        ["Address", [a.addressLine1, a.addressLine2, a.landmark, a.city, a.state, a.pincode, a.country].filter(Boolean).join(", ")], ["Customer note", order.customerNote]]),
      el("div", { class: "row" },
        wa ? el("a", { class: "btn btn-quiet btn-small", href: "https://wa.me/" + wa, target: "_blank", rel: "noopener noreferrer", text: "Open WhatsApp" }) : null,
        tel.length >= 10 ? el("a", { class: "btn btn-quiet btn-small", href: "tel:+" + (tel.length === 10 ? "91" + tel : tel), text: "Call" }) : null,
        order.userId ? el("a", { class: "btn btn-quiet btn-small", href: "customers.html?id=" + encodeURIComponent(order.userId), text: "Customer profile" }) : null),
      el("p", { class: "small muted", text: "Delivery is estimated at about " + BRAND.deliveryEstimateDays.min + "\u2013" + BRAND.deliveryEstimateDays.max + " days from the order date. It is an estimate, not a guarantee." }));
    const meta = kv([["Order number", order.orderNumber], ["Order id", order.id], ["Placed", formatDateTime(order.createdAt)], ["Last updated", formatDateTime(order.updatedAt)], ["Payment method", order.paymentMethod], ["Payment status", PAYMENT_LABEL[order.paymentStatus] || order.paymentStatus], ["Payment verified", order.paymentVerifiedAt ? formatDateTime(order.paymentVerifiedAt) + (order.paymentVerifiedBy ? " by " + order.paymentVerifiedBy : "") : ""]]);
    root.replaceChildren(el("div", { class: "col" }, statusCard, cancelCard, itemsCard), el("div", { class: "col" }, el("section", { class: "card" }, el("h2", { text: order.orderNumber || "Order" }), meta), timeline, custCard, shipBox, payBox));
  }
  async function act(fn, okMsg) {
    if (busy) return; busy = true; draw();
    try { await fn(); toast(okMsg, "success"); order = await getOrder(id) || order; }
    catch (e) { toast(e.code === "app/invalid-transition" ? "That status change is not allowed for this order." : e.code === "app/stale-status" ? "This order was changed elsewhere, so nothing was saved. The latest state is shown now." : describeError(e) + (e.code === "permission-denied" ? " The order may have changed since this page opened; reload and check its status." : ""), "error"); }
    finally { if (busy) { try { order = await getOrder(id) || order; } catch (_) { /* keep last known */ } } busy = false; draw(); drawShip(); }
  }
  async function change(s) {
    const [title, message, danger] = ASK[s] || ["Change status?", "", false];
    if (!await confirmDialog({ title, message, danger, confirmText: s === "confirmed" ? "Yes, approve order" : (STATUS_LABEL[s] ? "Yes, " + STATUS_LABEL[s].toLowerCase() : "Confirm") })) return;
    await act(() => changeOrderStatus(order.id, order.status, s), s === "confirmed" ? "Order approved and payment marked verified." : "Order marked " + (STATUS_LABEL[s] || s).toLowerCase() + ".");
  }
  async function decide(d) {
    if (!await confirmDialog({ title: d === "accepted" ? "Accept cancellation and cancel order?" : "Decline cancellation request?", message: d === "accepted" ? "The order will be cancelled. This cannot be undone and no refund is issued by this app." : "The order stays active; the customer will see the request as declined.", danger: d === "accepted", confirmText: d === "accepted" ? "Yes, cancel order" : "Yes, decline" })) return;
    await act(() => resolveCancellation(order.id, d), d === "accepted" ? "Cancellation accepted; order cancelled." : "Cancellation request declined.");
  }
  function drawShip() {
    if (!ships) return;
    const warn = shipmentWarnings(order, ships.list || []);
    shipBox.replaceChildren(...[el("h2", { text: "Shipments" }),
      ships.error ? el("p", { class: "error-text", text: ships.error }) : (ships.list.length ? el("ul", { class: "plain" }, ships.list.map(s => el("li", {}, el("p", { class: "badges" }, shipBadge(s.status)),
        el("p", { class: "small wrap", text: (s.courierName || "Courier") + (s.trackingNumber ? " \u2013 " + s.trackingNumber : " \u2013 no tracking number yet") }),
        safeUrl(s.trackingURL) ? el("a", { class: "small", href: safeUrl(s.trackingURL), target: "_blank", rel: "noopener noreferrer", text: "Open tracking link" }) : null,
        el("p", { class: "small muted", text: "Shipped " + formatDate(s.shippedAt) + " \u2013 estimated " + formatDate(s.estimatedDeliveryDate) })))) : el("p", { class: "muted", text: "No shipment recorded." })),
      flags(warn), el("a", { class: "btn btn-quiet btn-small", href: "shipments.html?order=" + encodeURIComponent(id), text: ships.list && ships.list.length ? "Manage shipments" : "Add shipment" })].filter(Boolean));
  }
  draw();
  shipmentsForOrder(id).then(list => { ships = { list }; }).catch(e => { ships = { list: [], error: "Could not load shipments. " + describeError(e) }; }).then(drawShip);
  transactionsForOrder(id).then(list => {
    payBox.replaceChildren(el("h2", { text: "Earlier payment records" }), note("Read-only records from the previous online-payment system. UPI orders are verified manually with Approve Order."),
      list.length ? el("ul", { class: "plain" }, list.map(t => el("li", {}, el("p", { class: "badges" }, badge("Status: " + (t.status || "unknown")), badge("Signature flag: " + String(t.signatureVerified === true), t.signatureVerified === true ? "badge-ok" : "badge-warn")),
        el("p", { class: "small wrap", text: formatINR(t.amount) + " \u2013 " + (t.provider || "provider unknown") + (t.razorpayPaymentId ? " \u2013 " + t.razorpayPaymentId : "") }), flags(transactionFlags(t, order))))) : el("p", { class: "muted", text: "No payment record found for this order." }));
  }).catch(e => payBox.replaceChildren(el("h2", { text: "Payment records" }), el("p", { class: "error-text", text: "Could not load payment records. " + describeError(e) })));
}
