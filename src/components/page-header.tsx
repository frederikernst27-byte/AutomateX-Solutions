import { cn } from '@/lib/utils';

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
}

export function PageHeader({
  title,
  description,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        'bg-primary/5 py-16 md:py-20 border-b',
        className
      )}
      {...props}
    >
      <div className="container text-center">
        <h1 className="text-3xl font-headline font-bold md:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mx-auto mt-4 max-w-3xl text-base text-muted-foreground md:text-xl">
            {description}
          </p>
        )}
      </div>
    </section>
  );
}
