import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBar, Toast, IconButton } from "../../components/MobileShell";
import eatlahLogo from "../../assets/eatlah_logo.jpg.asset.json";
import { useLang } from "../../i18n/LanguageContext";
import {
  recognizeMenuFromImage,
  bulkCreateMenuItems,
} from "../../lib/menu-import.functions";

type DraftOption = { name: string; name_en: string; price_delta: string };
type DraftItem = {
  key: string;
  category: string;
  category_en: string;
  name: string;
  english_name: string;
  price: string;
  description: string;
  description_en: string;
  daily_available: boolean;
  image_data_url: string | null;
  options: DraftOption[];
  expanded: boolean;
  confidence: "high" | "medium" | "low";
};

type Stage = "upload" | "recognizing" | "review";

const MAX_LONG_EDGE = 1600;
const THUMB_LONG_EDGE = 512;

// Paper & Ink design tokens (scoped to this flow)
const INK = {
  paper: "#f5f3ee",
  paperSoft: "#fcfbf9",
  line: "#e8e4dd",
  lineSoft: "#efece5",
  ink: "#2d2d2d",
  inkMuted: "rgba(45,45,45,0.6)",
  inkFaint: "rgba(45,45,45,0.4)",
  green: "#0b7a53",
};
const BRAND_GREEN = INK.green;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function loadAndCompressImage(file: File): Promise<{
  dataUrl: string;
  base64: string;
  mime: string;
  width: number;
  height: number;
  image: HTMLImageElement;
}> {
  const objUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objUrl;
    });
    const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const mime = "image/jpeg";
    const dataUrl = canvas.toDataURL(mime, 0.85);
    const base64 = dataUrl.split(",")[1] ?? "";
    const finalImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    return { dataUrl, base64, mime, width: w, height: h, image: finalImg };
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

function cropFromBox2d(
  img: HTMLImageElement,
  box: [number, number, number, number] | null | undefined,
): string | null {
  if (!box) return null;
  const [ymin, xmin, ymax, xmax] = box;
  const y0 = Math.max(0, Math.min(1, ymin / 1000));
  const x0 = Math.max(0, Math.min(1, xmin / 1000));
  const y1 = Math.max(0, Math.min(1, ymax / 1000));
  const x1 = Math.max(0, Math.min(1, xmax / 1000));
  if (y1 - y0 < 0.01 || x1 - x0 < 0.01) return null;
  const pad = 0.02;
  const x = Math.max(0, x0 - pad);
  const y = Math.max(0, y0 - pad);
  const w = Math.min(1 - x, x1 - x0 + pad * 2);
  const h = Math.min(1 - y, y1 - y0 + pad * 2);
  const sx = x * img.naturalWidth;
  const sy = y * img.naturalHeight;
  const sw = w * img.naturalWidth;
  const sh = h * img.naturalHeight;
  const longEdge = Math.max(sw, sh);
  const scale = longEdge > THUMB_LONG_EDGE ? THUMB_LONG_EDGE / longEdge : 1;
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function toNumberOrNaN(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.\-]/g, "");
    if (!cleaned) return NaN;
    return Number(cleaned);
  }
  return NaN;
}

const STEPS_ZH = ["读取图片", "结构化识别", "整理结果"];

export function MenuImportPage({
  restaurantId,
  onCancel,
  onDone,
}: {
  restaurantId: string;
  onCancel: () => void;
  onDone: (createdCount: number) => void;
}) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const callRecognize = useServerFn(recognizeMenuFromImage);
  const callBulkCreate = useServerFn(bulkCreateMenuItems);

  const [stage, setStage] = useState<Stage>("upload");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);
  const autoPickedRef = useRef(false);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 1800);
  };

  // Auto-open native picker once on mount
  useEffect(() => {
    if (autoPickedRef.current) return;
    autoPickedRef.current = true;
    const id = window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 80);
    return () => window.clearTimeout(id);
  }, []);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("请上传图片文件 (JPG / PNG)"));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast(t("文件不能超过 20MB"));
      return;
    }
    setBusy(true);
    setStage("recognizing");
    setProgressStep(0);
    setProgressPct(8);
    const progressId = window.setInterval(() => {
      setProgressPct((p) => (p >= 92 ? 92 : p + 2));
    }, 350);
    const stepId = window.setInterval(() => {
      setProgressStep((s) => (s >= STEPS_ZH.length - 1 ? s : s + 1));
    }, 1500);
    try {
      const { base64, mime, image } = await loadAndCompressImage(file);
      setProgressStep(1);
      const result = await callRecognize({
        data: { imageBase64: base64, mimeType: mime },
      });
      const items: DraftItem[] = (result.items ?? []).map((raw) => {
        const priceNum = toNumberOrNaN(raw.price ?? null);
        const photoBox = raw.photo_box_2d as
          | [number, number, number, number]
          | null
          | undefined;
        const cropped = photoBox ? cropFromBox2d(image, photoBox) : null;
        const conf = (raw.confidence ?? "medium") as "high" | "medium" | "low";
        return {
          key: uid(),
          category: (raw.category ?? "").trim() || t("未分类"),
          category_en: (raw.category_en ?? "").trim(),
          name: (raw.name ?? "").trim(),
          english_name: (raw.english_name ?? "").trim(),
          price: Number.isFinite(priceNum) ? priceNum.toFixed(2) : "",
          description: (raw.description ?? "").trim(),
          description_en: (raw.description_en ?? "").trim(),
          daily_available: true,
          image_data_url: cropped,
          expanded: false,
          confidence: conf,
          options: (raw.options ?? []).map((o) => {
            const d = toNumberOrNaN(o.price_delta ?? 0);
            return {
              name: o.name ?? "",
              name_en: o.name_en ?? "",
              price_delta: Number.isFinite(d) ? d.toFixed(2) : "0.00",
            };
          }),
        };
      });
      if (items.length === 0) {
        showToast(t("未识别到菜品，请换一张清晰照片"));
        setStage("upload");
        return;
      }
      setProgressStep(2);
      setProgressPct(100);
      setDrafts(items);
      setStage("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg);
      setStage("upload");
    } finally {
      window.clearInterval(progressId);
      window.clearInterval(stepId);
      setBusy(false);
    }
  };

  const updateDraft = (key: string, patch: Partial<DraftItem>) =>
    setDrafts((cur) => cur.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const updateOption = (key: string, idx: number, patch: Partial<DraftOption>) =>
    setDrafts((cur) =>
      cur.map((d) =>
        d.key === key
          ? { ...d, options: d.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) }
          : d,
      ),
    );

  const addOption = (key: string) =>
    setDrafts((cur) =>
      cur.map((d) =>
        d.key === key
          ? { ...d, options: [...d.options, { name: t("新选项"), name_en: "", price_delta: "0.00" }] }
          : d,
      ),
    );

  const removeOption = (key: string, idx: number) =>
    setDrafts((cur) =>
      cur.map((d) =>
        d.key === key ? { ...d, options: d.options.filter((_, i) => i !== idx) } : d,
      ),
    );

  const removeDraft = (key: string) =>
    setDrafts((cur) => cur.filter((d) => d.key !== key));

  const addBlankDraft = () =>
    setDrafts((cur) => [
      ...cur,
      {
        key: uid(),
        category: cur[0]?.category ?? t("未分类"),
        category_en: cur[0]?.category_en ?? "",
        name: "",
        english_name: "",
        price: "",
        description: "",
        description_en: "",
        daily_available: true,
        image_data_url: null,
        expanded: true,
        confidence: "high",
        options: [],
      },
    ]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    drafts.forEach((d, i) => {
      if (!d.name.trim()) errors.push(`#${i + 1} ${t("菜名不能为空")}`);
      if (!d.category.trim()) errors.push(`#${i + 1} ${t("种类不能为空")}`);
      const p = toNumberOrNaN(d.price);
      if (!Number.isFinite(p) || p < 0) errors.push(`#${i + 1} ${t("价格无效")}`);
    });
    return errors;
  }, [drafts, t]);

  const handleSubmit = async () => {
    if (validation.length > 0) {
      showToast(validation[0]);
      return;
    }
    setBusy(true);
    try {
      const payload = drafts.map((d) => {
        const imgParts = d.image_data_url ? d.image_data_url.split(",") : null;
        const mime = imgParts ? imgParts[0].match(/data:([^;]+);/)?.[1] ?? "image/jpeg" : null;
        const base64 = imgParts ? imgParts[1] : null;
        return {
          category: d.category.trim(),
          category_en: d.category_en.trim() || null,
          name: d.name.trim(),
          english_name: d.english_name.trim() || null,
          price: toNumberOrNaN(d.price),
          description: d.description.trim() || null,
          description_en: d.description_en.trim() || null,
          daily_available: d.daily_available,
          image_base64: base64,
          image_mime: mime,
          options: d.options
            .filter((o) => o.name.trim())
            .map((o) => ({
              name: o.name.trim(),
              name_en: o.name_en.trim() || null,
              price_delta: toNumberOrNaN(o.price_delta) || 0,
            })),
        };
      });
      const res = await callBulkCreate({ data: { restaurantId, items: payload } });
      await queryClient.invalidateQueries({ queryKey: ["my-restaurants"] });
      await queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      onDone(res.created);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`${t("导入失败")}: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  // ====== render ======
  if (stage === "recognizing") {
    return (
      <section className="screen" style={{ background: INK.paper }}>
        <StatusBar />
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            opacity: 0.4,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: `1px solid ${INK.line}`,
              background: "rgba(255,255,255,0.5)",
            }}
          />
          <h1
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginLeft: 12,
              color: INK.ink,
              letterSpacing: 0.2,
            }}
          >
            {t("正在识别菜单")}
          </h1>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 32px 64px",
            gap: 28,
          }}
        >
          <div style={{ position: "relative", width: 96, height: 96 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: `4px solid ${INK.line}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "4px solid transparent",
                borderTopColor: INK.green,
                animation: "menu-spin 0.9s linear infinite",
              }}
            />
          </div>

          <div style={{ textAlign: "center", display: "grid", gap: 6 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: INK.ink, letterSpacing: 0.2 }}>
              {t(STEPS_ZH[progressStep] ?? STEPS_ZH[0])}
            </div>
            <div style={{ fontSize: 13, color: INK.inkMuted }}>
              {t("AI 正在解析菜单…")}
            </div>
          </div>

          <div style={{ width: "100%", maxWidth: 280 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: INK.ink,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                }}
              >
                {t("第")} {progressStep + 1} / {STEPS_ZH.length}
              </span>
              <span style={{ fontSize: 12, color: INK.ink, fontWeight: 600 }}>
                {progressPct}%
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 6,
                borderRadius: 999,
                background: INK.line,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  background: INK.green,
                  borderRadius: 999,
                  transition: "width 350ms ease",
                }}
              />
            </div>
          </div>
        </div>
        <style>{`@keyframes menu-spin { to { transform: rotate(360deg); } }`}</style>
        <Toast text={toast} />
      </section>
    );
  }


  if (stage === "review") {
    return (
      <section className="screen" style={{ background: INK.paper }}>
        <div className="scroll" style={{ paddingBottom: 112, paddingLeft: 0, paddingRight: 0, overflowX: "hidden", width: "100%", boxSizing: "border-box" }}>
          <header
            style={{
              padding: "16px 20px 14px",
              background: INK.paper,
              borderBottom: `1px solid ${INK.line}`,
              position: "sticky",
              top: 0,
              zIndex: 5,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <IconButton icon="ri-arrow-left-s-line" label="Back" onClick={onCancel} />
              <h1
                style={{
                  flex: 1,
                  minWidth: 0,
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: INK.ink,
                  letterSpacing: 0.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t("识别完成")}
              </h1>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: INK.inkMuted,
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {t("共")} {drafts.length} {t("道菜")} · {t("点击卡片可编辑")}
            </p>
          </header>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, padding: "16px" }}>
            {drafts.map((d, idx) => (
              <DraftCard
                key={d.key}
                index={idx}
                d={d}
                onPatch={(p) => updateDraft(d.key, p)}
                onRemove={() => removeDraft(d.key)}
                onOptionPatch={(i, p) => updateOption(d.key, i, p)}
                onOptionRemove={(i) => removeOption(d.key, i)}
                onOptionAdd={() => addOption(d.key)}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px 0 28px",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 11, color: INK.inkMuted, fontWeight: 500, letterSpacing: 0.3 }}>
              {t("Powered by")}
            </span>
            <img
              src={eatlahLogo.url}
              alt="eatlah"
              style={{ height: 22, width: "auto", borderRadius: 6, objectFit: "contain", opacity: 0.9 }}
            />
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "14px 16px 22px",
            background: `linear-gradient(180deg, rgba(245,243,238,0) 0%, ${INK.paper} 35%)`,
            display: "flex",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1,
              padding: "14px 16px",
              borderRadius: 16,
              border: `1.5px solid ${INK.ink}`,
              background: "transparent",
              color: INK.ink,
              fontWeight: 700,
              fontSize: 14,
              cursor: busy ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <i className="ri-refresh-line" /> {t("重新扫描")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || drafts.length === 0}
            style={{
              flex: 2,
              padding: "14px 16px",
              borderRadius: 16,
              border: "none",
              background: INK.green,
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: busy || drafts.length === 0 ? "not-allowed" : "pointer",
              boxShadow: `0 6px 18px -8px ${INK.green}`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              opacity: busy || drafts.length === 0 ? 0.6 : 1,
            }}
          >
            <i className="ri-check-line" />
            {busy ? t("导入中…") : `${t("确认菜单")} (${drafts.length})`}
          </button>
        </div>
        <Toast text={toast} />
      </section>
    );
  }

  // upload stage: viewfinder + CTA while native picker opens
  return (
    <section className="screen" style={{ background: INK.paper }}>
      <StatusBar />
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <IconButton icon="ri-arrow-left-s-line" label="Back" onClick={onCancel} />
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: INK.ink,
            letterSpacing: 0.2,
          }}
        >
          {t("导入菜单")}
        </h1>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px 24px 40px",
        }}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: "100%",
            aspectRatio: "3 / 4",
            maxHeight: 420,
            borderRadius: 24,
            border: `2px dashed ${INK.line}`,
            background: INK.paperSoft,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            color: INK.ink,
            cursor: "pointer",
            padding: 24,
            textAlign: "center",
            marginBottom: 28,
            transition: "transform 120ms ease, background 120ms ease",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: INK.line,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              color: INK.ink,
            }}
          >
            <i className="ri-camera-line" />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: INK.ink,
              lineHeight: 1.5,
              maxWidth: 240,
            }}
          >
            {t("拍下菜单照片")}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: INK.inkFaint,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              fontWeight: 700,
            }}
          >
            {t("点击此处")}
          </p>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 16,
            border: "none",
            background: INK.green,
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            boxShadow: `0 6px 18px -8px ${INK.green}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <i className="ri-camera-line" /> {t("拍照")}
        </button>
        <button
          type="button"
          onClick={() => albumInputRef.current?.click()}
          style={{
            background: "none",
            border: "none",
            color: INK.ink,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
            textDecorationColor: INK.line,
            textUnderlineOffset: 4,
            padding: "6px 8px",
          }}
        >
          {t("从相册选择")}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <PoweredByEatlah />
      <Toast text={toast} />
    </section>
  );
}

function PoweredByEatlah() {
  const { t } = useLang();
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 6,
        gap: 6,
      }}
    >
      <span style={{ fontSize: 11, color: INK.inkMuted, fontWeight: 500, letterSpacing: 0.3 }}>
        {t("Powered by")}
      </span>
      <img
        src={eatlahLogo.url}
        alt="eatlah"
        style={{ height: 22, width: "auto", borderRadius: 6, objectFit: "contain", opacity: 0.9 }}
      />
    </div>
  );
}


// ============ DraftCard ============
function DraftCard({
  index,
  d,
  onPatch,
  onRemove,
  onOptionPatch,
  onOptionRemove,
  onOptionAdd,
}: {
  index: number;
  d: DraftItem;
  onPatch: (p: Partial<DraftItem>) => void;
  onRemove: () => void;
  onOptionPatch: (i: number, p: Partial<DraftOption>) => void;
  onOptionRemove: (i: number) => void;
  onOptionAdd: () => void;
}) {
  const { t } = useLang();
  const isLow = d.confidence === "low";
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 10,
        padding: 10,
        paddingLeft: isLow ? 14 : 10,
        borderRadius: 12,
        background: isLow ? "#fffaf0" : "#fff",
        border: isLow ? "1px solid #f5a52455" : "1px solid rgba(33,31,32,0.08)",
        borderLeft: isLow ? "4px solid #f5a524" : undefined,
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      {isLow && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            background: "#f5a524",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            padding: "1px 6px",
            borderRadius: 4,
            letterSpacing: 0.2,
          }}
        >
          {t("请核对")}
        </span>
      )}
      {d.image_data_url ? (
        <img
          src={d.image_data_url}
          alt=""
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            background: "#f4f4f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#bbb",
            flexShrink: 0,
          }}
        >
          <i className="ri-image-line" style={{ fontSize: 20 }} />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
          <input
            value={d.name}
            placeholder={`${t("菜名")} #${index + 1}`}
            onChange={(e) => onPatch({ name: e.target.value })}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 15,
              fontWeight: 800,
              color: "#211f20",
              padding: 0,
            }}
          />
          <span style={{ fontSize: 12, color: "#a04100", fontWeight: 700 }}>$</span>
          <input
            value={d.price}
            placeholder="0.00"
            inputMode="decimal"
            onChange={(e) => onPatch({ price: e.target.value })}
            style={{
              width: 56,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              fontWeight: 800,
              color: "#a04100",
              textAlign: "right",
              padding: 0,
            }}
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label="delete"
            style={{
              background: "none",
              border: "none",
              color: "#c44",
              cursor: "pointer",
              padding: 2,
              fontSize: 14,
            }}
          >
            <i className="ri-close-line" />
          </button>
        </div>

        <input
          value={d.english_name}
          placeholder={t("英文名")}
          onChange={(e) => onPatch({ english_name: e.target.value })}
          style={{
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 12,
            color: "#6f7b75",
            fontWeight: 600,
            padding: 0,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
          <input
            value={d.category}
            placeholder={t("种类")}
            onChange={(e) => onPatch({ category: e.target.value })}
            style={{
              flex: 1,
              minWidth: 0,
              border: "1px dashed rgba(33,31,32,0.15)",
              outline: "none",
              background: "transparent",
              fontSize: 11,
              color: "#6f7b75",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
            }}
          />
          <input
            value={d.category_en}
            placeholder="Category (EN)"
            onChange={(e) => onPatch({ category_en: e.target.value })}
            style={{
              flex: 1,
              minWidth: 0,
              border: "1px dashed rgba(33,31,32,0.15)",
              outline: "none",
              background: "transparent",
              fontSize: 11,
              color: "#6f7b75",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
            }}
          />
          <button
            type="button"
            onClick={() => onPatch({ expanded: !d.expanded })}
            style={{
              background: "none",
              border: "none",
              color: BRAND_GREEN,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              padding: "2px 4px",
              whiteSpace: "nowrap",
            }}
          >
            {d.expanded ? (
              <>
                <i className="ri-arrow-up-s-line" /> {t("收起")}
              </>
            ) : (
              <>
                <i className="ri-edit-line" /> {t("描述/选项")}
                {d.options.length > 0 && ` · ${d.options.length}`}
              </>
            )}
          </button>
        </div>

        {d.expanded && (
          <div
            style={{
              marginTop: 6,
              padding: "8px 8px 6px",
              borderRadius: 8,
              background: "#fafafa",
              display: "grid",
              gap: 8,
            }}
          >
            <textarea
              value={d.description}
              placeholder={t("菜品描述")}
              onChange={(e) => onPatch({ description: e.target.value })}
              rows={2}
              style={{
                width: "100%",
                resize: "vertical",
                border: "1px solid rgba(33,31,32,0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                color: "#211f20",
                background: "#fff",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <textarea
              value={d.description_en}
              placeholder="Description (EN)"
              onChange={(e) => onPatch({ description_en: e.target.value })}
              rows={2}
              style={{
                width: "100%",
                resize: "vertical",
                border: "1px solid rgba(33,31,32,0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                color: "#211f20",
                background: "#fff",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "grid", gap: 6 }}>
              {d.options.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    value={o.name}
                    placeholder={t("选项名")}
                    onChange={(e) => onOptionPatch(i, { name: e.target.value })}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: "1px solid rgba(33,31,32,0.1)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 12,
                      background: "#fff",
                      outline: "none",
                    }}
                  />
                  <input
                    value={o.name_en}
                    placeholder="EN"
                    onChange={(e) => onOptionPatch(i, { name_en: e.target.value })}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: "1px solid rgba(33,31,32,0.1)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 12,
                      background: "#fff",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#6f7b75" }}>+$</span>
                  <input
                    value={o.price_delta}
                    inputMode="decimal"
                    onChange={(e) => onOptionPatch(i, { price_delta: e.target.value })}
                    style={{
                      width: 56,
                      border: "1px solid rgba(33,31,32,0.1)",
                      borderRadius: 6,
                      padding: "4px 6px",
                      fontSize: 12,
                      background: "#fff",
                      outline: "none",
                      textAlign: "right",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onOptionRemove(i)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#c44",
                      cursor: "pointer",
                      padding: 2,
                      fontSize: 14,
                    }}
                  >
                    <i className="ri-delete-bin-line" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={onOptionAdd}
                style={{
                  background: "none",
                  border: "1px dashed rgba(33,31,32,0.18)",
                  borderRadius: 6,
                  color: "#6f7b75",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                <i className="ri-add-line" /> {t("添加选项")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
