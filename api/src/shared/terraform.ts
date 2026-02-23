import { TerraformInput } from "./types.js";

export function buildTerraform(input: TerraformInput): string {
  const windowsClassifications = input.windowsClassifications ?? ["Critical", "Security", "Updates"];
  const linuxClassifications = input.linuxClassifications ?? ["Critical", "Security"];
  const recurEveryLine = input.recurEvery ? `    recur_every         = "${input.recurEvery}"\n` : "";
  const durationLine = input.duration ? `    duration            = "${input.duration}"\n` : "";
  const selected = input.selectedServerIds ?? [];
  const assignments = selected
    .map(
      (id, index) => `resource "azurerm_maintenance_assignment_virtual_machine" "selected_${index + 1}" {
  location                     = "${input.location}"
  maintenance_configuration_id = azurerm_maintenance_configuration.generated.id
  virtual_machine_id           = "${id}"
}`
    )
    .join("\n\n");

  return `resource "azurerm_maintenance_configuration" "generated" {
  name                     = "${input.name}"
  resource_group_name      = "${input.resourceGroupName}"
  location                 = "${input.location}"
  scope                    = "InGuestPatch"
  in_guest_user_patch_mode = "${input.inGuestUserPatchMode}"

  window {
    start_date_time     = "${input.startDateTime}"
    time_zone           = "${input.timeZone}"
${recurEveryLine}${durationLine}  }

  install_patches {
    reboot = "${input.reboot}"

    windows {
      classifications_to_include = ${JSON.stringify(windowsClassifications)}
    }

    linux {
      classifications_to_include = ${JSON.stringify(linuxClassifications)}
    }
  }
}
${assignments ? `\n\n${assignments}` : ""}`;
}
