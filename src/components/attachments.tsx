import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { logActivity } from "@/lib/activity";

const BUCKET = "attachments";

function fmtSize(b?: number | null) {
  const n = Number(b ?? 0);
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Attachments({
  entityType,
  entityId,
  recordLabel,
}: {
  entityType: string;
  entityId: string;
  recordLabel?: string;
}) {
  const qc = useQueryClient();
  const { user } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const key = ["attachments", entityType, entityId];

  const { data: files = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await supabase
          .from("attachments")
          .select("*")
          .eq("entity_type", entityType)
          .eq("entity_id", entityId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function upload(file: File) {
    if (!user) return toast.error("You must be signed in");
    setBusy(true);
    try {
      const prior = (files as any[]).filter((f) => f.name === file.name);
      const version = prior.length ? Math.max(...prior.map((f) => Number(f.version ?? 1))) + 1 : 1;
      const path = `${entityType}/${entityId}/${Date.now()}-v${version}-${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("attachments").insert({
        entity_type: entityType,
        entity_id: entityId,
        name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        version,
        notes: notes || null,
        uploaded_by: user.id,
        uploaded_by_email: user.email ?? null,
      });
      if (error) throw error;
      await logActivity(`uploaded attachment v${version} — ${file.name}`, entityType, entityId, recordLabel);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success(`Uploaded ${file.name} (v${version})`);
      qc.invalidateQueries({ queryKey: key });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function download(row: any) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Could not create download link");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(row: any) {
    const { error } = await supabase
      .from("attachments")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Attachment removed");
    qc.invalidateQueries({ queryKey: key });
  }

  const latestByName = new Map<string, number>();
  for (const f of files as any[]) {
    latestByName.set(f.name, Math.max(latestByName.get(f.name) ?? 0, Number(f.version ?? 1)));
  }

  return (
    <div className="border rounded-lg bg-card">
      <div className="p-3 border-b flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium inline-flex items-center gap-2"><Paperclip className="h-4 w-4" /> Attachments</span>
        <Input
          className="h-9 w-56 ml-auto"
          placeholder="Version note (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
        />
        <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> {busy ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4">No files attached yet. Re-uploading a file with the same name creates a new version.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded by</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(files as any[]).map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell>
                    <Badge variant={Number(f.version) === latestByName.get(f.name) ? "default" : "secondary"}>
                      v{f.version}{Number(f.version) === latestByName.get(f.name) ? " · latest" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{fmtSize(f.size_bytes)}</TableCell>
                  <TableCell className="text-sm">{f.uploaded_by_email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{new Date(f.created_at).toLocaleString("en-NG")}</TableCell>
                  <TableCell className="text-sm">{f.notes ?? "—"}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" title="Download" onClick={() => download(f)}><Download className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" title="Remove" onClick={() => remove(f)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
