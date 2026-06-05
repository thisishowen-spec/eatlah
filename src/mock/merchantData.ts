import type { MerchantDish, MerchantOrder, MessageThread, Shop } from "../types/merchant";

export const merchantShop: Shop = {
  name: "海记炒饭",
  hawkerCenter: "麦士威熟食中心",
  image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
  paynowImage: "",
  phone: "+65 9123 4567",
  address: "麦士威熟食中心 01-23",
};

export const merchantDishes: MerchantDish[] = [
  {
    id: "1",
    name: "鸡扒蛋炒饭",
    englishName: "Chicken Cutlet Fried Rice",
    price: "6.80",
    description: "香煎鸡扒配蛋炒饭，适合午餐和晚餐。",
    category: "饭类",
    available: true,
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=360&q=80",
    options: [
      { name: "加蛋", price: "0.80" },
      { name: "大份", price: "1.00" },
    ],
  },
  {
    id: "2",
    name: "猪扒蛋炒饭",
    englishName: "Pork Cutlet Fried Rice",
    price: "6.80",
    description: "猪扒、鸡蛋和炒饭的经典组合。",
    category: "饭类",
    available: true,
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=360&q=80",
    options: [
      { name: "加蛋", price: "0.80" },
      { name: "大份", price: "1.00" },
    ],
  },
  {
    id: "3",
    name: "蛋炒饭",
    englishName: "Egg Fried Rice",
    price: "4.50",
    description: "简单耐吃的经典蛋炒饭。",
    category: "饭类",
    available: true,
    image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=360&q=80",
    options: [{ name: "加蛋", price: "0.80" }],
  },
  {
    id: "4",
    name: "虾仁蛋炒饭",
    englishName: "Shrimp Egg Fried Rice",
    price: "6.80",
    description: "虾仁和鸡蛋炒饭，口感清爽。",
    category: "饭类",
    available: true,
    image: "https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=360&q=80",
    options: [
      { name: "加蛋", price: "0.80" },
      { name: "大份", price: "1.00" },
    ],
  },
  {
    id: "5",
    name: "炒粿条",
    englishName: "Char Kway Teow",
    price: "5.00",
    description: "本地风味炒粿条，镬气十足。",
    category: "面类",
    available: false,
    image: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=360&q=80",
    options: [
      { name: "少辣", price: "0.00" },
      { name: "加蛋", price: "0.80" },
    ],
  },
  {
    id: "6",
    name: "冰柠茶",
    englishName: "Iced Lemon Tea",
    price: "1.80",
    description: "清爽冰柠茶，适合搭配主食。",
    category: "饮料",
    available: true,
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=360&q=80",
    options: [
      { name: "少冰", price: "0.00" },
      { name: "正常冰", price: "0.00" },
    ],
  },
];

export const merchantOrders: MerchantOrder[] = [
  { id: "A102", displayNumber: "C102", type: "外带", paymentMethod: "paynow", paymentStatus: "declared_paid", time: "今天 11:32", status: "待处理", note: "少辣，打包。", items: [["鸡扒蛋炒饭", 2], ["冰柠茶", 1]] },
  { id: "A103", displayNumber: "D103", type: "外带", paymentMethod: "cash", paymentStatus: "unpaid", time: "今天 11:18", status: "制作中", note: "不要葱。", items: [["猪扒蛋炒饭", 1], ["冰咖啡", 1]] },
  { id: "A099", displayNumber: "A099", type: "堂食", paymentMethod: "paynow", paymentStatus: "declared_paid", time: "今天 10:52", status: "已完成", note: "堂食。", items: [["炒粿条", 1]] },
];

export const messageThreads: MessageThread[] = [
  {
    id: "system-stock",
    title: "系统提醒",
    subtitle: "炒粿条已售罄，菜单已自动显示为无",
    time: "刚刚",
    kind: "系统",
    icon: "ri-alarm-warning-line",
    tone: "warn",
    unread: true,
    context: { label: "库存提醒", value: "炒粿条 · 今日数量已归零" },
    messages: [
      { from: "system", text: "炒粿条库存已变为 0，已在菜单中显示为无。", time: "11:40" },
      { from: "system", text: "建议发布菜单，避免顾客继续下单。", time: "11:41" },
    ],
  },
  {
    id: "order-a102",
    title: "订单 #A102",
    subtitle: "林先生催餐：请问还要多久？",
    time: "2 分钟前",
    kind: "催餐",
    icon: "ri-timer-flash-line",
    tone: "rush",
    unread: true,
    context: { label: "待处理订单", value: "鸡扒蛋炒饭 x2 · 冰柠茶 x1" },
    messages: [
      { from: "customer", text: "老板，请问还要多久？", time: "11:36" },
      { from: "merchant", text: "正在制作，大约 5 分钟。", time: "11:37" },
      { from: "customer", text: "好的，谢谢。", time: "11:38" },
    ],
  },
  {
    id: "customer-note",
    title: "顾客消息",
    subtitle: "可以不要葱吗？",
    time: "8 分钟前",
    kind: "顾客",
    icon: "ri-message-3-line",
    tone: "customer",
    unread: false,
    context: { label: "订单 #A103", value: "猪扒蛋炒饭 x1 · 冰咖啡 x1" },
    messages: [
      { from: "customer", text: "老板，可以不要葱吗？", time: "11:20" },
      { from: "merchant", text: "可以，已经备注。", time: "11:21" },
    ],
  },
];
