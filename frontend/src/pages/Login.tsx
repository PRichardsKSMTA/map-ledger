import React from 'react';
import { useMsal } from '@azure/msal-react';
import { LogIn } from 'lucide-react';
import signinMicrosoft from '../assets/signin-microsoft.svg';
import { loginRequest } from '../utils/msal';

export default function Login() {
  const { instance } = useMsal();

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
            <img
              src={signinMicrosoft}
              alt="Sign in with Microsoft"
              className="h-10 w-auto"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
