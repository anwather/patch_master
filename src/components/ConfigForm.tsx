"use client";

import { useState } from "react";
import { TerraformInput } from "@/lib/types";

interface ConfigFormProps {
  onGenerate: (config: Omit<TerraformInput, "selectedServerIds">) => void;
  generating: boolean;
  hasSelection: boolean;
}

const TIMEZONES = [
  "UTC",
  "AUS Eastern Standard Time",
  "E. Australia Standard Time",
  "Pacific Standard Time",
  "Eastern Standard Time",
  "Central Standard Time",
  "Mountain Standard Time",
  "GMT Standard Time",
  "Central European Standard Time",
  "India Standard Time",
  "Tokyo Standard Time",
];

const RECURRENCE_OPTIONS = [
  { label: "Daily", value: "1Day" },
  { label: "Weekly", value: "1Week" },
  { label: "Every 2 weeks", value: "2Weeks" },
  { label: "Monthly", value: "1Month" },
];

export function ConfigForm({
  onGenerate,
  generating,
  hasSelection,
}: ConfigFormProps) {
  const [config, setConfig] = useState({
    name: "maintenance-config",
    resourceGroupName: "",
    location: "australiaeast",
    inGuestUserPatchMode: "User" as "Platform" | "User",
    startDateTime: "",
    timeZone: "AUS Eastern Standard Time",
    recurEvery: "1Week",
    duration: "03:55",
    reboot: "IfRequired" as "Always" | "IfRequired" | "Never",
    windowsClassifications: ["Critical", "Security", "Updates"],
    linuxClassifications: ["Critical", "Security"],
  });

  const update = (field: string, value: string | string[]) =>
    setConfig((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(config);
  };

  const fieldClass =
    "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Configuration Name</label>
          <input
            className={fieldClass}
            value={config.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Resource Group</label>
          <input
            className={fieldClass}
            value={config.resourceGroupName}
            onChange={(e) => update("resourceGroupName", e.target.value)}
            placeholder="rg-maintenance"
            required
          />
        </div>
        <div>
          <label className={labelClass}>Location</label>
          <input
            className={fieldClass}
            value={config.location}
            onChange={(e) => update("location", e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Patch Mode</label>
          <select
            className={fieldClass}
            value={config.inGuestUserPatchMode}
            onChange={(e) =>
              update(
                "inGuestUserPatchMode",
                e.target.value as "Platform" | "User"
              )
            }
          >
            <option value="User">User</option>
            <option value="Platform">Platform</option>
          </select>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-1">
        Schedule
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Start Date &amp; Time</label>
          <input
            type="datetime-local"
            className={fieldClass}
            value={config.startDateTime}
            onChange={(e) => update("startDateTime", e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Time Zone</label>
          <select
            className={fieldClass}
            value={config.timeZone}
            onChange={(e) => update("timeZone", e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Recurrence</label>
          <select
            className={fieldClass}
            value={config.recurEvery}
            onChange={(e) => update("recurEvery", e.target.value)}
          >
            {RECURRENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Duration</label>
          <input
            className={fieldClass}
            value={config.duration}
            onChange={(e) => update("duration", e.target.value)}
            placeholder="03:55"
          />
        </div>
      </div>

      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-1">
        Patch Settings
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Reboot</label>
          <select
            className={fieldClass}
            value={config.reboot}
            onChange={(e) =>
              update(
                "reboot",
                e.target.value as "Always" | "IfRequired" | "Never"
              )
            }
          >
            <option value="IfRequired">If Required</option>
            <option value="Always">Always</option>
            <option value="Never">Never</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={generating || !hasSelection}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {generating
          ? "Generating..."
          : hasSelection
            ? "Generate Terraform"
            : "Select servers first"}
      </button>
    </form>
  );
}
