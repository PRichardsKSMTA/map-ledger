import { LogOut, Settings, Map } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { signOut, msalInstance } from "../utils/msal";

type Claims = Record<string, unknown>;

export default function Navbar() {
  const { account } = useAuthStore();

  const claims = (account?.idTokenClaims as Claims | undefined) ?? {};
  const displayName =
    (claims["name"] as string) ??
    account?.name ??
    (claims["given_name"] ? `${claims["given_name"]} ${claims["family_name"] ??  ""}`.trim() : "")
    "";
  const email =
    (Array.isArray(claims["emails"]) && (claims["emails"] as string[]) [0]) ||
    (claims["preferred_username"] as string) ||
    account?.username ||
    "";

  const hasAccount = 
    (msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]) != null;

  const handleSignOut = async () => {
    await signOut(); // logoutRedirect with postLogoutRedirectUri
  };

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
            <button 
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
              title="Settings"
              type='button'
            >
              <Settings className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <p className="font-semibold text-gray-900">
                  {displayName || "Guest"}
                </p>
                {email && <p className='text-gray-500 text-xs'>{email}</p>}
              </div>
              
              <button 
                type="button"
                onClick={handleSignOut}
                disabled={!hasAccount}
                title='Sign out'
                className="p-2 text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}