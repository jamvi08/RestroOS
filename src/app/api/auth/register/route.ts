import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { password, restaurantName, ownerName, phone, address } = body;
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";

    if (!email || !password || !restaurantName || !ownerName || !phone || !address) {
      return NextResponse.json({ message: "Please fill in all the fields." }, { status: 400 });
    }

    if (String(password).length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ message: "An account with this email already exists. Try logging in." }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const slug = restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    // Create restaurant and user atomically. The restaurant starts as PENDING
    // (schema default) until the super admin approves it at /admin.
    const restaurant = await prisma.restaurants.create({
      data: {
        name: restaurantName,
        slug,
        phone,
        address,
        users: {
          create: {
            name: ownerName,
            email,
            password: hashedPassword,
            role: "ADMIN",
          }
        }
      },
      include: {
        users: true
      }
    });

    const user = restaurant.users[0];

    return NextResponse.json(
      { message: "Account created successfully", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
