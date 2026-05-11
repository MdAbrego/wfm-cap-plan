import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { handleGoogleSuccess, handleGoogleError, isLoading, authError } = useAuth();

  const signIn = useGoogleLogin({
    flow:      'implicit',
    // Fix 1 — explicit full Sheets read+write scope
    scope:     'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly openid email profile',
    onSuccess: handleGoogleSuccess,
    onError:   handleGoogleError,
    // Fix 4 — always prompt for consent so new scopes are re-granted after API was enabled
    prompt:    'consent',
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm text-center">
        {/* Logo / title */}
        <div className="mb-2">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white text-xl font-bold mb-3">W</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">WFM Capacity Plan</h1>
        <p className="text-sm text-gray-500 mb-1">LATAM Workforce Management · Concentrix</p>
        <p className="text-xs text-gray-400 mb-8">
          Sign in with your Google account to access your planning workspace.
        </p>

        {/* Error states */}
        {authError === 'not-found' && (
          <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            Your account is not registered. Contact{' '}
            <a href="mailto:manfredd.abrego@concentrix.com" className="font-medium underline">
              manfredd.abrego@concentrix.com
            </a>{' '}
            to request access.
          </div>
        )}
        {authError === 'auth-failed' && (
          <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            Sign-in failed. Please try again.
          </div>
        )}
        {authError === 'network-error' && (
          <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            Could not reach the data source. Check your connection.
          </div>
        )}

        {/* Sign-in button */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
            Loading your profile…
          </div>
        ) : (
          <button
            onClick={() => signIn()}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors"
          >
            {/* Google G logo */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Sign in with Google
          </button>
        )}

        <p className="mt-8 text-xs text-gray-400">
          Concentrix internal tool — authorized users only
        </p>
      </div>
    </div>
  );
}
