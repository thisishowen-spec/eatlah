import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { CartEntry, CustomerItem, CustomerRestaurant, OrderRecord } from "../../types/customer";
import { useLang, pickLang } from "../../i18n/LanguageContext";

export function RestaurantHero({ restaurant, onOpenHistory, showHistoryBadge }: { restaurant: CustomerRestaurant; onOpenHistory?: () => void; showHistoryBadge?: boolean }) {
  const { t, lang, toggle } = useLang();
  const navigate = useNavigate();
  const name = pickLang(restaurant.name, restaurant.nameEn, lang);
  const center = pickLang(restaurant.center, restaurant.centerEn, lang);
  return (
    <section className="customer-hero full-bleed-hero">
      <img src={restaurant.image} alt="" />
      <div className="customer-hero-actions safe-top">
        <button className="icon-btn" aria-label={t("主页")} onClick={() => navigate({ to: "/c" })}>
          <i className="ri-home-4-line" />
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {onOpenHistory && (
            <button className="icon-btn" aria-label={t("订单记录")} onClick={onOpenHistory} style={{ position: "relative" }}>
              <i className="ri-file-list-3-line" />
              {showHistoryBadge && (
                <span aria-hidden style={{ position: "absolute", top: 6, right: 6, width: 9, height: 9, borderRadius: 999, background: "#ef4444", border: "2px solid #fff", boxSizing: "content-box" }} />
              )}
            </button>
          )}
          <button className="icon-btn lang-icon-btn" aria-label="Toggle language" onClick={toggle}>
            {lang === "zh" ? "EN" : "中"}
          </button>
        </div>
      </div>
      <div className="restaurant-panel">
        <h1>{name}</h1>
        <p>{center}{restaurant.cuisine ? ` · ${restaurant.cuisine}` : ""}</p>
      </div>
    </section>
  );
}

export function CustomerCategoryTabs({
  active,
  onChange,
  items,
  renderLabel,
  searchQuery,
  onSearchChange,
}: {
  active: string;
  onChange: (category: string) => void;
  items?: string[];
  renderLabel?: (category: string) => string;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}) {
  const { t } = useLang();
  const list = items && items.length > 0 ? items : ["全部", "主食", "小吃", "饮品", "加料"];
  const searchEnabled = typeof onSearchChange === "function";
  const [searchOpen, setSearchOpen] = useState<boolean>(Boolean(searchQuery));
  return (
    <div className="customer-tabs">
      {searchEnabled && searchOpen ? (
        <div className="customer-tabs-search-wrap" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 999, padding: "8px 14px" }}>
            <i className="ri-search-line" style={{ color: "#6F7B75" }} />
            <input
              autoFocus
              value={searchQuery ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={t("搜索菜品")}
              style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 16 }}
            />
            {searchQuery && (
              <button aria-label="Clear" onClick={() => onSearchChange?.("")} style={{ background: "transparent", border: 0, color: "#6F7B75", cursor: "pointer" }}>
                <i className="ri-close-circle-fill" />
              </button>
            )}
          </div>
          <button
            className="icon-btn"
            aria-label={t("取消")}
            onClick={() => { onSearchChange?.(""); setSearchOpen(false); }}
          >
            <i className="ri-close-line" />
          </button>
        </div>
      ) : (
        <>
          <div className="customer-tabs-scroll">
            {list.map((category) => (
              <button key={category} className={category === active ? "active" : ""} onClick={() => onChange(category)}>
                {renderLabel ? renderLabel(category) : t(category)}
              </button>
            ))}
          </div>
          <button
            className="icon-btn customer-tabs-search"
            aria-label="Search"
            onClick={() => searchEnabled && setSearchOpen(true)}
          >
            <i className="ri-search-line" />
          </button>
        </>
      )}
    </div>
  );
}


export function CustomerMenuItem({ item, onOpen }: { item: CustomerItem; onOpen: () => void }) {
  const { lang } = useLang();
  return (
    <article className="customer-menu-item">
      <button className="customer-menu-copy" onClick={onOpen}>
        <h2>{pickLang(item.name, item.nameEn, lang)}</h2>
        <p>{pickLang(item.category, item.categoryEn, lang)}</p>
        <strong>${item.price.toFixed(2)}</strong>
      </button>
      <div className="customer-menu-photo">
        <img src={item.image} alt="" />
        <button onClick={onOpen}><i className="ri-add-line" /></button>
      </div>
    </article>
  );
}

export function CartBar({ count, total, onOpen }: { count: number; total: number; onOpen: () => void }) {
  const { t } = useLang();
  if (count === 0) return <div className="empty-cart sticky-bottom-bar safe-bottom">{t("点选菜品加入购物车")}</div>;
  return (
    <button className="floating-cart sticky-bottom-bar safe-bottom" onClick={onOpen}>
      <span>{t("购物车")} · {count}</span>
      <span>${total.toFixed(2)}</span>
    </button>
  );
}

export function CartLine({
  entry,
  item,
  total,
  onMinus,
  onPlus,
}: {
  entry: CartEntry;
  item: CustomerItem;
  total: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const { lang } = useLang();
  const labels = entry.options.length === 0
    ? "—"
    : entry.options
        .map((name) => {
          const o = item.options.find((opt) => opt.name === name);
          return o ? pickLang(o.name, o.nameEn, lang) : name;
        })
        .join(" + ");
  const optLabel = labels;
  return (
    <article className="cart-line">
      <div>
        <h2>{pickLang(item.name, item.nameEn, lang)}</h2>
        <p>{optLabel}</p>
        <strong>${total.toFixed(2)}</strong>
        <div className="small-qty">
          <button onClick={onMinus}>-</button>
          <span>{entry.qty}</span>
          <button onClick={onPlus}>+</button>
        </div>
      </div>
      <img src={item.image} alt="" />
    </article>
  );
}

export function PaymentModal({
  open,
  total,
  onPaid,
  onClose,
  busy,
  qrUrl,
}: {
  open: boolean;
  total: number;
  onPaid: () => void;
  onClose?: () => void;
  busy?: boolean;
  qrUrl?: string;
}) {
  const { t } = useLang();
  const qrSrc = qrUrl && qrUrl.length > 0
    ? qrUrl
    : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(`EatLah PayNow $${total.toFixed(2)}`)}`;
  return (
    <div className={`modal-backdrop ${open ? "open" : ""}`}>
      <div className="modal-card" style={{ position: "relative" }}>
        {onClose && (
          <button
            type="button"
            aria-label={t("关闭")}
            onClick={onClose}
            className="modal-close"
          >
            <i className="ri-close-line" />
          </button>
        )}
        <h2>PayNow</h2>
        <p>{t("请向商家 PayNow 付款")}<br /><b>${total.toFixed(2)}</b></p>
        <img
          className="pay-qr"
          src={qrSrc}
          alt="PayNow QR"
        />
        <button className="btn primary w-full" onClick={onPaid} disabled={busy}>
          {busy ? t("正在提交订单…") : t("已支付")}
        </button>
      </div>
    </div>
  );
}

export function LoadingOverlay({ open, text }: { open: boolean; text?: string }) {
  const { t } = useLang();
  if (!open) return null;
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-overlay-card">
        <span className="loading-spinner" aria-hidden />
        <span>{text ?? t("正在加载")}…</span>
      </div>
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReceiptCard({ order }: { order: OrderRecord }) {
  const { t } = useLang();
  const statusText = order.status === "completed" ? t("已完成")
    : order.status === "cancelled" ? t("已取消")
    : order.status === "preparing" ? t("制作中")
    : order.status === "pending_payment" ? t("请到柜台支付")
    : t("待处理");
  const statusClass = order.status === "completed" ? "done"
    : order.status === "cancelled" ? "muted"
    : order.status === "preparing" ? "info"
    : "warn";
  const num = order.displayNumber || order.id.slice(-6).toUpperCase();
  return (
    <div className="receipt-card">
      <div className="receipt-head">
        <b className="receipt-num">#{num}</b>
        <span className={`status-pill ${statusClass}`}>{statusText}</span>
      </div>
      <div className="receipt-meta">
        {t(order.restaurantName)} · {formatTime(order.createdAt)} · {t(order.serviceType)} · {order.payMethod === "cash" ? t("现金") : "PayNow"}
      </div>
      <div className="receipt-items">
        {order.items.map((it, i) => (
          <div key={i} className="receipt-item-row">
            <span>{t(it.name)} {it.option && it.option !== "标准" ? `(${t(it.option)})` : ""} x{it.qty}</span>
            <span>${it.lineTotal.toFixed(2)}</span>
          </div>
        ))}
      </div>
      {order.status === "cancelled" && (
        <div className="receipt-cancel">
          <b>{t("取消原因")}：</b>{order.cancelReason || t("商家未填写原因")}
        </div>
      )}
      {order.note && (
        <div className="receipt-note">
          <b>{t("备注")}：</b>{order.note}
        </div>
      )}
      <div className="receipt-total">
        <span>{t("合计")}</span>
        <span>${order.total.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function SuccessModal({ open, order, onDone }: { open: boolean; order: OrderRecord | null; onDone: () => void }) {
  const { t, lang } = useLang();
  if (!order) return null;
  const localised = t(order.restaurantName);
  const isCash = order.payMethod === "cash";
  const body = isCash
    ? (lang === "zh"
        ? `请到${localised}柜台支付现金，商家收款后会立即开始制作。`
        : `Please pay cash at the ${localised} counter. The shop will start preparing once paid.`)
    : (lang === "zh"
        ? `订单已提交给${localised}。请稍等，老板会尽快开始制作。`
        : `Your order has been sent to ${localised}. The shop will start preparing it shortly.`);
  return (
    <div className={`modal-backdrop ${open ? "open" : ""}`}>
      <div className="modal-card success-modal-card">
        <div className="success-icon"><i className={isCash ? "ri-cash-line" : "ri-check-line"} /></div>
        <h2 className="success-title">{isCash ? t("请到柜台支付") : t("商家正在处理")}</h2>
        <p className="success-body">{body}</p>
        <ReceiptCard order={order} />
        <button className="btn primary w-full success-done-btn" onClick={onDone}>{t("完成")}</button>
      </div>
    </div>
  );
}

export function OrderHistoryScreen({ orders, onBack, onClear }: { orders: OrderRecord[]; onBack: () => void; onClear: () => void }) {
  const { t } = useLang();
  return (
    <section className="screen customer-screen">
      <div className="cart-page">
        <div className="stack-header">
          <button className="icon-btn" aria-label="Back" onClick={onBack}><i className="ri-arrow-left-s-line" /></button>
          <h1>{t("订单记录")}</h1>
          {orders.length > 0 && <button className="clear-btn" onClick={onClear}><i className="ri-delete-bin-line" />{t("清空")}</button>}
        </div>
        <div className="cart-list">
          {orders.length === 0 ? (
            <section className="soft-panel"><h2>{t("暂无订单")}</h2><p>{t("下单后可在这里查看历史记录。")}</p></section>
          ) : orders.map((order) => <ReceiptCard key={order.id} order={order} />)}
        </div>
      </div>
    </section>
  );
}


