import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { readStaffTicket } from "@/lib/signed-token";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        type: { label: "Type", type: "text" },
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        ticket: { label: "Ticket", type: "text" },
        userId: { label: "User", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) {
          return null;
        }

        // Waiters and staff: mobile number + WhatsApp code, no password.
        // /api/auth/staff/verify checks the code and hands back a ticket; the
        // waiter then picks which restaurant (userId) to log in to.
        if (credentials.type === "staff-ticket") {
          const phone = readStaffTicket(credentials.ticket);
          if (!phone) {
            throw new Error("Your code has expired. Please ask for a new code.");
          }
          if (!credentials.userId) {
            throw new Error("Please choose your restaurant.");
          }

          const staffUser = await prisma.users.findFirst({
            where: { id: credentials.userId, phone, isActive: true, restaurantId: { not: null } },
          });
          if (!staffUser) {
            throw new Error("You are not on this restaurant's staff list any more.");
          }

          return {
            id: staffUser.id,
            name: staffUser.name,
            email: staffUser.email,
            phone: staffUser.phone,
            role: staffUser.role,
            restaurantId: staffUser.restaurantId,
          };
        }

        // Traditional Email + Password Login (for Managers and Admins)
        if (credentials.email && credentials.password) {
          const user = await prisma.users.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
          });

          if (!user || !user.password) {
            throw new Error("Invalid email or password");
          }

          const isValidPassword = await bcrypt.compare(credentials.password, user.password);

          if (!isValidPassword) {
            throw new Error("Invalid email or password");
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            restaurantId: user.restaurantId,
          };
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.restaurantId = token.restaurantId as string | null;
        session.user.phone = token.phone as string | null;
        if (token.name) session.user.name = token.name as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.restaurantId = user.restaurantId;
        token.phone = user.phone;
        token.name = user.name;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
};
