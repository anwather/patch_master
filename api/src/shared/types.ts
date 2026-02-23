export type AuthUser = {
  name: string;
  tenantId?: string;
  objectId?: string;
};

export type ServerItem = {
  id: string;
  name: string;
  resourceGroup: string;
  subscriptionId: string;
  subscriptionName: string;
  osType: "Windows" | "Linux";
  isUpdateManagerEnabled: boolean;
};

export type TerraformInput = {
  name: string;
  resourceGroupName: string;
  location: string;
  inGuestUserPatchMode: "Platform" | "User";
  startDateTime: string;
  timeZone: string;
  recurEvery?: string;
  duration?: string;
  reboot: "Always" | "IfRequired" | "Never";
  selectedServerIds?: string[];
  windowsClassifications?: string[];
  linuxClassifications?: string[];
};
