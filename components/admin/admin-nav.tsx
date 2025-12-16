'use client';

import { Button } from '@/components/ui/button';
import { Users, Calendar, FileText } from 'lucide-react';

type AdminTab = 'users' | 'meeting-types' | 'scenarios';

interface AdminNavProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export function AdminNav({ activeTab, onTabChange }: AdminNavProps) {
  return (
    <div className="flex gap-2 border-b border-gray-200">
      <Button
        variant={activeTab === 'users' ? 'default' : 'ghost'}
        onClick={() => onTabChange('users')}
        className="rounded-b-none"
      >
        <Users className="mr-2 h-4 w-4" />
        Пользователи
      </Button>
      <Button
        variant={activeTab === 'meeting-types' ? 'default' : 'ghost'}
        onClick={() => onTabChange('meeting-types')}
        className="rounded-b-none"
      >
        <Calendar className="mr-2 h-4 w-4" />
        Типы встреч
      </Button>
      <Button
        variant={activeTab === 'scenarios' ? 'default' : 'ghost'}
        onClick={() => onTabChange('scenarios')}
        className="rounded-b-none"
      >
        <FileText className="mr-2 h-4 w-4" />
        Сценарии
      </Button>
    </div>
  );
}








