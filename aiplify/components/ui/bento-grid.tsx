"use client";

import type React from "react";
import { CheckCircle, Globe, TrendingUp, Video } from "lucide-react";

import { cn } from "@/lib/utils";

export interface BentoItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  status?: string;
  tags?: string[];
  meta?: string;
  cta?: string;
  colSpan?: number;
  hasPersistentHover?: boolean;
}

interface BentoGridProps {
  items?: BentoItem[];
}

const itemsSample: BentoItem[] = [
  {
    title: "Analytics Dashboard",
    meta: "v2.4.1",
    description: "Real-time metrics with AI-powered insights and predictive analytics",
    icon: <TrendingUp className="h-4 w-4 text-blue-500" />,
    status: "Live",
    tags: ["Statistics", "Reports", "AI"],
    colSpan: 2,
    hasPersistentHover: true,
  },
  {
    title: "Task Manager",
    meta: "84 completed",
    description: "Automated workflow management with priority scheduling",
    icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
    status: "Updated",
    tags: ["Productivity", "Automation"],
  },
  {
    title: "Media Library",
    meta: "12GB used",
    description: "Cloud storage with intelligent content processing",
    icon: <Video className="h-4 w-4 text-purple-500" />,
    tags: ["Storage", "CDN"],
    colSpan: 2,
  },
  {
    title: "Global Network",
    meta: "6 regions",
    description: "Multi-region deployment with edge computing",
    icon: <Globe className="h-4 w-4 text-sky-500" />,
    status: "Beta",
    tags: ["Infrastructure", "Edge"],
  },
];

function BentoGrid({ items = itemsSample }: BentoGridProps) {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 p-0 md:grid-cols-3">
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            "group relative overflow-hidden rounded-lg p-4 transition-all duration-300",
            "border border-black/10 bg-white/[0.88] shadow-[0_10px_35px_rgba(15,23,42,0.05)] backdrop-blur-xl",
            "hover:-translate-y-0.5 hover:shadow-[0_18px_55px_rgba(15,23,42,0.09)]",
            item.colSpan === 2 ? "md:col-span-2" : "md:col-span-1",
            {
              "-translate-y-0.5 shadow-[0_18px_55px_rgba(15,23,42,0.09)]":
                item.hasPersistentHover,
            },
          )}
        >
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-300",
              item.hasPersistentHover ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(2,6,23,0.035)_1px,transparent_1px)] bg-[length:5px_5px]" />
          </div>

          <div className="relative flex flex-col space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.04] transition-all duration-300 group-hover:bg-black/[0.07]">
                {item.icon}
              </div>
              <span className="rounded-lg bg-black/[0.04] px-2 py-1 text-xs font-medium text-slate-600 backdrop-blur-sm transition-colors duration-300 group-hover:bg-black/[0.07]">
                {item.status || "Active"}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-[15px] font-medium tracking-tight text-slate-950">
                {item.title}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {item.meta}
                </span>
              </h3>
              <p className="text-sm font-[425] leading-snug text-slate-600">
                {item.description}
              </p>
            </div>

            <div className="mt-2 flex items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {item.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-black/[0.04] px-2 py-1 backdrop-blur-sm transition-all duration-200 hover:bg-black/[0.08]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <span className="text-xs text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
                {item.cta || "Explore ->"}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export { BentoGrid };
