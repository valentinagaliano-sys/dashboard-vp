import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard VP Proyectos",
  description: "Estado de proyectos por socio — VP Proyectos 2026",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
