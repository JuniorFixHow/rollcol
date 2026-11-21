"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClass } from "./ui";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
}

interface Request {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

/**
 * RollCol's own confirmation dialog, used instead of the browser's confirm()
 * box. Returns a confirm() that resolves true or false, and the dialog to render.
 *
 *   const [confirm, dialog] = useConfirm();
 *   if (await confirm({ title: "Remove this teacher?" })) { ... }
 *   return <>{...}{dialog}</>;
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [request, setRequest] = useState<Request | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ options, resolve })),
    [],
  );

  const close = useCallback(
    (confirmed: boolean) => {
      request?.resolve(confirmed);
      setRequest(null);
    },
    [request],
  );

  // Rendered into <body>, so it never picks up alignment or styles from where the button sits.
  const dialog = request ? createPortal(<ConfirmDialog options={request.options} onClose={close} />, document.body) : null;
  return [confirm, dialog];
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (confirmed: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "primary" } = options;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        // Escape key.
        event.preventDefault();
        onClose(false);
      }}
      onClick={(event) => {
        // A click on the dimmed backdrop (outside the panel) cancels.
        if (event.target === ref.current) onClose(false);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl text-left border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        {message ? <div className="mt-2 text-sm leading-6 whitespace-pre-line text-muted">{message}</div> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => onClose(false)} className={buttonClass("secondary")}>
            {cancelLabel}
          </button>
          {/* autoFocus on the safe choice for destructive actions. */}
          <button
            type="button"
            autoFocus={tone !== "danger"}
            onClick={() => onClose(true)}
            className={buttonClass(tone === "danger" ? "danger" : "primary")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
