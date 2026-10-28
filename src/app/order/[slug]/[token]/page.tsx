import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { QrCode } from "lucide-react";
import { MenuDisplay } from "@/components/customer/MenuDisplay";

interface OrderPageProps {
  params: Promise<{
    slug: string;
    token: string;
  }>;
}

export default async function CustomerOrderPage({ params }: OrderPageProps) {
  // In Next.js 15, dynamic route params must be awaited
  const { slug, token } = await params;

  // Validate the restaurant slug and table token securely on the server
  // Never trust client IDs - always derive from the unguessable QR token
  const table = await prisma.tables.findFirst({
    where: {
      qrCodeToken: token,
      isActive: true,
      restaurants: {
        slug: slug,
        isActive: true,
        status: "APPROVED",
      }
    },
    include: {
      restaurants: true,
    }
  });

  if (!table) {
    // If the token doesn't match the restaurant slug, or if the token is invalid,
    // we return a 404 or an error page. This ensures strict isolation.
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mb-5 inline-flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <QrCode className="size-8" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">This QR code doesn&apos;t work</h1>
        <p className="max-w-sm text-base text-muted-foreground">
          The restaurant may have printed a new one. Please scan the QR code on your table again, or ask the staff for help.
        </p>
      </div>
    );
  }

  const restaurant = table.restaurants;

  // Fetch active categories and menu items for this restaurant
  const categories = await prisma.categories.findMany({
    where: {
      restaurantId: restaurant.id,
      isActive: true,
    },
    orderBy: {
      displayOrder: 'asc'
    }
  });

  const menuItems = await prisma.menu_items.findMany({
    where: {
      restaurantId: restaurant.id,
      isActive: true,
    },
    orderBy: {
      displayOrder: 'asc'
    }
  });

  // Render the interactive client component
  return (
    <MenuDisplay 
      restaurant={{ name: restaurant.name, logo: restaurant.logo, currency: restaurant.currency, customerOtp: restaurant.customerOtp }}
      slug={slug}
      token={token}
      tableNumber={table.tableNumber}
      categories={categories}
      menuItems={menuItems}
    />
  );
}
