"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, QrCode, Pencil, Trash2, Users } from "lucide-react";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard/PageHeader";
import { cn } from "@/lib/utils";
import { TableForm } from "@/components/tables/TableForm";
import { QRCodeModal } from "@/components/tables/QRCodeModal";
import { useSession } from "next-auth/react";

export default function TablesPage() {
  const { data: session } = useSession();
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [selectedQRTable, setSelectedQRTable] = useState<any | null>(null);

  const fetchTables = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/tables");
      if (res.ok) setTables(await res.json());
    } catch (error) {
      console.error("Failed to load tables", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this table? Its QR code will stop working.")) return;
    try {
      const res = await fetch(`/api/tables/${id}`, { method: "DELETE" });
      if (res.ok) fetchTables();
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const getQRUrl = (token: string, slug?: string) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/order/${slug || 'unknown'}/${token}`;
  };

  const activeTables = tables.filter(t => t.status === "OCCUPIED").length;

  const openNew = () => {
    setEditingTable(null);
    setIsTableModalOpen(true);
  };

  const statusStyle: Record<string, string> = {
    AVAILABLE: "bg-success-soft text-success",
    OCCUPIED: "bg-primary-soft text-primary-strong",
    RESERVED: "bg-[#e7f5ff] text-[#1971c2]",
  };
  const statusLabel: Record<string, string> = { AVAILABLE: "Free", OCCUPIED: "Occupied", RESERVED: "Reserved" };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title="Tables & QR codes"
        description="Add each table, then print its QR code and stick it on the table."
        actions={
          <Button onClick={openNew}>
            <PlusCircle />
            Add table
          </Button>
        }
      />

      {tables.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:max-w-md md:gap-4">
          <StatCard label="Total tables" value={tables.length} />
          <StatCard label="Occupied now" value={activeTables} />
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-base text-muted-foreground">Loading tables...</div>
      ) : tables.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="No tables yet"
          description="Add your first table to get its QR code. Customers scan it to see your menu and order."
          action={
            <Button onClick={openNew}>
              <PlusCircle />
              Add first table
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
          {tables.map((table) => (
            <article key={table.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-foreground">Table {table.tableNumber}</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-muted-foreground">
                    <Users className="size-4" />
                    {table.capacity} seats{table.label ? ` · ${table.label}` : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold", statusStyle[table.status] ?? "bg-muted text-muted-foreground")}>
                  {statusLabel[table.status] ?? table.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => { setSelectedQRTable(table); setIsQRModalOpen(true); }}
                  className="flex-1"
                >
                  <QrCode />
                  Show QR code
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Edit table ${table.tableNumber}`} onClick={() => { setEditingTable(table); setIsTableModalOpen(true); }}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete table ${table.tableNumber}`} onClick={() => handleDelete(table.id)} className="text-destructive hover:bg-destructive-soft">
                  <Trash2 />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {isTableModalOpen && (
        <TableForm 
          isOpen={isTableModalOpen}
          onClose={() => setIsTableModalOpen(false)}
          onSuccess={fetchTables}
          initialData={editingTable}
        />
      )}

      {isQRModalOpen && selectedQRTable && session?.user && (
        <QRCodeModal
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          tableId={selectedQRTable.id}
          tableNumber={selectedQRTable.tableNumber}
          qrCodeUrl={getQRUrl(selectedQRTable.qrCodeToken, selectedQRTable.restaurants?.slug)}
          onRegenerate={fetchTables}
        />
      )}
    </div>
  );
}
