import type { ReactNode } from "react";
import type { StatusMood } from "../lib/stickers";
import { StatusMascot } from "./status-mascot";

type StatusScreenProps = {
  mood: StatusMood;
  title: string;
  hint?: string | null;
  action?: ReactNode;
};

/** Full-area empty / error / not-found stage. */
export function StatusScreen({
  mood,
  title,
  hint,
  action,
}: StatusScreenProps) {
  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
      <div className="mx-auto flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
        <StatusMascot mood={mood} size="lg" />
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {hint ? (
          <p className="max-w-sm text-sm text-foreground-muted">{hint}</p>
        ) : null}
        {action}
      </div>
    </div>
  );
}
