import { useAuthStore } from '../store/authStore';
import { LogOut, Settings, Map } from 'lucide-react';

export default function Navbar() {
  const { user } = useAuthStore();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-inner-top">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white">
              <Map className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">MapLedger</h1>
              <p className="text-xs text-gray-500 -mt-1">GL Mapping Solution</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
              <Settings className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
                <p className="text-gray-500 text-xs">{user?.email}</p>
              </div>
              
              <button className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}