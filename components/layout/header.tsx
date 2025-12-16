'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, User } from 'lucide-react';
import { useState } from 'react';
import { NotificationsBell } from '@/components/notifications/notifications-bell';

export function Header() {
  const { user, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xl font-bold text-blue-600">
            AAM
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Встречи
            </Link>
            <Link
              href="/clients"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Клиенты
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Админ
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <>
              <NotificationsBell />
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-700">
                <User className="h-4 w-4" />
                <span>{user.name}</span>
                {isAdmin && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                    Admin
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="hidden md:flex"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white md:hidden">
          <nav className="container mx-auto flex flex-col gap-2 px-4 py-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              Встречи
            </Link>
            <Link
              href="/clients"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              Клиенты
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Админ
              </Link>
            )}
            {user && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <User className="h-4 w-4" />
                  <span>{user.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={logout}>
                  Выйти
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

