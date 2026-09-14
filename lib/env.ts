// Derives NEXTAUTH_URL automatically on Vercel so it never needs to be set by hand there.
// Vercel injects VERCEL_PROJECT_PRODUCTION_URL (stable production domain) and VERCEL_URL
// (this specific deployment's domain, including previews) — prefer the former so the value
// stays stable across production deploys and matches whatever redirect URI is registered
// with the Google OAuth client. Local dev still needs NEXTAUTH_URL in .env.local, since
// none of these are set outside Vercel.
if (!process.env.NEXTAUTH_URL) {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) {
    process.env.NEXTAUTH_URL = `https://${vercelHost}`;
  }
}

export {};
