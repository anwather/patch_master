"use client";

import { ServerItem } from "@/lib/types";

interface ServerTableProps {
  servers: ServerItem[];
  selectedIds: Set<string>;
  loading: boolean;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
}

export function ServerTable({
  servers,
  selectedIds,
  loading,
  onToggleSelect,
  onSelectAll,
}: ServerTableProps) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading servers...
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No servers found. Ensure you have Reader access to your Azure
        subscriptions.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 px-3 w-10">
              <input
                type="checkbox"
                checked={selectedIds.size === servers.length && servers.length > 0}
                onChange={onSelectAll}
                className="rounded"
              />
            </th>
            <th className="py-2 px-3">Name</th>
            <th className="py-2 px-3">OS</th>
            <th className="py-2 px-3">Resource Group</th>
            <th className="py-2 px-3">Subscription</th>
            <th className="py-2 px-3">Update Manager</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr
              key={server.id}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              onClick={() => onToggleSelect(server.id)}
            >
              <td className="py-2 px-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(server.id)}
                  onChange={() => onToggleSelect(server.id)}
                  className="rounded"
                />
              </td>
              <td className="py-2 px-3 font-medium">{server.name}</td>
              <td className="py-2 px-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    server.osType === "Windows"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {server.osType}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-600">
                {server.resourceGroup}
              </td>
              <td className="py-2 px-3 text-gray-600">
                {server.subscriptionName}
              </td>
              <td className="py-2 px-3">
                {server.isUpdateManagerEnabled ? (
                  <span className="text-green-600 font-medium">Enabled</span>
                ) : (
                  <span className="text-gray-400">Disabled</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-xs text-gray-400">
        {selectedIds.size} of {servers.length} selected
      </div>
    </div>
  );
}
