import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { MobileTabBar } from "@/components/MobileTabBar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { registerOfflineWorker } from "@/lib/offline/register-sw";
import { LocaleProvider, useI18n } from "@/lib/i18n";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-mono text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {t({ ar: "الصفحة غير موجودة", en: "Page not found" })}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t({
            ar: "الرابط الذي تحاول الوصول إليه غير موجود أو تم نقله.",
            en: "The link you followed does not exist or has been moved.",
          })}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t({ ar: "العودة إلى المحلّل", en: "Back to the resolver" })}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useI18n();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t({ ar: "تعذر تحميل هذه الصفحة", en: "This page could not be loaded" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t({
            ar: "حدث خطأ غير متوقع. يمكنك إعادة المحاولة أو العودة إلى الصفحة الرئيسية.",
            en: "An unexpected error occurred. Try again or go back to the home page.",
          })}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t({ ar: "إعادة المحاولة", en: "Try again" })}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t({ ar: "الصفحة الرئيسية", en: "Home page" })}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "شبكة العنوان الذكي السورية" },
      {
        name: "description",
        content: "بنية العنونة الرقمية في سوريا: عنوان ذكي دقيق لكل مكان، مدخل صحيح لكل غرض.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0f1b3d" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "سيرياسان" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/app-icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://tile.openstreetmap.org", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://api.heigit.org" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <LocalizedDocument>{children}</LocalizedDocument>
    </LocaleProvider>
  );
}

function LocalizedDocument({ children }: { children: ReactNode }) {
  const { lang, dir } = useI18n();
  return (
    <html lang={lang} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          الانتقال إلى المحتوى الرئيسي / Skip to main content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    registerOfflineWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      {/* The skip target wraps routed content without adding a second main landmark. */}
      <div id="main-content" tabIndex={-1}>
        <Outlet />
      </div>
      <MobileTabBar />
      <InstallPrompt />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
