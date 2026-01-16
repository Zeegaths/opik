import { useState } from 'react';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const AnalysisSchema = z.object({
  suggestion: z.string(),
  needsBreak: z.boolean(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  reasoning: z.string(),
});

export function useBuilderAgent() {
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeUptime = async (data: {
    tasks: any[];
    energy: number;
    focusMinutes: number;
    uptime: number;
    lastBreak: number | null;
  }) => {
    setIsAnalyzing(true);

    try {
      const blockers = data.tasks.filter(t => t.hasBlocker && !t.completed);
      const completed = data.tasks.filter(t => t.completed);
      
      const { object } = await generateObject({
        model: openai('gpt-4-turbo'),
        schema: AnalysisSchema,
        prompt: `Analyze this Web3 builder's productivity:

Status:
- Uptime: ${data.uptime}%
- Energy: ${data.energy}/5
- Focus: ${data.focusMinutes} mins
- Tasks: ${completed.length}/${data.tasks.length} done
- Blockers: ${blockers.length}

${blockers.length > 0 ? `Stuck on:\n${blockers.map(t => `- ${t.text}`).join('\n')}` : ''}

Give ONE actionable tip (max 20 words) to help them build sustainably.`,
      });

      setAnalysis(object);
      return object;
    } catch (error) {
      console.error('AI analysis failed:', error);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return { analysis, isAnalyzing, analyzeUptime };
}