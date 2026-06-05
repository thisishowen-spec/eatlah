import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../../i18n/LanguageContext";

export type HawkerCenterOption = {
  id: string;
  name: string;          // zh
  name_en: string | null;
};

type CenterFull = HawkerCenterOption & { address?: string | null };

type Props = {
  value: string;                       // selected id ("" for none)
  centers: CenterFull[];
  onChange: (id: string) => void;
  loading?: boolean;
  placeholder?: string;
  /** 显示字段中需附带地址副标题 */
  showAddress?: boolean;
};

/**
 * 搜索式熟食中心选择器：触发按钮看起来像 input，点击后弹出全屏抽屉，
 * 顶部固定搜索框，匹配中文名 / 英文名 / 地址（不区分大小写）。
 * 适合 100+ 选项的场景。
 */
export function HawkerCenterPicker({ value, centers, onChange, loading, placeholder, showAddress = true }: Props) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => centers.find((c) => c.id === value) || null, [centers, value]);

  useEffect(() => {
    if (open) {
      setQ("");
      // 等过渡帧后聚焦，避免动画抖动
      const id = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // 锁滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return centers;
    return centers.filter((c) => {
      const hay = `${c.name} ${c.name_en ?? ""} ${c.address ?? ""}`.toLowerCase();
      return hay.includes(kw);
    });
  }, [centers, q]);

  const displayName = (c: CenterFull) => (lang === "zh" ? c.name : (c.name_en || c.name));
  const subName = (c: CenterFull) => (lang === "zh" ? c.name_en : c.name);

  return (
    <>
      <button
        type="button"
        className="hc-picker-trigger"
        onClick={() => !loading && setOpen(true)}
        disabled={loading}
      >
        {selected ? (
          <span className="hc-picker-value">
            <b>{displayName(selected)}</b>
            {showAddress && selected.address ? <small>{selected.address}</small> : subName(selected) ? <small>{subName(selected)}</small> : null}
          </span>
        ) : (
          <span className="hc-picker-placeholder">
            {loading ? t("正在加载…") : (placeholder || t("请选择熟食中心"))}
          </span>
        )}
        <i className="ri-arrow-down-s-line" aria-hidden />
      </button>

      {open && (
        <div className="hc-picker-modal" role="dialog" aria-modal="true">
          <div className="hc-picker-head">
            <button type="button" className="hc-picker-close" onClick={() => setOpen(false)} aria-label={t("关闭")}>
              <i className="ri-close-line" />
            </button>
            <span className="hc-picker-title">{t("选择熟食中心")}</span>
            <span className="hc-picker-count">{filtered.length}</span>
          </div>
          <label className="hc-picker-search">
            <i className="ri-search-line" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("搜索名称 / 英文 / 地址")}
              autoComplete="off"
            />
            {q && (
              <button type="button" className="hc-picker-clear" onClick={() => setQ("")} aria-label={t("清除")}>
                <i className="ri-close-circle-fill" />
              </button>
            )}
          </label>
          <div className="hc-picker-list">
            {filtered.length === 0 ? (
              <div className="hc-picker-empty">{t("没有匹配的熟食中心")}</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`hc-picker-row ${c.id === value ? "active" : ""}`}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <span className="hc-picker-row-main">
                    <b>{displayName(c)}</b>
                    {subName(c) && <em>{subName(c)}</em>}
                    {c.address && <small>{c.address}</small>}
                  </span>
                  {c.id === value && <i className="ri-check-line" aria-hidden />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
