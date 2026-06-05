import { createFileRoute } from "@tanstack/react-router";
import "remixicon/fonts/remixicon.css";
import "../eatlah.css";
import { MerchantApp } from "../features/merchant/MerchantApp";
import { LanguageProvider } from "../i18n/LanguageContext";

export const Route = createFileRoute("/merchant")({
  // 商家端依赖 supabase 浏览器会话（localStorage），跳过 SSR 让客户端单次渲染，避免水合空白与首帧延迟
  ssr: false,
  head: () => ({
    meta: [
      { title: "EatLah · Merchant" },
      { name: "description", content: "EatLah merchant prototype for hawker stall owners." },
      { name: "viewport", content: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#00a86b" },
    ],
    links: [
      // 预加载登录前页 LCP 图片，缩短首屏渲染时间
      { rel: "preload", as: "image", href: "/assets/eatlah-logo.jpg", fetchpriority: "high" },
      { rel: "preload", as: "image", href: "/assets/eatlah-laupasat-illustration.svg" },
    ],
  }),
  component: MerchantRoute,
});

function MerchantRoute() {
  return (
    <LanguageProvider>
      <MerchantApp />
    </LanguageProvider>
  );
}
