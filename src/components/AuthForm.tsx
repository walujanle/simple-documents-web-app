import { useId, useState } from 'react';
import { config } from '@/utils/config';

type FormSubmitEvent = {
  preventDefault: () => void;
};

interface AuthFormProps {
  mode: 'login' | 'register';
}

export default function AuthForm({ mode }: AuthFormProps) {
  const fieldIdPrefix = useId().replace(/:/g, '');
  const nameId = `${fieldIdPrefix}-name`;
  const usernameId = `${fieldIdPrefix}-username`;
  const passwordId = `${fieldIdPrefix}-password`;
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormSubmitEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'An error occurred');
      }

      // Redirect to documents workspace on success
      window.location.href = '/documents';
    } catch (err: any) {
      setError(err.message || 'Failed to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-xl border border-border-custom bg-bg-card text-text-main shadow-lg">
      <div className="flex flex-col items-center mb-8 select-none">
        {config.appLogo ? (
          <img
            src={config.appLogo}
            alt={config.appName}
            className="h-10 w-auto object-contain mb-2"
          />
        ) : (
          <h1 className="text-3xl font-black tracking-widest mb-1">
            {config.appName.toUpperCase()}
          </h1>
        )}
        <p className="text-xs text-text-muted text-center">
          {mode === 'login' ? 'Sign in to your workspace' : 'Create a new author account'}
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs text-center font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label
              htmlFor={nameId}
              className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted"
            >
              Full Name (Optional)
            </label>
            <input
              id={nameId}
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40 font-semibold"
              placeholder="Enter full name"
            />
          </div>
        )}

        <div>
          <label
            htmlFor={usernameId}
            className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted"
          >
            Username
          </label>
          <input
            id={usernameId}
            name="username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40"
            placeholder="Enter username"
          />
        </div>

        <div>
          <label
            htmlFor={passwordId}
            className="block text-2xs font-bold uppercase tracking-widest mb-1 text-text-muted"
          >
            Password
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border-custom bg-bg-app text-text-main outline-none focus:ring-1 focus:ring-text-main focus:border-text-main transition-all placeholder:text-text-muted/40"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-3 py-3 rounded-lg bg-text-main text-bg-card font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <div className="mt-8 text-center text-xs text-text-muted border-t border-border-custom/55 pt-5">
        {mode === 'login' ? (
          <p>
            Don't have an account?{' '}
            <a href="/register" className="font-semibold text-text-main hover:underline">
              Sign up
            </a>
          </p>
        ) : (
          <p>
            Already have an account?{' '}
            <a href="/login" className="font-semibold text-text-main hover:underline">
              Sign in here
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
