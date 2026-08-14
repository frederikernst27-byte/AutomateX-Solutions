import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-tight", {
  variants: { variant: { default: "border-brand-100 bg-brand-50 text-brand-700", muted: "border-line bg-soft text-muted", blue: "border-blue-100 bg-blue-50 text-blue-700", warning: "border-orange-100 bg-orange-50 text-orange-700", danger: "border-rose-100 bg-rose-50 text-rose-700", ink: "border-slate-200 bg-slate-100 text-ink" } }, defaultVariants: { variant: "default" }
});
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) { return <div className={cn(badgeVariants({ variant }), className)} {...props} />; }
