import { CloudOff, CloudUpload, Check, AlertTriangle, RefreshCw, RotateCcw, Trash2, WifiOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useSyncState } from "@/lib/offline/react";
import { syncEngine } from "@/lib/offline/sync";
import type { OutboxEntry } from "@/lib/offline/local-db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Header control: connection state, number of changes waiting to sync, and the list of queued changes. */
export function SyncStatus() {
  const st = useSyncState();
  const { user } = useAuth();
  const mine = st.entries.filter((e) => e.userId === st.userId);
  const others = st.entries.length - mine.length;
  const failed = mine.filter((e) => e.status === "failed");
  const connected = st.online && st.reachable;

  const tone = failed.length ? "failed" : !connected ? "offline" : mine.length || st.syncing ? "pending" : "synced";
  const label = failed.length ? "Sync problem"
    : !st.online ? "Offline" : !st.reachable ? "Can't reach server"
    : st.syncing ? "Syncing…" : mine.length ? `${mine.length} waiting` : "All saved";
  const Icon = tone === "failed" ? AlertTriangle : tone === "offline" ? CloudOff : tone === "pending" ? CloudUpload : Check;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button data-tour="sync-status" aria-label={`Sync status: ${label}`}
          className={cn("flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors",
            tone === "synced" && "border-success/30 bg-success/10 text-success",
            tone === "pending" && "border-primary/30 bg-primary/10 text-primary",
            tone === "offline" && "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
            tone === "failed" && "border-destructive/30 bg-destructive/10 text-destructive")}>
          <Icon className={cn("h-4 w-4", st.syncing && "animate-pulse")} />
          <span className="hidden sm:inline">{label}</span>
          {mine.length > 0 && <span className="rounded-full bg-background/70 px-1.5 tabular-nums sm:hidden">{mine.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="border-b p-4">
          <p className="text-sm font-semibold">{connected ? "Connected" : "Working offline"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {connected
              ? `Last synced ${ago(st.lastSyncedAt)}. Changes save on this device first, then sync automatically.`
              : "Everything you change is saved on this device and will sync when the connection returns."}
          </p>
          {st.lastError && connected && <p className="mt-2 text-xs text-destructive">{st.lastError}</p>}
          <Button size="sm" variant="outline" className="mt-3 w-full" disabled={!st.online || st.syncing}
            onClick={() => syncEngine.syncNow({ pull: true }).then(() => {
              const s = syncEngine.getSnapshot();
              if (!s.reachable) toast.error("Couldn't reach the school server. Your changes are still saved here.");
            })}>
            <RefreshCw className={cn(st.syncing && "animate-spin")} /> {st.syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {mine.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">No changes waiting to sync.</p>
          ) : (
            <ul className="divide-y">
              {mine.map((e) => <QueuedChange key={e.seq} entry={e} />)}
            </ul>
          )}
          {others > 0 && (
            <p className="border-t p-3 text-xs text-muted-foreground">
              {others} change{others === 1 ? "" : "s"} saved by another account on this device will sync when that person signs in.
            </p>
          )}
        </div>
        {!user && null}
      </PopoverContent>
    </Popover>
  );
}

function QueuedChange({ entry }: { entry: OutboxEntry }) {
  const [busy, setBusy] = useState(false);
  const failed = entry.status === "failed";
  return (
    <li className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{entry.summary}</p>
          <p className="text-[11px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
        </div>
        <Badge variant={failed ? "danger" : "info"}>{failed ? "Refused" : "Waiting"}</Badge>
      </div>
      {failed && (
        <>
          <p className="mt-1.5 text-xs text-destructive">{entry.error}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Later changes wait until this one is retried or discarded.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); await syncEngine.retry(entry.seq!); setBusy(false); }}>
              <RotateCcw /> Retry
            </Button>
            <Button size="sm" variant="danger-ghost" disabled={busy} onClick={async () => {
              setBusy(true);
              await syncEngine.discard(entry.seq!);
              setBusy(false);
              toast.success("Change discarded. This device now matches the school server.");
            }}>
              <Trash2 /> Discard
            </Button>
          </div>
        </>
      )}
    </li>
  );
}

/** Thin banner under the header while the device is offline. */
export function OfflineBanner() {
  const st = useSyncState();
  const { offline } = useAuth();
  if (st.online && st.reachable && !offline) return null;
  const waiting = st.entries.filter((e) => e.userId === st.userId).length;
  return (
    <div role="status" className="no-print flex items-center gap-2 border-b border-warning/30 bg-warning/12 px-4 py-2 text-xs text-warning-foreground md:px-8 dark:text-warning">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        {st.online ? "Can't reach the school server." : "You're offline."} You can keep viewing and editing — changes are saved on this device
        {waiting ? ` (${waiting} waiting)` : ""} and sync when you reconnect.
      </span>
    </div>
  );
}
