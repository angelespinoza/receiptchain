import type { Metadata, Viewport } from 'next';
import ClientProviders from '@/components/ClientProviders';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReceiptChain',
  description: 'Escanea recibos y registra gastos en la blockchain de Celo',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ReceiptChain',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#35D07F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-[#F7FBF9]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <GoogleAnalytics />
        <ClientProviders>
          <div className="max-w-md mx-auto pb-20">{children}</div>
        </ClientProviders>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
