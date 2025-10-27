// src/pages/Login.tsx
import { useMsal } from '@azure/msal-react';
import { LogIn } from 'lucide-react';
import { loginRequest } from '../utils/msal';
import { useAuthStore } from '../store/authStore';
import AuthErrorAlert from '../components/AuthErrorAlert';

const MS_SIGNIN_SVG_LIGHT =
  'https://learn.microsoft.com/en-us/entra/identity-platform/media/howto-add-branding-in-apps/ms-symbollockup_signin_light.svg';
const MS_SIGNIN_SVG_DARK =
  'https://raw.githubusercontent.com/MicrosoftDocs/entra-docs/main/docs/identity-platform/media/howto-add-branding-in-apps/ms-symbollockup_signin_dark.svg';

export default function Login() {
  const { instance } = useMsal();
  const setError = useAuthStore((s) => s.setError);

  const handleLogin = async () => {
    try {
      setError(null);
      await instance.loginRedirect(loginRequest);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-custom flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-white backdrop-blur-sm p-3 rounded-xl border border-white/10 shadow-none">
            <LogIn className="h-12 w-12 text-primary-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Sign in to MapLedger
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-500/70 backdrop-blur-sm py-6 px-4 border border-white/10 shadow-none sm:rounded-xl sm:px-10">
          <AuthErrorAlert />
          <button
            type="button"
            onClick={handleLogin}
            className="w-full flex justify-center p-0 border-0 bg-transparent"
          >
            <img
              src={MS_SIGNIN_SVG_LIGHT}
              alt="Sign in with Microsoft"
              className="h-10 w-auto block dark:hidden"
            />
            <img
              src={MS_SIGNIN_SVG_DARK}
              alt="Sign in with Microsoft"
              className="h-10 w-auto hidden dark:block"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
