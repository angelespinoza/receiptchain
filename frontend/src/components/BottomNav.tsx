'use client';

import Link from 'next/link';

interface BottomNavProps {
  activeTab: string;
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', href: '/' },
    { id: 'scan', label: 'Escanear', icon: '📸', href: '/scan' },
    { id: 'history', label: 'Historial', icon: '📋', href: '/history' },
    { id: 'settings', label: 'Ajustes', icon: '⚙️', href: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex flex-row justify-around items-center px-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isScan = tab.id === 'scan';

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${
              isScan ? 'scale-110' : ''
            } ${isActive ? 'text-[#35D07F] font-bold' : 'text-gray-400'}`}
          >
            <span className={`text-2xl mb-1 ${isScan ? 'text-3xl' : ''}`}>{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
