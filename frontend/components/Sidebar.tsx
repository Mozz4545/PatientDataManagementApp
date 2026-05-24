"use client";

import React from "react";
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r hidden md:block">
      <div className="p-6">
        <div className="mb-6 text-xl font-semibold">ລະບົບລັງສີ</div>
        <nav className="space-y-2">
          <Link href="/dashboard" className="block rounded px-3 py-2 hover:bg-slate-100">ໜ້າທໍາ</Link>
          <Link href="/patients" className="block rounded px-3 py-2 hover:bg-slate-100">ຄົນໄຂ້</Link>
          <Link href="/orders" className="block rounded px-3 py-2 hover:bg-slate-100">ໃບສັ່ງ</Link>
          <Link href="/queues" className="block rounded px-3 py-2 hover:bg-slate-100">ຄິວ</Link>
          <Link href="/results" className="block rounded px-3 py-2 hover:bg-slate-100">ຜົນການກວດ</Link>
        </nav>
      </div>
    </aside>
  );
}
