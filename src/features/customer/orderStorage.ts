import type { OrderRecord, OrderStatus } from "../../types/customer";

const KEY = "eatlah-customer-orders";

export function loadOrders(): OrderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list: OrderRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
}

export function saveOrder(order: OrderRecord) {
  const all = loadOrders();
  all.unshift(order);
  persist(all);
}

export function clearOrders() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function updateOrders(
  patches: { id: string; status?: OrderStatus; displayNumber?: string; cancelReason?: string | null }[],
): OrderRecord[] {
  const all = loadOrders();
  const map = new Map(patches.map((p) => [p.id, p]));
  const next = all.map((o) => {
    const p = map.get(o.id);
    if (!p) return o;
    return {
      ...o,
      status: p.status ?? o.status,
      displayNumber: p.displayNumber ?? o.displayNumber,
      cancelReason: p.cancelReason ?? o.cancelReason,
    };
  });
  persist(next);
  return next;
}
