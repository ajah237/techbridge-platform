import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Inv = {
  id: string;
  event_id: string;
  email: string | null;
  name: string | null;
  token: string;
  created_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
};

const AdminJudgeInvitations = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [invs, setInvs] = useState<Inv[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("events").select("id,title").order("created_at", { ascending: false });
      setEvents((data ?? []) as any);
    })();
  }, []);

  const load = async () => {
    if (!eventId) return setInvs([]);
    const { data } = await supabase
      .from("judge_invitations" as any)
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setInvs((data ?? []) as unknown as Inv[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventId]);

  const create = async () => {
    if (!user || !eventId) return;
    setBusy(true);
    const { error } = await supabase.from("judge_invitations" as any).insert({
      event_id: eventId,
      email: email.trim() || null,
      name: name.trim() || null,
      created_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setEmail(""); setName("");
    toast.success("Invitation created");
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this invitation?")) return;
    const { error } = await supabase
      .from("judge_invitations" as any)
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const linkFor = (token: string) => `${window.location.origin}/judge/accept/${token}`;

  const copy = (token: string) => {
    navigator.clipboard.writeText(linkFor(token));
    toast.success("Invitation link copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Judge Invitations</h1>
        <p className="text-sm text-muted-foreground">Create tokenized invitation links to bring judges into an event.</p>
      </div>

      <Card><CardContent className="p-5 grid gap-3 md:grid-cols-[1fr,1fr,1fr,auto] items-end">
        <div className="grid gap-2">
          <Label>Event</Label>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
            <SelectContent>
              {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Judge name (optional)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div className="grid gap-2">
          <Label>Email (optional, for reference)</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
        </div>
        <Button onClick={create} disabled={!eventId || busy} className="bg-gradient-primary text-primary-foreground gap-2">
          <Plus size={14} /> Create link
        </Button>
      </CardContent></Card>

      {eventId && (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No invitations yet.</TableCell></TableRow>
              ) : invs.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <div className="font-medium">{i.name || "Unnamed judge"}</div>
                    {i.email && <div className="text-xs text-muted-foreground">{i.email}</div>}
                  </TableCell>
                  <TableCell>
                    {i.revoked_at ? <Badge variant="destructive">Revoked</Badge>
                      : i.accepted_at ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Accepted</Badge>
                      : <Badge variant="outline">Pending</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    {!i.revoked_at && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => copy(i.token)} className="gap-1">
                          <Copy size={12} /> Copy link
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => revoke(i.id)}
                          aria-label={`Revoke invitation for ${i.name || i.email || "judge"}`}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
};

export default AdminJudgeInvitations;