import { cloneElement, forwardRef, isValidElement, type HTMLAttributes, type ReactElement, type ReactNode } from "react";

type SlotProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
};

const Slot = forwardRef<HTMLElement, SlotProps>(function Slot({ children, ...props }, ref) {
  if (!isValidElement(children)) return null;
  const child = children as ReactElement<{ className?: string }>;
  return cloneElement(child, {
    ...props,
    ref,
    className: [props.className, child.props.className].filter(Boolean).join(" "),
  } as Record<string, unknown>);
});

export { Slot };
