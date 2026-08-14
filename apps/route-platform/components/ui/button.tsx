import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-brand-500 text-white shadow-sm hover:bg-brand-600",
      secondary: "bg-ink text-white hover:bg-slate-800",
      outline: "border border-line bg-white text-ink hover:border-brand-500 hover:text-brand-700",
      ghost: "text-muted hover:bg-soft hover:text-ink",
      danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
      soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
    },
    size: { default: "h-10 px-4", sm: "h-8 rounded-lg px-3 text-xs", lg: "h-12 px-5", icon: "h-10 w-10" }
  }, defaultVariants: { variant: "default", size: "default" }
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean; }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";
export { Button, buttonVariants };
