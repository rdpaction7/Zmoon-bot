import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "./icons";

/* --------------------------------------------------------------------- button */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function LinkButton({
  to,
  children,
  variant = "primary",
  size = "md",
  className = "",
}: {
  to: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Link className={`btn btn-${variant} btn-${size} ${className}`} to={to}>
      {children}
    </Link>
  );
}

/* ---------------------------------------------------------------------- forms */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return <input ref={ref} className={`input ${className}`} {...rest} />;
  },
);

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`input textarea ${className}`} {...rest} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select className={`input select ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={`search-field ${className}`} role="search">
      <Icon name="search" />
      <input
        className="input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ surfaces */

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: any;
}) {
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger" | "accent";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Avatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initials = String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  if (src && !failed) {
    return (
      <img
        className="avatar"
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className="avatar avatar-fallback"
      style={{ width: size, height: size, fontSize: Math.max(11, size / 2.6) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="skeleton" style={{ width: `${90 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon = "sparkles",
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: IconName;
  tone?: "neutral" | "positive" | "espresso";
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className={`stat-icon ${tone && tone !== "neutral" ? `stat-icon-${tone}` : ""}`} aria-hidden="true">
            <Icon name={icon} />
          </span>
        )}
      </div>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={`tab ${value === tab.id ? "tab-active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------- modal */

/** Keeps track of open modals so only the top-most one handles Escape. */
const openModals: symbol[] = [];

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const token = Symbol("modal");
    openModals.push(token);

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      );
    const timer = window.setTimeout(() => focusables()[0]?.focus(), 30);

    const onKey = (event: KeyboardEvent) => {
      // Nested dialogs: only the most recently opened one reacts.
      if (openModals[openModals.length - 1] !== token) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      const index = openModals.lastIndexOf(token);
      if (index >= 0) openModals.splice(index, 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- toast */

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
const ToastContext = createContext<{ push: (message: string, tone?: Toast["tone"]) => void } | null>(
  null,
);

const TOAST_ICON: Record<Toast["tone"], IconName> = {
  success: "check",
  error: "alert",
  info: "info",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4800);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.tone}`}
            role={toast.tone === "error" ? "alert" : undefined}
          >
            <span className="toast-icon" aria-hidden="true">
              <Icon name={TOAST_ICON[toast.tone]} />
            </span>
            <span className="toast-content">{toast.message}</span>
            <span className="toast-progress" aria-hidden="true" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="error-text" role="alert">
      {children}
    </p>
  );
}

/** Accessible replacement for window.confirm. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  tone = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{body}</p>
    </Modal>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Math.round(safe * 2) / 2;
  return (
    <span
      className="stars"
      aria-label={`${safe.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ""}`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          aria-hidden="true"
          className={rounded >= star ? "star star-on" : rounded >= star - 0.5 ? "star star-half" : "star"}
        >
          ★
        </span>
      ))}
      <span className="small muted">
        {safe.toFixed(1)}
        {count ? ` (${count})` : ""}
      </span>
    </span>
  );
}
