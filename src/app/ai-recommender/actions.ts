'use server';

import { z } from 'zod';
import { generateWorkflowRecommendations } from '@/ai/flows/ai-generated-workflow-recommendations';

const recommendationSchema = z.object({
  industry: z.string().min(3, 'Industry must be at least 3 characters long.'),
  operationalNeeds: z
    .string()
    .min(10, 'Operational needs must be at least 10 characters long.'),
});

interface FormState {
  recommendations: string[];
  error: string | null;
}

export async function generateRecommendationsAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const input = {
      industry: formData.get('industry'),
      operationalNeeds: formData.get('operationalNeeds'),
    };

    const validatedInput = recommendationSchema.safeParse(input);

    if (!validatedInput.success) {
      return {
        recommendations: [],
        error: validatedInput.error.errors.map((e) => e.message).join(', '),
      };
    }

    const result = await generateWorkflowRecommendations(validatedInput.data);

    if (!result || !result.recommendations) {
      return {
        recommendations: [],
        error: 'Failed to generate recommendations. Please try again.',
      };
    }

    return {
      recommendations: result.recommendations,
      error: null,
    };
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return {
      recommendations: [],
      error: 'An unexpected error occurred. Please try again later.',
    };
  }
}
