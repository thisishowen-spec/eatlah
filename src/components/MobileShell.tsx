import type { ReactNode } from "react";

type MobileShellProps = {
  caption?: string;
  children: ReactNode;
};

export function MobileShell({ caption = "390 x 844", children }: MobileShellProps) {
  return (
    <main className="app-viewport">
      <section className="desktop-preview-frame">
        <div className="desktop-preview-caption">
          <span>EatLah prototype</span>
          <span>{caption}</span>
        </div>
        <div className="app-surface">{children}</div>
      </section>
    </main>
  );
}

export function StatusBar(_props: { light?: boolean }) {
  return null;
}

export function IconButton({
  icon,
  onClick,
  label,
  className = "",
}: {
  icon: string;
  onClick?: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button className={`icon-btn ${className}`} onClick={onClick} aria-label={label}>
      <i className={icon} />
    </button>
  );
}

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button className={`sheet-backdrop ${open ? "open" : ""}`} onClick={onClose} aria-label="Close sheet" />
      <div className={`bottom-sheet ${open ? "open" : ""}`}>
        <div className="handle" />
        {children}
      </div>
    </>
  );
}

export function Toast({ text }: { text: string }) {
  if (!text) return null;
  return <div className="toast">{text}</div>;
}
