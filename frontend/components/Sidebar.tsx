"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "dashboard" | "queue" | "orders" | "payments" | "results" | "examTypes" | "reports";

const mainLinks: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/dashboard", label: "ໜ້າຫຼັກ", icon: "dashboard" },
  { href: "/queues", label: "ຄິວ", icon: "queue" },
  { href: "/orders", label: "ໃບສັ່ງກວດ", icon: "orders" },
  { href: "/payments", label: "ການຊຳລະເງິນ", icon: "payments" },
  { href: "/results", label: "ຜົນກວດ", icon: "results" },
  { href: "/exam-types", label: "ປະເພດການກວດ", icon: "examTypes" },
];

const detailLinks: Array<{ href: string; label: string; icon: IconName; adminOnly: boolean }> = [
  { href: "/reports", label: "ລາຍງານ", icon: "reports", adminOnly: true },
];

function Icon({ name }: { name: IconName }) {
  const className = "h-5 w-5 shrink-0";

  if (name === "dashboard") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (name === "queue") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16.5 19.5c0-2.2-1.8-4-4-4h-5c-2.2 0-4 1.8-4 4" />
        <circle cx="10" cy="8" r="3.5" />
        <path d="M21 19.5c0-1.9-1.2-3.4-3-3.9" />
        <path d="M16.5 4.8a3 3 0 0 1 0 5.4" />
      </svg>
    );
  }

  if (name === "orders") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 4h6l1 2h3v15H5V6h3l1-2Z" />
        <path d="M9 11h6" />
        <path d="M9 15h5" />
      </svg>
    );
  }

  if (name === "payments") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5.5" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
        <path d="M15.5 15h1.5" />
      </svg>
    );
  }

  if (name === "results") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 3.5h7l4 4V21H7V3.5Z" />
        <path d="M14 3.5v4h4" />
        <path d="m9.5 14 2 2 4-4" />
      </svg>
    );
  }

  if (name === "examTypes") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 18c2.8-4 5.1-8.2 6.7-12.5" />
        <path d="M14 5.5c1.6 4.3 3.9 8.5 6.7 12.5" />
        <path d="M7 13h10" />
        <path d="M6 18h12" />
        <path d="M10 5.5h4" />
      </svg>
    );
  }

  if (name === "reports") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5h16" />
        <path d="M7 16v-5" />
        <path d="M12 16V7" />
        <path d="M17 16v-8" />
      </svg>
    );
  }

  return null;
}

function RadiologyLogo() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
      <Image
        src="/radiology_logo_minimal.svg"
        alt="Radiology Patient Management"
        width={34}
        height={34}
        priority
        className="h-8 w-8"
      />
    </span>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: IconName }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-semibold transition ${
        active
          ? "border border-slate-900/70 bg-[#eeeafe] text-[#161133]"
          : "border border-transparent text-[#767285] hover:bg-[#f2efff]"
      }`}
    >
      <Icon name={icon} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

export default function Sidebar({ userRole }: { userRole?: string }) {
  const visibleDetailLinks = detailLinks.filter((link) => !link.adminOnly || userRole === "ADMIN");

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[248px] border-r border-[#dedede] bg-white lg:block">
      <div className="flex h-[72px] items-center bg-[#123879] px-4 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <RadiologyLogo />
          <span className="min-w-0 text-sm font-bold leading-tight">ພະແນກລັງສີ - ໂຮງໝໍ 103</span>
        </div>
      </div>

      <nav className="px-3 py-4">
        <div className="space-y-1.5 border-b border-slate-200 pb-5">
          {mainLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </div>

        {visibleDetailLinks.length > 0 && (
          <div className="pt-10">
            <p className="mb-3 px-3 text-[11px] font-bold uppercase text-[#767285]">DETAIL</p>
            <div className="space-y-1.5">
              {visibleDetailLinks.map((link) => (
                <NavLink key={link.href} {...link} />
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
