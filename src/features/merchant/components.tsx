import { useEffect, useState, type ReactNode } from "react";
import { IconButton } from "../../components/MobileShell";
import { useLang } from "../../i18n/LanguageContext";
import type { MerchantDish, MerchantOrder, MessageThread, Shop } from "../../types/merchant";
import { HawkerCenterPicker, type HawkerCenterOption } from "./HawkerCenterPicker";

const SG_DATE_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" });
const SG_TIME_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", hour12: false });
const SG_MD_FMT_ZH = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Singapore", month: "numeric", day: "numeric" });
const SG_MD_FMT_EN = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", month: "short", day: "numeric" });

function formatOrderTime(order: MerchantOrder, t: (s: string) => string, lang: string): string {
  const iso = order.submittedAt;
  if (!iso) return `${t("今天")} ${order.time}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return `${t("今天")} ${order.time}`;
  const time = SG_TIME_FMT.format(d);
  const dayKey = SG_DATE_FMT.format(d);
  const now = new Date();
  const todayKey = SG_DATE_FMT.format(now);
  const yesterdayKey = SG_DATE_FMT.format(new Date(now.getTime() - 86400000));
  if (dayKey === todayKey) return `${t("今天")} ${time}`;
  if (dayKey === yesterdayKey) return `${t("昨天")} ${time}`;
  const label = lang === "en" ? SG_MD_FMT_EN.format(d) : SG_MD_FMT_ZH.format(d);
  return `${label} ${time}`;
}

export function PageHeader({
  title,
  status,
  meta,
  right,
}: {
  title: string;
  status?: string;
  meta?: string;
  right?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {(status || meta) && (
          <p>
            {status && <span className="text-priceOrange">{status}</span>}
            {status && meta ? " · " : ""}
            {meta}
          </p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}

export function StackHeader({
  title,
  meta,
  onBack,
}: {
  title: string;
  meta?: string;
  onBack: () => void;
}) {
  return (
    <header className="stack-header">
      <IconButton icon="ri-arrow-left-s-line" label="Back" onClick={onBack} />
      <div>
        <h1>{title}</h1>
        {meta && <p>{meta}</p>}
      </div>
    </header>
  );
}

export function CategoryTabs({
  items,
  active,
  onChange,
}: {
  items: string[];
  active: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLang();
  return (
    <div className="category-tabs">
      {items.map((item) => (
        <button key={item} className={item === active ? "active" : ""} onClick={() => onChange(item)}>
          {t(item)}
        </button>
      ))}
    </div>
  );
}

export function AvailabilityToggle({
  available,
  onChange,
  large = false,
}: {
  available: boolean;
  onChange: (available: boolean) => void;
  large?: boolean;
}) {
  const { t } = useLang();
  return (
    <div className={`availability-toggle ${large ? "large" : ""}`}>
      <button className={available ? "active" : ""} onClick={(event) => { event.stopPropagation(); onChange(true); }}>
        {large && <i className="ri-checkbox-circle-line" />} {large ? t("有货") : t("有")}
      </button>
      <button className={!available ? "active unavailable" : "unavailable"} onClick={(event) => { event.stopPropagation(); onChange(false); }}>
        {large && <i className="ri-close-circle-line" />} {large ? t("售罄") : t("无")}
      </button>
    </div>
  );
}

export function MenuItemCard({
  item,
  onOpen,
  onAvailabilityChange,
}: {
  item: MerchantDish;
  onOpen: () => void;
  onAvailabilityChange: (available: boolean) => void;
}) {
  const { t } = useLang();
  return (
    <article className="merchant-menu-item" onClick={onOpen}>
      <img src={item.image} alt="" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h2>{t(item.name)}</h2>
          <strong>${item.price}</strong>
        </div>
        <AvailabilityToggle available={item.available} onChange={onAvailabilityChange} />
      </div>
      <i className="ri-arrow-right-s-line text-3xl text-muted/60" />
    </article>
  );
}

export function BottomActionBar({
  secondary,
  primary,
  onSecondary,
  onPrimary,
  onSecondaryHover,
  className = "",
}: {
  secondary: ReactNode;
  primary: ReactNode;
  onSecondary: () => void;
  onPrimary: () => void;
  onSecondaryHover?: () => void;
  className?: string;
}) {
  return (
    <div className={`bottom-action-bar sticky-bottom-bar safe-bottom ${className}`}>
      <button
        className="btn secondary"
        onClick={onSecondary}
        onPointerEnter={onSecondaryHover}
        onTouchStart={onSecondaryHover}
      >
        {secondary}
      </button>
      <button className="btn primary" onClick={onPrimary}>{primary}</button>
    </div>
  );
}

export function TabBar({ active, onChange }: { active: string; onChange: (page: "home" | "menu" | "orders" | "me") => void }) {
  const { t } = useLang();
  const tabs = [
    ["home", "ri-layout-grid-fill", "首页"],
    ["menu", "ri-file-list-3-line", "菜单"],
    ["orders", "ri-receipt-line", "订单"],
    ["me", "ri-user-3-line", "我的"],
  ] as const;

  return (
    <nav className="tabbar sticky-bottom-bar safe-bottom">
      {tabs.map(([key, icon, label]) => (
        <button key={key} className={active === key ? "active" : ""} onClick={() => onChange(key)}>
          <i className={icon} />
          <span>{t(label)}</span>
        </button>
      ))}
    </nav>
  );
}

export function OrderCard({
  order,
  compact = false,
  onStart,
  onFinish,
  onCancel,
}: {
  order: MerchantOrder;
  compact?: boolean;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const { t, lang } = useLang();
  const done = order.status === "已完成" || order.status === "已取消";
  const statusClass = order.status === "待处理" ? "warn"
    : order.status === "制作中" ? "info"
    : order.status === "已完成" ? "done"
    : "muted";
  const payLabel = order.paymentMethod === "paynow" ? "PayNow" : t("现金");
  return (
    <article className={compact ? "soft-panel order-card-pro" : "order-card order-card-pro"}>
      <div className="order-card-head">
        <div className="order-card-head-left">
          <h2>#{order.displayNumber}</h2>
          <span className={`order-type ${order.type === "外带" ? "takeaway" : ""}`}>{t(order.type)}</span>
          <span className={`pay-pill ${order.paymentMethod}`}>{payLabel}</span>
        </div>
        <span className={`status-pill ${statusClass}`}>{t(order.status)}</span>
      </div>
      <p className="order-time">{formatOrderTime(order, t, lang)}</p>
      <div className="order-items">
        {order.items.map(([name, qty]) => (
          <div key={name} className="order-item-row">
            <span>{t(name)}</span>
            <span>x{qty}</span>
          </div>
        ))}
      </div>
      {order.note && <p className="order-note">{t("备注")}：{t(order.note)}</p>}
      {order.status === "已取消" && order.cancelReason && (
        <p className="order-note order-cancel-reason">
          <i className="ri-close-circle-line" /> {t("取消原因")}：{t(order.cancelReason)}
        </p>
      )}
      {!done && (
        <div className={`order-actions ${order.status === "待处理" ? "two" : "one"}`}>
          <button className="btn primary" onClick={order.status === "待处理" ? onStart : onFinish}>
            {order.status === "待处理" ? t("开始制作") : t("完成")}
          </button>
          {order.status === "待处理" && <button className="btn secondary" onClick={onCancel}>{t("取消订单")}</button>}
        </div>
      )}
    </article>
  );
}

export function MessageItem({ thread, onOpen }: { thread: MessageThread; onOpen: () => void }) {
  const { t } = useLang();
  return (
    <button className={`message-item ${thread.unread ? "unread" : ""}`} onClick={onOpen}>
      <span className={`message-avatar ${thread.tone}`}><i className={thread.icon} /></span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <b>{t(thread.title)}</b>
          <em>{t(thread.kind)}</em>
        </span>
        <span className="block truncate text-sm font-semibold text-muted">{t(thread.subtitle)}</span>
      </span>
      <span className="text-right text-xs font-bold text-muted">
        {t(thread.time)}
        {thread.unread && <span className="mt-2 block rounded-full bg-priceOrange px-2 py-0.5 text-white">1</span>}
      </span>
    </button>
  );
}

export function UploadImageField({
  label,
  image,
  placeholderIcon = "ri-image-line",
  buttonText,
  onUpload,
}: {
  label: string;
  image?: string;
  placeholderIcon?: string;
  buttonText: string;
  onUpload: (file: File) => void | Promise<void>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="upload-row">
        {image ? <img className="shop-preview" src={image} alt="" /> : <span className="upload-placeholder"><i className={placeholderIcon} /></span>}
        <span className="upload-btn"><i className="ri-upload-2-line" />{buttonText}</span>
        <input
          className="hidden-file"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUpload(file);
            event.target.value = "";
          }}
        />
      </div>
    </label>
  );
}

export function ShopEditorSheet({
  open,
  shop,
  hawkerCenterId,
  hawkerCenters,
  hawkerCentersLoading,
  onClose,
  onSave,
  onUploadShop,
  onUploadPayNow,
}: {
  open: boolean;
  shop: Shop;
  hawkerCenterId: string;
  hawkerCenters: (HawkerCenterOption & { address?: string | null })[];
  hawkerCentersLoading?: boolean;
  onClose: () => void;
  onSave: (shop: Shop, hawkerCenterId: string) => void;
  onUploadShop: (file: File) => void | Promise<void>;
  onUploadPayNow: (file: File) => void | Promise<void>;
}) {
  const { t } = useLang();
  const [centerId, setCenterId] = useState(hawkerCenterId);
  // 每次打开时同步当前餐厅的熟食中心；关闭后保留用户最近选择不影响下次
  useEffect(() => {
    if (open) setCenterId(hawkerCenterId);
  }, [open, hawkerCenterId]);
  return (
    <>
      <button className={`sheet-backdrop ${open ? "open" : ""}`} onClick={onClose} aria-label="Close restaurant editor" />
      <div className={`bottom-sheet ${open ? "open" : ""}`}>
        <div className="handle" />
        <div className="mb-4 flex items-center gap-3">
          <img className="shop-preview" src={shop.image} alt="" />
          <div>
            <h2 className="text-xl font-extrabold">{t("餐厅信息")}</h2>
            <p className="text-sm font-semibold text-muted">{t("会显示在商家端和扫码菜单页")}</p>
          </div>
        </div>
        <div className="fields">
          <label className="field"><span>{t("餐厅名称")}</span><input defaultValue={shop.name} id="shop-name" /></label>
          <UploadImageField label={t("餐厅图片")} image={shop.image} buttonText={t("上传图片")} onUpload={onUploadShop} />
          <UploadImageField label={t("PayNow 二维码")} image={shop.paynowImage} placeholderIcon="ri-qr-code-line" buttonText={t("上传二维码")} onUpload={onUploadPayNow} />
          <label className="field">
            <span>{t("所属熟食中心")}</span>
            <HawkerCenterPicker
              value={centerId}
              centers={hawkerCenters}
              loading={hawkerCentersLoading}
              onChange={setCenterId}
            />
          </label>
          <label className="field"><span>{t("联系电话")}</span><input defaultValue={shop.phone} id="shop-phone" /></label>
          <label className="field"><span>{t("店铺地址")}</span><input defaultValue={shop.address} id="shop-address" /></label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="btn secondary" onClick={onClose}>{t("取消")}</button>
          <button
            className="btn primary"
            onClick={() => {
              const matched = hawkerCenters.find((c) => c.id === centerId);
              onSave({
                ...shop,
                name: (document.getElementById("shop-name") as HTMLInputElement)?.value || shop.name,
                hawkerCenter: matched ? matched.name : shop.hawkerCenter,
                phone: (document.getElementById("shop-phone") as HTMLInputElement)?.value || shop.phone,
                address: (document.getElementById("shop-address") as HTMLInputElement)?.value || shop.address,
              }, centerId);
            }}
          >
            {t("保存")}
          </button>
        </div>
      </div>
    </>
  );
}

