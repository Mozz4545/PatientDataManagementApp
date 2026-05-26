import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Radiology Patient Management - Hospital 103",
  description: "Radiology Patient Management System",
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
