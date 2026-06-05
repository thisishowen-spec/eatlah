import { useEffect, useMemo, useRef, useState } from "react";
import { useLang, pickLang } from "../../i18n/LanguageContext";
import type { CustomerItem, CustomerRestaurant } from "../../types/customer";
import "./imageMenu.css";

type Props = {
  restaurant: CustomerRestaurant;
  items: CustomerItem[];
  category: string;
  setCategory: (c: string) => void;
  categoryItems: string[];
  renderCategory: (c: string) => string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  cartCount: number;
  cartTotal: number;
  isClosed: boolean;
  hasUnseenCancelled: boolean;
  onOpenOrders: () => void;
  onOpenCart: () => void;
  onOpenDetail: (item: CustomerItem) => void;
  /** Add 1 of the given item with no add-on options to cart. */
  onQuickAdd: (item: CustomerItem) => void;
};

export function ImageMenuScreen(props: Props) {
  const {
    restaurant, items, category, setCategory, categoryItems, renderCategory,
    searchQuery, setSearchQuery, cartCount, cartTotal, isClosed, hasUnseenCancelled,
    onOpenOrders, onOpenCart, onOpenDetail, onQuickAdd,
  } = props;
  const { t, lang, toggle } = useLang();

  // 动画状态
  const [pulse, setPulse] = useState(false);
  const lastCount = useRef(cartCount);
  useEffect(() => {
    if (cartCount > lastCount.current) {
      setPulse(true);
      const id = window.setTimeout(() => setPulse(false), 240);
      return () => window.clearTimeout(id);
    }
    lastCount.current = cartCount;
  }, [cartCount]);

  const restName = pickLang(restaurant.name, restaurant.nameEn, lang);
  const center = pickLang(restaurant.center, restaurant.centerEn, lang);

  const q = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => items.filter((it) => {
    if (category !== "全部" && it.category !== category) return false;
    if (!q) return true;
    const hay = [it.name, it.nameEn, it.category, it.categoryEn, it.description, it.descriptionEn]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  }), [items, category, q]);

  const sectionTitle = q ? `${t("搜索")}: "${searchQuery}"` : renderCategory(category);
  const countLabel = lang === "zh" ? `${filtered.length} 个菜` : `${filtered.length} ${filtered.length === 1 ? "dish" : "dishes"}`;

  return (
    <div className="eatlah-image-menu">
      <div className="im-scroll">
        <header className="im-menu-hero">
          <div className="im-brand-row">
            <button
              className="im-nav-button im-home-button"
              onClick={() => { if (typeof window !== "undefined") window.location.href = "/c"; }}
              aria-label={t("主页")}
            >
              <i className="ri-home-5-line" aria-hidden="true" />
              {t("主页")}
            </button>
            <div className="im-top-actions">
              <button className="im-nav-button" aria-label={t("订单记录")} onClick={onOpenOrders}>
                <i className="ri-file-list-3-line" aria-hidden="true" />
                {t("订单")}
                {hasUnseenCancelled && <span className="im-nav-badge" aria-hidden />}
              </button>
              <button className="im-nav-button im-lang-button" aria-label="Toggle language" onClick={toggle}>
                {lang === "zh" ? "中 / EN" : "EN / 中"}
              </button>
            </div>
          </div>
          <div className="im-restaurant">
            <h1>{restName}</h1>
            <div className="im-restaurant-meta">
              <p>{center || restaurant.cuisine || ""}</p>
              <section className="im-info-strip" aria-label={t("餐厅信息")}>
                <div className="im-info-chip"><b>{t("平均 8 分钟")}</b><span>{t("出餐")}</span></div>
                <div className="im-info-chip"><b>PayNow</b><span>{t("付款")}</span></div>
              </section>
            </div>
          </div>
        </header>

        {isClosed && (
          <div className="im-closed">
            <b>{t("店铺已打烊")}</b>
            {t("请在营业时间内下单，敬请期待再次光临。")}
          </div>
        )}

        <label className="im-search" role="search">
          <i className="ri-search-line" aria-hidden="true" />
          <input
            type="search"
            inputMode="search"
            placeholder={t("搜索菜品")}
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>

        <nav className="im-tabs" aria-label={t("菜单分类")}>
          {categoryItems.map((cat) => (
            <button
              key={cat}
              className={`im-tab ${cat === category ? "active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {renderCategory(cat)}
            </button>
          ))}
        </nav>

        <section className="im-section-title">
          <h2>{sectionTitle}</h2>
          <span>{countLabel}</span>
        </section>

        <section className="im-grid" aria-label={t("菜品")}>
          {filtered.length === 0 ? (
            <div className="im-empty">
              {q ? t("暂时没有找到这个菜。换个分类或搜索试试。") : t("商家正在准备菜单，请稍后再来。")}
            </div>
          ) : filtered.map((item, idx) => {
            const dishName = pickLang(item.name, item.nameEn, lang);
            const catLabel = pickLang(item.category, item.categoryEn, lang);
            const tagLabel = idx === 0 ? t("招牌推荐") : catLabel;
            return (
              <button
                key={item.id}
                type="button"
                className={`im-dish-card ${idx === 0 ? "featured" : ""}`}
                onClick={() => onOpenDetail(item)}
              >
                <div className="im-dish-photo">
                  {item.image ? (
                    <img src={item.image} alt={dishName} loading="lazy" />
                  ) : (
                    <div className="im-dish-placeholder" aria-hidden>
                      <i className="ri-restaurant-2-line" />
                    </div>
                  )}
                  <button
                    type="button"
                    className="im-add"
                    aria-label={`${t("加入购物车")} ${dishName}`}
                    disabled={isClosed}
                    onClick={(e) => { e.stopPropagation(); if (!isClosed) onQuickAdd(item); }}
                  >
                    <i className="ri-add-line" />
                  </button>
                </div>
                <div className="im-dish-copy">
                  <small>{tagLabel}</small>
                  <h3>{dishName}</h3>
                  <strong>${item.price.toFixed(2)}</strong>
                </div>
              </button>
            );
          })}
        </section>
      </div>

      {!isClosed && (
        <button
          type="button"
          className={`im-cart-bar ${pulse ? "im-pulse" : ""}`}
          onClick={onOpenCart}
          aria-label={t("购物车")}
        >
          <span className="im-cart-left">
            <span className="im-cart-icon"><i className="ri-shopping-cart-2-line" /></span>
          </span>
          <span className="im-cart-cta">
            {cartCount > 0
              ? `${t("购物车")} · $${cartTotal.toFixed(2)}`
              : t("购物车")}
          </span>
          {cartCount > 0 && (
            <span className={`im-cart-count ${pulse ? "im-pop" : ""}`}>{cartCount}</span>
          )}
        </button>
      )}
    </div>
  );
}

type DetailProps = {
  item: CustomerItem;
  selectedOptions: string[];
  toggleOption: (name: string) => void;
  detailQty: number;
  setDetailQty: (q: number) => void;
  detailTotal: number;
  onAdd: () => void;
  onClose: () => void;
};

export function ImageMenuDetailSheet({
  item, selectedOptions, toggleOption, detailQty, setDetailQty, detailTotal, onAdd, onClose,
}: DetailProps) {
  const { t, lang } = useLang();
  const name = pickLang(item.name, item.nameEn, lang);
  const desc = pickLang(item.description, item.descriptionEn, lang);
  const realOptions = item.options.filter((o) => o.name !== "标准");
  return (
    <div className="eatlah-image-menu">
      <div className="im-overlay" role="dialog" aria-modal="true" onClick={onClose}>
        <section className="im-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="im-sheet-body">
            <div className="im-detail-hero">
              {item.image ? (
                <img className="im-detail-photo" src={item.image} alt={name} />
              ) : (
                <div className="im-dish-placeholder" aria-hidden>
                  <i className="ri-restaurant-2-line" />
                </div>
              )}
              <button className="im-detail-close" aria-label={t("关闭")} onClick={onClose}>
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="im-detail-intro">
              <span className="im-dish-label">{pickLang(item.category, item.categoryEn, lang)}</span>
              <div className="im-detail-title-row">
                <h2 className="im-sheet-title">{name}</h2>
                <div className="im-price">${item.price.toFixed(2)}</div>
              </div>
              {desc && <p className="im-sheet-subtitle">{desc}</p>}
            </div>

            {realOptions.length > 0 && (
              <>
                <h3 className="im-section-label">{t("可选项")}</h3>
                <div className="im-option-list">
                  {realOptions.map((opt) => {
                    const active = selectedOptions.includes(opt.name);
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        className={`im-option ${active ? "active" : ""}`}
                        onClick={() => toggleOption(opt.name)}
                      >
                        <span>{pickLang(opt.name, opt.nameEn, lang)}</span>
                        {opt.price > 0 && <span className="im-opt-extra">+${opt.price.toFixed(2)}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="im-qty-row im-detail-action">
              <div className="im-stepper" aria-label={t("数量")}>
                <button type="button" onClick={() => setDetailQty(Math.max(1, detailQty - 1))} aria-label="-">-</button>
                <span>{detailQty}</span>
                <button type="button" onClick={() => setDetailQty(detailQty + 1)} aria-label="+">+</button>
              </div>
              <button className="im-primary" type="button" onClick={onAdd}>
                <span>{t("加入购物车")}</span>
                <span>${detailTotal.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
