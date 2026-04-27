import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import type { Id } from "@cvx/dataModel";
import { useLanguage } from "@/contexts/LanguageContext";

type Node = {
  _id: Id<"categories">;
  parent_id?: Id<"categories">;
  name_ar: string;
  name_en: string;
  children: Node[];
};

/**
 * Hook for components that need to display localized category names from
 * a `category_id` foreign key. Falls back to the provided legacy string
 * (typically the product's `category` column) when no FK is set or the
 * tree hasn't loaded yet.
 *
 * Usage:
 *   const { localize } = useCategoryNames();
 *   const display = localize(p.category_id, p.category);
 */
export function useCategoryNames() {
  const { lang } = useLanguage();
  const tree = useQuery(api.categories.tree, {}) as Node[] | undefined;

  const byId = useMemo(() => {
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

  const localize = (
    id: Id<"categories"> | undefined | null,
    fallback?: string,
  ) => {
    if (id) {
      const node = byId.get(id);
      if (node) return lang === "ar" ? node.name_ar : node.name_en;
    }
    return fallback ?? "";
  };

  return { localize, ready: tree !== undefined, byId };
}
