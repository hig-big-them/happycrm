"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminBypassPage() {
  const router = useRouter();

  useEffect(() => {
    // Bypass devre dışı - login sayfasına yönlendir
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Bypass yapılıyor...</p>
      </div>
    </div>
  );
}