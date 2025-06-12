import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  Users, 
  Building2, 
  FileSpreadsheet, 
  Upload,
  BarChart3,
  Settings,
  Network
} from 'lucide-react';

export default function Sidebar() {
  const { user } = useAuthStore();
  const isSuperUser = user?.role === 'super';

  return (
    <aside className="w-64 bg-gradient-sidebar border-r border-gray-200 shadow-soft">
      <div className="h-full px-3 py-4 flex flex-col">
        <div className="space-y-1.5">
          {isSuperUser && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary-600 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                }`
              }
            >
              <Users className="mr-3 h-5 w-5" />
              Users
            </NavLink>
          )}

          <NavLink
            to="/clients"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-primary-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
              }`
            }
          >
            <Building2 className="mr-3 h-5 w-5" />
            Client Profiles
          </NavLink>

          {isSuperUser && (
            <NavLink
              to="/templates"
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary-600 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                }`
              }
            >
              <FileSpreadsheet className="mr-3 h-5 w-5" />
              COA Templates
            </NavLink>
          )}

          <NavLink
            to="/import"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-primary-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
              }`
            }
          >
            <Upload className="mr-3 h-5 w-5" />
            Data Import
          </NavLink>

          <NavLink
            to="/mapping"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-primary-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
              }`
            }
          >
            <BarChart3 className="mr-3 h-5 w-5" />
            GL Mapping
          </NavLink>

          <NavLink
            to="/integrations"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-primary-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
              }`
            }
          >
            <Network className="mr-3 h-5 w-5" />
            Integrations
          </NavLink>
        </div>

        <div className="mt-auto">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-primary-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
              }`
            }
          >
            <Settings className="mr-3 h-5 w-5" />
            Settings
          </NavLink>
        </div>
      </div>
    </aside>
  );
}