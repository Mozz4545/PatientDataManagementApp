import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "ລະບົບຈັດການຂໍ້ມູນຄົນເຈັບ - ໂຮງໝໍ 103",
  description: "ລະບົບຈັດການຂໍ້ມູນຄົນເຈັບພະແນກລັງສີ",
  icons: {
    icon: "/radiology_logo_minimal.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lo">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
