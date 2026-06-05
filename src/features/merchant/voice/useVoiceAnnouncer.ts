import { useCallback, useEffect, useRef, useState } from "react";
import type { MerchantOrder } from "../../../types/merchant";
import { setTtsProvider, speak } from "./ttsProvider";
import { aurastdProvider } from "./aurastdProvider";
import { buildNewOrderText, buildPendingOverdueText } from "./phrases";
import type { Announcement, VoiceLang } from "./types";

// 模块加载即覆盖默认浏览器 TTS。前端不传 voice_id，全由服务端按 lang 决定。
setTtsProvider(aurastdProvider);

const MUTE_KEY = "eatlah.voice.muted";
const OVERDUE_FIRST_MIN = 5;
const OVERDUE_SECOND_MIN = 10;
const NEW_ORDER_PRIORITY = 10;
const OVERDUE_PRIORITY = 1;

function minsSince(iso?: string | null) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor((Date.now() - t) / 60000);
}

function isPendingOrder(order: MerchantOrder) {
  return order.status === "待处理";
}

function overdueRoundForWait(waitedMins: number) {
  if (waitedMins >= OVERDUE_SECOND_MIN) return 2;
  if (waitedMins >= OVERDUE_FIRST_MIN) return 1;
  return 0;
}

function pendingOverdueOrderId(a: Announcement) {
  if (a.kind !== "pending_overdue") return null;
  return a.id.split(":")[1] ?? null;
}

type Options = {
  orders: MerchantOrder[];
  lang: VoiceLang;
  /** 数据是否已就绪：第一次拿到订单列表后才开始 diff，避免登录就轰炸 */
  ready: boolean;
};

export function useVoiceAnnouncer({ orders, lang, ready }: Options) {
  const [muted, setMutedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MUTE_KEY) === "1";
  });
  const [unlocked, setUnlocked] = useState<boolean>(false);

  const queueRef = useRef<Announcement[]>([]);
  const playingRef = useRef(false);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const overdueRoundsRef = useRef<Map<string, number>>(new Map()); // orderId -> 已播报轮次（0/1/2）
  const lastAnnouncementRef = useRef<Announcement | null>(null);
  const pendingOrderIdsRef = useRef<Set<string>>(new Set());
  const mutedRef = useRef(muted);
  const langRef = useRef(lang);
  const unlockedRef = useRef(false);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { unlockedRef.current = unlocked; }, [unlocked]);

  // 首次用户交互后解锁 autoplay
  useEffect(() => {
    if (unlocked) return;
    const unlock = () => {
      unlockedRef.current = true;
      setUnlocked(true);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, [unlocked]);

  const drain = useCallback(async () => {
    if (playingRef.current) return;
    if (mutedRef.current || !unlockedRef.current) {
      console.debug("[voice] drain skipped", { muted: mutedRef.current, unlocked: unlockedRef.current, queued: queueRef.current.length });
      return;
    }
    let next = queueRef.current.shift();
    while (next?.kind === "pending_overdue") {
      const oid = pendingOverdueOrderId(next);
      if (oid && pendingOrderIdsRef.current.has(oid)) break;
      next = queueRef.current.shift();
    }
    if (!next) return;
    playingRef.current = true;
    lastAnnouncementRef.current = next;
    console.debug("[voice] speaking", next.kind, next.lang, next.text.slice(0, 40));
    try {
      await speak(next.text, next.lang);
    } catch (e) {
      console.warn("[voice] speak failed", e);
    } finally {
      playingRef.current = false;
      if (queueRef.current.length > 0) {
        void drain();
      }
    }
  }, []);


  const enqueue = useCallback((a: Announcement) => {
    // 去重
    if (queueRef.current.some((x) => x.id === a.id)) return;
    // 按 priority 插入（高优插队首之后，但在已播条目前）
    const q = queueRef.current;
    let i = 0;
    while (i < q.length && q[i].priority >= a.priority) i++;
    q.splice(i, 0, a);
    void drain();
  }, [drain]);

  // 解锁后尝试消费积压
  useEffect(() => {
    if (unlocked) void drain();
  }, [unlocked, drain]);

  // 场景 1：新订单 diff
  useEffect(() => {
    if (!ready) return;
    if (!initializedRef.current) {
      // 首次拉到数据，仅记录已有订单，不播报
      orders.forEach((o) => {
        seenOrderIdsRef.current.add(o.id);
        if (isPendingOrder(o)) {
          overdueRoundsRef.current.set(o.id, overdueRoundForWait(minsSince(o.submittedAt)));
        }
      });
      initializedRef.current = true;
      return;
    }
    const newPending = orders
      .filter((o) => isPendingOrder(o) && !seenOrderIdsRef.current.has(o.id))
      .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
    newPending.forEach((o) => {
      seenOrderIdsRef.current.add(o.id);
      enqueue({
        id: `new_order:${o.id}`,
        kind: "new_order",
        text: buildNewOrderText(o, langRef.current),
        lang: langRef.current,
        priority: NEW_ORDER_PRIORITY,
      });
    });
    // 同步：当前 orders 之外的旧 id 不清理（防止订单刷新后重复播报）
  }, [orders, ready, enqueue]);

  // 场景 2：超时未接 — 每分钟扫描；订单离开"待处理"立即清理已排队的超时播报
  useEffect(() => {
    if (!ready) return;
    const pendingIds = new Set(orders.filter(isPendingOrder).map((o) => o.id));
    pendingOrderIdsRef.current = pendingIds;

    // 清掉队列里指向已离开"待处理"订单的超时播报
    queueRef.current = queueRef.current.filter((a) => {
      if (a.kind !== "pending_overdue") return true;
      const oid = pendingOverdueOrderId(a);
      return Boolean(oid && pendingIds.has(oid));
    });
    // 不再 pending 的清理轮次记录
    for (const id of Array.from(overdueRoundsRef.current.keys())) {
      if (!pendingIds.has(id)) overdueRoundsRef.current.delete(id);
    }

    const scan = () => {
      orders.forEach((o) => {
        if (!isPendingOrder(o)) return;
        const waited = minsSince(o.submittedAt);
        const round = overdueRoundsRef.current.get(o.id) ?? 0;
        if (round < 1 && waited >= OVERDUE_FIRST_MIN) {
          overdueRoundsRef.current.set(o.id, 1);
          enqueue({
            id: `pending_overdue:${o.id}:1`,
            kind: "pending_overdue",
            text: buildPendingOverdueText(o, waited, langRef.current),
            lang: langRef.current,
            priority: OVERDUE_PRIORITY,
          });
        } else if (round < 2 && waited >= OVERDUE_SECOND_MIN) {
          overdueRoundsRef.current.set(o.id, 2);
          enqueue({
            id: `pending_overdue:${o.id}:2`,
            kind: "pending_overdue",
            text: buildPendingOverdueText(o, waited, langRef.current),
            lang: langRef.current,
            priority: OVERDUE_PRIORITY,
          });
        }
      });
    };
    scan();
    const timer = window.setInterval(scan, 60_000);
    return () => window.clearInterval(timer);
  }, [orders, ready, enqueue]);


  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    }
    if (m && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      queueRef.current = [];
      playingRef.current = false;
    }
  }, []);

  const replayLast = useCallback(() => {
    const last = lastAnnouncementRef.current;
    if (!last) return;
    enqueue({ ...last, id: `${last.id}:replay:${Date.now()}` });
  }, [enqueue]);

  const testSpeak = useCallback(() => {
    // 用户主动点击触发：天然解锁 autoplay；强制入队一条测试播报，绕过 muted/diff 逻辑。
    unlockedRef.current = true;
    setUnlocked(true);
    mutedRef.current = false;
    setMutedState(false);
    if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, "0");
    const text = langRef.current === "zh"
      ? "语音播报测试。来新订单啦，鸡扒蛋炒饭 两份，备注少辣，请核对 PayNow 金额 12 新币 80 分。"
      : "Voice test. New order in. Chicken Cutlet Fried Rice times two. Note: less spicy. Please verify PayNow amount S$12.80.";
    enqueue({
      id: `test:${Date.now()}`,
      kind: "new_order",
      text,
      lang: langRef.current,
      priority: 9,
    });
  }, [enqueue]);

  return { muted, setMuted, unlocked, replayLast, testSpeak };
}


