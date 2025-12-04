import Link from 'next/link';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle,
  Zap,
  Cpu,
  Server,
  Shuffle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { automationExamples, services } from '@/lib/data';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Badge } from '@/components/ui/badge';
import WorkflowDiagram from '@/components/workflow-diagram';

export default function Home() {
  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero-home');
  const featuredAutomation = automationExamples[0];

  return (
    <div className="flex flex-col">
      <section className="relative bg-background pt-24 pb-12 md:pt-32 md:pb-20">
        <div
          aria-hidden="true"
          className="absolute inset-0 top-0 h-64 bg-gradient-to-b from-primary/5 to-background"
        ></div>
        <div className="container px-4 md:px-6 relative">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="flex flex-col gap-6 text-center md:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-bold tracking-tighter">
                Automate Your Business,{' '}
                <span className="text-primary">Effortlessly</span>
              </h1>
              <p className="max-w-xl mx-auto md:mx-0 text-lg text-muted-foreground">
                AutomateX provides cutting-edge automation software and services
                to simplify your business workflows, powered by n8n.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
                  <Link href="/contact">Book a Free Consultation</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/automations">
                    Explore Automations <ArrowRight className="ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="relative h-64 md:h-96 rounded-xl overflow-hidden shadow-2xl">
              {heroImage && (
                <Image
                  src={heroImage.imageUrl}
                  alt={heroImage.description}
                  fill
                  style={{ objectFit: 'cover' }}
                  data-ai-hint={heroImage.imageHint}
                  priority
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent"></div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-secondary">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-headline font-bold">
              Why Automate with AutomateX?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
              We leverage the power of n8n to build robust, scalable, and
              custom automation solutions for your unique business needs.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit">
                  <Zap size={32} />
                </div>
                <CardTitle className="mt-4 font-headline">
                  Boost Efficiency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Eliminate repetitive tasks and free up your team to focus on
                  what truly matters.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit">
                  <Cpu size={32} />
                </div>
                <CardTitle className="mt-4 font-headline">
                  Custom Solutions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Tailored n8n workflows designed to integrate seamlessly with
                  your existing tools and processes.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit">
                  <Server size={32} />
                </div>
                <CardTitle className="mt-4 font-headline">
                  Scalable & Reliable
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Build automations that grow with your business, ensuring long-term
                  viability and performance.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-headline font-bold">
              Our Automation Services
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
              From ERP integration to bespoke n8n workflows, we offer a complete
              suite of automation services.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map((service) => (
              <Card key={service.title} className="flex flex-col">
                <CardHeader>
                  <service.icon className="h-8 w-8 text-primary mb-4" />
                  <CardTitle className="font-headline">
                    {service.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-muted-foreground">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-12">
            <Button asChild size="lg" variant="outline">
              <Link href="/services">
                Learn More About Our Services <ArrowRight className="ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-secondary">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">
              Featured Automation
            </Badge>
            <h2 className="text-3xl md:text-4xl font-headline font-bold">
              See a Workflow in Action
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
              Explore how we automate complex processes. Here is an example of our '{featuredAutomation.title}' workflow.
            </p>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center gap-4">
                <div className="bg-accent/10 text-accent p-2 rounded-lg">
                  <featuredAutomation.icon className="h-6 w-6" />
                </div>
                <CardTitle className="font-headline">{featuredAutomation.title}</CardTitle>
              </div>
              <p className="text-muted-foreground pt-2">{featuredAutomation.description}</p>
            </CardHeader>
            <CardContent className="p-6">
              <h3 className="font-bold mb-4 text-lg font-headline">Workflow Diagram:</h3>
              <WorkflowDiagram nodes={featuredAutomation.workflow} />
            </CardContent>
          </Card>
          
          <div className="text-center mt-12">
            <Button asChild size="lg" variant="outline">
              <Link href="/automations">
                Explore All Automation Examples <ArrowRight className="ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-primary text-primary-foreground">
        <div className="container px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="text-center md:text-left">
              <BrainCircuit className="h-16 w-16 text-accent mx-auto md:mx-0 mb-4" />
              <h2 className="text-3xl md:text-4xl font-headline font-bold">
                Discover Your Automation Potential
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/80 max-w-xl mx-auto md:mx-0">
                Not sure where to start? Use our AI-powered tool to get
                personalized n8n workflow recommendations based on your
                industry and needs.
              </p>
            </div>
            <div className="flex justify-center items-center">
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/ai-recommender">
                  Get AI Recommendations <ArrowRight className="ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
