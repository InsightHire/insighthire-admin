'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

export default function IndeedIntegrationPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [status, setStatus] = useState<string>('');

  const startLoginMutation = trpc.platformAdmin.startIndeedLogin.useMutation();
  const submitPhoneMutation = trpc.platformAdmin.submitIndeedPhoneCode.useMutation();

  const handleStartLogin = async () => {
    try {
      setStatus('Starting Indeed login...');
      const result = await startLoginMutation.mutateAsync();
      setSessionId(result.sessionId);
      setStatus(`Session started: ${result.status}`);
      
      if (result.status === 'phone_code_needed') {
        setStatus('Email code verified! Enter your phone/SMS code below.');
      } else if (result.status === 'logged_in') {
        setStatus('Already logged in!');
      } else {
        setStatus(`Status: ${result.status}`);
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const handleSubmitPhone = async () => {
    if (!sessionId || !phoneCode) {
      alert('Please enter phone code');
      return;
    }

    try {
      setStatus('Submitting phone code...');
      const result = await submitPhoneMutation.mutateAsync({
        sessionId,
        phoneCode
      });
      setStatus(result.message || `Login status: ${result.status}`);
      
      if (result.status === 'logged_in') {
        alert('Successfully logged into Indeed! You can now fetch resumes.');
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Indeed Integration</h1>
      
      <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">Login to Indeed</h2>
        
        <div className="space-y-4">
          {/* Step 1: Start Login */}
          <div>
            <button
              onClick={handleStartLogin}
              disabled={startLoginMutation.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {startLoginMutation.isPending ? 'Starting...' : 'Start Indeed Login'}
            </button>
            <p className="text-sm text-gray-600 mt-2">
              This will automatically fetch the email verification code from Mailgun and enter it.
            </p>
          </div>

          {/* Step 2: Phone Code */}
          {sessionId && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium mb-2">
                Phone/SMS Verification Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  placeholder="Enter 6-digit code from SMS"
                  className="border rounded px-3 py-2 flex-1"
                  maxLength={6}
                />
                <button
                  onClick={handleSubmitPhone}
                  disabled={submitPhoneMutation.isPending || !phoneCode}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {submitPhoneMutation.isPending ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          )}

          {/* Status */}
          {status && (
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm font-mono">{status}</p>
              {sessionId && (
                <p className="text-xs text-gray-600 mt-2">Session ID: {sessionId}</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 border-t pt-4">
          <h3 className="font-semibold mb-2">How It Works:</h3>
          <ol className="text-sm text-gray-700 space-y-2">
            <li>1. Click "Start Indeed Login" - automation enters email and fetches code from Mailgun</li>
            <li>2. Check your phone for SMS code from Indeed</li>
            <li>3. Enter the SMS code above and click Submit</li>
            <li>4. Once logged in, resumes will be auto-downloaded when candidates apply</li>
          </ol>
        </div>
      </div>

      {sessionId && status.includes('logged in') && (
        <div className="bg-green-50 border border-green-200 p-4 rounded mt-6 max-w-2xl">
          <p className="text-green-800 font-semibold">✅ Indeed session active!</p>
          <p className="text-sm text-green-700 mt-2">
            The system will now automatically download resumes when new Indeed applications arrive.
          </p>
        </div>
      )}
    </div>
  );
}
