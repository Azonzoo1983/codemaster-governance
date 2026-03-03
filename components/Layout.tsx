import React, { useState } from 'react';
import { useStore } from '../store';
import { Role } from '../types';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  LogOut, 
  User as UserIcon,
  ShieldCheck,
  Menu,
  X,
  BarChart2
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage }) => {
  const { currentUser, users, setCurrentUser } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: Object.values(Role) },
    { id: 'new-request', label: 'New Request', icon: <PlusCircle size={20} />, roles: [Role.REQUESTER, Role.ADMIN] },
    { id: 'reports', label: 'Reports', icon: <BarChart2 size={20} />, roles: [Role.ADMIN, Role.MANAGER, Role.POC, Role.SPECIALIST, Role.TECHNICAL_REVIEWER] },
    { id: 'admin', label: 'Admin Panel', icon: <Settings size={20} />, roles: [Role.ADMIN] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(currentUser.role));

  return (
    <div className="h-screen bg-gray-50 flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden bg-indigo-900 text-white p-4 flex justify-between items-center">
        <div className="font-bold text-lg">CodeMaster</div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 h-screen w-64 bg-indigo-900 text-gray-100 flex flex-col transition-transform z-20
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-indigo-800">
          <h1 className="text-2xl font-bold tracking-tight">CodeMaster</h1>
          <p className="text-indigo-300 text-xs mt-1">Governance Tool</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {filteredMenu.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActivePage(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activePage === item.id 
                  ? 'bg-indigo-700 text-white shadow-md' 
                  : 'hover:bg-indigo-800 text-indigo-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Role Switcher for Demo */}
        <div className="p-4 border-t border-indigo-800 bg-indigo-950">
          <div className="text-xs text-indigo-400 mb-2 uppercase font-semibold">Demo: Switch Role</div>
          <select 
            className="w-full bg-indigo-900 border border-indigo-700 text-xs rounded p-2 text-white focus:outline-none focus:border-indigo-500"
            value={currentUser.id}
            onChange={(e) => {
              const u = users.find(u => u.id === e.target.value);
              if(u) setCurrentUser(u);
            }}
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
          <div className="mt-4 flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
              <UserIcon size={16} />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="truncate font-medium">{currentUser.name}</div>
              <div className="truncate text-xs text-indigo-300">{currentUser.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto min-h-0">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
