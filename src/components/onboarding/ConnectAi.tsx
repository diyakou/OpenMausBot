import { X } from "lucide-react";
import { t } from "@/lib/i18n";
import { HoushiarSetup } from "../HoushiarSetup";
import type { WelcomeAiNow } from "./welcome-ai";

export function ConnectAi(_props: { hosted?: boolean; tested: WelcomeAiNow | null }) {
  return <HoushiarSetup />;
}

/** "Connect an AI": every way to connect one, over the first screen or the chat, until it is closed. */
export function ConnectAiDialog({ hosted = false, tested, onClose }: { hosted?: boolean; tested: WelcomeAiNow | null; onClose: () => void }) {
  return (
    <div
      className="ui-scrim fixed inset-0 z-[60] flex items-center justify-center p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-ai-title"
        data-connect-ai=""
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
        className="ui-modal animate-pop-in flex max-h-[min(640px,calc(100vh-32px))] w-[440px] max-w-full flex-col overflow-hidden text-left"
      >
        <div className="flex h-[52px] shrink-0 items-center justify-between pl-4 pr-3">
          <h2 id="connect-ai-title" className="text-[14px] font-semibold leading-[22px] text-ink">{t("onboarding.meet.connectAi")}</h2>
          <button type="button" autoFocus onClick={onClose} aria-label={t("common.close")} title={t("common.close")}
            className="flex size-7 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-ink/[0.06] hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="ui-modal-divider shrink-0" />
        <div className="min-h-0 overflow-y-auto p-4 [scrollbar-width:thin]">
          <ConnectAi hosted={hosted} tested={tested} />
        </div>
      </div>
    </div>
  );
}
