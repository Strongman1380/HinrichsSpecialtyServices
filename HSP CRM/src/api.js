const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "https://hsp-crm.web.app").replace(/\/$/, "");
import { auth } from './firebase-auth';
const pendingRequests = new Map();
export async function adminRequest(path, payload) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in as the administrator to continue.');
  const key = `hsst:pending:${auth.currentUser.uid}:${path}:${payload.action}:${payload.collection || ''}:${payload.id || payload.campaignId || 'new'}:${payload.contactId || payload.data?.contactId || ''}`;
  let pending = pendingRequests.get(key);
  try { pending ||= JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { /* memory fallback */ }
  pending ||= { payload, requestId: crypto.randomUUID() };
  pendingRequests.set(key, pending);
  try { sessionStorage.setItem(key, JSON.stringify(pending)); } catch { if (path !== '/api/summary') throw new Error('Enable session storage before saving. It protects pending saves when a response is lost.'); }
  const changed = JSON.stringify(payload) !== JSON.stringify(pending.payload);
  const response = await fetch(apiUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...pending.payload, requestId: pending.requestId }), signal: AbortSignal.timeout(30000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) { pendingRequests.delete(key); try { sessionStorage.removeItem(key); } catch { /* storage unavailable */ } }
    throw new Error(data.error || 'The operation failed. Please retry.');
  }
  pendingRequests.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* receipt still protects a replay */ }
  if (changed) window.alert(`The earlier pending save is confirmed (${data.id || 'saved record'}). Your newer edits were not applied. Reopen that record to make further changes.`);
  return data;
}

export function apiUrl(path) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function publicAppUrl(path = "") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}${path ? `/${path.replace(/^\//, "")}` : ""}`;
}
