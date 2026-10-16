"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, RefreshCw } from "lucide-react";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  tableNumber: string;
  qrCodeUrl: string;
  onRegenerate: () => void;
}

export function QRCodeModal({ isOpen, onClose, tableId, tableNumber, qrCodeUrl, onRegenerate }: QRCodeModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // We need to store local URL to instantly update it when regeneration finishes
  const [localUrl, setLocalUrl] = useState(qrCodeUrl);

  useEffect(() => {
    setLocalUrl(qrCodeUrl);
  }, [qrCodeUrl]);

  const handleDownload = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `Table-${tableNumber}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector("canvas");
    if (!canvas) return;

    const imgUrl = canvas.toDataURL("image/png");
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code - Table ${tableNumber}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; margin: 0; }
            img { width: 300px; height: 300px; }
            h1 { font-size: 2rem; margin-top: 1rem; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <img src="${imgUrl}" />
          <h1>Table ${tableNumber}</h1>
          <p>Scan to order</p>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleRegenerate = async () => {
    if (!window.confirm("Make a new QR code? The old sticker on this table will stop working.")) return;
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/regenerate-qr`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        // data.qrCodeToken is the new token
        // Let's assume the caller will trigger onRegenerate() which fetches table data again
        // but we can locally patch it quickly if the URL structure is known, but it's safer to just call onRegenerate and close/refresh.
        onRegenerate();
        onClose(); 
      }
    } catch (err) {
      console.error("Failed to regenerate QR", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Table {tableNumber} QR code</DialogTitle>
          <DialogDescription>
            Print this and stick it on the table. Customers scan it to see your menu and order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center rounded-2xl border border-border bg-white p-5" ref={qrRef}>
          <QRCodeCanvas 
            value={localUrl} 
            size={200}
            level="H"
            includeMargin={true}
          />
          <p className="mt-3 text-xl font-bold text-foreground">Table {tableNumber}</p>
          <p className="text-[15px] text-muted-foreground">Scan to order · ऑर्डर के लिए स्कैन करें</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={handlePrint}>
            <Printer />
            Print
          </Button>
          <Button type="button" onClick={handleDownload}>
            <Download />
            Download
          </Button>
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-sm text-muted-foreground">
            Lost or damaged sticker? Make a new code. The old one will stop working.
          </p>
          <Button type="button" variant="destructive" size="sm" onClick={handleRegenerate} disabled={isRegenerating} className="w-full">
            <RefreshCw className={isRegenerating ? "animate-spin" : ""} />
            {isRegenerating ? "Making new code..." : "Make a new QR code"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
