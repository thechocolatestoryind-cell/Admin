import { auth, db, collection, doc, getDoc, getDocs, updateDoc, query, where, limit, serverTimestamp, runTransaction } from "../firebase.js";
import { COL, ORDER_TRANSITIONS } from "../collections.js";
import { assertOnline } from "./util.js";
import { byNewest, STATUS_TIME_FIELD, cancellationOf } from "./order-logic.js";

const withId = d => ({ id: d.id, ...d.data() });
export async function listOrders() { return (await getDocs(collection(db, COL.orders))).docs.map(withId).sort(byNewest); }
export async function getOrder(id) { const s = await getDoc(doc(db, COL.orders, id)); return s.exists() ? withId(s) : null; }
export async function ordersForUser(uid) { return (await getDocs(query(collection(db, COL.orders), where("userId", "==", uid), limit(100)))).docs.map(withId).sort(byNewest); }

// Internal note only (+ updatedAt). Status changes go through changeOrderStatus() below, which uses a transaction.
export async function updateOrder(order, { adminNote }) {
  assertOnline();
  const patch = { updatedAt: serverTimestamp() };
  if (adminNote !== undefined) patch.adminNote = String(adminNote).slice(0, 1000);
  await updateDoc(doc(db, COL.orders, order.id), patch);
  return patch;
}

const fail = (code, message) => Object.assign(new Error(message), { code });
const adminEmail = () => (auth.currentUser && auth.currentUser.email) || "";

/**
 * Manual lifecycle step, run in a Firestore TRANSACTION so two admin tabs can't both apply conflicting changes:
 * the order is re-read, must still be in the status the admin saw (expectedStatus), and the move must be an allowed transition.
 * On any failure nothing is written and the old state is kept. Matches the order rules in firestore.rules.
 *  - confirmed (Approve Order) also records payment verification (paymentStatus=verified, paymentVerifiedAt/By).
 *  - confirmed/processing/shipped/delivered/cancelled record their own real timestamp.
 *  - cancelling an order with an open customer request marks that request accepted.
 */
export async function changeOrderStatus(orderId, expectedStatus, newStatus) {
  assertOnline();
  if (!(ORDER_TRANSITIONS[expectedStatus] || []).includes(newStatus) || newStatus === expectedStatus) throw fail("app/invalid-transition", "Not an allowed status change");
  const ref = doc(db, COL.orders, orderId), email = adminEmail();
  if (!email) throw fail("unauthenticated", "Not signed in");
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw fail("app/not-found", "Order not found");
    const cur = snap.data();
    if (cur.status !== expectedStatus) throw fail("app/stale-status", "The order changed since this page opened");
    // Older orders still carrying the legacy "pending" status keep the original simple update (no new fields).
    const patch = cur.status === "pending" ? { status: newStatus, updatedAt: serverTimestamp() } : { status: newStatus, updatedAt: serverTimestamp(), [STATUS_TIME_FIELD[newStatus]]: serverTimestamp() };
    if (newStatus === "confirmed" && cur.status !== "pending") { patch.paymentStatus = "verified"; patch.paymentVerifiedAt = serverTimestamp(); patch.paymentVerifiedBy = email; }
    const cr = cancellationOf(cur);
    if (newStatus === "cancelled" && cur.status !== "pending" && cr && cr.status === "requested") patch.cancellationRequest = { ...cr, status: "accepted", resolvedAt: serverTimestamp(), resolvedBy: email };
    tx.update(ref, patch);
  });
}

/** Accept (cancels the order) or decline a customer's cancellation request. Only the admin can apply either. */
export async function resolveCancellation(orderId, decision) {
  if (decision === "accepted") {
    const o = await getOrder(orderId); if (!o) throw fail("app/not-found", "Order not found");
    return changeOrderStatus(orderId, o.status, "cancelled");
  }
  if (decision !== "declined") throw fail("app/invalid", "Unknown decision");
  assertOnline();
  const ref = doc(db, COL.orders, orderId), email = adminEmail();
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref); if (!snap.exists()) throw fail("app/not-found", "Order not found");
    const cr = cancellationOf(snap.data());
    if (!cr || cr.status !== "requested") throw fail("app/stale-status", "There is no open cancellation request");
    tx.update(ref, { cancellationRequest: { ...cr, status: "declined", resolvedAt: serverTimestamp(), resolvedBy: email }, updatedAt: serverTimestamp() });
  });
}
