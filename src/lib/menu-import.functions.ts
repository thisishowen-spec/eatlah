import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEMO_ITEMS = [
  {
    id: "22222222-2222-4222-8222-222222222201",
    name: "鸡扒蛋炒饭",
    englishName: "Chicken Cutlet Fried Rice",
    price: "6.80",
    description: "香煎鸡扒配蛋炒饭，适合午餐和晚餐。",
    descriptionEn: "Golden fried rice with pan-seared chicken cutlet.",
    category: "饭类",
    categoryEn: "Rice",
    available: true,
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=480&q=80",
    options: [
      { name: "加蛋", nameEn: "Add egg", price: "0.80" },
      { name: "大份", nameEn: "Large", price: "1.00" },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    name: "猪扒蛋炒饭",
    englishName: "Pork Cutlet Fried Rice",
    price: "6.80",
    description: "猪扒、鸡蛋和炒饭的经典组合。",
    descriptionEn: "Classic pork cutlet fried rice with egg.",
    category: "饭类",
    categoryEn: "Rice",
    available: true,
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=480&q=80",
    options: [
      { name: "加蛋", nameEn: "Add egg", price: "0.80" },
      { name: "大份", nameEn: "Large", price: "1.00" },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222203",
    name: "炒粿条",
    englishName: "Char Kway Teow",
    price: "5.00",
    description: "本地风味炒粿条，镬气十足。",
    descriptionEn: "Local wok-fried flat noodles.",
    category: "面类",
    categoryEn: "Noodles",
    available: false,
    image: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=480&q=80",
    options: [
      { name: "少辣", nameEn: "Less spicy", price: "0.00" },
      { name: "加蛋", nameEn: "Add egg", price: "0.80" },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222204",
    name: "冰柠茶",
    englishName: "Iced Lemon Tea",
    price: "1.80",
    description: "清爽冰柠茶，适合搭配主食。",
    descriptionEn: "Refreshing iced lemon tea.",
    category: "饮料",
    categoryEn: "Drinks",
    available: true,
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=480&q=80",
    options: [
      { name: "少冰", nameEn: "Less ice", price: "0.00" },
      { name: "正常冰", nameEn: "Regular ice", price: "0.00" },
    ],
  },
];

const RecognitionInput = z.object({
  imageDataUrl: z.string().min(1),
  filename: z.string().optional(),
});

export const recognizeMenuFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecognitionInput.parse(input))
  .handler(async () => ({
    items: DEMO_ITEMS.map((item) => ({
      category: item.category,
      category_en: item.categoryEn,
      name: item.name,
      english_name: item.englishName,
      price: Number(item.price),
      description: item.description,
      description_en: item.descriptionEn,
      options: item.options.map((option) => ({
        name: option.name,
        name_en: option.nameEn,
        price_delta: Number(option.price),
      })),
      text_box_2d: null,
      photo_box_2d: null,
      confidence: 0.96,
    })),
    warnings: ["Public demo: recognition uses fixed sample dishes."],
  }));

export const detectMenuItemImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecognitionInput.parse(input))
  .handler(async () => ({ matches: [] }));

const BulkInput = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(z.object({
    category: z.string(),
    category_en: z.string().nullable().optional(),
    name: z.string(),
    english_name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    description_en: z.string().nullable().optional(),
    price: z.number(),
    daily_available: z.boolean().optional(),
    image_base64: z.string().nullable().optional(),
    image_mime: z.string().nullable().optional(),
    options: z.array(z.object({
      name: z.string(),
      name_en: z.string().nullable().optional(),
      price_delta: z.number(),
    })).default([]),
  })).min(1),
});

export const bulkCreateMenuItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkInput.parse(input))
  .handler(async ({ data }) => ({ created: data.items.length }));

const ListInput = z.object({ restaurantId: z.string().uuid() });

export const listMyMenuItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async () => ({ items: DEMO_ITEMS }));

export const deleteMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().uuid() }).parse(input))
  .handler(async () => ({ ok: true }));

const UpdateItemInput = z.object({
  itemId: z.string().uuid(),
  name: z.string().min(1),
  english_name: z.string().nullable().optional(),
  price: z.number().min(0),
  description: z.string().nullable().optional(),
  options: z.array(z.object({
    name: z.string().min(1),
    name_en: z.string().nullable().optional(),
    price_delta: z.number(),
  })).default([]),
});

export const updateMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateItemInput.parse(input))
  .handler(async () => ({ ok: true }));

export const publishMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async () => ({
    versionId: "33333333-3333-4333-8333-333333333333",
    versionNumber: 1,
    itemCount: DEMO_ITEMS.length,
  }));

export const getLatestMenuVersion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async () => ({
    versionNumber: 1,
    status: "published",
    publishedAt: new Date().toISOString(),
  }));

export const listMenuVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async () => ([{
    id: "33333333-3333-4333-8333-333333333333",
    versionNumber: 1,
    publishedAt: new Date().toISOString(),
    itemCount: DEMO_ITEMS.length,
  }]));
