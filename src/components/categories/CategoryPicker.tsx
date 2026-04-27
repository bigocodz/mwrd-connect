import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";

type Node = {
  _id: Id<"categories">;
  parent_id?: Id<"categories">;
  level: number;
  name_ar: string;
  name_en: string;
  default_uom?: string;
  children: Node[];
};

interface CategoryPickerProps {
  categoryId?: Id<"categories">;
  subcategoryId?: Id<"categories">;
  onChange: (next: {
    category_id?: Id<"categories">;
    subcategory_id?: Id<"categories">;
    /** English name — safe to mirror into legacy string columns */
    category_name_en?: string;
    /** Arabic name — for components that want a denormalized AR mirror */
    category_name_ar?: string;
    subcategory_name_en?: string;
    subcategory_name_ar?: string;
    default_uom?: string;
  }) => void;
  required?: boolean;
}

const NONE = "__none__";

/**
 * Cascading category picker (top-level → subcategory).
 * Surfaces the master category tree (PRD §5.4). Returns both the FK ids and
 * denormalized bilingual names so callers that still need the legacy string
 * `category` field can fill it without an extra round-trip.
 */
export const CategoryPicker = ({
  categoryId,
  subcategoryId,
  onChange,
  required,
}: CategoryPickerProps) => {
  const { tr, lang } = useLanguage();
  const tree = useQuery(api.categories.tree, {}) as Node[] | undefined;

  const flat = useMemo(() => {
    const m = new Map<string, Node>();
    const walk = (nodes: Node[]) => {
      for (const n of nodes) {
        m.set(n._id, n);
        walk(n.children);
      }
    };
    walk(tree ?? []);
    return m;
  }, [tree]);

  const topLevel = tree ?? [];
  const selectedTop = categoryId ? flat.get(categoryId) : undefined;
  const subOptions = selectedTop?.children ?? [];

  const renderName = (n: Node) => (lang === "ar" ? n.name_ar : n.name_en);

  const handleTopChange = (value: string) => {
    if (value === NONE) {
      onChange({});
      return;
    }
    const node = flat.get(value as Id<"categories">);
    if (!node) return;
    onChange({
      category_id: node._id,
      category_name_en: node.name_en,
      category_name_ar: node.name_ar,
      default_uom: node.default_uom,
    });
  };

  const handleSubChange = (value: string) => {
    if (!selectedTop) return;
    if (value === NONE) {
      onChange({
        category_id: selectedTop._id,
        category_name_en: selectedTop.name_en,
        category_name_ar: selectedTop.name_ar,
        default_uom: selectedTop.default_uom,
      });
      return;
    }
    const node = flat.get(value as Id<"categories">);
    if (!node) return;
    onChange({
      category_id: selectedTop._id,
      subcategory_id: node._id,
      category_name_en: selectedTop.name_en,
      category_name_ar: selectedTop.name_ar,
      subcategory_name_en: node.name_en,
      subcategory_name_ar: node.name_ar,
      default_uom: node.default_uom ?? selectedTop.default_uom,
    });
  };

  if (tree === undefined) {
    return <p className="text-sm text-muted-foreground">{tr("Loading…")}</p>;
  }

  if (topLevel.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {tr("No categories yet. Ask an admin to seed the master tree.")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label>
          {tr("Category")} {required && "*"}
        </Label>
        <Select value={categoryId ?? NONE} onValueChange={handleTopChange}>
          <SelectTrigger>
            <SelectValue placeholder={tr("Select a category")} />
          </SelectTrigger>
          <SelectContent>
            {!required && <SelectItem value={NONE}>{tr("(None)")}</SelectItem>}
            {topLevel.map((n) => (
              <SelectItem key={n._id} value={n._id}>
                {renderName(n)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{tr("Subcategory")}</Label>
        <Select
          value={subcategoryId ?? NONE}
          onValueChange={handleSubChange}
          disabled={!selectedTop || subOptions.length === 0}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                !selectedTop
                  ? tr("Pick a category first")
                  : subOptions.length === 0
                    ? tr("No subcategories")
                    : tr("Select a subcategory")
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{tr("(None)")}</SelectItem>
            {subOptions.map((n) => (
              <SelectItem key={n._id} value={n._id}>
                {renderName(n)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
