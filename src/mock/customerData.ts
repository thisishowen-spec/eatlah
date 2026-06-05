import type { CustomerItem, CustomerRestaurant } from "../types/customer";

export const customerRestaurant: CustomerRestaurant = {
  name: "海记炒饭",
  center: "麦士威熟食中心",
  cuisine: "本地炒饭",
  image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
};

export const customerItems: CustomerItem[] = [
  {
    id: "1",
    name: "鸡扒蛋炒饭",
    category: "主食",
    price: 6.8,
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=360&q=80",
    description: "香煎鸡扒配蛋炒饭，加入鸡蛋和青葱。适合午餐和晚餐，可选择加蛋或大份。",
    options: [
      { name: "标准", price: 0 },
      { name: "加蛋", price: 0.8 },
      { name: "大份", price: 1 },
    ],
  },
  {
    id: "2",
    name: "虾仁蛋炒饭",
    category: "主食",
    price: 6.8,
    image: "https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=360&q=80",
    description: "虾仁和鸡蛋炒饭，口感清爽，适合喜欢海鲜口味的顾客。",
    options: [
      { name: "标准", price: 0 },
      { name: "加蛋", price: 0.8 },
      { name: "大份", price: 1 },
    ],
  },
  {
    id: "3",
    name: "炒粿条",
    category: "小吃",
    price: 5,
    image: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=360&q=80",
    description: "本地风味炒粿条，镬气十足。可选择少辣。",
    options: [
      { name: "标准", price: 0 },
      { name: "少辣", price: 0 },
      { name: "加蛋", price: 0.8 },
    ],
  },
  {
    id: "4",
    name: "冰柠茶",
    category: "饮品",
    price: 1.8,
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=360&q=80",
    description: "清爽冰柠茶，适合搭配主食。",
    options: [
      { name: "少冰", price: 0 },
      { name: "正常冰", price: 0 },
    ],
  },
  {
    id: "5",
    name: "加蛋",
    category: "加料",
    price: 0.8,
    image: "https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&w=360&q=80",
    description: "单独加一颗蛋。",
    options: [{ name: "标准", price: 0 }],
  },
];
