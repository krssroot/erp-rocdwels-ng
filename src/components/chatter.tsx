import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Reply, Trash2, AtSign } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";

type Msg = {
  id: string;
  parent_id: string | null;
  body: string;
  author_id: string | null;
  author_email: string | null;
  author_name: string | null;
  mentions: string[] | null;
  created_at: string;
};

export function Chatter({
  entityType,
  entityId,
  title = "Discussion",
}: {
  entityType: string;
  entityId: string;
  title?: string;
}) {
  const qc = useQueryClient();
  const { user } = useSession();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const key = ["discussions", entityType, entityId];

  const { data: staff = [] } = useQuery({
    queryKey: ["profiles", "mentionable"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,email,full_name").is("deleted_at", null)).data ?? [],
  });

  const { data: messages = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      ((
        await supabase
          .from("discussions")
          .select("*")
          .eq("entity_type", entityType)
          .eq("entity_id", entityId)
          .is("deleted_at", null)
          .order("created_at")
      ).data ?? []) as unknown as Msg[],
  });

  useEffect(() => {
    const channel = supabase
      .channel(`chatter-${entityType}-${entityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "discussions" }, () => {
        qc.invalidateQueries({ queryKey: key });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const threads = useMemo(() => {
    const roots = messages.filter((m) => !m.parent_id);
    return roots.map((r) => ({ root: r, replies: messages.filter((m) => m.parent_id === r.id) }));
  }, [messages]);

  function detectMentions(text: string): string[] {
    const ids: string[] = [];
    for (const p of staff as any[]) {
      const handle = String(p.full_name ?? p.email ?? "").split("@")[0];
      if (!handle) continue;
      const token = "@" + handle.replace(/\s+/g, "");
      if (text.toLowerCase().includes(token.toLowerCase())) ids.push(p.id);
    }
    return Array.from(new Set(ids));
  }

  async function post() {
    if (!body.trim()) return;
    if (!user) return toast.error("You must be signed in");
    const { error } = await supabase.from("discussions").insert({
      entity_type: entityType,
      entity_id: entityId,
      parent_id: replyTo?.id ?? null,
      body: body.trim(),
      mentions: detectMentions(body),
      author_id: user.id,
      author_email: user.email ?? null,
      author_name: (user.user_metadata as any)?.full_name ?? user.email ?? null,
    });
    if (error) return toast.error(error.message);
    setBody("");
    setReplyTo(null);
    qc.invalidateQueries({ queryKey: key });
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("discussions")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="border rounded-lg bg-card">
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="secondary">{messages.length} message{messages.length === 1 ? "" : "s"}</Badge>
      </div>

      <div className="divide-y max-h-[420px] overflow-y-auto">
        {threads.length === 0 && (
          <p className="text-sm text-muted-foreground p-4">No messages yet. Start the conversation below.</p>
        )}
        {threads.map(({ root, replies }) => (
          <div key={root.id} className="p-3 space-y-2">
            <Message m={root} onReply={() => setReplyTo(root)} onDelete={() => remove(root.id)} canDelete={root.author_id === user?.id} />
            {replies.map((r) => (
              <div key={r.id} className="ml-6 border-l pl-3">
                <Message m={r} onReply={() => setReplyTo(root)} onDelete={() => remove(r.id)} canDelete={r.author_id === user?.id} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="p-3 border-t space-y-2">
        {replyTo && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            Replying to {replyTo.author_name ?? replyTo.author_email}
            <button className="underline" onClick={() => setReplyTo(null)}>cancel</button>
          </div>
        )}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message… use @name to mention a colleague"
          rows={3}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <AtSign className="h-3 w-3" /> Mention: {(staff as any[]).slice(0, 4).map((p) => "@" + String(p.full_name ?? p.email ?? "").split("@")[0].replace(/\s+/g, "")).join(", ") || "—"}
          </span>
          <Button size="sm" className="ml-auto" onClick={post}><Send className="h-4 w-4 mr-1" /> Post</Button>
        </div>
      </div>
    </div>
  );
}

function Message({ m, onReply, onDelete, canDelete }: { m: Msg; onReply: () => void; onDelete: () => void; canDelete: boolean }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{m.author_name ?? m.author_email ?? "Unknown"}</span>
        <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("en-NG")}</span>
        {(m.mentions?.length ?? 0) > 0 && <Badge variant="secondary" className="text-[10px]">{m.mentions!.length} mentioned</Badge>}
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Reply" onClick={onReply}><Reply className="h-3.5 w-3.5" /></Button>
          {canDelete && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap mt-1">{m.body}</p>
    </div>
  );
}
