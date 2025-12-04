import { PageHeader } from '@/components/page-header';
import AiRecommenderForm from '@/components/ai-recommender-form';

export default function AiRecommenderPage() {
  return (
    <div>
      <PageHeader
        title="AI Workflow Recommender"
        description="Unsure where to begin with automation? Describe your business, and our AI will suggest tailored n8n workflow ideas to address your operational needs."
      />
      <div className="container py-16">
        <div className="max-w-2xl mx-auto">
          <AiRecommenderForm />
        </div>
      </div>
    </div>
  );
}
