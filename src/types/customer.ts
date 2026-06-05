export type CustomerPage = "menu" | "detail" | "cart" | "checkout" | "orders";

export type CustomerRestaurant = {
  name: string;
  nameEn?: string;
  center: string;
  centerEn?: string;
  cuisine: string;
  image: string;
  isOpen?: boolean;
  menuTemplate?: "classic" | "image";
  paynowQrUrl?: string;
};

export type CustomerOption = {
  name: string;
  nameEn?: string;
  price: number;
};

export type CustomerItem = {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  categoryEn?: string;
  price: number;
  image: string;
  description: string;
  descriptionEn?: string;
  options: CustomerOption[];
};

export type CartEntry = {
  itemId: string;
  /** Selected add-on option names (multi-select). Empty when no add-ons chosen. */
  options: string[];
  qty: number;
};

export type OrderRecordItem = {
  name: string;
  option: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderStatus =
  | "pending_payment"  // 现金未付
  | "pending"          // 已下单待商家确认
  | "preparing"        // 制作中
  | "completed"        // 已完成
  | "cancelled";       // 已取消

export type OrderRecord = {
  id: string;
  displayNumber?: string;
  restaurantName: string;
  createdAt: number;
  serviceType: "堂食" | "外带";
  payMethod: "paynow" | "cash";
  note?: string;
  items: OrderRecordItem[];
  total: number;
  status: OrderStatus;
  cancelReason?: string | null;
};
