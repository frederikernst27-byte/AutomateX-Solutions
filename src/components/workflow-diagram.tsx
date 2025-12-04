import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type WorkflowNode = {
  id: string;
  label: string;
  icon: LucideIcon;
};

interface WorkflowDiagramProps {
  nodes: WorkflowNode[];
  className?: string;
}

export default function WorkflowDiagram({
  nodes,
  className,
}: WorkflowDiagramProps) {
  return (
    <TooltipProvider>
      <div className={cn('flex items-center justify-center flex-wrap gap-4', className)}>
        {nodes.map((node, index) => (
          <div key={node.id} className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-background border rounded-lg p-3 shadow-sm">
                    <node.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground text-center max-w-20">
                    {node.label}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{node.label}</p>
              </TooltipContent>
            </Tooltip>

            {index < nodes.length - 1 && (
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
