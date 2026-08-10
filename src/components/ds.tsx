import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
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
