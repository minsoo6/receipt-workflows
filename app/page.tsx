import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import SignInScreen from '@/components/SignInScreen';
import Dashboard from '@/components/Dashboard';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <SignInScreen />;
  }

  return <Dashboard userEmail={session.user?.email ?? null} />;
}
