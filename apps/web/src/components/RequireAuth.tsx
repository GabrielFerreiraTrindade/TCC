"use client";

import { useEffect, type PropsWithChildren } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function RequireAuth({ children }: PropsWithChildren) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    );
  }

  return <>{children}</>;
}
