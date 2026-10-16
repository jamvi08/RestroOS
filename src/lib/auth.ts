import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { normalizeRestaurantName } from "@/lib/utils";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        type: { label: "Type", type: "text" },
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        phone: { label: "Phone", type: "text" },
        restaurantName: { label: "Restaurant", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) {
          return null;
        }

        // Restaurant name + Phone + Password Login (for Waiters and Staff).
        // Managers set staff passwords; WhatsApp OTP is only a "forgot password" backup.
        if (credentials.type === "phone-password") {
          const cleanedPhone = (credentials.phone || "").replace(/\D/g, "").slice(-10);

          if (cleanedPhone.length !== 10) {
            throw new Error("Please enter a valid 10-digit mobile number.");
          }

          const wrongDetails = "Restaurant name, mobile number or password is wrong. Please check and try again.";

          const staffUser = await prisma.users.findFirst({
            where: {
              phone: cleanedPhone,
              isActive: true,
            },
            include: { restaurants: { select: { name: true } } },
          });

          const typedRestaurant = normalizeRestaurantName(credentials.restaurantName || "");
          if (
            !staffUser ||
            !staffUser.restaurants ||
            !typedRestaurant ||
            normalizeRestaurantName(staffUser.restaurants.name) !== typedRestaurant
          ) {
            throw new Error(wrongDetails);
          }

          if (!staffUser.password) {
            throw new Error("Your password isn't set yet. Ask your manager to set it in Staff, or tap Forgot password.");
          }

          const isValidPassword = await bcrypt.compare(credentials.password || "", staffUser.password);
          if (!isValidPassword) {
            throw new Error(wrongDetails);
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
