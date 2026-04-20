'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Simple client-side guard: if no user id / token found in storage,
 * redirect to /login and include returnTo query.
 */
export default function AuthGuard() {
  const router = useRouter();

  useEffect(() => {
    const hasAuth =
      !!(sessionStorage.getItem('userID') ||
         sessionStorage.getItem('userId') ||
         localStorage.getItem('userID') ||
         localStorage.getItem('userId') ||
         localStorage.getItem('token') ||
         sessionStorage.getItem('token'));

    if (!hasAuth) {
      const returnTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
    // run once on mount
  }, [router]);

  return null; // no UI — just redirect if unauthenticated
}