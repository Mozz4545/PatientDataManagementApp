"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { statusLabel } from "@/lib/status";
import type { ApiResponse, User } from "@/lib/types";
import Sidebar from "./Sidebar";

export function useCurrentUser() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAuthReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (await api.get<ApiResponse<User>>("/auth/me")).data.data,
    enabled: authReady,
    retry: false,
  });

  return { ...query, isAuthReady: authReady };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const userQuery = useCurrentUser();
  const user = userQuery.data;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Clear the client state even if the server session already expired.
    }
    localStorage.removeItem("radiology_user");
    queryClient.clear();
    setMobileMenuOpen(false);
    router.replace("/login");
  };

  useEffect(() => {
    if (userQuery.isError) {
      localStorage.removeItem("radiology_user");
      queryClient.clear();
      router.replace("/login");
    }
  }, [queryClient, router, userQuery.isError]);

  if (!userQuery.isAuthReady || userQuery.isLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#123879]" />
          <div className="mt-4 font-bold text-[#767285]">ກຳລັງກວດສອບສິດ...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#120d34]">
      <Sidebar userRole={user?.role} />
      <header className="fixed left-0 right-0 top-0 z-20 flex min-h-14 items-center justify-between bg-[#123879] px-4 py-2 text-white shadow-sm sm:min-h-16 sm:px-5 lg:left-[248px] lg:min-h-[72px] lg:px-8 xl:px-10">
        <h1 className="min-w-0 flex-1 pr-3 text-base font-bold leading-tight sm:text-xl md:text-2xl lg:max-w-none lg:text-[28px] xl:text-[30px]">
          ລະບົບຈັດການຂໍ້ມູນຄົນເຈັບ
        </h1>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-white/15 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-white/25 lg:hidden"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu-panel"
        >
          <span className="flex h-5 w-5 flex-col justify-center gap-1" aria-hidden="true">
            <span className="block h-0.5 rounded-full bg-white" />
            <span className="block h-0.5 rounded-full bg-white" />
            <span className="block h-0.5 rounded-full bg-white" />
          </span>
          ເມນູ
        </button>
        <div className="hidden items-center gap-3 lg:flex">
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
      <MobileMenu
        open={mobileMenuOpen}
        pathname={pathname}
        userRole={user?.role}
        userName={user?.staff_name || user?.name}
        onClose={() => setMobileMenuOpen(false)}
        onLogout={logout}
      />
      <MobileNav pathname={pathname} userRole={user?.role} />
      <main className="min-h-screen pb-24 pt-14 sm:pt-16 lg:pb-0 lg:pl-[248px] lg:pt-[72px]">{children}</main>
    </div>
  );
}

const mobileLinks = [
  { href: "/dashboard", label: "ໜ້າຫຼັກ", shortLabel: "ໜ້າຫຼັກ", icon: "home" },
  { href: "/patients", label: "ຂໍ້ມູນຄົນເຈັບ", shortLabel: "ຄົນເຈັບ", icon: "patient" },
  { href: "/queues", label: "ຈັດການຄິວ", shortLabel: "ຄິວ", icon: "queue" },
  { href: "/orders", label: "ໃບສັ່ງກວດ", shortLabel: "ສັ່ງກວດ", icon: "order" },
  { href: "/payments", label: "ການຊຳລະເງິນ", shortLabel: "ຊຳລະ", icon: "payment" },
  { href: "/results", label: "ຜົນກວດ", shortLabel: "ຜົນກວດ", icon: "result" },
  { href: "/exam-types", label: "ປະເພດການກວດ", shortLabel: "ປະເພດ", icon: "order" },
  { href: "/staff", label: "ຂໍ້ມູນພະນັກງານ", shortLabel: "ພະນັກງານ", icon: "patient", adminOnly: true },
  { href: "/reports", label: "ລາຍງານ", shortLabel: "ລາຍງານ", icon: "result" },
];

const mobileNavHrefs = new Set(["/dashboard", "/queues", "/orders", "/payments", "/results"]);

function MobileMenu({
  open,
  pathname,
  userRole,
  userName,
  onClose,
  onLogout,
}: {
  open: boolean;
  pathname: string;
  userRole?: string;
  userName?: string;
  onClose: () => void;
  onLogout: () => void;
}) {
  const visibleLinks = mobileLinks.filter((link) => !link.adminOnly || userRole === "ADMIN");

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="ປິດເມນູ"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/45 backdrop-blur-[1px] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        id="mobile-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="ເມນູຫຼັກ"
        className={`absolute inset-y-0 left-0 flex w-[82vw] max-w-[300px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-16 items-center justify-between bg-[#123879] px-4 text-white">
          <div>
            <div className="text-base font-bold">ເມນູຫຼັກ</div>
            <div className="text-[11px] text-white/75">ລະບົບຈັດການພະແນກລັງສີ</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            aria-label="ປິດເມນູ"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-2xl leading-none transition hover:bg-white/20"
          >
            ×
          </button>
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <div className="truncate text-sm font-bold text-[#123879]">{userName || "ພະນັກງານ"}</div>
          <div className="mt-0.5 text-[11px] font-semibold text-[#767285]">{statusLabel(userRole)}</div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile menu">
          {visibleLinks.map((link) => {
            const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                tabIndex={open ? 0 : -1}
                className={`mb-1 flex min-h-11 items-center rounded-lg border-l-4 px-3 py-2.5 text-sm font-bold transition ${
                  active
                    ? "border-[#123879] bg-[#eeeafe] text-[#123879]"
                    : "border-transparent text-[#454158] hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={onLogout}
            tabIndex={open ? 0 : -1}
            className="min-h-11 w-full rounded-lg bg-[#ef4444] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc2626]"
          >
            ອອກຈາກລະບົບ
          </button>
        </div>
      </aside>
    </div>
  );
}

function MobileNav({ pathname, userRole }: { pathname: string; userRole?: string }) {
  const visibleLinks = mobileLinks.filter(
    (link) => mobileNavHrefs.has(link.href) && (!link.adminOnly || userRole === "ADMIN")
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex gap-1 overflow-x-auto border-t border-slate-200 bg-white/95 px-2 py-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur lg:hidden"
      aria-label="Mobile navigation"
    >
      {visibleLinks.map((link) => {
        const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1.5 text-center text-[10px] font-bold transition sm:min-w-[92px] sm:text-[11px] ${
              active ? "bg-[#eeeafe] text-[#123879]" : "text-[#767285]"
            }`}
          >
            <MobileNavIcon name={link.icon} />
            <span>{link.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavIcon({ name }: { name: string }) {
  if (name === "home") return <span aria-hidden="true" className="text-lg leading-none">⌂</span>;
  if (name === "patient") return <span aria-hidden="true" className="text-lg leading-none">♙</span>;
  if (name === "queue") return <span aria-hidden="true" className="text-lg leading-none">☷</span>;
  if (name === "payment") return <span aria-hidden="true" className="text-lg leading-none">₭</span>;
  if (name === "result") return <span aria-hidden="true" className="text-lg leading-none">✓</span>;
  return <span aria-hidden="true" className="text-lg leading-none">▤</span>;
}
