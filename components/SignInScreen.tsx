'use client';

import { signIn } from 'next-auth/react';

export default function SignInScreen() {
  return (
    <div className="signin-screen">
      <h1>Receipt Workflows</h1>
      <p>
        Upload a receipt and automatically rename &amp; file it into Google Drive, or log it as a
        row in a Google Sheet. Sign in with Google to get started.
      </p>
      <button className="btn" onClick={() => signIn('google')}>
        Sign in with Google
      </button>
    </div>
  );
}
