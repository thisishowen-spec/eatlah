import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEMO_CENTER_ID = "44444444-4444-4444-8444-444444444444";
const DEMO_RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

const demoRestaurant = {
  id: DEMO_RESTAURANT_ID,
  name: "海记炒饭",
  slug: "demo",
  status: "active",
  hawker_center_id: DEMO_CENTER_ID,
  is_open: true,
  image_path: null,
  image_url: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
  phone: "+65 9123 4567",
  address: "麦士威熟食中心 #01-23",
  paynow_qr_path: null,
  paynow_qr_url: "",
  menu_template: "classic",
  created_at: "2026-06-05T04:00:00.000Z",
  hawker_centers: { name: "麦士威熟食中心", name_en: "Maxwell Food Centre" },
};

const demoOrders = [
  {
    id: "55555555-5555-4555-8555-555555555501",
    display_number: "C102",
    service_type: "takeaway",
    status: "pending",
    payment_status: "declared_paid",
    total_amount: 15.40,
    customer_note: "少辣，打包。",
    cancel_reason: null,
    submitted_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    order_items: [
      { id: "oi-1", name_snapshot: "鸡扒蛋炒饭", quantity: 2, unit_price: 6.8, line_total: 13.6, order_item_options: [] },
      { id: "oi-2", name_snapshot: "冰柠茶", quantity: 1, unit_price: 1.8, line_total: 1.8, order_item_options: [] },
    ],
  },
  {
    id: "55555555-5555-4555-8555-555555555502",
    display_number: "D103",
    service_type: "takeaway",
    status: "preparing",
    payment_status: "unpaid",
    total_amount: 8.60,
    customer_note: "不要葱。",
    cancel_reason: null,
    submitted_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    started_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    completed_at: null,
    cancelled_at: null,
    order_items: [
      { id: "oi-3", name_snapshot: "猪扒蛋炒饭", quantity: 1, unit_price: 6.8, line_total: 6.8, order_item_options: [] },
      { id: "oi-4", name_snapshot: "冰柠茶", quantity: 1, unit_price: 1.8, line_total: 1.8, order_item_options: [] },
    ],
  },
  {
    id: "55555555-5555-4555-8555-555555555503",
    display_number: "A099",
    service_type: "dine_in",
    status: "completed",
    payment_status: "declared_paid",
    total_amount: 5.00,
    customer_note: "堂食。",
    cancel_reason: null,
    submitted_at: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
    started_at: new Date(Date.now() - 43 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 36 * 60 * 1000).toISOString(),
    cancelled_at: null,
    order_items: [
      { id: "oi-5", name_snapshot: "炒粿条", quantity: 1, unit_price: 5.0, line_total: 5.0, order_item_options: [] },
    ],
  },
];

export const listHawkerCenters = createServerFn({ method: "GET" }).handler(async () => ({
  centers: [
    { id: DEMO_CENTER_ID, name: "麦士威熟食中心", name_en: "Maxwell Food Centre", address: "1 Kadayanallur Street" },
    { id: "44444444-4444-4444-8444-444444444445", name: "老巴刹", name_en: "Lau Pa Sat", address: "18 Raffles Quay" },
  ],
}));

export const getMyRestaurants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ restaurants: [demoRestaurant] }));

export const createFirstRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    name: z.string().trim().min(1).max(80),
    hawkerCenterId: z.string().uuid().nullable().optional(),
  }).parse(input))
  .handler(async ({ data }) => ({
    restaurant: { ...demoRestaurant, name: data.name, hawker_center_id: data.hawkerCenterId ?? DEMO_CENTER_ID },
  }));

export const updateMyRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(40).nullable().optional(),
    address: z.string().trim().max(200).nullable().optional(),
    hawkerCenterId: z.string().uuid().nullable().optional(),
  }).parse(input))
  .handler(async ({ data }) => ({
    restaurant: {
      ...demoRestaurant,
      id: data.id,
      name: data.name,
      phone: data.phone ?? demoRestaurant.phone,
      address: data.address ?? demoRestaurant.address,
      hawker_center_id: data.hawkerCenterId ?? demoRestaurant.hawker_center_id,
    },
  }));

export const setRestaurantOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), isOpen: z.boolean() }).parse(input))
  .handler(async () => ({ ok: true }));

export const setRestaurantMenuTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    menuTemplate: z.enum(["classic", "image"]),
  }).parse(input))
  .handler(async () => ({ ok: true }));

const UploadRestaurantAssetInput = z.object({
  restaurantId: z.string().uuid(),
  kind: z.enum(["image", "paynow"]),
  contentType: z.string().min(1).max(100),
  ext: z.string().min(1).max(10),
  fileBase64: z.string().min(1),
});

export const uploadRestaurantAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UploadRestaurantAssetInput.parse(input))
  .handler(async ({ data }) => ({
    path: `demo/${data.kind}.${data.ext.toLowerCase()}`,
    signedUrl: `data:${data.contentType};base64,${data.fileBase64}`,
  }));

export const listRestaurantOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async () => ({ orders: demoOrders }));

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    orderId: z.string().uuid(),
    status: z.enum(["pending", "preparing", "completed", "cancelled"]),
    cancelReason: z.string().max(200).optional(),
  }).parse(input))
  .handler(async () => ({ ok: true }));

const UploadMenuItemImageInput = z.object({
  itemId: z.string().uuid(),
  contentType: z.string().min(1).max(100),
  ext: z.string().min(1).max(10),
  fileBase64: z.string().min(1),
});

export const uploadMenuItemImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UploadMenuItemImageInput.parse(input))
  .handler(async ({ data }) => ({
    path: `demo/menu-items/${data.itemId}.${data.ext.toLowerCase()}`,
    signedUrl: `data:${data.contentType};base64,${data.fileBase64}`,
  }));
