import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      restaurantId?: string | null;
      phone?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: string;
    restaurantId?: string | null;
    phone?: string | null;
    name?: string | null;
    email?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    restaurantId?: string | null;
    phone?: string | null;
  }
}
