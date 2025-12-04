'use server';

/**
 * @fileOverview A flow to generate tailored n8n workflow automation ideas based on user input.
 *
 * - generateWorkflowRecommendations - A function that generates workflow recommendations.
 * - WorkflowRecommendationsInput - The input type for the generateWorkflowRecommendations function.
 * - WorkflowRecommendationsOutput - The return type for the generateWorkflowRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const WorkflowRecommendationsInputSchema = z.object({
  industry: z.string().describe('The industry of the user.'),
  operationalNeeds: z.string().describe('The operational needs of the user.'),
});
export type WorkflowRecommendationsInput = z.infer<
  typeof WorkflowRecommendationsInputSchema
>;

const WorkflowRecommendationsOutputSchema = z.object({
  recommendations: z
    .array(z.string())
    .describe('A list of n8n workflow automation ideas.'),
});
export type WorkflowRecommendationsOutput = z.infer<
  typeof WorkflowRecommendationsOutputSchema
>;

export async function generateWorkflowRecommendations(
  input: WorkflowRecommendationsInput
): Promise<WorkflowRecommendationsOutput> {
  return generateWorkflowRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'workflowRecommendationsPrompt',
  input: {schema: WorkflowRecommendationsInputSchema},
  output: {schema: WorkflowRecommendationsOutputSchema},
  prompt: `You are an expert in suggesting n8n workflow automations.

  Based on the user's industry and operational needs, suggest several tailored n8n workflow automation ideas.

  Industry: {{{industry}}}
  Operational Needs: {{{operationalNeeds}}}

  Provide a list of workflow automation ideas that address these needs.
  Each idea should be a concise description of a potential n8n workflow.
  Limit the number of recommendations to 5.
  Ensure the recommendations are specific and actionable.

  Return the recommendations in the following JSON format:
  {
    "recommendations": ["Recommendation 1", "Recommendation 2", ...] // Each recommendation should describe an n8n workflow automation idea.
  }
  `,
});

const generateWorkflowRecommendationsFlow = ai.defineFlow(
  {
    name: 'generateWorkflowRecommendationsFlow',
    inputSchema: WorkflowRecommendationsInputSchema,
    outputSchema: WorkflowRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
