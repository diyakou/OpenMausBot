import { useId, useState } from "react";
import { api, useStore, type InstanceInfo } from "@/state/store";
import { ApiError, snapshotArrays } from "@/state/api";
import { t } from "@/lib/i18n";

export function HoushiarSetup() {
  const { state, dispatch } = useStore();
  const keyId = useId();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const houshiar = state.instances.find((instance) => instance.instanceId === "houshiar");
  const connected = houshiar?.snapshot.state === "available" && houshiar.snapshot.authenticated !== false && houshiar.models.options.length > 0;
  const applyCatalog = (result: { instances: InstanceInfo[] }) => {
    const { instances } = snapshotArrays(result, "instances");
    dispatch({ type: "instances", instances });
    const loaded = instances.some((instance) => instance.instanceId === "houshiar" && instance.models.options.length > 0);
    setNeedsRefresh(!loaded);
    setSaved(loaded);
    setError(loaded ? null : t("houshiar.unreachable"));
  };
  const save = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const result = await api<{ instances: InstanceInfo[] }>("/api/instances/houshiar", {
        method: "PATCH", body: JSON.stringify({ apiKey: key.trim() }),
      });
      applyCatalog(result);
      setKey("");
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409
        ? t("houshiar.busy")
        : cause instanceof ApiError && cause.status === 400
        ? t("houshiar.invalid")
        : t("houshiar.failed"));
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      applyCatalog(await api<{ instances: InstanceInfo[] }>("/api/instances/houshiar/refresh-models", { method: "POST", body: "{}" }));
    } catch {
      setError(t("houshiar.unreachable"));
    } finally {
      setBusy(false);
    }
  };
  return <form className="flex w-full flex-col gap-3 text-start" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <label htmlFor={keyId} className="text-[13px] text-ink">{t("houshiar.key")}</label>
    <input id={keyId} type="password" autoComplete="off" spellCheck={false} dir="ltr"
      value={key} onChange={(event) => setKey(event.target.value)} disabled={busy}
      className="h-9 w-full rounded-lg border border-hairline bg-inset px-3 text-[13px] text-ink disabled:opacity-50" />
    <button type="submit" disabled={busy || !key.trim()} className="ui-button ui-button-md ui-button-primary">{t(busy ? "houshiar.connecting" : "houshiar.connect")}</button>
    {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
    {(needsRefresh || houshiar?.modelsUnconfirmed) && <button type="button" disabled={busy} onClick={() => void refresh()} className="ui-button ui-button-md self-start rounded-full">{t("houshiar.refresh")}</button>}
    {!error && (saved || connected) && <p role="status" className="text-[13px] text-success">{t("houshiar.connected")}</p>}
  </form>;
}
