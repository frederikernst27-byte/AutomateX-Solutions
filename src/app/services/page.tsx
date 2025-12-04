import { PageHeader } from '@/components/page-header';
import { services } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function ServicesPage() {
  return (
    <div>
      <PageHeader
        title="Our Automation Services"
        description="We offer a comprehensive suite of services to help you harness the power of automation. Whether you need to integrate existing systems or build a custom solution from scratch, we've got you covered."
      />

      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => (
            <Card key={service.title} className="flex flex-col">
              <CardHeader>
                <div className="mb-4">
                  <div className="w-fit p-3 bg-primary/10 text-primary rounded-lg">
                    <service.icon className="h-8 w-8" />
                  </div>
                </div>
                <CardTitle className="font-headline text-2xl">
                  {service.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-muted-foreground">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <section className="bg-primary text-primary-foreground">
        <div className="container py-20 text-center">
          <h2 className="font-headline text-3xl font-bold">
            Ready to Start Automating?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            Let's discuss how AutomateX can help your business become more
            efficient and productive. Schedule a free consultation with one of
            our automation experts today.
          </p>
          <Button asChild size="lg" className="mt-8 bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/contact">
              Book a Consultation <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
