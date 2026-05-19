import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sprayed Dashboard",
  description: "Sprayed Monitoring Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
