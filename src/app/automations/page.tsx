import { PageHeader } from '@/components/page-header';
import WorkflowDiagram from '@/components/workflow-diagram';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { automationExamples } from '@/lib/data';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function AutomationsPage() {
  return (
    <div>
      <PageHeader
        title="Automation Examples"
        description="Explore interactive examples of how n8n-based solutions can streamline your business processes. These are just a few possibilities we can build and customize for you."
      />

      <div className="container py-16">
        <Card>
          <CardContent className="p-0">
            <Accordion type="single" collapsible className="w-full">
              {automationExamples.map((example, index) => (
                <AccordionItem
                  value={`item-${index}`}
                  key={example.title}
                  className={index === automationExamples.length - 1 ? 'border-b-0' : ''}
                >
                  <AccordionTrigger className="p-6 text-lg font-headline hover:no-underline">
                    <div className="flex items-center gap-4">
                      <div className="bg-accent/10 text-accent p-3 rounded-lg">
                        <example.icon className="h-6 w-6" />
                      </div>
                      {example.title}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <p className="text-muted-foreground mb-6">
                      {example.description}
                    </p>
                    <div className="p-6 bg-secondary rounded-lg border">
                      <h3 className="font-bold mb-4 text-md font-headline">
                        Workflow Diagram:
                      </h3>
                      <WorkflowDiagram nodes={example.workflow} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
