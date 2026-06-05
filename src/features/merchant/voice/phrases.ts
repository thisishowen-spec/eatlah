import type { MerchantOrder } from "../../../types/merchant";
import type { VoiceLang } from "./types";

function fmtMoney(n: number | undefined, lang: VoiceLang) {
  const v = Number(n ?? 0);
  if (lang === "zh") return `${v.toFixed(2)} 新币`;
  return `S$${v.toFixed(2)}`;
}

function itemsText(order: MerchantOrder, lang: VoiceLang) {
  // items: [label, qty][] — label 是后端 snapshot，多为中文；英文环境也用同一份。
  return order.items
    .map(([label, qty]) => {
      if (lang === "zh") return `${label} ${qty} 份`;
      return `${label} times ${qty}`;
    })
    .join(lang === "zh" ? "，" : ", ");
}

function serviceText(order: MerchantOrder, lang: VoiceLang) {
  if (lang === "zh") return order.type === "外带" ? "外带" : "堂食";
  return order.type === "外带" ? "takeaway" : "dine in";
}

function paymentTailText(order: MerchantOrder, lang: VoiceLang) {
  if (order.paymentMethod === "cash") {
    return lang === "zh" ? "现金支付，请到柜台收款。" : "Cash payment, please collect at counter.";
  }
  const money = fmtMoney(order.totalAmount, lang);
  return lang === "zh"
    ? `请核对 PayNow 金额 ${money}。`
    : `Please verify PayNow amount ${money}.`;
}

function noteText(order: MerchantOrder, lang: VoiceLang) {
  const n = (order.note ?? "").trim();
  if (!n) return "";
  return lang === "zh" ? `备注：${n}。` : `Note: ${n}.`;
}

export function buildNewOrderText(order: MerchantOrder, lang: VoiceLang): string {
  const num = order.displayNumber || order.id.slice(0, 4);
  const head = lang === "zh" ? "来新订单啦。" : "New order in.";
  const meta = lang === "zh"
    ? `订单 ${num}，${serviceText(order, "zh")}。`
    : `Order ${num}, ${serviceText(order, "en")}.`;
  const items = lang === "zh"
    ? `${itemsText(order, "zh")}。`
    : `${itemsText(order, "en")}.`;
  return [head, meta, items, noteText(order, lang), paymentTailText(order, lang)]
    .filter(Boolean)
    .join(" ");
}

export function buildPendingOverdueText(order: MerchantOrder, waitedMins: number, lang: VoiceLang): string {
  const num = order.displayNumber || order.id.slice(0, 4);
  if (lang === "zh") {
    return `提醒：订单 ${num} 已等待 ${waitedMins} 分钟，请尽快接单。`;
  }
  return `Reminder: Order ${num} has been waiting ${waitedMins} minutes, please accept soon.`;
}
