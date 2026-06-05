import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { IconButton, MobileShell, StatusBar, Toast } from "../../components/MobileShell";
import { LanguageToggle } from "../../components/LanguageToggle";
import { useLang } from "../../i18n/LanguageContext";
// 真实数据：dishes / orders / threads 默认空，由后端逐步填充；shop 从 getMyRestaurants 同步
import type { ChatMessage, MerchantDish, MerchantOrder, MerchantPage, MessageThread, OrderStatus, Shop } from "../../types/merchant";
import { useMerchantAuth } from "./useMerchantAuth";
import { getMyRestaurants, listHawkerCenters, createFirstRestaurant, updateMyRestaurant, uploadRestaurantAsset, uploadMenuItemImage, listRestaurantOrders, updateOrderStatus, setRestaurantOpen, setRestaurantMenuTemplate } from "../../lib/merchant.functions";
import { listMyMenuItems, publishMenu, getLatestMenuVersion, deleteMenuItem, updateMenuItem } from "../../lib/menu-import.functions";
import {
  AvailabilityToggle,
  BottomActionBar,
  CategoryTabs,
  MenuItemCard,
  MessageItem,
  OrderCard,
  PageHeader,
  ShopEditorSheet,
  StackHeader,
  TabBar,
} from "./components";
import { HawkerCenterPicker } from "./HawkerCenterPicker";
import { useVoiceAnnouncer } from "./voice/useVoiceAnnouncer";
// 菜单导入页较大（OCR/裁剪等），登录前页面用不到，按需懒加载以缩短首屏 JS
const menuImportLoader = () => import("./MenuImportPage").then((m) => ({ default: m.MenuImportPage }));
const MenuImportPage = lazy(menuImportLoader);
let menuImportPrefetched: Promise<unknown> | null = null;
const prefetchMenuImport = () => {
  if (!menuImportPrefetched) menuImportPrefetched = menuImportLoader();
  return menuImportPrefetched;
};

const COUNTRIES = [
  { code: "SG", flag: "🇸🇬", dial: "+65", length: 8, placeholder: "91234567" },
  { code: "MY", flag: "🇲🇾", dial: "+60", length: 10, placeholder: "123456789" },
  { code: "CN", flag: "🇨🇳", dial: "+86", length: 11, placeholder: "13800138000" },
  { code: "HK", flag: "🇭🇰", dial: "+852", length: 8, placeholder: "61234567" },
  { code: "TW", flag: "🇹🇼", dial: "+886", length: 9, placeholder: "912345678" },
  { code: "ID", flag: "🇮🇩", dial: "+62", length: 11, placeholder: "81234567890" },
  { code: "TH", flag: "🇹🇭", dial: "+66", length: 9, placeholder: "812345678" },
  { code: "PH", flag: "🇵🇭", dial: "+63", length: 10, placeholder: "9171234567" },
  { code: "VN", flag: "🇻🇳", dial: "+84", length: 9, placeholder: "912345678" },
  { code: "IN", flag: "🇮🇳", dial: "+91", length: 10, placeholder: "9876543210" },
  { code: "US", flag: "🇺🇸", dial: "+1", length: 10, placeholder: "4155551234" },
  { code: "GB", flag: "🇬🇧", dial: "+44", length: 10, placeholder: "7400123456" },
  { code: "AU", flag: "🇦🇺", dial: "+61", length: 9, placeholder: "412345678" },
  { code: "JP", flag: "🇯🇵", dial: "+81", length: 10, placeholder: "9012345678" },
  { code: "KR", flag: "🇰🇷", dial: "+82", length: 10, placeholder: "1012345678" },
];


// 顾客点餐链接始终使用已发布的生产域名，避免落到 preview / lovableproject 域名上要求 Lovable 登录。
const CUSTOMER_BASE_URL = "https://eatlah.lovable.app";

function orderMenuUrl(slug: string | undefined | null) {
  const path = slug ? `/c/${encodeURIComponent(slug)}` : "/c/";
  return `${CUSTOMER_BASE_URL}${path}`;
}

function qrImageUrl(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(url)}`;
}

function MenuProcessingIllustration() {
  return (
    <svg className="menu-scan-ill" viewBox="0 0 280 210" aria-hidden="true">
      <rect x="44" y="30" width="192" height="142" rx="14" fill="#fff" />
      <path d="M44 74h192" stroke="#211f20" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M78 52h64M164 52h36" stroke="#211f20" strokeWidth="4.5" strokeLinecap="round" />
      <rect className="scan-line" x="36" y="104" width="208" height="34" rx="17" fill="rgba(6,63,49,.42)" />
      <rect x="66" y="90" width="52" height="42" rx="9" fill="#e9fff3" stroke="#211f20" strokeWidth="4" />
      <path d="M138 96h66M138 116h48M138 136h74" stroke="#211f20" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="66" y="142" width="52" height="34" rx="9" fill="#fff2d8" stroke="#211f20" strokeWidth="4" />
      <path d="M138 150h62M138 166h42" stroke="#211f20" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="44" y="30" width="192" height="142" rx="14" fill="none" stroke="#211f20" strokeWidth="4.5" />
      <path d="M58 190h164" stroke="#211f20" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

export function MerchantApp() {
  const { t, lang } = useLang();
  const auth = useMerchantAuth();
  const queryClient = useQueryClient();
  const fetchMyRestaurants = useServerFn(getMyRestaurants);
  const fetchHawkerCenters = useServerFn(listHawkerCenters);
  const callCreateFirstRestaurant = useServerFn(createFirstRestaurant);
  const fetchMyMenuItems = useServerFn(listMyMenuItems);
  const callUpdateMyRestaurant = useServerFn(updateMyRestaurant);
  const callUploadRestaurantAsset = useServerFn(uploadRestaurantAsset);
  const callUploadMenuItemImage = useServerFn(uploadMenuItemImage);
  const dishImageInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadDishImage = async (file: File) => {
    if (!selectedDish?.id || !/^[0-9a-f-]{36}$/i.test(selectedDish.id)) {
      showToast(t("请先保存菜品"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(t("图片过大，请选择小于 5MB 的文件"));
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const fileBase64 = btoa(binary);
      const ext = (file.name.split(".").pop() || "png").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "png";
      const res = await callUploadMenuItemImage({
        data: { itemId: selectedDish.id, contentType: file.type || "image/png", ext, fileBase64 },
      });
      const newUrl = res.signedUrl ?? "";
      setDishes((current) => current.map((d) => d.id === selectedDish.id ? { ...d, image: newUrl } : d));
      await queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      showToast(t("图片已上传"));
    } catch (err) {
      showToast(`${t("上传失败")}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const callSetRestaurantOpen = useServerFn(setRestaurantOpen);
  const callSetMenuTemplate = useServerFn(setRestaurantMenuTemplate);

  const [uploadingAsset, setUploadingAsset] = useState<null | "image" | "paynow">(null);

  const handleUploadRestaurantAsset = async (file: File, kind: "image" | "paynow") => {
    if (!activeRestaurant?.id) {
      showToast(t("请先登录"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(t("图片过大，请选择小于 5MB 的文件"));
      return;
    }
    setUploadingAsset(kind);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const fileBase64 = btoa(binary);
      const ext = (file.name.split(".").pop() || "png").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "png";
      const res = await callUploadRestaurantAsset({
        data: {
          restaurantId: activeRestaurant.id,
          kind,
          contentType: file.type || "image/png",
          ext,
          fileBase64,
        },
      });
      console.log("[upload] success", { kind, path: res.path, signedUrl: res.signedUrl });
      setShop((current) => kind === "image"
        ? { ...current, image: res.signedUrl ?? current.image }
        : { ...current, paynowImage: res.signedUrl ?? current.paynowImage });
      // 强制刷新餐厅数据，确保下次进入时仍能看到上传后的图片
      await queryClient.invalidateQueries({ queryKey: ["my-restaurants"] });
      await queryClient.refetchQueries({ queryKey: ["my-restaurants"] });
      showToast(t("图片已上传"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[upload] failed", err);
      showToast(`${t("上传失败")}: ${msg}`);
    } finally {
      setUploadingAsset(null);
    }
  };

  const myRestaurantsQuery = useQuery({
    queryKey: ["my-restaurants", auth.user?.id],
    queryFn: () => fetchMyRestaurants(),
    enabled: auth.status === "authenticated",
    staleTime: 30_000,
  });
  const hawkerCentersQuery = useQuery({
    queryKey: ["hawker-centers"],
    queryFn: () => fetchHawkerCenters(),
    staleTime: 5 * 60_000,
  });

  const [page, setPage] = useState<MerchantPage>("prelogin");
  const [shopOpen, setShopOpen] = useState(true);
  const [category, setCategory] = useState("全部");
  const [orderFilter, setOrderFilter] = useState("全部");
  const [selectedDishId, setSelectedDishId] = useState<string>("");
  const [selectedThreadId, setSelectedThreadId] = useState("system-stock");
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("菜品售罄");
  const [shopEditorOpen, setShopEditorOpen] = useState(false);
  const [qrSheetOpen, setQrSheetOpen] = useState(false);
  const [template, setTemplate] = useState<"经典菜单" | "图片菜单">("经典菜单");
  const [toast, setToast] = useState("");
  const [authCountry, setAuthCountry] = useState(COUNTRIES[0]);
  const [authPhone, setAuthPhone] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [emailMode, setEmailMode] = useState<"signin" | "signup">("signin");
  const [registerName, setRegisterName] = useState("");
  const [registerCenterId, setRegisterCenterId] = useState<string>("");
  const [registerBusy, setRegisterBusy] = useState(false);
  const [shop, setShop] = useState<Shop>({
    name: "",
    hawkerCenter: "",
    image: "",
    paynowImage: "",
    phone: "",
    address: "",
  });
  const [dishes, setDishes] = useState<MerchantDish[]>([]);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [ordersReady, setOrdersReady] = useState(false);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [pendingImport, setPendingImport] = useState(false);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 1600);
  };

  useEffect(() => {
    if (page !== "menu-processing") return undefined;
    const timer = window.setTimeout(() => {
      setPage("prelogin");
      showToast(t("请先登录后再导入菜单"));
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [page, t]);

  // 登录态变化时把 page 拉回合理位置
  useEffect(() => {
    if (auth.status === "anonymous") {
      if (!["prelogin", "login-method", "login-phone", "login-code", "login-email", "menu-processing"].includes(page)) {
        setPage("prelogin");
      }
    }
  }, [auth.status, page]);

  // 当用户进入菜单页时，提前预取菜单导入页的代码块，点击时几乎无感知加载
  useEffect(() => {
    if (page === "menu" || page === "home") prefetchMenuImport();
  }, [page]);

  // 处理"导入菜单"入口的延迟跳转：登录完成 + 有餐厅 → 进入 menu-import
  const pendingActiveRestaurantId = myRestaurantsQuery.data?.restaurants?.[0]?.id;
  useEffect(() => {
    if (!pendingImport) return;
    if (auth.status !== "authenticated") return;
    if (!pendingActiveRestaurantId) return;
    setPendingImport(false);
    setPage("menu-import");
  }, [pendingImport, auth.status, pendingActiveRestaurantId]);

  // 同步真实餐厅信息到 shop（替代之前的 mock 数据）
  const activeRestaurant = myRestaurantsQuery.data?.restaurants?.[0];
  useEffect(() => {
    if (!activeRestaurant) return;
    setShop({
      name: activeRestaurant.name ?? "",
      hawkerCenter: activeRestaurant.hawker_centers?.name ?? "",
      image: activeRestaurant.image_url ?? "",
      paynowImage: activeRestaurant.paynow_qr_url ?? "",
      phone: activeRestaurant.phone ?? "",
      address: activeRestaurant.address ?? "",
    });
    setShopOpen(Boolean(activeRestaurant.is_open));
    setTemplate(activeRestaurant.menu_template === "image" ? "图片菜单" : "经典菜单");
  }, [activeRestaurant?.id, activeRestaurant?.name, activeRestaurant?.hawker_centers?.name, activeRestaurant?.image_url, activeRestaurant?.paynow_qr_url, activeRestaurant?.phone, activeRestaurant?.address, activeRestaurant?.is_open, activeRestaurant?.menu_template]);

  // 拉取菜单
  const menuItemsQuery = useQuery({
    queryKey: ["menu-items", activeRestaurant?.id],
    queryFn: () => fetchMyMenuItems({ data: { restaurantId: activeRestaurant!.id } }),
    enabled: Boolean(activeRestaurant?.id),
    staleTime: 30_000,
  });
  useEffect(() => {
    if (menuItemsQuery.data?.items) {
      setDishes(menuItemsQuery.data.items as MerchantDish[]);
    }
  }, [menuItemsQuery.data]);

  // ===== 菜单发布 / 版本 =====
  const callPublishMenu = useServerFn(publishMenu);
  const fetchLatestMenuVersion = useServerFn(getLatestMenuVersion);
  const latestMenuVersionQuery = useQuery({
    queryKey: ["latest-menu-version", activeRestaurant?.id],
    queryFn: () => fetchLatestMenuVersion({ data: { restaurantId: activeRestaurant!.id } }),
    enabled: Boolean(activeRestaurant?.id),
    staleTime: 10_000,
  });
  const publishMutation = useMutation({
    mutationFn: (restaurantId: string) => callPublishMenu({ data: { restaurantId } }),
    onSuccess: (r, restaurantId) => {
      showToast(`${t("菜单已发布")} · v${r.versionNumber} · ${r.itemCount} ${t("道菜")}`);
      queryClient.invalidateQueries({ queryKey: ["latest-menu-version", restaurantId] });
    },
    onError: (e: Error) => showToast(`${t("发布失败")}: ${e.message}`),
  });
  const callDeleteMenuItem = useServerFn(deleteMenuItem);
  const deleteDishMutation = useMutation({
    mutationFn: (itemId: string) => callDeleteMenuItem({ data: { itemId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items", activeRestaurant?.id] });
    },
    onError: (e: Error) => showToast(`${t("删除失败")}: ${e.message}`),
  });
  const callUpdateMenuItem = useServerFn(updateMenuItem);
  type UpdateMenuItemPayload = {
    itemId: string;
    name: string;
    english_name: string | null;
    price: number;
    description: string | null;
    options: { name: string; name_en: string | null; price_delta: number }[];
  };
  const updateDishMutation = useMutation({
    mutationFn: (payload: UpdateMenuItemPayload) =>
      callUpdateMenuItem({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items", activeRestaurant?.id] });
    },
    onError: (e: Error) => showToast(`${t("保存失败")}: ${e.message}`),
  });





  // 拉取订单（轮询同步顾客端下单）
  const fetchOrders = useServerFn(listRestaurantOrders);
  const callUpdateOrderStatus = useServerFn(updateOrderStatus);
  const ordersQuery = useQuery({
    queryKey: ["restaurant-orders", activeRestaurant?.id],
    queryFn: () => fetchOrders({ data: { restaurantId: activeRestaurant!.id } }),
    enabled: Boolean(activeRestaurant?.id),
    refetchInterval: 5000,
    staleTime: 0,
  });
  useEffect(() => {
    const list = ordersQuery.data?.orders;
    if (!list) return;
    const STATUS_MAP: Record<string, OrderStatus> = {
      pending: "待处理", preparing: "制作中", completed: "已完成", cancelled: "已取消",
    };
    const mapped: MerchantOrder[] = list.map((o: any) => {
      const d = new Date(o.submitted_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      const itemPairs: [string, number][] = (o.order_items ?? []).map((it: any) => {
        const opts = (it.order_item_options ?? []).map((x: any) => x.name_snapshot).join("/");
        const label = opts ? `${it.name_snapshot}(${opts})` : it.name_snapshot;
        return [label, Number(it.quantity)];
      });
      const payMethod: "paynow" | "cash" = o.payment_status === "unpaid" ? "cash" : "paynow";
      return {
        id: o.id,
        displayNumber: o.display_number,
        type: o.service_type === "takeaway" ? "外带" : "堂食",
        paymentMethod: payMethod,
        paymentStatus: o.payment_status,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        status: STATUS_MAP[o.status] ?? "待处理",
        note: o.customer_note ?? "",
        items: itemPairs,
        totalAmount: Number(o.total_amount ?? 0),
        submittedAt: o.submitted_at,
        startedAt: o.started_at ?? null,
        completedAt: o.completed_at ?? null,
        cancelReason: o.cancel_reason ?? null,
      };
    });
    setOrders(mapped);
    setOrdersReady(true);
  }, [ordersQuery.data]);

  // 语音播报：新订单 + 长时间未接单
  const voice = useVoiceAnnouncer({ orders, lang, ready: ordersReady });




  // 动态分类列表
  const categoryItems = useMemo(() => {
    const uniq = Array.from(new Set(dishes.map((d) => d.category).filter(Boolean)));
    return ["全部", ...uniq];
  }, [dishes]);
  useEffect(() => {
    if (category !== "全部" && !categoryItems.includes(category)) {
      setCategory("全部");
    }
  }, [categoryItems, category]);

  const unreadCount = threads.filter((thread) => thread.unread).length;
  const selectedDish = dishes.find((dish) => dish.id === selectedDishId) || dishes[0];
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) || threads[0];


  const setDishAvailability = (id: string, available: boolean) => {
    setDishes((current) => current.map((dish) => dish.id === id ? { ...dish, available } : dish));
  };

  const setOrderStatus = (id: string, status: OrderStatus, cancelReason?: string) => {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order));
    const MAP: Record<OrderStatus, "pending" | "preparing" | "completed" | "cancelled"> = {
      "待处理": "pending", "制作中": "preparing", "已完成": "completed", "已取消": "cancelled",
    };
    const dbStatus = MAP[status];
    // 仅对真实 UUID 订单同步到后端（本地 mock 订单跳过）
    if (/^[0-9a-f-]{36}$/i.test(id)) {
      callUpdateOrderStatus({ data: { orderId: id, status: dbStatus, cancelReason } })
        .then(() => queryClient.invalidateQueries({ queryKey: ["restaurant-orders", activeRestaurant?.id] }))
        .catch((e) => console.error("update order status failed", e));
    }
  };

  const saveDish = async () => {
    const get = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value || "";
    const name = get("dish-name") || selectedDish.name;
    const englishName = get("dish-english") || selectedDish.englishName;
    const priceStr = get("dish-price") || selectedDish.price;
    const description = get("dish-description") || selectedDish.description;
    const nextOptions = selectedDish.options.map((option, index) => ({
      name: get(`option-name-${index}`) || option.name,
      price: get(`option-price-${index}`).replace("+$", "") || option.price,
    }));
    setDishes((current) => current.map((dish) => {
      if (dish.id !== selectedDish.id) return dish;
      return {
        ...dish,
        name,
        englishName,
        price: priceStr,
        description,
        options: nextOptions,
      };
    }));
    // 持久化到数据库（仅对真实 UUID 菜品）
    if (/^[0-9a-f-]{36}$/i.test(selectedDish.id)) {
      try {
        await updateDishMutation.mutateAsync({
          itemId: selectedDish.id,
          name,
          english_name: englishName.trim() || null,
          price: Number.parseFloat(priceStr) || 0,
          description: description.trim() || null,
          options: nextOptions
            .filter((o) => o.name.trim())
            .map((o) => ({
              name: o.name.trim(),
              name_en: null,
              price_delta: Number.parseFloat(String(o.price).replace("+$", "")) || 0,
            })),
        });
      } catch {
        // onError 已 toast
        return;
      }
    }
    showToast(t("菜品已保存"));
    setPage("menu");
  };


  const handleSendOtp = async () => {
    if (authPhone.length !== authCountry.length) {
      showToast(t("请输入 8 位本地号码").replace("8", String(authCountry.length)));
      return;
    }
    setAuthBusy(true);
    try {
      await auth.signInWithPhone(authPhone, authCountry.dial);
      setAuthCode("");
      setPage("login-code");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`${t("短信发送失败")}: ${message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setAuthBusy(true);
    try {
      await auth.verifyOtp(authPhone, code, authCountry.dial);
      // 登录后 onAuthStateChange 会触发 status 更新，进入 dashboard / register 判断
    } catch (err) {
      setAuthCode("");
      const message = err instanceof Error ? err.message : String(err);
      showToast(`${t("验证码错误")}: ${message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    try {
      await auth.signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`${t("Google 登录失败")}: ${message}`);
      setAuthBusy(false);
    }
  };

  const handleEmailSubmit = async () => {
    const email = authEmail.trim();
    if (!email || !authPassword) {
      showToast(t("请输入邮箱和密码"));
      return;
    }
    setAuthBusy(true);
    try {
      if (emailMode === "signin") {
        await auth.signInWithEmail(email, authPassword);
      } else {
        await auth.signUpWithEmail(email, authPassword);
        showToast(t("请前往邮箱完成验证"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`${emailMode === "signin" ? t("登录失败") : t("注册失败")}: ${message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const renderAuth = () => {
    if (page === "login-method") {
      return (
        <section className="screen auth-screen">
          <StatusBar />
          <div className="auth-content">
            <div className="auth-nav">
              <IconButton icon="ri-arrow-left-s-line" label="Back" onClick={() => setPage("prelogin")} />
              <h1>{t("登录")}</h1>
              <span />
            </div>
            <div className="auth-body" style={{ gap: 12 }}>
              <button className="btn outline" disabled={authBusy} onClick={handleGoogleSignIn}>
                <i className="ri-google-fill" style={{ marginRight: 8 }} />
                {t("使用 Google 登录")}
              </button>
              <button className="btn neutral" disabled={authBusy} onClick={() => { setEmailMode("signin"); setPage("login-email"); }}>
                <i className="ri-mail-line" style={{ marginRight: 8 }} />
                {t("使用邮箱登录")}
              </button>
              <button className="btn neutral" disabled={authBusy} onClick={() => setPage("login-phone")}>
                <i className="ri-smartphone-line" style={{ marginRight: 8 }} />
                {t("使用手机号 OTP 登录")}
              </button>
            </div>
          </div>
        </section>
      );
    }

    if (page === "login-email") {
      return (
        <section className="screen auth-screen">
          <StatusBar />
          <div className="auth-content">
            <div className="auth-nav">
              <IconButton icon="ri-arrow-left-s-line" label="Back" onClick={() => setPage("login-method")} />
              <h1>{emailMode === "signin" ? t("邮箱登录") : t("邮箱注册")}</h1>
              <span />
            </div>
            <div className="auth-body">
              <label>{t("邮箱")}</label>
              <div className="phone-input-row">
                <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="name@example.com" />
              </div>
              <label style={{ marginTop: 12 }}>{t("密码")}</label>
              <div className="phone-input-row">
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button className="link-btn" style={{ marginTop: 12 }} onClick={() => setEmailMode((m) => m === "signin" ? "signup" : "signin")}>
                {emailMode === "signin" ? t("没有账号？注册") : t("已有账号？登录")}
              </button>
            </div>
            <button className="btn primary mt-auto" disabled={authBusy} onClick={handleEmailSubmit}>
              {authBusy ? t("处理中…") : (emailMode === "signin" ? t("登录") : t("注册"))}
            </button>
          </div>
        </section>
      );
    }

    if (page === "login-phone") {
      return (
        <section className="screen auth-screen">
          <StatusBar />
          <div className="auth-content">
            <div className="auth-nav">
              <IconButton icon="ri-arrow-left-s-line" label="Back" onClick={() => setPage("login-method")} />
              <h1>{t("登录")}</h1>
              <span />
            </div>
            <div className="auth-body">
              <label>{t("手机号码")}</label>
              <div className="phone-input-row">
                <select
                  value={authCountry.code}
                  onChange={(e) => {
                    const next = COUNTRIES.find((c) => c.code === e.target.value) || COUNTRIES[0];
                    setAuthCountry(next);
                    setAuthPhone("");
                  }}
                  style={{ background: "transparent", border: "none", fontSize: "inherit", fontWeight: "inherit", cursor: "pointer", outline: "none" }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>
                  ))}
                </select>
                <input value={authPhone} onChange={(event) => setAuthPhone(event.target.value.replace(/\D/g, "").slice(0, authCountry.length))} inputMode="numeric" placeholder={authCountry.placeholder} />
                <button onClick={() => setAuthPhone("")}><i className="ri-close-circle-fill" /></button>
              </div>
            </div>
            <button className="btn primary mt-auto" disabled={authBusy || authPhone.length !== authCountry.length} onClick={handleSendOtp}>
              {authBusy ? t("正在发送验证码…") : t("下一步")}
            </button>
          </div>
        </section>
      );
    }

    if (page === "login-code") {
      return (
        <section className="screen auth-screen">
          <StatusBar />
          <div className="auth-content">
            <div className="auth-nav">
              <IconButton icon="ri-arrow-left-s-line" label="Back" onClick={() => setPage("login-phone")} />
              <span />
              <span />
            </div>
            <div className="auth-body">
              <h2>{t("请输入验证码")}</h2>
              <p>{t("验证码将发送至")}<br />{authCountry.dial} {authPhone}</p>
              <div className="otp-row">
                {[0, 1, 2, 3, 4, 5].map((index) => <input key={index} value={authCode[index] || ""} readOnly />)}
              </div>
              <button className="link-btn" disabled={authBusy} onClick={handleSendOtp}>{t("再次发送")}</button>
              {authBusy && <p className="text-sm text-muted mt-2">{t("正在验证…")}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {"1234567890".split("").map((digit) => (
                <button
                  key={digit}
                  className="key-btn"
                  disabled={authBusy}
                  onClick={() => {
                    const next = (authCode + digit).slice(0, 6);
                    setAuthCode(next);
                    if (next.length === 6) {
                      void handleVerifyOtp(next);
                    }
                  }}
                >
                  {digit}
                </button>
              ))}
              <button className="key-btn" disabled={authBusy} onClick={() => setAuthCode((c) => c.slice(0, -1))}>
                <i className="ri-delete-back-2-line" />
              </button>
            </div>
          </div>
        </section>
      );
    }



    if (page === "menu-processing") {
      return (
        <section className="screen bg-white">
          <StatusBar />
          <button className="processing-close safe-top" onClick={() => setPage("prelogin")}><i className="ri-close-line" /></button>
          <div className="processing-body">
            <MenuProcessingIllustration />
            <h2>{t("正在识别菜单")}</h2>
            <p>{t("这可能需要几秒钟")}</p>
          </div>
        </section>
      );
    }

    return (
      <section className="screen prelogin">
        <div className="pre-stage full-bleed-hero">
          <div className="prelogin-brand">
            <img className="prelogin-logo" src="/assets/eatlah-logo.jpg" alt="EatLah" />
            <p>{t("拍菜单，扫码点单")}</p>
          </div>
        </div>
        <img className="prelogin-illustration" src="/assets/eatlah-laupasat-illustration.svg" alt="" />
        <div className="pre-cta">
          <LanguageToggle />
          <button className="btn primary prelogin-login-btn" disabled={authBusy} onClick={handleGoogleSignIn}>{t("登录")}</button>
          <button className="btn secondary prelogin-import-btn" disabled={authBusy} onClick={() => { setPendingImport(true); handleGoogleSignIn(); }}>{t("新用户？导入菜单")}</button>
        </div>
      </section>
    );
  };

  const handleCreateRestaurant = async () => {
    const name = registerName.trim();
    if (!name) {
      showToast(t("请填写餐厅名称"));
      return;
    }
    if (!registerCenterId) {
      showToast(t("请选择熟食中心"));
      return;
    }
    setRegisterBusy(true);
    try {
      const result = await callCreateFirstRestaurant({ data: { name, hawkerCenterId: registerCenterId } });
      setShop((current) => ({ ...current, name: result.restaurant.name }));
      await queryClient.invalidateQueries({ queryKey: ["my-restaurants"] });
      setPage("home");
      showToast(t("注册已完成"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`${t("创建失败")}: ${message}`);
    } finally {
      setRegisterBusy(false);
    }
  };

  const renderRegister = () => {
    const centers = hawkerCentersQuery.data?.centers ?? [];
    return (
      <section className="screen auth-screen">
        <StatusBar />
        <div className="profile-scroll">
          <h1>{t("创建第一家餐厅")}</h1>
          <p>{t("发布扫码菜单前，需要先完成基础资料。")}</p>
          <div className="fields">
            <label className="field">
              <span>{t("餐厅名称")}</span>
              <input value={registerName} onChange={(e) => setRegisterName(e.target.value)} maxLength={80} placeholder="例如：阿强海南鸡饭" />
            </label>
            <label className="field">
              <span>{t("所属熟食中心")}</span>
              <HawkerCenterPicker
                value={registerCenterId}
                centers={centers}
                loading={hawkerCentersQuery.isLoading}
                onChange={setRegisterCenterId}
              />
            </label>
          </div>
          <button className="btn primary mt-5" disabled={registerBusy} onClick={handleCreateRestaurant}>
            {registerBusy ? t("创建中…") : t("完成注册")}
          </button>
          <button className="link-btn mt-3" onClick={() => void auth.signOut()}>{t("退出登录")}</button>
        </div>
        <Toast text={toast} />
      </section>
    );
  };


  const renderHome = () => {
    // 新加坡时区"今日"起始
    const sgDayStart = (() => {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Singapore",
        year: "numeric", month: "2-digit", day: "2-digit",
      });
      return new Date(`${fmt.format(new Date())}T00:00:00+08:00`).getTime();
    })();
    const now = Date.now();
    const minsSince = (iso?: string | null) => {
      if (!iso) return 0;
      return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
    };

    const todayOrders = orders.filter((o) => {
      const t = o.submittedAt ? new Date(o.submittedAt).getTime() : 0;
      return t >= sgDayStart;
    });
    const pendingOrders = todayOrders.filter((o) => o.status === "待处理");
    const preparingOrders = todayOrders.filter((o) => o.status === "制作中");
    const completedOrders = todayOrders.filter((o) => o.status === "已完成");
    const revenueOrders = todayOrders.filter((o) => o.status !== "已取消");
    const revenue = revenueOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const avgTicket = revenueOrders.length ? revenue / revenueOrders.length : 0;

    const longestPendingMin = pendingOrders.reduce((m, o) => Math.max(m, minsSince(o.submittedAt)), 0);
    const longestPreparingMin = preparingOrders.reduce((m, o) => Math.max(m, minsSince(o.startedAt ?? o.submittedAt)), 0);

    // 异常订单
    const TIMEOUT_PENDING = 5;
    const TIMEOUT_PREPARING = 20;
    type Alert = { id: string; order: MerchantOrder; reason: string; severity: "warn" | "danger" };
    const alerts: Alert[] = [];
    pendingOrders.forEach((o) => {
      const m = minsSince(o.submittedAt);
      if (m >= TIMEOUT_PENDING) {
        alerts.push({ id: o.id, order: o, reason: `${t("接单超时")} · ${m} ${t("分钟")}`, severity: m >= TIMEOUT_PENDING * 2 ? "danger" : "warn" });
      } else if (o.paymentStatus === "declared_paid") {
        alerts.push({ id: o.id, order: o, reason: t("PayNow 待核对"), severity: "warn" });
      }
    });
    preparingOrders.forEach((o) => {
      const m = minsSince(o.startedAt ?? o.submittedAt);
      if (m >= TIMEOUT_PREPARING) {
        alerts.push({ id: o.id, order: o, reason: `${t("制作超时")} · ${m} ${t("分钟")}`, severity: m >= TIMEOUT_PREPARING * 1.5 ? "danger" : "warn" });
      }
    });
    const topAlerts = alerts.slice(0, 3);

    // 制作中菜品聚合（仅统计商家已点击"开始制作"的订单）
    const dishAgg = new Map<string, number>();
    preparingOrders.forEach((o) => {
      o.items.forEach(([name, qty]) => {
        // 去掉括号中的选项，仅按主菜名汇总
        const base = name.replace(/\(.*?\)/, "").trim();
        dishAgg.set(base, (dishAgg.get(base) ?? 0) + qty);
      });
    });
    const aggList = Array.from(dishAgg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // 平均出餐时长（pending submitted_at → completed_at）
    const durations = completedOrders
      .map((o) => (o.completedAt && o.submittedAt ? (new Date(o.completedAt).getTime() - new Date(o.submittedAt).getTime()) / 60000 : null))
      .filter((x): x is number => x !== null && x >= 0);
    const avgMakeMin = durations.length ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length) : 0;
    const cancelRate = todayOrders.length ? Math.round((todayOrders.filter((o) => o.status === "已取消").length / todayOrders.length) * 100) : 0;

    

    const toggleShopOpen = async () => {
      if (!activeRestaurant?.id) return;
      const next = !shopOpen;
      setShopOpen(next);
      try {
        await callSetRestaurantOpen({ data: { id: activeRestaurant.id, isOpen: next } });
        queryClient.invalidateQueries({ queryKey: ["my-restaurants"] });
      } catch (e) {
        setShopOpen(!next);
        showToast(t("操作失败，请重试"));
      }
    };

    return (
      <section className="screen">
        <div className="scroll">
          <PageHeader
            title={t(shop.name)}
            right={
              <>
                <button className={`store-switch ${shopOpen ? "" : "closed"}`} onClick={toggleShopOpen}>
                  <span className="pulse-dot" />{shopOpen ? t("营业中") : t("已打烊")}
                </button>
              </>
            }
          />

          <div className="metrics metrics-4">
            <div className={`metric pending ${pendingOrders.length > 0 ? "is-hot" : ""}`}>
              <small>{t("待处理")}</small>
              <strong>{pendingOrders.length}</strong>
              <span className="metric-sub">{longestPendingMin > 0 ? `${t("最久")} ${longestPendingMin}${t("分钟")}` : t("暂无新单")}</span>
            </div>
            <div className={`metric preparing ${longestPreparingMin >= 15 ? "is-hot" : ""}`}>
              <small>{t("制作中")}</small>
              <strong>{preparingOrders.length}</strong>
              <span className="metric-sub">{longestPreparingMin > 0 ? `${t("最久")} ${longestPreparingMin}${t("分钟")}` : "—"}</span>
            </div>
            <div className="metric done">
              <small>{t("今日完成")}</small>
              <strong>{completedOrders.length}</strong>
              <span className="metric-sub">{avgMakeMin > 0 ? `${t("均出餐")} ${avgMakeMin}${t("分钟")}` : "—"}</span>
            </div>
            <div className="metric revenue">
              <small>{t("今日营收")}</small>
              <strong>${revenue.toFixed(0)}</strong>
              <span className="metric-sub">{avgTicket > 0 ? `${t("均单价")} $${avgTicket.toFixed(1)}` : "—"}</span>
            </div>
          </div>

          {topAlerts.length > 0 && (
            <div className="dash-block">
              <div className="dash-block-head">
                <h3>{t("需要立即处理")}</h3>
                <button className="dash-link" onClick={() => setPage("orders")}>{t("查看全部")} ›</button>
              </div>
              <div className="alert-list">
                {topAlerts.map((a) => (
                  <button key={a.id} className={`alert-row ${a.severity}`} onClick={() => setPage("orders")}>
                    <span className="alert-num">#{a.order.displayNumber}</span>
                    <span className="alert-reason">{a.reason}</span>
                    {typeof a.order.totalAmount === "number" && (
                      <span className="alert-amount">S${a.order.totalAmount.toFixed(2)}</span>
                    )}
                    <span className="alert-type">{a.order.type}</span>
                    <i className="ri-arrow-right-s-line" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="dash-block">
            <div className="dash-block-head">
              <h3>{t("正在制作")}</h3>
            </div>
            {aggList.length > 0 ? (
              <div className="dish-agg">
                {aggList.map(([name, qty]) => (
                  <span key={name} className="dish-agg-chip">
                    <span className="dish-agg-name">{name}</span>
                    <span className="dish-agg-qty">×{qty}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="dish-agg-empty" style={{ padding: "12px 4px", color: "#94a3b8", fontSize: 14 }}>
                {t("没有待制作的菜品")}
              </div>
            )}
          </div>



        </div>
        <TabBar active="home" onChange={setPage} />
        {renderCancelSheet()}
        <Toast text={toast} />
      </section>
    );
  };

  const renderMenu = () => {
    const items = dishes.filter((dish) => category === "全部" || dish.category === category);
    const latest = latestMenuVersionQuery.data;
    const metaParts: string[] = [];
    if (latest?.publishedAt) {
      metaParts.push(`${t("最近发布")} ${new Date(latest.publishedAt).toLocaleString()}`);
    }
    return (
      <section className="screen">
        <div className="scroll menu-scroll">
          <PageHeader title={t("菜品库")} meta={metaParts.join(" · ")} />
          <CategoryTabs items={categoryItems} active={category} onChange={setCategory} />
          <div className="grid gap-3">
            {items.length === 0 ? (
              <div
                style={{
                  margin: "12px 16px",
                  padding: "32px 16px",
                  borderRadius: 12,
                  background: "#fff",
                  border: "1px dashed rgba(33,31,32,0.15)",
                  textAlign: "center",
                  color: "#9aa39e",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {t("暂无菜品")}
              </div>
            ) : (
              items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onOpen={() => { setSelectedDishId(item.id); setPage("detail"); }}
                  onAvailabilityChange={(available) => setDishAvailability(item.id, available)}
                />
              ))
            )}
          </div>
        </div>
        <BottomActionBar
          secondary={<><i className="ri-camera-line" />{t("导入菜单")}</>}
          primary={publishMutation.isPending
            ? <>{t("发布中…")}</>
            : <><i className="ri-send-plane-2-line" />{t("发布菜单")}</>}
          onSecondary={() => setPage("menu-import")}
          onSecondaryHover={prefetchMenuImport}
          onPrimary={() => {
            if (publishMutation.isPending) return;
            if (!activeRestaurant) { showToast(t("店铺尚未配置")); return; }
            if (dishes.length === 0) { showToast(t("暂无菜品")); return; }
            publishMutation.mutate(activeRestaurant.id);
          }}
        />
        <TabBar active="menu" onChange={setPage} />
        <Toast text={toast} />
      </section>
    );
  };



  const renderDetail = () => (
    <section className="screen">
      <div className="detail-photo full-bleed-hero">
        <img src={selectedDish.image} alt="" />
        <IconButton icon="ri-arrow-left-s-line" label="Back" className="safe-top" onClick={() => setPage("menu")} />
        <button type="button" className="photo-upload" onClick={() => dishImageInputRef.current?.click()}>
          <i className="ri-camera-line" /> {t("拍照 / 上传")}
        </button>
        <input
          ref={dishImageInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUploadDishImage(f);
            e.target.value = "";
          }}
        />
      </div>
      <div className="scroll detail-scroll">
        <PageHeader title={t(selectedDish.name)} />
        <div className="fields">
          <label className="field"><span>{t("菜名")}</span><input defaultValue={selectedDish.name} id="dish-name" /></label>
          <label className="field"><span>{t("英文名")}</span><input defaultValue={selectedDish.englishName} id="dish-english" /></label>
          <label className="field"><span>{t("价格")}</span><input defaultValue={selectedDish.price} id="dish-price" /></label>
          <label className="field"><span>{t("菜品描述")}</span><textarea defaultValue={selectedDish.description} id="dish-description" /></label>
          <label className="field">
            <span>{t("今日供应")}</span>
            <AvailabilityToggle available={selectedDish.available} large onChange={(available) => setDishAvailability(selectedDish.id, available)} />
          </label>
          <div className="field options-field">
            <div className="options-field__head">
              <span>{t("可选项")}</span>
            </div>
            {selectedDish.options.map((option, index) => (
              <div key={`opt-${index}-${selectedDish.options.length}`} className="option-edit-row">
                <input defaultValue={option.name} id={`option-name-${index}`} />
                <input defaultValue={`+$${option.price}`} id={`option-price-${index}`} />
                <button
                  type="button"
                  className="option-edit-remove"
                  aria-label={t("删除选项")}
                  onClick={() => {
                    setDishes((current) => current.map((dish) =>
                      dish.id === selectedDish.id
                        ? { ...dish, options: dish.options.filter((_, i) => i !== index) }
                        : dish
                    ));
                  }}
                >
                  <i className="ri-close-line" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="add-option-row"
              onClick={() => {
                setDishes((current) => current.map((dish) => dish.id === selectedDish.id ? { ...dish, options: [...dish.options, { name: t("新选项"), price: "0.00" }] } : dish));
              }}
            >
              <i className="ri-add-line" />
              <span>{t("添加选项")}</span>
            </button>
          </div>
        </div>
      </div>
      <BottomActionBar
        className="bottom-action-bar--standalone"
        secondary={<><i className="ri-delete-bin-line" />{t("删除")}</>}
        primary={<><i className="ri-check-line" />{t("保存")}</>}
        onSecondary={() => {
          const id = selectedDish.id;
          setDishes((current) => current.filter((dish) => dish.id !== id));
          setPage("menu");
          if (/^[0-9a-f-]{36}$/i.test(id)) {
            deleteDishMutation.mutate(id);
          }
        }}
        onPrimary={saveDish}
      />
      <Toast text={toast} />
    </section>
  );

  const renderOrders = () => {
    const list = orders.filter((order) => orderFilter === "全部" ? order.status !== "已取消" : order.status === orderFilter);
    return (
      <section className="screen">
        <div className="scroll">
          <PageHeader title={t("订单管理")} meta={`${t("今天")} ${orders.length} · ${orders.filter((order) => order.status === "待处理").length} ${t("待处理")}`} />
          <CategoryTabs items={["全部", "待处理", "制作中", "已完成", "已取消"]} active={orderFilter} onChange={setOrderFilter} />
          <div className="grid gap-3">
            {list.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStart={() => setOrderStatus(order.id, "制作中")}
                onFinish={() => setOrderStatus(order.id, "已完成")}
                onCancel={() => setCancelOrderId(order.id)}
              />
            ))}
          </div>
        </div>
        <TabBar active="orders" onChange={setPage} />
        {renderCancelSheet()}
        <Toast text={toast} />
      </section>
    );
  };

  const renderMessages = () => (
    <section className="screen">
      <div className="scroll">
        <StackHeader title={t("消息")} meta={`${unreadCount} · ${t("系统提醒和顾客消息")}`} onBack={() => setPage("home")} />
        <div className="grid gap-3">
          {threads.map((thread) => (
            <MessageItem
              key={thread.id}
              thread={thread}
              onOpen={() => {
                setSelectedThreadId(thread.id);
                setThreads((current) => current.map((item) => item.id === thread.id ? { ...item, unread: false } : item));
                setPage("chat");
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );

  const renderChat = () => {
    const send = () => {
      const input = document.getElementById("chat-input") as HTMLInputElement | null;
      const text = input?.value.trim();
      if (!text) return;
      const message: ChatMessage = { from: "merchant", text, time: "刚刚" };
      setThreads((current) => current.map((thread) => thread.id === selectedThread.id ? { ...thread, subtitle: text, time: "刚刚", messages: [...thread.messages, message] } : thread));
      if (input) input.value = "";
    };
    return (
      <section className="screen">
        <div className="scroll chat-scroll">
          <StackHeader title={t(selectedThread.title)} meta={t(selectedThread.subtitle)} onBack={() => setPage("messages")} />
          <section className="chat-context">
            <p>{t(selectedThread.context.label)}</p>
            <b>{t(selectedThread.context.value)}</b>
          </section>
          <div className="chat-day">{t("今天")}</div>
          {selectedThread.messages.map((message, index) => (
            <div key={`${message.time}-${index}`} className={`bubble-row ${message.from === "merchant" ? "me" : ""}`}>
              <div className={`bubble ${message.from === "system" ? "system" : ""}`}>
                <p>{t(message.text)}</p>
                <small>{t(message.time)}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input-bar sticky-bottom-bar safe-bottom">
          <input id="chat-input" placeholder={t("快速回复顾客...")} />
          <button onClick={send}><i className="ri-send-plane-2-fill" /></button>
        </div>
      </section>
    );
  };

  const renderMe = () => {
    // 收入统计（按新加坡时区分组，剔除已取消订单）
    const sgDateKey = (iso?: string | null) => {
      if (!iso) return "";
      try {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
      } catch {
        return "";
      }
    };
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const monthKey = todayKey.slice(0, 7);
    const paidOrders = orders.filter((o) => o.status !== "已取消");
    const todayIncome = paidOrders.filter((o) => sgDateKey(o.submittedAt) === todayKey).reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const monthIncome = paidOrders.filter((o) => sgDateKey(o.submittedAt).startsWith(monthKey)).reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);

    // 近 7 日
    const days: { key: string; label: string; value: number }[] = [];
    const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" });
    const labelFmt = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Singapore", month: "numeric", day: "numeric" });
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push({ key: dayFmt.format(d), label: labelFmt.format(d), value: 0 });
    }
    paidOrders.forEach((o) => {
      const k = sgDateKey(o.submittedAt);
      const slot = days.find((d) => d.key === k);
      if (slot) slot.value += Number(o.totalAmount ?? 0);
    });
    const sevenDayTotal = days.reduce((s, d) => s + d.value, 0);
    const maxVal = Math.max(1, ...days.map((d) => d.value));
    const W = 320, H = 72, padX = 6, padY = 8;
    const stepX = (W - padX * 2) / (days.length - 1);
    const points = days.map((d, i) => {
      const x = padX + i * stepX;
      const y = padY + (H - padY * 2) * (1 - d.value / maxVal);
      return { x, y };
    });
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)} ${H} L${points[0].x.toFixed(1)} ${H} Z`;
    const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

    return (
    <section className="screen me-screen">
      <div className="scroll me-scroll">
        <section className="me-hero full-bleed-hero">
          <img src={shop.image} alt="" />
          <div className="me-hero-actions safe-top">
            <IconButton icon="ri-edit-line" label="Edit restaurant" onClick={() => setShopEditorOpen(true)} />
          </div>
          <div className="me-hero-text">
            <h1>{t(shop.name)}</h1>
            <p>{t(shop.hawkerCenter)} · {t(template)}</p>
          </div>
        </section>
        <div className="me-content">
          <div className="metrics">
            <div className="metric revenue"><small>{t("今日扫码")}</small><strong>{orders.filter((o) => sgDateKey(o.submittedAt) === todayKey).length}</strong></div>
            <div className="metric pending"><small>{t("今日收入")}</small><strong>{fmtMoney(todayIncome)}</strong></div>
            <div className="metric visits"><small>{t("月收入")}</small><strong>{fmtMoney(monthIncome)}</strong></div>
          </div>
          <section className="mini-chart">
            <div className="flex justify-between"><h2>{t("近 7 日收入")}</h2><span>{fmtMoney(sevenDayTotal)}</span></div>
            <svg viewBox={`0 0 ${W} ${H}`}>
              <path d={areaPath} fill="rgba(5,170,103,.10)" />
              <path d={linePath} fill="none" stroke="#05aa67" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#05aa67" />
              ))}
            </svg>
            <div className="mini-chart-labels" style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888", marginTop: 4 }}>
              {days.map((d) => <span key={d.key}>{d.label}</span>)}
            </div>
          </section>
          <div className="template-row">
            {(["经典菜单", "图片菜单"] as const).map((name, index) => (
              <button key={name} className={`template-tile ${template === name ? "active" : ""}`} onClick={() => {
                if (template === name) return;
                setTemplate(name);
                const rid = activeRestaurant?.id;
                if (rid) {
                  void callSetMenuTemplate({ data: { id: rid, menuTemplate: name === "图片菜单" ? "image" : "classic" } })
                    .then(() => { void myRestaurantsQuery.refetch(); showToast(t("已保存")); })
                    .catch(() => { setTemplate(name === "经典菜单" ? "图片菜单" : "经典菜单"); showToast(t("保存失败")); });
                }
              }}>
                <div className={`template-art ${index ? "alt" : ""}`} />
                <b>{t(name)}</b>
                <p>{index ? t("突出招牌菜") : t("适合饭类小摊")}</p>
              </button>
            ))}
          </div>
          <div className="language-row">
            <span><i className="ri-translate-2" aria-hidden="true" />&nbsp;{t("语言")} / Language</span>
            <LanguageToggle compact />
          </div>
          <button className="qr-button" onClick={() => setQrSheetOpen(true)}>
            <span><i className="ri-qr-code-line" />{t("点餐二维码")}</span>
            <i className="ri-arrow-right-s-line" />
          </button>
          <button className="qr-button" onClick={() => voice.setMuted(!voice.muted)} aria-pressed={!voice.muted}>
            <span>
              <i className={voice.muted ? "ri-volume-mute-line" : "ri-volume-up-line"} />
              {t("语音播报")}
            </span>
            <span style={{ color: voice.muted ? "#888" : "#05aa67", fontWeight: 600 }}>
              {voice.muted ? t("已静音") : t("已开启")}
            </span>
          </button>

          <button className="logout-btn" onClick={() => { void auth.signOut(); setPage("prelogin"); }}>
            <i className="ri-logout-box-r-line" />{t("登出")}
          </button>

        </div>
      </div>
      <TabBar active="me" onChange={setPage} />
      <ShopEditorSheet
        open={shopEditorOpen}
        shop={shop}
        hawkerCenterId={activeRestaurant?.hawker_center_id ?? ""}
        hawkerCenters={hawkerCentersQuery.data?.centers ?? []}
        hawkerCentersLoading={hawkerCentersQuery.isLoading}
        onClose={() => setShopEditorOpen(false)}
        onSave={async (next, nextCenterId) => {
          if (!activeRestaurant?.id) {
            showToast(t("请先登录"));
            return;
          }
          setShop(next);
          try {
            await callUpdateMyRestaurant({
              data: {
                id: activeRestaurant.id,
                name: next.name,
                phone: next.phone || null,
                address: next.address || null,
                hawkerCenterId: nextCenterId || null,
              },
            });
            await queryClient.invalidateQueries({ queryKey: ["my-restaurants"] });
            setShopEditorOpen(false);
            showToast(t("餐厅信息已更新"));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            showToast(`${t("保存失败")}: ${msg}`);
          }
        }}
        onUploadShop={(file) => handleUploadRestaurantAsset(file, "image")}
        onUploadPayNow={(file) => handleUploadRestaurantAsset(file, "paynow")}
      />
      {renderQrSheet()}
      {uploadingAsset && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            background: "rgba(15, 23, 19, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
          }}
          aria-live="polite"
        >
          <div
            style={{
              width: 42,
              height: 42,
              border: "3px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <span>{uploadingAsset === "paynow" ? t("正在上传二维码…") : t("正在上传图片…")}</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <Toast text={toast} />
    </section>
    );
  };


  const renderCancelSheet = () => (
    <div className={`cancel-sheet ${cancelOrderId ? "open" : ""}`}>
      <div className="handle" />
      <h2>{t("取消订单")}</h2>
      <p>{t("选择原因，系统会同步给顾客。")}</p>
      {["菜品售罄", "现在做不完", "其他原因"].map((reason) => (
        <button key={reason} className={cancelReason === reason ? "selected" : ""} onClick={() => setCancelReason(reason)}>
          <span>{t(reason)}</span><i className="ri-arrow-right-s-line" />
        </button>
      ))}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button className="btn secondary" onClick={() => setCancelOrderId(null)}>{t("返回")}</button>
        <button className="btn danger" onClick={() => {
          if (cancelOrderId) setOrderStatus(cancelOrderId, "已取消", cancelReason);
          setCancelOrderId(null);
          showToast(`${t("已取消")}：${t(cancelReason)}`);
        }}>{t("确认取消")}</button>
      </div>
    </div>
  );

  const orderUrl = orderMenuUrl(activeRestaurant?.slug);
  const renderQrSheet = () => (
    <>
      <button className={`sheet-backdrop ${qrSheetOpen ? "open" : ""}`} onClick={() => setQrSheetOpen(false)} aria-label="Close QR sheet" />
      <div className={`center-modal ${qrSheetOpen ? "open" : ""}`}>

        <div className="qr-sheet-body">
          <h2>{t("点餐二维码")}</h2>
          <p>{t("顾客扫码进入菜单。长按二维码可保存图片。")}</p>
          <img className="qr-image" src={qrImageUrl(orderUrl)} alt={t("点餐二维码")} />
          <button
            className="preview-menu-btn"
            onClick={() => {
              if (activeRestaurant?.slug && typeof window !== "undefined") {
                window.open(orderUrl, "_blank", "noopener,noreferrer");
              } else {
                showToast(t("店铺尚未配置"));
              }
            }}
          >
            <i className="ri-eye-line" />{t("预览在线菜单")}
          </button>
          <section className="qr-link-card" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 12, background: "#f5f5f5", margin: "12px 0" }}>
            <span style={{ fontSize: 12, color: "#666" }}>{t("点餐链接")}</span>
            <code style={{ fontSize: 12, wordBreak: "break-all", color: "#211f20" }}>{orderUrl}</code>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(orderUrl);
                  showToast(t("链接已复制"));
                } catch {
                  showToast(t("复制失败"));
                }
              }}
            >
              <i className="ri-file-copy-line" />{t("复制链接")}
            </button>
          </section>
          <section className="qr-shop-card">
            <h3>{t(shop.name)}</h3>
            <p><i className="ri-store-2-line" />{t(shop.hawkerCenter)}</p>
            <p><i className="ri-map-pin-line" />{t(shop.address)}</p>
            <p><i className="ri-phone-line" />{shop.phone}</p>
          </section>
          <button className="btn secondary w-full" onClick={() => setQrSheetOpen(false)}>{t("关闭")}</button>
        </div>
      </div>
    </>
  );

  const restaurants = myRestaurantsQuery.data?.restaurants ?? [];
  const needsRegister = auth.status === "authenticated" && myRestaurantsQuery.isSuccess && restaurants.length === 0;

  const screen = useMemo(() => {
    if (auth.status === "loading") {
      return (
        <section className="screen auth-screen">
          <StatusBar />
          <div className="auth-content items-center justify-center">
            <p className="text-muted">{t("正在加载…")}</p>
          </div>
        </section>
      );
    }
    if (auth.status === "anonymous") return renderAuth();
    if (myRestaurantsQuery.isLoading) {
      return (
        <section className="screen auth-screen">
          <StatusBar />
          <div className="auth-content items-center justify-center">
            <p className="text-muted">{t("正在加载…")}</p>
          </div>
        </section>
      );
    }
    if (needsRegister || page === "register-profile") return renderRegister();
    if (page === "menu-import") {
      const rid = restaurants[0]?.id;
      if (!rid) return renderHome();
      return (
        <Suspense fallback={<section className="screen"><StatusBar /><div className="processing-stage"><div className="processing-card"><h1>{t("加载中…")}</h1></div></div></section>}>
          <MenuImportPage
            restaurantId={rid}
            onCancel={() => setPage("menu")}
            onDone={async (n) => {
              showToast(`${t("已新增")} ${n} ${t("项菜品")}`);
              setPage("menu");
              try {
                const r = await publishMutation.mutateAsync(rid);
                showToast(`${t("已发布")} v${r.versionNumber} · ${r.itemCount} ${t("道菜")}`);
              } catch {
                // publishMutation.onError 已经 toast
              }
            }}
          />
        </Suspense>
      );
    }
    if (page === "detail") return renderDetail();
    if (page === "orders") return renderOrders();
    if (page === "messages") return renderMessages();
    if (page === "chat") return renderChat();
    if (page === "me") return renderMe();
    if (page === "menu") return renderMenu();
    return renderHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, myRestaurantsQuery.isLoading, myRestaurantsQuery.isSuccess, needsRegister, page, shopOpen, category, orderFilter, selectedDishId, selectedThreadId, cancelOrderId, cancelReason, shopEditorOpen, qrSheetOpen, template, toast, authPhone, authCode, authBusy, authEmail, authPassword, emailMode, registerName, registerCenterId, registerBusy, shop, dishes, orders, threads, hawkerCentersQuery.data, t, restaurants, publishMutation.isPending, latestMenuVersionQuery.data, voice.muted, uploadingAsset]);


  return <MobileShell caption="Merchant · 390 x 844">{screen}</MobileShell>;
}
