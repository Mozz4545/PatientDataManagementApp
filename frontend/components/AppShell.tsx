"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { setAuthToken } from "@/lib/api";
import { statusLabel } from "@/lib/status";
import type { ApiResponse, User } from "@/lib/types";
import Sidebar from "./Sidebar";

export function useCurrentUser() {
  const [authReady, setAuthReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const token = localStorage.getItem("radiology_token");
      setAuthToken(token || undefined);
      setHasToken(Boolean(token));
      setAuthReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (await api.get<ApiResponse<User>>("/auth/me")).data.data,
    enabled: authReady && hasToken,
    retry: false,
  });

  return { ...query, isAuthReady: authReady, hasToken };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const userQuery = useCurrentUser();
  const user = userQuery.data;

  const logout = () => {
    localStorage.removeItem("radiology_token");
    localStorage.removeItem("radiology_user");
    setAuthToken(undefined);
    queryClient.clear();
    router.replace("/login");
  };

  useEffect(() => {
    const token = localStorage.getItem("radiology_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setAuthToken(token);
  }, [router]);

  useEffect(() => {
    if (userQuery.isError) {
      localStorage.removeItem("radiology_token");
      localStorage.removeItem("radiology_user");
      setAuthToken(undefined);
      queryClient.clear();
      router.replace("/login");
    }
  }, [queryClient, router, userQuery.isError]);

  return (
    <div className="min-h-screen bg-white text-[#120d34]">
      <Sidebar userRole={user?.role} />
      <header className="fixed left-0 right-0 top-0 z-20 flex min-h-14 items-center justify-between bg-[#123879] px-4 py-2 text-white shadow-sm sm:min-h-16 sm:px-5 lg:left-[248px] lg:min-h-[72px] lg:px-8 xl:px-10">
        <h1 className="max-w-[76vw] text-base font-bold leading-tight sm:text-xl md:text-2xl lg:max-w-none lg:text-[28px] xl:text-[30px]">
          ລະບົບຈັດການຂໍ້ມູນຄົນເຈັບ
        </h1>
        <div className="hidden items-center gap-3 md:flex">
          <div className="text-right">
            <div className="text-sm font-medium">{user?.staff_name || user?.name || "ພະນັກງານ"}</div>
            <div className="text-[11px] tracking-wide">{statusLabel(user?.role)}</div>
          </div>
          <div className="h-10 w-10 rounded-full bg-[#dedede]" />
          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-[#ef4444] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#dc2626]"
          >
            ອອກຈາກລະບົບ
          </button>
        </div>
      </header>
      <MobileNav pathname={pathname} userRole={user?.role} />
      <main className="min-h-screen pb-20 pt-14 sm:pt-16 lg:pb-0 lg:pl-[248px] lg:pt-[72px]">{children}</main>
    </div>
  );
}

const mobileLinks = [
  { href: "/dashboard", label: "ໜ້າຫຼັກ" },
  { href: "/queues", label: "ຄິວ" },
  { href: "/orders", label: "ສັ່ງກວດ" },
  { href: "/payments", label: "ຈ່າຍເງິນ" },
  { href: "/results", label: "ຜົນ" },
  { href: "/reports", label: "ລາຍງານ", adminOnly: true },
];

function MobileNav({ pathname, userRole }: { pathname: string; userRole?: string }) {
  const visibleLinks = mobileLinks.filter((link) => !link.adminOnly || userRole === "ADMIN");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 grid border-t border-slate-200 bg-white/95 px-1 py-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur lg:hidden"
      style={{ gridTemplateColumns: `repeat(${visibleLinks.length}, minmax(0, 1fr))` }}
    >
      {visibleLinks.map((link) => {
        const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`mx-0.5 rounded-lg px-1 py-2 text-center text-[11px] font-bold transition ${
              active ? "bg-[#eeeafe] text-[#123879]" : "text-[#767285]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
