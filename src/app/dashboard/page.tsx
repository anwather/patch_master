"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { ServerItem, TerraformInput } from "@/lib/types";
import { ServerTable } from "@/components/ServerTable";
import { ConfigForm } from "@/components/ConfigForm";
import { TerraformOutput } from "@/components/TerraformOutput";
import { useTheme } from "@/components/ThemeProvider";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEnabledOnly, setShowEnabledOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terraform, setTerraform] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/";
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError(null);
    fetch(`/api/servers?showEnabledOnly=${showEnabledOnly}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data) => setServers(data.servers))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, showEnabledOnly]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === servers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(servers.map((s) => s.id)));
    }
  };

  const handleGenerate = async (
    config: Omit<TerraformInput, "selectedServerIds">
  ) => {
    setGenerating(true);
    setTerraform("");
    try {
      const res = await fetch("/api/terraform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          selectedServerIds: Array.from(selectedIds),
        }),
      });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data = await res.json();
      setTerraform(data.terraform);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav bar */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-blue-700 dark:text-blue-400">
          Patch Master
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? (
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            )}
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {session.user?.name}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-3 flex items-center justify-between shrink-0">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 font-bold cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Split layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left panel — inputs */}
        <div className="lg:w-1/2 overflow-y-auto border-r border-gray-200 dark:border-gray-700">
          <div className="p-6 space-y-6">
            {/* Server list */}
            <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Azure Servers</h2>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={showEnabledOnly}
                    onChange={(e) => setShowEnabledOnly(e.target.checked)}
                    className="rounded"
                  />
                  Enabled only
                </label>
              </div>
              <ServerTable
                servers={servers}
                selectedIds={selectedIds}
                loading={loading}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
              />
            </section>

            {/* Configuration */}
            <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-lg font-semibold mb-4">
                Maintenance Configuration
              </h2>
              <ConfigForm
                onGenerate={handleGenerate}
                generating={generating}
                hasSelection={selectedIds.size > 0}
              />
            </section>
          </div>
        </div>

        {/* Right panel — terraform output */}
        <div className="lg:w-1/2 overflow-y-auto bg-gray-100 dark:bg-gray-900/50">
          <div className="p-6 h-full">
            {terraform ? (
              <section className="h-full flex flex-col">
                <h2 className="text-lg font-semibold mb-4">
                  Generated Terraform
                </h2>
                <div className="flex-1 min-h-0">
                  <TerraformOutput code={terraform} />
                </div>
              </section>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400 dark:text-gray-600">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                  <p className="text-lg font-medium">No Terraform generated yet</p>
                  <p className="text-sm mt-1">
                    Select servers and configure maintenance settings, then
                    click Generate
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
