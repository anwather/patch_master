"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { ServerItem, TerraformInput } from "@/lib/types";
import { ServerTable } from "@/components/ServerTable";
import { ConfigForm } from "@/components/ConfigForm";
import { TerraformOutput } from "@/components/TerraformOutput";

export default function DashboardPage() {
  const { data: session, status } = useSession();
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

  const handleGenerate = async (config: Omit<TerraformInput, "selectedServerIds">) => {
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
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen">
      {/* Nav bar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-700">Patch Master</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-red-600 hover:text-red-800 font-medium cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-500 hover:text-red-700 font-bold cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Server list */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Azure Servers</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showEnabledOnly}
                onChange={(e) => setShowEnabledOnly(e.target.checked)}
                className="rounded"
              />
              Show Update Manager enabled only
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
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">
            Maintenance Configuration
          </h2>
          <ConfigForm
            onGenerate={handleGenerate}
            generating={generating}
            hasSelection={selectedIds.size > 0}
          />
        </section>

        {/* Terraform output */}
        {terraform && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">
              Generated Terraform
            </h2>
            <TerraformOutput code={terraform} />
          </section>
        )}
      </main>
    </div>
  );
}
