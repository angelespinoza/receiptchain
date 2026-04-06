import type { Metadata } from 'next';
import ClientProviders from '@/components/ClientProviders';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReceiptChain',
  description: 'Escanea recibos y registra gastos en la blockchain de Celo',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#F7FBF9]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <ClientProviders>
          <div className="max-w-md mx-auto pb-20">{children}</div>
        </ClientProviders>
      </body>
    </html>
  );
}
