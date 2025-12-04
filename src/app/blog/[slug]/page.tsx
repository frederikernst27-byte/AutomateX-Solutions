import { notFound } from 'next/navigation';
import Image from 'next/image';
import { blogPosts } from '@/lib/data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = blogPosts.find((p) => p.slug === params.slug);

  if (!post) {
    notFound();
  }

  const image = PlaceHolderImages.find((img) => img.id === post.imageId);

  return (
    <article>
      <header className="bg-primary/5 py-16 md:py-20 border-b">
        <div className="container text-center">
          <h1 className="text-3xl font-headline font-bold md:text-5xl leading-tight">
            {post.title}
          </h1>
          <div className="mt-6 flex items-center justify-center space-x-4 text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{post.author.charAt(0)}</AvatarFallback>
              </Avatar>
              <span>{post.author}</span>
            </div>
            <span>•</span>
            <time dateTime={post.date}>{post.date}</time>
          </div>
        </div>
      </header>

      <div className="container max-w-4xl py-12 md:py-16">
        {image && (
          <div className="relative h-64 md:h-96 w-full mb-12 rounded-lg overflow-hidden">
            <Image
              src={image.imageUrl}
              alt={post.title}
              fill
              style={{ objectFit: 'cover' }}
              data-ai-hint={image.imageHint}
              priority
            />
          </div>
        )}

        <div
          className="prose prose-lg dark:prose-invert max-w-none prose-p:text-muted-foreground prose-headings:font-headline prose-headings:text-foreground"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </div>
    </article>
  );
}
