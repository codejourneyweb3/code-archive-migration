import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncEngine, type SyncSnapshot } from "./sync";

const SERVER_SNAPSHOT: SyncSnapshot = { online: true, reachable: true, syncing: false, userId: null, entries: [], lastSyncedAt: null, lastError: null, hasData: false };

export function useSyncState(): SyncSnapshot {
  return useSyncExternalStore(syncEngine.subscribe, syncEngine.getSnapshot, () => SERVER_SNAPSHOT);
}

/** Starts syncing for the signed-in account and refreshes on-screen data whenever the device copy changes. */
export function OfflineBridge({ userId }: { userId: string }) {
  const qc = useQueryClient();
  useEffect(() => {
    void syncEngine.start(userId);
    const off = syncEngine.onChange((tables) => {
      if (tables === "all") {
        void qc.invalidateQueries({ queryKey: ["table"] });
        void qc.invalidateQueries({ queryKey: ["school_settings"] });
      } else {
        for (const t of tables) void qc.invalidateQueries({ queryKey: t === "school_settings" ? ["school_settings"] : ["table", t] });
      }
    });
    return () => { off(); };
  }, [userId, qc]);
  return null;
}
