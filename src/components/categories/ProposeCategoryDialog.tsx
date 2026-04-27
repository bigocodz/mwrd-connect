import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import type { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus } from "lucide-react";

type Node = {
  _id: Id<"categories">;
  parent_id?: Id<"categories">;
  level: number;
  name_ar: string;
  name_en: string;
  children: Node[];
};

interface ProposeCategoryDialogProps {
  /**
   * Optional pre-selection for the parent. Suppliers can change it in the dialog.
   * Pass `null` to default to "top-level (no parent)".
   */
  defaultParentId?: Id<"categories"> | null;
  trigger?: React.ReactNode;
}

const NONE = "__none__";

/**
 * Inline supplier flow: propose a new category to admins (PRD §5.4.2).
 * The proposal lands in /admin/categories → Proposals tab.
 */
export const ProposeCategoryDialog = ({
  defaultParentId,
  trigger,
}: ProposeCategoryDialogProps) => {
  const { tr, lang } = useLanguage();
  const tree = useQuery(api.categories.tree, {}) as Node[] | undefined;
  const propose = useMutation(api.categories.propose);

  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState<Id<"categories"> | undefined>(
    defaultParentId ?? undefined,
  );
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [defaultUom, setDefaultUom] = useState("");
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);

  // Flat list of valid parent options (level < 3 means a child can still be added)
  const parentOptions = useMemo(() => {
    const out: { id: Id<"categories">; label: string }[] = [];
    const walk = (nodes: Node[], prefix: string[]) => {
      for (const n of nodes) {
        const path = [...prefix, lang === "ar" ? n.name_ar : n.name_en];
        if (n.level < 3) {
          out.push({ id: n._id, label: path.join(" / ") });
        }
        walk(n.children, path);
      }
    };
    walk(tree ?? [], []);
    return out;
  }, [tree, lang]);

  const reset = () => {
    setParentId(defaultParentId ?? undefined);
    setNameAr("");
    setNameEn("");
    setDescAr("");
    setDescEn("");
    setDefaultUom("");
    setJustification("");
  };

  const handleSubmit = async () => {
    if (!nameAr.trim() || !nameEn.trim()) {
      toast.error(tr("Both Arabic and English names are required"));
      return;
    }
    if (!justification.trim()) {
      toast.error(tr("Please tell admin why this category is needed"));
      return;
    }
    setBusy(true);
    try {
      await propose({
        parent_id: parentId,
        name_ar: nameAr.trim(),
        name_en: nameEn.trim(),
        description_ar: descAr.trim() || undefined,
        description_en: descEn.trim() || undefined,
        default_uom: defaultUom.trim() || undefined,
        justification: justification.trim(),
      });
      toast.success(tr("Category proposal submitted for review"));
      reset();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {tr("Propose new category")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tr("Propose new category")}</DialogTitle>
          <DialogDescription>
            {tr("Admin will review your suggestion. You'll see the result on your products page.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{tr("Parent")}</Label>
            <Select
              value={parentId ?? NONE}
              onValueChange={(v) =>
                setParentId(v === NONE ? undefined : (v as Id<"categories">))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{tr("(Top-level — no parent)")}</SelectItem>
                {parentOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{tr("Name (Arabic)")} *</Label>
              <Input
                dir="rtl"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Name (English)")} *</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{tr("Description (Arabic)")}</Label>
              <Textarea
                dir="rtl"
                rows={2}
                value={descAr}
                onChange={(e) => setDescAr(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Description (English)")}</Label>
              <Textarea
                rows={2}
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Default UoM")}</Label>
            <Input
              placeholder={tr("e.g. PCS, KG, BOX")}
              value={defaultUom}
              onChange={(e) => setDefaultUom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Why is this category needed?")} *</Label>
            <Textarea
              rows={3}
              placeholder={tr("Example items, why existing categories don't fit, expected demand…")}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{tr("Cancel")}</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {tr("Submit proposal")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
