'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { generateRecommendationsAction } from '@/app/ai-recommender/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Loader, Shuffle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const initialState = {
  recommendations: [],
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <BrainCircuit className="mr-2 h-4 w-4" />
          Generate Ideas
        </>
      )}
    </Button>
  );
}

export default function AiRecommenderForm() {
  const [state, formAction] = useFormState(
    generateRecommendationsAction,
    initialState
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">
            Tell us about your business
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="industry">Your Industry</Label>
              <Input
                id="industry"
                name="industry"
                placeholder="e.g., E-commerce, Real Estate, SaaS"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operationalNeeds">Your Operational Needs</Label>
              <Textarea
                id="operationalNeeds"
                name="operationalNeeds"
                placeholder="Describe your daily tasks, challenges, or what you'd like to automate.&#10;For example: 'Managing customer support tickets from multiple channels', 'Onboarding new employees', 'Tracking sales leads from our website'."
                required
                rows={5}
              />
            </div>
            <SubmitButton />
          </form>
        </CardContent>
      </Card>

      {state.error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.recommendations.length > 0 && (
        <div>
          <h2 className="text-2xl font-headline font-bold mb-4">
            Here are some automation ideas for you:
          </h2>
          <Card>
            <CardContent className="p-6">
              <ul className="space-y-4">
                {state.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0">
                      <Shuffle className="h-5 w-5 text-accent" />
                    </div>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
