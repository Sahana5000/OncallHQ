import './globals.css';
import React from 'react';
import Sidebar from '../components/Sidebar';

export const metadata = {
  title: 'OnCallHQ — Incident Response & On-Call Platform',
  description:
    'Event-driven incident response, alert routing, and automated escalation platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased font-sans">
        <Sidebar />
        <main className="ml-56 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
