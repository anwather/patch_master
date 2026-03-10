"use client";

import { useState } from "react";

interface TerraformOutputProps {
  code: string;
}

export function TerraformOutput({ code }: TerraformOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative h-full">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium py-1.5 px-3 rounded transition-colors cursor-pointer z-10"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="bg-gray-900 dark:bg-gray-950 text-green-400 rounded-lg p-4 overflow-auto text-sm leading-relaxed h-full min-h-[300px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
