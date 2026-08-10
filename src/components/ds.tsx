import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Check, X } from "lucide-react";
import "./ds.css";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/* ---------- Card ---------- */
export function Card({
  children,
  style,
  className,
}: {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={cx("ds-card", className)} style={style}>
      {children}
    </div>
  );
}

/* ---------- Button ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "accent" | "ghost" | "solid";
  icon?: ReactNode;
};

export function Button({ variant = "accent", icon, children, className, ...rest }: ButtonProps) {
  return (
    <button type="button" className={cx("ds-button", `ds-button--${variant}`, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/* ---------- IconButton ---------- */
export function IconButton({
  icon,
  variant = "solid",
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  variant?: "solid" | "ghost";
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx("ds-iconbutton", `ds-iconbutton--${variant}`, "ds-hit")}
      {...rest}
    >
      {icon}
    </button>
  );
}

/* ---------- Input ---------- */
type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "style"> & {
  icon?: ReactNode;
  /** Ice border + glow, used while the field holds content. */
  lit?: boolean;
  style?: CSSProperties;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, lit, style, className, ...rest },
  ref,
) {
  return (
    <div className={cx("ds-input", lit && "ds-input--lit", className)} style={style}>
      {icon && <span className="ds-input__icon">{icon}</span>}
      <input ref={ref} {...rest} />
    </div>
  );
});

/* ---------- Checkbox ---------- */
export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="ds-checkbox ds-hit"
    >
      {checked && <Check size={14} strokeWidth={3} />}
    </button>
  );
}

/* ---------- Tag ---------- */
export function Tag({ children, active }: { children: ReactNode; active?: boolean }) {
  return <span className={cx("ds-tag", active && "ds-tag--active")}>{children}</span>;
}

/* ---------- Badge ---------- */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "accent" | "ice";
  children: ReactNode;
}) {
  return <span className={cx("ds-badge", `ds-badge--${tone}`)}>{children}</span>;
}

/* ---------- Tabs ---------- */
export interface TabItem<T extends string> {
  value: T;
  label: string;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="ds-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className={cx("ds-tab", item.value === value && "ds-tab--active")}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Toast ---------- */
export function Toast({
  tone = "success",
  children,
  style,
}: {
  tone?: "success" | "danger";
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className={cx("ds-toast", `ds-toast--${tone}`)} role="status" aria-live="polite" style={style}>
      <span className="ds-toast__dot" />
      {children}
    </div>
  );
}

/* ---------- Sheet ---------- */
export function Sheet({
  title,
  onClose,
  children,
  action,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // The sheet owns the screen; the list behind it must not scroll.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="ds-sheet-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ds-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ds-sheet__head">
          <div className="ds-sheet__title">{title}</div>
          {action ?? (
            <IconButton icon={<X size={16} />} variant="ghost" label="閉じる" onClick={onClose} />
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Labelled form row used inside sheets. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ds-field">
      <span className="ds-field__label">{label}</span>
      {children}
    </label>
  );
}

/* ---------- Switch ---------- */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="ds-switch ds-hit"
    >
      <span className="ds-switch__knob" />
    </button>
  );
}
