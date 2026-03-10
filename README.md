# Patch Master

Azure Update Manager Scheduler & Terraform Generator built with Next.js.

## Features

- **Microsoft Entra ID authentication** via next-auth
- **Azure server enumeration** — lists VMs and Arc machines across all subscriptions
- **Maintenance configuration** — schedule, patch classifications, reboot settings
- **Terraform generation** — produces ready-to-deploy HCL code

## Getting Started

1. Copy `.env.example` to `.env.local` and fill in your Entra ID app registration values
2. Run `npm install`
3. Run `npm run dev`

## Azure App Registration

Create an Entra ID app registration with:
- **Redirect URI:** `http://localhost:3000/api/auth/callback/microsoft-entra-id` (dev), plus your production URL
- **API permissions:** `Microsoft Graph / User.Read`, `Azure Service Management / user_impersonation`
- **Client secret:** Generate one and add to `.env.local`

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [next-auth v5](https://authjs.dev/) with Microsoft Entra ID provider
- [Tailwind CSS v4](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)

