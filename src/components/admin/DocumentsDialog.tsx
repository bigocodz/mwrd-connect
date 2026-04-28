import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { DocumentsPanel } from "./DocumentsPanel";

interface DocumentsDialogProps {
  targetType: "order" | "quote" | "client_invoice" | "grn";
  targetId: string;
  trigger: React.ReactNode;
  title?: string;
}

/**
 * Dialog wrapper around DocumentsPanel for row-action surfaces. Used on
 * AdminClientInvoices, AdminQuoteReview, and the GRN list rows.
 */
export const DocumentsDialog = ({
  targetType,
  targetId,
  trigger,
  title,
}: DocumentsDialogProps) => {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title ?? tr("Documents")}</DialogTitle>
        </DialogHeader>
        {open && <DocumentsPanel targetType={targetType} targetId={targetId} />}
      </DialogContent>
    </Dialog>
  );
};
