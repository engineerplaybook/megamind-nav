import Script from 'next/script';
import { metadata } from './metadata';
import '@engineerplaybook/design-system/dist/style.css';
import './globals.css';

// eslint-disable-next-line react-refresh/only-export-components -- Next.js requires metadata export alongside default component
export { metadata };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/@knadh/oat/oat.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-19GSDP6BS8" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-19GSDP6BS8');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
