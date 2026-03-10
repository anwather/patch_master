"use client";

import { signIn, useSession } from "next-auth/react";

export default function HomePage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (session) {
    if (typeof window !== "undefined") {
      window.location.href = "/dashboard";
    }
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Patch Master
          </h1>
          <p className="text-gray-500">
            Azure Update Manager Scheduler &amp; Terraform Generator
          </p>
        </div>
        <p className="text-gray-600 mb-8">
          Sign in with your Microsoft Entra ID account to enumerate your Azure
          servers and generate maintenance configuration Terraform code.
        </p>
        <button
          onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/dashboard" })}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors cursor-pointer"
        >
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}
