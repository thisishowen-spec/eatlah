export type MerchantPage =
  | "prelogin"
  | "login-method"
  | "login-phone"
  | "login-code"
  | "login-email"
  | "menu-processing"
  | "menu-import"
  | "register-profile"
  | "home"
  | "menu"
  | "detail"
  | "orders"
  | "messages"
  | "chat"
  | "me";

export type OrderStatus = "待处理" | "制作中" | "已完成" | "已取消";
export type OrderType = "堂食" | "外带";

export type Shop = {
  name: string;
  hawkerCenter: string;
  image: string;
  paynowImage: string;
  phone: string;
  address: string;
};

export type DishOption = {
  name: string;
  price: string;
};

export type MerchantDish = {
  id: string;
  name: string;
  englishName: string;
  price: string;
  description: string;
  category: string;
  available: boolean;
  image: string;
  options: DishOption[];
};

export type MerchantOrder = {
  id: string;
  displayNumber: string;
  type: OrderType;
  paymentMethod: "paynow" | "cash";
  paymentStatus: "unpaid" | "declared_paid" | "paid" | "refunded";
  time: string;
  status: OrderStatus;
  note: string;
  items: [string, number][];
  totalAmount?: number;
  submittedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelReason?: string | null;
};

export type ChatMessage = {
  from: "system" | "customer" | "merchant";
  text: string;
  time: string;
};

export type MessageThread = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  kind: string;
  icon: string;
  tone: "warn" | "rush" | "customer";
  unread: boolean;
  context: {
    label: string;
    value: string;
  };
  messages: ChatMessage[];
};
