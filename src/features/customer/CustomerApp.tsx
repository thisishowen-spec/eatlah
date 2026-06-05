import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { IconButton, MobileShell, StatusBar } from "../../components/MobileShell";
import { useLang, pickLang } from "../../i18n/LanguageContext";
import { customerItems as mockItems, customerRestaurant as mockRestaurant } from "../../mock/customerData";
import type { CartEntry, CustomerItem, CustomerPage, CustomerRestaurant, OrderRecord, OrderStatus } from "../../types/customer";
import { getCustomerOrderStatuses, submitCustomerOrder } from "../../lib/storefront.functions";
import { CartBar, CartLine, CustomerCategoryTabs, CustomerMenuItem, LoadingOverlay, OrderHistoryScreen, PaymentModal, RestaurantHero, SuccessModal } from "./components";
import { ImageMenuScreen, ImageMenuDetailSheet } from "./ImageMenuScreens";
import { clearOrders, loadOrders, saveOrder, updateOrders } from "./orderStorage";

function optionPrice(item: CustomerItem, optionName: string) {
  return item.options.find((option) => option.name === optionName)?.price || 0;
}

function sumOptionsPrice(item: CustomerItem, optionNames: string[]) {
  return optionNames.reduce((sum, name) => sum + optionPrice(item, name), 0);
}

function optionsKey(options: string[]) {
  return [...options].sort().join("|");
}

type CustomerAppProps = {
  restaurant?: CustomerRestaurant;
  restaurantId?: string | null;
  items?: CustomerItem[];
  menuTemplate?: "classic" | "image";
};

export function CustomerApp({ restaurant, restaurantId, items, menuTemplate = "classic" }: CustomerAppProps = {}) {
  const { t, lang } = useLang();
  const customerRestaurant = restaurant ?? mockRestaurant;
  const customerItems = items ?? mockItems;
  const [page, setPage] = useState<CustomerPage>("menu");
  const [category, setCategory] = useState("全部");
  const [selectedItemId, setSelectedItemId] = useState<string>(customerItems[0]?.id ?? "");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [detailQty, setDetailQty] = useState(1);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [serviceType, setServiceType] = useState<"堂食" | "外带">("堂食");
  const [note, setNote] = useState("");
  const [payMethod, setPayMethod] = useState<"paynow" | "cash">("paynow");
  const [payOpen, setPayOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<OrderRecord | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [seenCancelledIds, setSeenCancelledIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem("eatlah-seen-cancelled");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });
  useEffect(() => { setOrders(loadOrders()); }, []);

  // 后端订单状态轮询：当存在未终结订单时，每 5s 同步一次
  const callGetStatuses = useServerFn(getCustomerOrderStatuses);
  const pollingRef = useRef<number | null>(null);
  const activeIdsKey = useMemo(() => {
    const FINAL = new Set<OrderStatus>(["completed", "cancelled"]);
    return orders
      .filter((o) => /^[0-9a-f-]{36}$/i.test(o.id) && !FINAL.has(o.status))
      .map((o) => o.id)
      .sort()
      .join(",");
  }, [orders]);
  useEffect(() => {
    if (!activeIdsKey) return;
    const ids = activeIdsKey.split(",");
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await callGetStatuses({ data: { ids: ids.slice(0, 50) } });
        if (cancelled) return;
        const STATUS_MAP: Record<string, OrderStatus> = {
          pending: "pending", preparing: "preparing", completed: "completed", cancelled: "cancelled",
        };
        const patches = res.orders.map((o) => ({
          id: o.id,
          status: STATUS_MAP[o.status] ?? "pending",
          displayNumber: o.display_number,
          cancelReason: o.cancel_reason,
        }));
        const next = updateOrders(patches);
        setOrders(next);
        setLastOrder((prev) => {
          if (!prev) return prev;
          const updated = next.find((o) => o.id === prev.id);
          return updated ?? prev;
        });
      } catch {
        // ignore
      }
    };
    void poll();
    const id = window.setInterval(poll, 5000);
    pollingRef.current = id as unknown as number;
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeIdsKey, callGetStatuses]);

  const fallbackItem: CustomerItem = { id: "", name: "", category: "", price: 0, image: "", description: "", options: [] };
  const selectedItem = customerItems.find((item) => item.id === selectedItemId) || customerItems[0] || fallbackItem;
  const cartCount = cart.reduce((sum, entry) => sum + entry.qty, 0);
  const cartTotal = cart.reduce((sum, entry) => {
    const item = customerItems.find((candidate) => candidate.id === entry.itemId);
    if (!item) return sum;
    return sum + (item.price + sumOptionsPrice(item, entry.options)) * entry.qty;
  }, 0);
  const detailTotal = (selectedItem.price + sumOptionsPrice(selectedItem, selectedOptions)) * detailQty;
  const categoryEnMap = useMemo(() => {
    const m = new Map<string, string>();
    customerItems.forEach((i) => { if (i.categoryEn) m.set(i.category, i.categoryEn); });
    return m;
  }, [customerItems]);
  const categoryItems = useMemo(
    () => ["全部", ...Array.from(new Set(customerItems.map((i) => i.category)))],
    [customerItems],
  );
  const renderCategory = (cat: string) => cat === "全部" ? t("全部") : pickLang(cat, categoryEnMap.get(cat) ?? "", lang);

  const openDetail = (item: CustomerItem) => {
    setSelectedItemId(item.id);
    setSelectedOptions([]);
    setDetailQty(1);
    setPage("detail");
  };

  const toggleSelectedOption = (name: string) => {
    setSelectedOptions((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
  };

  const addCart = () => {
    const opts = [...selectedOptions];
    setCart((current) => {
      const key = optionsKey(opts);
      const existing = current.find((entry) => entry.itemId === selectedItem.id && optionsKey(entry.options) === key);
      if (existing) {
        return current.map((entry) => entry === existing ? { ...entry, qty: entry.qty + detailQty } : entry);
      }
      return [...current, { itemId: selectedItem.id, options: opts, qty: detailQty }];
    });
    setPage("menu");
  };

  const updateCart = (entry: CartEntry, delta: number) => {
    const key = optionsKey(entry.options);
    setCart((current) => current
      .map((candidate) => candidate.itemId === entry.itemId && optionsKey(candidate.options) === key ? { ...candidate, qty: candidate.qty + delta } : candidate)
      .filter((candidate) => candidate.qty > 0));
  };

  const buildOrder = (status: OrderRecord["status"]): OrderRecord => {
    const recordItems = cart.map((entry) => {
      const item = customerItems.find((c) => c.id === entry.itemId);
      const unit = (item?.price ?? 0) + (item ? sumOptionsPrice(item, entry.options) : 0);
      const optionLabel = entry.options.length > 0 ? entry.options.join(" + ") : "标准";
      return {
        name: item?.name ?? entry.itemId,
        option: optionLabel,
        qty: entry.qty,
        unitPrice: unit,
        lineTotal: unit * entry.qty,
      };
    });
    return {
      id: (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `o-${Date.now()}`),
      restaurantName: customerRestaurant.name,
      createdAt: Date.now(),
      serviceType,
      payMethod,
      note: note.trim() || undefined,
      items: recordItems,
      total: cartTotal,
      status,
    };
  };

  const callSubmitOrder = useServerFn(submitCustomerOrder);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const persistOrder = (order: OrderRecord) => {
    saveOrder(order);
    setOrders((prev) => [order, ...prev]);
    setLastOrder(order);
    setSuccessOpen(true);
  };

  const syncOrderToBackend = async (status: OrderRecord["status"]): Promise<OrderRecord | null> => {
    const base = buildOrder(status);
    setSubmitError(null);
    if (!restaurantId) {
      // No backend restaurant (mock/preview) — keep local only
      persistOrder(base);
      return base;
    }
    try {
      setSubmitting(true);
      const payload = {
        restaurantId,
        serviceType,
        payMethod,
        note: note.trim() || undefined,
        items: cart.map((entry) => {
          const item = customerItems.find((c) => c.id === entry.itemId);
          const selectedOpts = entry.options
            .map((name) => item?.options.find((o) => o.name === name))
            .filter((o): o is NonNullable<typeof o> => !!o && o.name !== "标准");
          return {
            menuItemId: item?.id ?? null,
            nameSnapshot: item?.name ?? entry.itemId,
            unitPrice: item?.price ?? 0,
            quantity: entry.qty,
            options: selectedOpts.map((o) => ({ nameSnapshot: o.name, priceDelta: o.price })),
          };
        }),
      };
      const res = await callSubmitOrder({ data: payload });
      const order: OrderRecord = { ...base, id: res.id, displayNumber: res.displayNumber };
      persistOrder(order);
      return order;
    } catch (e) {
      console.error("submit order failed", e);
      setSubmitError(t("订单提交失败，请重试。"));
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const isClosed = customerRestaurant.isOpen === false;

  const submitOrder = () => {
    if (cart.length === 0 || submitting || isClosed) return;
    if (payMethod === "cash") {
      void syncOrderToBackend("pending_payment");
    } else {
      setPayOpen(true);
    }
  };

  const confirmPaid = () => {
    setPayOpen(false);
    void syncOrderToBackend("pending");
  };


  const cancelledIds = useMemo(
    () => orders.filter((o) => o.status === "cancelled").map((o) => o.id),
    [orders],
  );
  const hasUnseenCancelled = useMemo(
    () => cancelledIds.some((id) => !seenCancelledIds.has(id)),
    [cancelledIds, seenCancelledIds],
  );
  const openOrders = () => {
    if (cancelledIds.length > 0) {
      const next = new Set(seenCancelledIds);
      cancelledIds.forEach((id) => next.add(id));
      setSeenCancelledIds(next);
      if (typeof window !== "undefined") {
        try { window.localStorage.setItem("eatlah-seen-cancelled", JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      }
    }
    setPage("orders");
  };

  const menuScreen = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const items = customerItems.filter((item) => {
      if (category !== "全部" && item.category !== category) return false;
      if (!q) return true;
      const hay = [item.name, item.nameEn, item.category, item.categoryEn, item.description, item.descriptionEn]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
    return (
      <section className="screen customer-screen">
        <StatusBar light />
        <div className="scroll customer-scroll">
          <RestaurantHero restaurant={customerRestaurant} onOpenHistory={openOrders} showHistoryBadge={hasUnseenCancelled} />
          {isClosed && (
            <section className="soft-panel" style={{ borderLeft: "4px solid #e85d3a", background: "#fff5f0" }}>
              <h2>{t("店铺已打烊")}</h2>
              <p>{t("请在营业时间内下单，敬请期待再次光临。")}</p>
            </section>
          )}
          <CustomerCategoryTabs active={category} onChange={setCategory} items={categoryItems} renderLabel={renderCategory} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          <section className="customer-list">
            <h2>{q ? `${t("搜索")}: "${searchQuery}"` : `${renderCategory(category)}${t("菜品")}`}</h2>
            {items.length === 0 ? (
              <section className="soft-panel"><h2>{q ? t("没有匹配的菜品") : t("暂无菜品")}</h2><p>{q ? t("试试其他关键词。") : t("商家正在准备菜单，请稍后再来。")}</p></section>
            ) : items.map((item) => <CustomerMenuItem key={item.id} item={item} onOpen={() => openDetail(item)} />)}
          </section>
        </div>
        {!isClosed && <CartBar count={cartCount} total={cartTotal} onOpen={() => setPage("cart")} />}
      </section>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, cartCount, cartTotal, t, customerItems, customerRestaurant, categoryItems, isClosed, searchQuery, hasUnseenCancelled]);

  const detailScreen = (
    <section className="screen customer-screen">
      <StatusBar light />
      <section className="detail-hero full-bleed-hero">
        <img src={selectedItem.image} alt="" />
        <IconButton icon="ri-close-line" label="Close" className="safe-top" onClick={() => setPage("menu")} />
      </section>
      <section className="customer-detail-sheet">
        <h1>{pickLang(selectedItem.name, selectedItem.nameEn, lang)}</h1>
        <strong>${selectedItem.price.toFixed(2)}</strong>
        <p>{pickLang(selectedItem.description, selectedItem.descriptionEn, lang)}</p>
        {selectedItem.options.filter((o) => o.name !== "标准").length > 0 && (
          <section className="option-card">
            <div className="flex items-center justify-between">
              <h2>{t("可选项")}</h2>
              <span>{t("多选")}</span>
            </div>
            {selectedItem.options.filter((o) => o.name !== "标准").map((option) => {
              const checked = selectedOptions.includes(option.name);
              return (
                <button key={option.name} type="button" onClick={() => toggleSelectedOption(option.name)} className="option-row">
                  <span>{pickLang(option.name, option.nameEn, lang)}{option.price ? ` +$${option.price.toFixed(2)}` : ""}</span>
                  <span
                    aria-hidden
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: checked ? "2px solid #0B7A53" : "2px solid #cbd5e1",
                      background: checked ? "#0B7A53" : "#fff",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 14, fontWeight: 800,
                    }}
                  >{checked ? "✓" : ""}</span>
                </button>
              );
            })}
          </section>
        )}
      </section>
      <div className="detail-bottom customer sticky-bottom-bar safe-bottom">
        <div className="qty">
          <button onClick={() => setDetailQty((value) => Math.max(1, value - 1))}>-</button>
          <span>{detailQty}</span>
          <button onClick={() => setDetailQty((value) => value + 1)}>+</button>
        </div>
        <button className="btn primary flex-1 justify-between" onClick={addCart}>
          <span>{t("加入购物车")}</span>
          <span>${detailTotal.toFixed(2)}</span>
        </button>
      </div>
    </section>
  );

  const cartScreen = (
    <section className="screen customer-screen">
      <StatusBar />
      <div className="cart-page">
        <div className="stack-header">
          <IconButton icon="ri-arrow-left-s-line" label="Back" onClick={() => setPage("menu")} />
          <h1>{t("购物车")}</h1>
          {cart.length > 0 && <button className="clear-btn" onClick={() => setCart([])}><i className="ri-delete-bin-line" />{t("清空")}</button>}
        </div>
        <div className="cart-list">
          {cart.length === 0 ? (
            <section className="soft-panel"><h2>{t("购物车是空的")}</h2><p>{t("先回到菜单选择想吃的菜品。")}</p></section>
          ) : cart.map((entry) => {
            const item = customerItems.find((candidate) => candidate.id === entry.itemId);
            if (!item) return null;
            const total = (item.price + sumOptionsPrice(item, entry.options)) * entry.qty;
            const key = `${entry.itemId}-${optionsKey(entry.options)}`;
            return <CartLine key={key} entry={entry} item={item} total={total} onMinus={() => updateCart(entry, -1)} onPlus={() => updateCart(entry, 1)} />;
          })}
        </div>
      </div>
      <div className="cart-bottom sticky-bottom-bar safe-bottom">
        <div><span>{t("合计")}</span><b>${cartTotal.toFixed(2)}</b></div>
        <button className="btn primary" disabled={cart.length === 0} onClick={() => setPage("checkout")}>{t("去下单")}</button>
      </div>
    </section>
  );

  const checkoutScreen = (
    <section className="screen customer-screen">
      <StatusBar />
      <div className="checkout-page">
        <div className="stack-header">
          <IconButton icon="ri-arrow-left-s-line" label="Back" onClick={() => setPage("cart")} />
          <h1>{t("结账")}</h1>
        </div>
        <div className="service-toggle">
          {(["堂食", "外带"] as const).map((type) => <button key={type} className={serviceType === type ? "active" : ""} onClick={() => setServiceType(type)}>{t(type)}</button>)}
        </div>
        <section className="summary-card">
          <h2>{t("订单摘要")}</h2>
          <div className="summary-shop">
            <img src={customerRestaurant.image} alt="" />
            <div><b>{pickLang(customerRestaurant.name, customerRestaurant.nameEn, lang)}</b><p>{cartCount} {t("件商品")}</p></div>
          </div>
          {cart.map((entry) => {
            const item = customerItems.find((candidate) => candidate.id === entry.itemId);
            if (!item) return null;
            const total = (item.price + sumOptionsPrice(item, entry.options)) * entry.qty;
            const key = `${entry.itemId}-${optionsKey(entry.options)}`;
            return <div key={key} className="summary-row"><span>{pickLang(item.name, item.nameEn, lang)} x{entry.qty}</span><span>${total.toFixed(2)}</span></div>;
          })}
          <div className="summary-row"><span>{t("服务方式")}</span><span>{t(serviceType)}</span></div>
          {note.trim() && <div className="summary-row"><span>{t("备注")}</span><span className="summary-note">{note.trim()}</span></div>}
          <div className="summary-row total"><span>{t("合计")}</span><span>${cartTotal.toFixed(2)}</span></div>
        </section>
        <section className="note-card">
          <div className="note-card-head">
            <h2>{t("备注")}</h2>
            <span className="note-count">{note.length}/100</span>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 100))}
            maxLength={100}
            placeholder={t("口味要求、忌口等（选填）")}
          />
        </section>
        <section className="pay-method-card">
          <h2>{t("支付方式")}</h2>
          <div className="pay-method-options">
            {([
              { id: "paynow", icon: "ri-qr-code-line", label: "PayNow" },
              { id: "cash", icon: "ri-cash-line", label: t("现金") },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                className={`pay-method-option ${payMethod === opt.id ? "active" : ""}`}
                onClick={() => setPayMethod(opt.id)}
              >
                <i className={opt.icon} />
                <span>{opt.label}</span>
                <span className={`radio ${payMethod === opt.id ? "active" : ""}`} />
              </button>
            ))}
          </div>
        </section>
        {submitError && (
          <section className="soft-panel" style={{ borderLeft: "4px solid #e85d3a", background: "#fff5f0" }}>
            <h2>{t("下单未成功")}</h2>
            <p>{submitError}</p>
          </section>
        )}
      </div>
      <div className="checkout-bottom sticky-bottom-bar safe-bottom">
        <div><span>{t("合计")}</span><b>${cartTotal.toFixed(2)}</b></div>
        <button className="btn primary" onClick={submitOrder} disabled={isClosed || submitting}>
          <i className={payMethod === "cash" ? "ri-cash-line" : "ri-qr-code-line"} />{isClosed ? t("店铺已打烊") : t("支付")}
        </button>
      </div>

      <PaymentModal open={payOpen} total={cartTotal} onPaid={confirmPaid} onClose={() => setPayOpen(false)} busy={submitting} qrUrl={customerRestaurant.paynowQrUrl} />
      <SuccessModal open={successOpen} order={lastOrder} onDone={() => { setSuccessOpen(false); setCart([]); setNote(""); setLastOrder(null); setPage("menu"); }} />
      <LoadingOverlay open={submitting && !payOpen} text={t("正在提交订单…")} />

    </section>
  );

  const ordersScreen = (
    <OrderHistoryScreen
      orders={orders}
      onBack={() => setPage("menu")}
      onClear={() => { clearOrders(); setOrders([]); }}
    />
  );

  const quickAddItem = (item: CustomerItem) => {
    setCart((current) => {
      const key = optionsKey([]);
      const existing = current.find((entry) => entry.itemId === item.id && optionsKey(entry.options) === key);
      if (existing) {
        return current.map((entry) => entry === existing ? { ...entry, qty: entry.qty + 1 } : entry);
      }
      return [...current, { itemId: item.id, options: [], qty: 1 }];
    });
  };

  const imageMenuScreen = (
    <ImageMenuScreen
      restaurant={customerRestaurant}
      items={customerItems}
      category={category}
      setCategory={setCategory}
      categoryItems={categoryItems}
      renderCategory={renderCategory}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      cartCount={cartCount}
      cartTotal={cartTotal}
      isClosed={isClosed}
      hasUnseenCancelled={hasUnseenCancelled}
      onOpenOrders={openOrders}
      onOpenCart={() => setPage("cart")}
      onOpenDetail={openDetail}
      onQuickAdd={quickAddItem}
    />
  );

  const imageDetailScreen = (
    <ImageMenuDetailSheet
      item={selectedItem}
      selectedOptions={selectedOptions}
      toggleOption={toggleSelectedOption}
      detailQty={detailQty}
      setDetailQty={setDetailQty}
      detailTotal={detailTotal}
      onAdd={addCart}
      onClose={() => setPage("menu")}
    />
  );

  let current: React.ReactNode;
  if (menuTemplate === "image" && page === "menu") current = imageMenuScreen;
  else if (menuTemplate === "image" && page === "detail") current = imageDetailScreen;
  else if (page === "detail") current = detailScreen;
  else if (page === "cart") current = cartScreen;
  else if (page === "checkout") current = checkoutScreen;
  else if (page === "orders") current = ordersScreen;
  else current = menuScreen;

  return <MobileShell caption="Customer · 390 x 844">{current}</MobileShell>;
}
