# Patch Scheduler Helper — User Guide

## What is this?

The Patch Scheduler Helper is a web-based tool that helps you plan and configure patch schedules for your Azure servers. It connects to your Azure environment, shows you which servers you have access to, and generates ready-to-use Terraform code for Azure Update Manager maintenance configurations.

## Getting started

### 1. Open the app

Navigate to the Patch Scheduler Helper URL provided by your administrator.

### 2. Sign in

Click **"Sign in with Entra"**. A popup window will appear asking you to sign in with your Microsoft account. After signing in, you may be asked to consent to the app reading your Azure resources — click **Accept**.

Once signed in, the banner will show **"Signed in as \<your name\>"**.

### 3. Load your servers

Click **"Refresh servers"** to load all Azure Virtual Machines and Azure Arc machines you have access to. Servers are loaded from every Azure subscription your account can read.

Each server card shows:
- **Server name** and OS type (Windows/Linux)
- **Resource group** and subscription name
- **Update Manager status** — a green left border means Update Manager is enabled; red means it is not

> **Tip:** Use the **"Show enabled only"** checkbox to filter out servers that don't have Update Manager enabled.

### 4. Select servers

Tick the checkbox on each server you want to include in the maintenance configuration. You can select servers across different resource groups and subscriptions — this lets you create per-environment or per-application patch groups.

### 5. Configure the maintenance window

Fill in the configuration form on the right panel:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Name for the maintenance configuration resource | `mc-prod-weekly` |
| **Resource Group** | Resource group where the configuration will be created | `rg-maintenance` |
| **Location** | Azure region for the configuration | `australiaeast` |
| **Patch Mode** | `Platform` (Azure manages) or `User` (you control timing) | `User` |
| **Start DateTime** | When the first maintenance window begins | `2026-03-01 22:00` |
| **Time Zone** | Time zone for the schedule | `AUS Eastern Standard Time` |
| **Recur Every** | How often the window repeats | `1Week`, `2Week`, `1Month` |
| **Duration** | Maximum time the window stays open | `03:00` (3 hours) |
| **Reboot** | Reboot behaviour after patching | `IfRequired`, `Always`, or `Never` |

### 6. Generate Terraform

Click **"Generate Terraform"**. The output panel at the bottom will display:

- An `azurerm_maintenance_configuration` resource with your settings
- An `azurerm_maintenance_assignment_virtual_machine` resource for each selected server

### 7. Use the output

Copy the generated Terraform code and paste it into your existing Terraform configuration. Run `terraform plan` to review, then `terraform apply` to create the maintenance schedule.

## Frequently asked questions

**Q: I signed in but no servers appear.**
A: Ensure your Azure account has at least **Reader** role on the subscriptions containing your servers. Click Refresh after verifying access.

**Q: Some servers show as "Not enabled" for Update Manager.**
A: These servers haven't been onboarded to Azure Update Manager yet. They can still be selected, but patching won't work until Update Manager is enabled on them. Consult your Azure administrator.

**Q: Can I create different schedules for different server groups?**
A: Yes. Select one group of servers, generate the Terraform, save it, then deselect those servers and select a different group. Change the maintenance configuration name to avoid conflicts.

**Q: What permissions does the app need?**
A: The app requests permission to read your Azure resources (`user_impersonation` on Azure Service Management). It does **not** make any changes to your environment — it only reads server information and generates Terraform code for you to apply yourself.

**Q: Is my data stored anywhere?**
A: No. The app does not store any server data, credentials, or generated Terraform. Everything is processed in your browser session and discarded when you close the tab.
