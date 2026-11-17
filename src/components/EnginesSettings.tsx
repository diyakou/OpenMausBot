import { t } from "@/lib/i18n";
import { HoushiarSetup } from "./HoushiarSetup";
import { AdminOnly } from "./AdminOnly";
import { SettingsGroup } from "./SettingsPrimitives";
export { HiddenEngines } from "./HiddenProviders";

export function AiSignInSettings() {
  return <AdminOnly><HoushiarSetup /></AdminOnly>;
}

export function EnginesSettings(_props: { simple?: boolean; more?: { id: string; open: boolean; onToggle: () => void } }) {
  return <SettingsGroup label={t("houshiar.title")}><HoushiarSetup /></SettingsGroup>;
}
