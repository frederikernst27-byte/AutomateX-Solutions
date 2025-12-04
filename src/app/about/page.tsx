import Image from 'next/image';
import { PageHeader } from '@/components/page-header';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Zap, Target } from 'lucide-react';

export default function AboutPage() {
  const teamImage = PlaceHolderImages.find((img) => img.id === 'about-team');

  return (
    <div>
      <PageHeader
        title="About AutomateX"
        description="We are a passionate team of innovators dedicated to simplifying complex business processes through intelligent automation."
      />

      <div className="container py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-headline text-3xl font-bold mb-4">Our Mission</h2>
            <p className="text-muted-foreground text-lg mb-6">
              Our mission is to empower businesses of all sizes to achieve peak
              efficiency by automating their workflows. We believe that by
              eliminating repetitive tasks, we can unlock human potential and
              drive meaningful growth.
            </p>
            <h2 className="font-headline text-3xl font-bold mb-4">
              Our Vision & Technology
            </h2>
            <p className="text-muted-foreground text-lg">
              We envision a world where technology works seamlessly in the
              background, allowing people to focus on creativity, strategy, and
              innovation. We leverage the power and flexibility of n8n as our
              core integration platform to build custom, scalable, and reliable
              automation solutions that adapt to the unique needs of each client.
            </p>
          </div>
          <div className="relative h-80 md:h-96 rounded-xl overflow-hidden shadow-lg">
            {teamImage && (
              <Image
                src={teamImage.imageUrl}
                alt={teamImage.description}
                fill
                style={{ objectFit: 'cover' }}
                data-ai-hint={teamImage.imageHint}
              />
            )}
          </div>
        </div>
      </div>
      
      <section className="py-16 bg-secondary">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-headline font-bold">
              Our Core Values
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
              These principles guide every decision we make and every solution we build.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit">
                  <Zap size={28} />
                </div>
                <CardTitle className="mt-4 font-headline">Innovation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We constantly explore new technologies and approaches to deliver the best automation solutions.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit">
                  <Target size={28} />
                </div>
                <CardTitle className="mt-4 font-headline">Customer Focus</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your success is our success. We work closely with you to understand and solve your unique challenges.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit">
                  <CheckCircle size={28} />
                </div>
                <CardTitle className="mt-4 font-headline">Integrity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We build reliable, secure, and transparent solutions you can trust to run your business processes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
