import React, { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import signinMicrosoft from '../assets/signin-microsoft.svg';
import { loginRequest } from '../utils/msal';
import { useAuthStore } from '../store/authStore';
import { env } from '../utils/env';

export default function Login() {
  const { instance } = useMsal();
  const setAccount = useAuthStore((state) => state.setAccount);
  const navigate = useNavigate();

  useEffect(() => {
    instance
      .handleRedirectPromise()
      .then((res) => {
        const account = res?.account ?? instance.getAllAccounts()[0];
        if (account) {
          instance.setActiveAccount(account);
          const groups = (res?.idTokenClaims?.groups as string[]) || [];
          const isAdmin = groups.includes(env.AAD_ADMIN_GROUP_ID);
          const domain = account.username.split('@')[1] || '';
          const isEmployee = env.AAD_EMPLOYEE_DOMAINS.includes(domain);
          const isGuest = !isEmployee;
          setAccount(account, { isAdmin, isEmployee, isGuest });
          navigate('/', { replace: true });
        }
      })
      .catch((e) => console.error(e));
  }, [instance, setAccount, navigate]);

  const handleLogin = () => {
    instance.loginRedirect(loginRequest);
  };

  return (
    <div className="min-h-screen bg-gradient-custom flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-xl shadow-soft">
            <LogIn className="h-12 w-12 text-primary-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Sign in to MapLedger
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-soft sm:rounded-xl sm:px-10">
          <button
            type="button"
            onClick={handleLogin}
            className="w-full flex justify-center p-0 border-0 bg-transparent"
          >
            <img src={signinMicrosoft} alt="Sign in with Microsoft" />
          </button>
        </div>
      </div>
    </div>
  );
}
