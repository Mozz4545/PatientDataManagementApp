"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // redirect root to the login route
    router.replace("/login");
  }, [router]);

  return null;
}
