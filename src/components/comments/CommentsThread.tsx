import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import type { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { DualDate } from "@/components/shared/DualDate";

type TargetType = "rfq" | "quote" | "order" | "client_invoice" | "dispute";
type Visibility = "INTERNAL" | "CLIENT_THREAD" | "SUPPLIER_THREAD";

interface CommentsThreadProps {
  targetType: TargetType;
  targetId: string;
  /**
   * Optional default visibility for the composer. Server-enforced; the UI
   * just nudges toward the right thread for the calling role.
   */
  defaultVisibility?: Visibility;
}

const VISIBILITY_LABEL: Record<Visibility, string> = {
  INTERNAL: "Internal (admin)",
  CLIENT_THREAD: "With client",
  SUPPLIER_THREAD: "With supplier",
};

const VISIBILITY_TONE: Record<Visibility, string> = {
  INTERNAL: "bg-amber-100 text-amber-800",
  CLIENT_THREAD: "bg-blue-100 text-blue-800",
  SUPPLIER_THREAD: "bg-violet-100 text-violet-800",
};

const MENTION_RE = /@([A-Z]{1,4}-?\d{2,8})/gi;

const extractMentionTokens = (body: string): string[] => {
  const out = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) {
    out.add(m[1].toUpperCase());
  }
  return [...out];
};

/**
 * Comments thread component for any procurement entity (PRD §10.4).
 *
 * Visibility model preserves anonymity (PRD §4.6):
 *   - admin sees all threads; suppliers see only SUPPLIER_THREAD; clients
 *     see only CLIENT_THREAD.
 * @mentions: type @PUBLIC_ID anywhere in the body. Tokens that resolve
 * to a real profile get the user notified on submit; unresolved tokens
 * are silently dropped.
 */
export const CommentsThread = ({
  targetType,
  targetId,
  defaultVisibility,
}: CommentsThreadProps) => {
  const { tr, lang } = useLanguage();
  const { profile } = useAuth();

  const comments = useQuery(api.comments.listForTarget, {
    target_type: targetType,
    target_id: targetId,
  }) as any[] | undefined;

  const post = useMutation(api.comments.post);

  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(
    defaultVisibility ??
      (profile?.role === "ADMIN"
        ? "INTERNAL"
        : profile?.role === "SUPPLIER"
          ? "SUPPLIER_THREAD"
          : "CLIENT_THREAD"),
  );
  const [busy, setBusy] = useState(false);

  const mentionTokens = useMemo(() => extractMentionTokens(body), [body]);
  const resolved = useQuery(
    api.comments.resolveMentions,
    mentionTokens.length > 0 ? { public_ids: mentionTokens } : "skip",
  ) as Array<{ public_id: string; profile_id: Id<"profiles"> }> | undefined;

  // Auditors (PRD §13.4) are read-only — they can see every thread but
  // cannot post. The server rejects them anyway; we just hide the composer.
  const canPost = profile?.role !== "AUDITOR";

  const visibilityOptions: Visibility[] =
    profile?.role === "ADMIN"
      ? ["INTERNAL", "CLIENT_THREAD", "SUPPLIER_THREAD"]
      : profile?.role === "CLIENT"
        ? ["CLIENT_THREAD"]
        : ["SUPPLIER_THREAD"];

  const handleSubmit = async () => {
    if (!body.trim()) {
      toast.error(tr("Comment body is required"));
      return;
    }
    setBusy(true);
    try {
      const mentioned = resolved?.map((r) => r.profile_id);
      await post({
        target_type: targetType,
        target_id: targetId,
        visibility,
        body: body.trim(),
        mentioned_profile_ids: mentioned && mentioned.length > 0 ? mentioned : undefined,
      });
      setBody("");
      toast.success(tr("Comment posted"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  // Highlight @-tokens with green if resolved, red if not.
  const highlightBody = (raw: string) => {
    const resolvedSet = new Set((resolved ?? []).map((r) => r.public_id.toUpperCase()));
    const parts: Array<{ text: string; resolved?: boolean }> = [];
    let lastIndex = 0;
    for (const m of raw.matchAll(MENTION_RE)) {
      const start = m.index ?? 0;
      if (start > lastIndex) parts.push({ text: raw.slice(lastIndex, start) });
      const token = m[1].toUpperCase();
      parts.push({ text: m[0], resolved: resolvedSet.has(token) });
      lastIndex = start + m[0].length;
    }
    if (lastIndex < raw.length) parts.push({ text: raw.slice(lastIndex) });
    return parts;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("Comments")}</CardTitle>
        <CardDescription>
          {tr("Internal notes and role-scoped threads. Use @PUBLIC_ID to mention someone.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments === undefined ? (
          <p className="text-sm text-muted-foreground">{tr("Loading…")}</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {tr("No comments yet. Start the conversation below.")}
          </p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c: any) => (
              <li key={c._id} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {c.author_role}
                  </Badge>
                  <span className="text-sm font-medium font-mono">
                    {c.author_public_id ?? "—"}
                  </span>
                  {c.author_company_name && (
                    <span className="text-xs text-muted-foreground">
                      {c.author_company_name}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={`ms-auto text-[10px] ${VISIBILITY_TONE[c.visibility as Visibility] ?? ""}`}
                  >
                    {tr(VISIBILITY_LABEL[c.visibility as Visibility] ?? c.visibility)}
                  </Badge>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">
                  {highlightBody(c.body).map((part, i) =>
                    part.resolved !== undefined ? (
                      <span
                        key={i}
                        className={
                          part.resolved
                            ? "rounded bg-blue-100 px-1 text-blue-800"
                            : "text-muted-foreground"
                        }
                      >
                        {part.text}
                      </span>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <DualDate value={c._creationTime} withTime />
                </p>
              </li>
            ))}
          </ul>
        )}

        {canPost && (
        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {tr("Add a comment")}
            </Label>
            {visibilityOptions.length > 1 && (
              <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibilityOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {tr(VISIBILITY_LABEL[v])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={tr("Type your comment. Use @PUBLIC_ID to mention.")}
          />
          {mentionTokens.length > 0 && resolved !== undefined && (
            <div className="flex flex-wrap gap-1.5">
              {mentionTokens.map((tok) => {
                const ok = resolved.some((r) => r.public_id.toUpperCase() === tok);
                return (
                  <Badge
                    key={tok}
                    variant="outline"
                    className={ok ? "bg-blue-100 text-blue-800" : ""}
                    title={ok ? tr("Will be notified") : tr("Unknown user — won't be notified")}
                  >
                    @{tok}
                    {!ok && (
                      <span className="ms-1 text-muted-foreground">?</span>
                    )}
                  </Badge>
                );
              })}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={busy || !body.trim()} size="sm">
              {tr("Post comment")}
            </Button>
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
};
