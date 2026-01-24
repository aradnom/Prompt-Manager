import { useState } from 'react';
import { HeroInput } from '@/components/ui/hero-input';
import { Button } from '@/components/ui/button';

export function CreateAccountOrLogin() {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error('Failed to log in');
      }
    } catch (error) {
      console.error('Error logging in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create account');
      }

      const data = await response.json();
      console.log('Account created successfully:', data);
    } catch (error) {
      console.error('Error creating account:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Login Section */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="flex gap-4 items-center">
          <HeroInput
            value={token}
            onChange={setToken}
            placeholder="Enter your token (XXXX-XXXX-XXXX)"
            className="flex-1"
            tokenFormatting
          />
          <Button
            type="submit"
            variant="hero"
            size="hero"
            disabled={!token || isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </div>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-cyan-medium/30"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-background text-cyan-medium">or</span>
        </div>
      </div>

      {/* Create Account Section */}
      <div className="flex justify-center">
        <Button
          onClick={handleCreateAccount}
          variant="hero"
          size="hero"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Creating Account...' : 'Create an Account'}
        </Button>
      </div>
    </div>
  );
}
