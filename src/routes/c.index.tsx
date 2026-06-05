import { createFileRoute, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import "remixicon/fonts/remixicon.css";
import { HawkerHomeApp } from "../features/customer/HawkerHomeApp";
import { LanguageProvider } from "../i18n/LanguageContext";
import { getCustomerHomepage } from "../lib/storefront.functions";

const homepageQuery = () =>
  queryOptions({
    queryKey: ["customer-homepage"],
    queryFn: () => getCustomerHomepage(),
  });

export const Route = createFileRoute("/c/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homepageQuery()),
  head: () => ({
    meta: [
      { title: "EatLah · 熟食中心" },
      { name: "description", content: "EatLah 顾客端 — 选择熟食中心，扫码点单。" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#0b7a53" },
      { property: "og:title", content: "EatLah · 熟食中心" },
      { property: "og:description", content: "EatLah 顾客端 — 选择熟食中心，扫码点单。" },
    ],
  }),
  component: HomeRoute,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div style={{ padding: 24 }}>
        <h1>无法加载首页</h1>
        <p>{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }}>重试</button>
      </div>
    );
  },
  notFoundComponent: () => <div style={{ padding: 24 }}>页面不存在</div>,
});

function HomeRoute() {
  const { data } = useSuspenseQuery(homepageQuery());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <LanguageProvider>
      <HawkerHomeApp data={data} />
    </LanguageProvider>
  );
}
