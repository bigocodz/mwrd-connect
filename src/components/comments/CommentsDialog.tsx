import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { CommentsThread } from "./CommentsThread";

interface CommentsDialogProps {
  targetType: "rfq" | "quote" | "order" | "client_invoice" | "dispute";
  targetId: string;
  trigger: React.ReactNode;
  title?: string;
}

/**
 * Dialog wrapper around CommentsThread for row-action surfaces (invoice
 * lists, etc.) where there's no full detail page to host the thread inline.
 */
export const CommentsDialog = ({
  targetType,
  targetId,
  trigger,
  title,
}: CommentsDialogProps) => {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title ?? tr("Comments")}</DialogTitle>
        </DialogHeader>
        {open && <CommentsThread targetType={targetType} targetId={targetId} />}
      </DialogContent>
    </Dialog>
  );
};
