import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MobileShell } from "../../components/MobileShell";
import type { HomepagePayload } from "../../lib/storefront.functions";
import { useLang, pickLang } from "../../i18n/LanguageContext";
import eatlahLogo from "@/assets/eatlah-logo.jpg.asset.json";
import "./hawkerHome.css";

type Props = { data: HomepagePayload };

export function HawkerHomeApp({ data }: Props) {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { shops } = data;

  const ALL = t("全部");

  // 只列出有活跃商铺的熟食中心，切换后必有内容
  const centers = useMemo(
    () => data.centers.filter((c) => shops.some((s) => s.centerId === c.id)),
    [data.centers, shops],
  );

  const defaultCenterId = useMemo(() => centers[0]?.id ?? "", [centers]);

  const [centerId, setCenterId] = useState<string>(defaultCenterId);
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState<string>("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState<string>("");

  const filteredCenters = useMemo(() => {
    const kw = locationQuery.trim().toLowerCase();
    if (!kw) return centers;
    return centers.filter((c) =>
      `${c.name} ${c.nameEn ?? ""} ${c.address ?? ""}`.toLowerCase().includes(kw),
    );
  }, [centers, locationQuery]);

  const activeCenter = centers.find((c) => c.id === centerId) ?? centers[0];
  const centerShops = useMemo(
    () => shops.filter((s) => s.centerId === (activeCenter?.id ?? "")),
    [shops, activeCenter],
  );
  const categories = useMemo(() => {
    const set = new Set<string>();
    centerShops.forEach((s) => { if (s.cuisine) set.add(s.cuisine); });
    return [ALL, ...Array.from(set)];
  }, [centerShops, ALL]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return centerShops.filter((s) => {
      const catOk = category === ALL || s.cuisine === category;
      if (!catOk) return false;
      if (!q) return true;
      return `${s.name} ${s.cuisine}`.toLowerCase().includes(q);
    });
  }, [centerShops, category, query, ALL]);

  if (!activeCenter) {
    return (
      <MobileShell caption="Customer · 390 x 844">
        <div className="hawker-home" data-lang={lang}><div className="scroll">
          <header className="top">
            <div className="brand">
              <button className="brand-mark"><i className="ri-map-pin-2-line" /><span>EatLah</span></button>
              <p className="address">{t("暂无熟食中心数据")}</p>
            </div>
            <img className="logo-img" src={eatlahLogo.url} alt="EatLah" />
          </header>
          <section className="empty show">{t("还没有可用的熟食中心。")}</section>
        </div></div>
      </MobileShell>
    );
  }

  return (
    <MobileShell caption="Customer · 390 x 844">
      <div className="hawker-home" data-lang={lang}>
        <div className="scroll">
          <header className="top">
            <div className="brand">
              <button
                className="brand-mark"
                aria-expanded={locationOpen}
                onClick={() => setLocationOpen((v) => !v)}
              >
                <i className="ri-map-pin-2-line" aria-hidden />
                <span>{pickLang(activeCenter.name, activeCenter.nameEn, lang)}</span>
                <i className={locationOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} aria-hidden />
              </button>
              <p className="address">{activeCenter.address}</p>
            </div>
            <img className="logo-img" src={eatlahLogo.url} alt="EatLah" />
          </header>

          <section className={`location-menu ${locationOpen ? "show" : ""}`} aria-label={t("选择熟食中心")}>
            <label className="location-search">
              <i className="ri-search-line" aria-hidden />
              <input
                type="search"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder={t("搜索名称 / 英文 / 地址")}
                autoComplete="off"
              />
              {locationQuery && (
                <button type="button" className="location-search-clear" onClick={() => setLocationQuery("")} aria-label={t("清除")}>
                  <i className="ri-close-circle-fill" />
                </button>
              )}
            </label>
            {filteredCenters.length === 0 ? (
              <div className="location-empty">{t("没有匹配的熟食中心")}</div>
            ) : (
              filteredCenters.map((c) => (
                <button
                  key={c.id}
                  className={`location-option ${c.id === centerId ? "active" : ""}`}
                  onClick={() => {
                    setCenterId(c.id);
                    setCategory(ALL);
                    setLocationOpen(false);
                    setLocationQuery("");
                  }}
                >
                  <span>
                    <b>{pickLang(c.name, c.nameEn, lang)}</b>
                    <small>{c.address}</small>
                  </span>
                  {c.id === centerId && <i className="ri-check-line" aria-hidden />}
                </button>
              ))
            )}
          </section>

          <label className="search">
            <i className="ri-search-line" aria-hidden />
            <input
              type="search"
              placeholder={t("搜索店铺或菜品")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </label>

          <nav className="tabs" aria-label={t("菜系分类")}>
            {categories.map((c) => (
              <button
                key={c}
                className={`tab ${c === category ? "active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c === ALL ? ALL : t(c)}
              </button>
            ))}
          </nav>

          <section className="section-title">
            <h2>{lang === "zh" ? "店铺" : "Stalls"}</h2>
            <span>{visible.length}{lang === "zh" ? " 家" : ""}</span>
          </section>

          <section className="list" aria-label={t("商铺列表")}>
            {visible.map((s) => (
              <button
                key={s.id}
                className="shop-card"
                onClick={() => navigate({ to: "/c/$slug", params: { slug: s.slug } })}
              >
                {s.image ? (
                  <img src={s.image} alt={s.name} />
                ) : (
                  <span className="img-fallback" aria-hidden>
                    <i className="ri-store-2-line" />
                  </span>
                )}
                <span className="shop-copy">
                  <b>{t(s.name)}</b>
                  <small>{s.cuisine ? t(s.cuisine) : t("店铺")}</small>
                  <em>
                    {s.itemCount > 0
                      ? lang === "zh"
                        ? `${s.itemCount} 个菜${s.minPrice > 0 ? ` · $${s.minPrice.toFixed(2)} 起` : ""}`
                        : `${s.itemCount} dishes${s.minPrice > 0 ? ` · from $${s.minPrice.toFixed(2)}` : ""}`
                      : t("暂未上架菜品")}
                  </em>
                </span>
                <span className="shop-meta">
                  <span className={`status ${s.isOpen ? "" : "closed"}`}>
                    {s.isOpen ? t("营业中") : t("休息中")}
                  </span>
                  <i className="ri-arrow-right-s-line" aria-hidden />
                </span>
              </button>
            ))}
          </section>

          {visible.length === 0 && (
            <section className="empty show">{t("没有找到对应商铺。换个分类或搜索试试。")}</section>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
