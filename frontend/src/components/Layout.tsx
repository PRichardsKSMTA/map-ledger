import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar isOpen={isSidebarOpen} />
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-900">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        />
        <main id="app-scroll-container" className="relative flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex h-full w-full min-h-0 max-w-8xl flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
