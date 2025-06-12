import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const { user } = useAuthStore();

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Welcome back, {user?.firstName}!</h1>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="py-4">
          {/* Dashboard content will go here */}
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-700">Your dashboard content will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}