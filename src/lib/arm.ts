import { ServerItem } from "./types";

async function armGetAll<T extends object>(
  url: string,
  accessToken: string
): Promise<T[]> {
  const collected: T[] = [];
  let nextUrl: string | undefined = url;
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ARM request failed (${response.status}): ${text}`);
    }
    const payload = (await response.json()) as {
      value?: T[];
      nextLink?: string;
    };
    collected.push(...(payload.value ?? []));
    nextUrl = payload.nextLink;
  }
  return collected;
}

function resourceGroupFromId(resourceId: string): string {
  const match = resourceId.match(/\/resourceGroups\/([^/]+)/i);
  return match?.[1] ?? "unknown-rg";
}

const DEMO_SERVERS: ServerItem[] = [
  {
    id: "/subscriptions/000/resourceGroups/rg-app/providers/Microsoft.Compute/virtualMachines/app-01",
    name: "app-01",
    resourceGroup: "rg-app",
    subscriptionId: "000",
    subscriptionName: "Demo Subscription",
    osType: "Windows",
    isUpdateManagerEnabled: true,
  },
  {
    id: "/subscriptions/000/resourceGroups/rg-data/providers/Microsoft.Compute/virtualMachines/data-01",
    name: "data-01",
    resourceGroup: "rg-data",
    subscriptionId: "000",
    subscriptionName: "Demo Subscription",
    osType: "Linux",
    isUpdateManagerEnabled: false,
  },
];

export async function listServers(
  armAccessToken: string | null | undefined
): Promise<ServerItem[]> {
  if (!armAccessToken) {
    return DEMO_SERVERS;
  }

  const subscriptions = await armGetAll<{
    subscriptionId: string;
    displayName: string;
  }>(
    "https://management.azure.com/subscriptions?api-version=2020-01-01",
    armAccessToken
  );

  const serverLists = await Promise.all(
    subscriptions.map(async (sub) => {
      const vmUrl = `https://management.azure.com/subscriptions/${sub.subscriptionId}/providers/Microsoft.Compute/virtualMachines?api-version=2023-09-01`;
      const arcUrl = `https://management.azure.com/subscriptions/${sub.subscriptionId}/providers/Microsoft.HybridCompute/machines?api-version=2023-10-03`;
      const [vms, arcMachines] = await Promise.all([
        armGetAll<{
          id: string;
          name: string;
          properties?: {
            storageProfile?: { osDisk?: { osType?: string } };
          };
        }>(vmUrl, armAccessToken).catch(() => []),
        armGetAll<{
          id: string;
          name: string;
          properties?: { osName?: string };
        }>(arcUrl, armAccessToken).catch(() => []),
      ]);

      const mappedVms: ServerItem[] = vms.map((vm) => ({
        id: vm.id,
        name: vm.name,
        resourceGroup: resourceGroupFromId(vm.id),
        subscriptionId: sub.subscriptionId,
        subscriptionName: sub.displayName,
        osType:
          vm.properties?.storageProfile?.osDisk?.osType === "Windows"
            ? "Windows"
            : "Linux",
        isUpdateManagerEnabled: true,
      }));
      const mappedArc: ServerItem[] = arcMachines.map((machine) => ({
        id: machine.id,
        name: machine.name,
        resourceGroup: resourceGroupFromId(machine.id),
        subscriptionId: sub.subscriptionId,
        subscriptionName: sub.displayName,
        osType: machine.properties?.osName?.toLowerCase().includes("windows")
          ? "Windows"
          : "Linux",
        isUpdateManagerEnabled: true,
      }));
      return [...mappedVms, ...mappedArc];
    })
  );

  return serverLists.flat();
}
