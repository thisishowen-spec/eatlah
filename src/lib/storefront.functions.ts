import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DEMO_CENTER_ID = "44444444-4444-4444-8444-444444444444";
const DEMO_RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

const demoItems = [
  {
    id: "22222222-2222-4222-8222-222222222201",
    name: "鸡扒蛋炒饭",
    nameEn: "Chicken Cutlet Fried Rice",
    category: "主食",
    categoryEn: "Mains",
    price: 6.8,
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=480&q=80",
    description: "香煎鸡扒配蛋炒饭，加入鸡蛋和青葱。",
    descriptionEn: "Golden fried rice with pan-seared chicken cutlet.",
    options: [
      { name: "标准", nameEn: "Regular", price: 0 },
      { name: "加蛋", nameEn: "Add egg", price: 0.8 },
      { name: "大份", nameEn: "Large", price: 1 },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    name: "猪扒蛋炒饭",
    nameEn: "Pork Cutlet Fried Rice",
    category: "主食",
    categoryEn: "Mains",
    price: 6.8,
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=480&q=80",
    description: "猪扒、鸡蛋和炒饭的经典组合。",
    descriptionEn: "Classic pork cutlet fried rice with egg.",
    options: [
      { name: "标准", nameEn: "Regular", price: 0 },
      { name: "加蛋", nameEn: "Add egg", price: 0.8 },
      { name: "大份", nameEn: "Large", price: 1 },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222203",
    name: "炒粿条",
    nameEn: "Char Kway Teow",
    category: "小吃",
    categoryEn: "Snacks",
    price: 5,
    image: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=480&q=80",
    description: "本地风味炒粿条，镬气十足。",
    descriptionEn: "Local wok-fried flat noodles.",
    options: [
      { name: "标准", nameEn: "Regular", price: 0 },
      { name: "少辣", nameEn: "Less spicy", price: 0 },
      { name: "加蛋", nameEn: "Add egg", price: 0.8 },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222204",
    name: "冰柠茶",
    nameEn: "Iced Lemon Tea",
    category: "饮品",
    categoryEn: "Drinks",
    price: 1.8,
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=480&q=80",
    description: "清爽冰柠茶，适合搭配主食。",
    descriptionEn: "Refreshing iced lemon tea.",
    options: [
      { name: "少冰", nameEn: "Less ice", price: 0 },
      { name: "正常冰", nameEn: "Regular ice", price: 0 },
    ],
  },
];

const demoRestaurant = {
  id: DEMO_RESTAURANT_ID,
  slug: "demo",
  name: "海记炒饭",
  nameEn: "Hai Kee Fried Rice",
  center: "麦士威熟食中心",
  centerEn: "Maxwell Food Centre",
  cuisine: "本地炒饭",
  image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
  isOpen: true,
  menuTemplate: "classic" as const,
  paynowQrUrl: "",
};

export type StorefrontPayload = {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    nameEn: string;
    center: string;
    centerEn: string;
    cuisine: string;
    image: string;
    isOpen: boolean;
    menuTemplate: "classic" | "image";
    paynowQrUrl: string;
  } | null;
  items: {
    id: string;
    name: string;
    nameEn: string;
    category: string;
    categoryEn: string;
    price: number;
    image: string;
    description: string;
    descriptionEn: string;
    options: { name: string; nameEn: string; price: number }[];
  }[];
};

export const getCustomerStorefront = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(input))
  .handler(async ({ data }): Promise<StorefrontPayload> => ({
    restaurant: { ...demoRestaurant, slug: data.slug },
    items: demoItems,
  }));

const SubmitInput = z.object({
  restaurantId: z.string().uuid(),
  serviceType: z.enum(["堂食", "外带"]),
  payMethod: z.enum(["paynow", "cash"]),
  note: z.string().max(200).optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid().nullable(),
    nameSnapshot: z.string().min(1).max(200),
    unitPrice: z.number().min(0).max(99999),
    quantity: z.number().int().min(1).max(99),
    options: z.array(z.object({
      nameSnapshot: z.string().min(1).max(200),
      priceDelta: z.number().min(-9999).max(9999),
    })).max(20),
  })).min(1).max(50),
});

function demoUuid() {
  const tail = String(Date.now() % 1_000_000_000_000).padStart(12, "0");
  return `99999999-9999-4999-8999-${tail}`;
}

function orderLetter(serviceType: "堂食" | "外带", payMethod: "paynow" | "cash") {
  if (serviceType === "堂食") return payMethod === "paynow" ? "A" : "B";
  return payMethod === "paynow" ? "C" : "D";
}

export const submitCustomerOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SubmitInput.parse(input))
  .handler(async ({ data }) => {
    const total = data.items.reduce((sum, item) => {
      const optionsTotal = item.options.reduce((s, option) => s + option.priceDelta, 0);
      return sum + (item.unitPrice + optionsTotal) * item.quantity;
    }, 0);
    return {
      id: demoUuid(),
      displayNumber: `${orderLetter(data.serviceType, data.payMethod)}102`,
      total: Number(total.toFixed(2)),
    };
  });

const StatusInput = z.object({ ids: z.array(z.string().uuid()).min(1).max(50) });

export type CustomerOrderStatus = {
  id: string;
  status: "pending" | "preparing" | "completed" | "cancelled";
  payment_status: string;
  display_number: string;
  cancel_reason: string | null;
};

export const getCustomerOrderStatuses = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data }): Promise<{ orders: CustomerOrderStatus[] }> => ({
    orders: data.ids.map((id, index) => ({
      id,
      status: index % 3 === 2 ? "completed" : index % 3 === 1 ? "preparing" : "pending",
      payment_status: "declared_paid",
      display_number: `A${String(102 + index).padStart(3, "0")}`,
      cancel_reason: null,
    })),
  }));

export type HomepageCenter = { id: string; name: string; nameEn: string; address: string };
export type HomepageShop = {
  id: string;
  slug: string;
  name: string;
  cuisine: string;
  image: string;
  isOpen: boolean;
  centerId: string | null;
  itemCount: number;
  minPrice: number;
};
export type HomepagePayload = { centers: HomepageCenter[]; shops: HomepageShop[] };

export const getCustomerHomepage = createServerFn({ method: "GET" })
  .handler(async (): Promise<HomepagePayload> => ({
    centers: [
      { id: DEMO_CENTER_ID, name: "麦士威熟食中心", nameEn: "Maxwell Food Centre", address: "1 Kadayanallur Street" },
      { id: "44444444-4444-4444-8444-444444444445", name: "老巴刹", nameEn: "Lau Pa Sat", address: "18 Raffles Quay" },
    ],
    shops: [
      { id: DEMO_RESTAURANT_ID, slug: "demo", name: "海记炒饭", cuisine: "本地炒饭", image: demoRestaurant.image, isOpen: true, centerId: DEMO_CENTER_ID, itemCount: 4, minPrice: 1.8 },
      { id: "11111111-1111-4111-8111-111111111112", slug: "chicken-rice", name: "阿林鸡饭", cuisine: "鸡饭", image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=480&q=80", isOpen: true, centerId: DEMO_CENTER_ID, itemCount: 3, minPrice: 4.8 },
      { id: "11111111-1111-4111-8111-111111111113", slug: "noodle-stall", name: "明记面摊", cuisine: "面食", image: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=480&q=80", isOpen: true, centerId: DEMO_CENTER_ID, itemCount: 5, minPrice: 5.0 },
      { id: "11111111-1111-4111-8111-111111111114", slug: "morning-coffee", name: "早安咖啡", cuisine: "饮品", image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=480&q=80", isOpen: true, centerId: DEMO_CENTER_ID, itemCount: 4, minPrice: 1.4 },
      { id: "11111111-1111-4111-8111-111111111115", slug: "snacks", name: "老街小吃", cuisine: "小吃", image: "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=480&q=80", isOpen: false, centerId: DEMO_CENTER_ID, itemCount: 2, minPrice: 2.5 },
    ],
  }));
