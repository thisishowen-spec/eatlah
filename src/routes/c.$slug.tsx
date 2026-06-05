import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import "remixicon/fonts/remixicon.css";
import "../eatlah.css";
import { CustomerApp } from "../features/customer/CustomerApp";
import { LanguageProvider } from "../i18n/LanguageContext";
import { getCustomerStorefront } from "../lib/storefront.functions";

const storefrontQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront", slug],
    queryFn: async () => {
      const data = await getCustomerStorefront({ data: { slug } });
      if (!data.restaurant) throw notFound();
      return data;
    },
  });

export const Route = createFileRoute("/c/$slug")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(storefrontQuery(params.slug)),
  head: ({ loaderData }) => {
    const r = loaderData?.restaurant;
    const title = r ? `${r.name} · EatLah` : "EatLah";
    const desc = r ? `${r.name}${r.center ? ` · ${r.center}` : ""} · 扫码点餐` : "EatLah 在线点餐";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "viewport", content: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" },
        { name: "theme-color", content: "#00a86b" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(r?.image ? [{ property: "og:image", content: r.image }] : []),
      ],
    };
  },
  component: StorefrontRoute,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div style={{ padding: 24 }}>
        <h1>无法加载店铺</h1>
        <p>{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }}>重试</button>
      </div>
    );
  },
  notFoundComponent: () => {
    const { slug } = Route.useParams();
    return (
      <div style={{ padding: 24 }}>
        <h1>店铺不存在</h1>
        <p>找不到 “{slug}” 对应的店铺。</p>
      </div>
    );
  },
});

function StorefrontRoute() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <LanguageProvider>
      <CustomerApp
        restaurant={data.restaurant ?? undefined}
        restaurantId={data.restaurant?.id ?? null}
        items={data.items}
        menuTemplate={data.restaurant?.menuTemplate ?? "classic"}
      />
    </LanguageProvider>
  );
}
