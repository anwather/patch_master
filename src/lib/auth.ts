import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { ConfidentialClientApplication } from "@azure/msal-node";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}

const ARM_SCOPE = "https://management.azure.com/user_impersonation";

async function refreshAccessToken(token: import("next-auth/jwt").JWT) {
  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    },
  });

  try {
    const result = await cca.acquireTokenByRefreshToken({
      refreshToken: token.refreshToken!,
      scopes: [ARM_SCOPE],
    });

    return {
      ...token,
      accessToken: result?.accessToken,
      accessTokenExpires: result?.expiresOn
        ? result.expiresOn.getTime()
        : Date.now() + 3600 * 1000,
      refreshToken: result?.account ? token.refreshToken : token.refreshToken,
    };
  } catch (error) {
    console.error("Failed to refresh access token:", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope: `openid profile email ${ARM_SCOPE}`,
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // On initial sign-in, persist the tokens
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
        };
      }

      // Return token if it hasn't expired
      if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 5 * 60 * 1000
      ) {
        return token;
      }

      // Token expired — refresh it
      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
});
