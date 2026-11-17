import { useState } from "react";
import { api, useStore, type InstanceInfo } from "@/state/store";
import { t } from "@/lib/i18n";

export function HoushiarSetup() {
  const { state, dispatch } = useStore();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const connected = state.instances.some((instance) => instance.instanceId === "houshiar" && instance.snapshot.state === "available" && instance.snapshot.authenticated !== false);
  const save = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const result = await api<{ instances: InstanceInfo[]; warning?: string }>("/api/instances/houshiar", {
        method: "PATCH", body: JSON.stringify({ apiKey: key.trim() }),
      });
      setKey("");
      dispatch({ type: "instances", instances: result.instances });
      if (result.warning) setError(t("houshiar.unreachable"));
      else setSaved(true);
    } catch {
      setError(t("houshiar.failed"));
    } finally {
      setBusy(false);
    }
  };
  return <form className="flex w-full flex-col gap-3 text-start" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <label htmlFor="houshiar-api-key" className="text-[13px] text-ink">{t("houshiar.key")}</label>
    <input id="houshiar-api-key" type="password" autoComplete="off" spellCheck={false} dir="ltr"
      value={key} onChange={(event) => setKey(event.target.value)} disabled={busy}
      className="h-9 w-full rounded-lg border border-hairline bg-inset px-3 text-[13px] text-ink disabled:opacity-50" />
    <button type="submit" disabled={busy || !key.trim()} className="ui-button ui-button-md ui-button-primary">{t(busy ? "houshiar.connecting" : "houshiar.connect")}</button>
    {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
    {!error && (saved || connected) && <p role="status" className="text-[13px] text-success">{t("houshiar.connected")}</p>}
  </form>;
}
