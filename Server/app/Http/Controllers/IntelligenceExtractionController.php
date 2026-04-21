<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class IntelligenceExtractionController extends Controller
{
    public function extract(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'text' => ['required', 'string', 'min:30', 'max:5000'],
        ]);

        $text = $validated['text'];
        $signals = $this->signals();
        $normalized = Str::of($text)
            ->lower()
            ->replaceMatches('/[^a-z0-9\s\+\-]/', ' ')
            ->squish()
            ->value();

        $matches = [];

        foreach ($signals as $signal) {
            $hits = [];
            $totalHitCount = 0;

            foreach ($signal['keywords'] as $keyword) {
                $escaped = preg_quote($keyword, '/');
                preg_match_all('/(?<!\w)'.$escaped.'(?!\w)/i', $normalized, $keywordMatches);

                $count = count($keywordMatches[0]);

                if ($count > 0) {
                    $hits[$keyword] = $count;
                    $totalHitCount += $count;
                }
            }

            if ($totalHitCount === 0) {
                continue;
            }

            $coverage = count($hits) / max(count($signal['keywords']), 1);
            $score = min(100, (int) round(($coverage * 72) + (min($totalHitCount, 6) * 4.6)));

            $matches[] = [
                'id' => $signal['id'],
                'title' => $signal['title'],
                'category' => $signal['category'],
                'impact' => $signal['impact'],
                'score' => $score,
                'matched_terms' => array_keys($hits),
                'keyword_hits' => $hits,
                'explanation' => $signal['explanation'],
            ];
        }

        usort(
            $matches,
            fn (array $a, array $b): int => $b['score'] <=> $a['score']
        );

        preg_match_all('/\b\d[\d,\.]*\+?\b/', $text, $numberMentions);

        $topMatches = array_slice($matches, 0, 5);
        $topTitles = array_map(fn (array $item): string => $item['title'], array_slice($topMatches, 0, 3));

        $suggestedFocus = [];

        if ($this->containsCategory($topMatches, 'operational-efficiency')) {
            $suggestedFocus[] = 'Show how automation removes repetitive recruiting steps.';
        }

        if ($this->containsCategory($topMatches, 'candidate-quality')) {
            $suggestedFocus[] = 'Explain how your workflow surfaces qualified candidates earlier.';
        }

        if ($this->containsCategory($topMatches, 'societal-impact')) {
            $suggestedFocus[] = 'Highlight measurable social impact such as fairness, access, or inclusion.';
        }

        if (empty($suggestedFocus)) {
            $suggestedFocus[] = 'Clarify the user pain point and connect it to measurable hiring outcomes.';
        }

        return response()->json([
            'meta' => [
                'engine' => 'heuristic-keyword-matcher',
                'version' => '1.0.0',
                'language' => 'en',
            ],
            'input' => [
                'characters' => mb_strlen($text),
                'numbers_detected' => array_values(array_unique($numberMentions[0] ?? [])),
            ],
            'summary' => [
                'top_signals' => $topTitles,
                'overall_alignment' => $this->alignmentLabel($topMatches),
            ],
            'matches' => $topMatches,
            'recommended_next_steps' => $suggestedFocus,
        ]);
    }

    private function containsCategory(array $items, string $category): bool
    {
        foreach ($items as $item) {
            if (($item['category'] ?? null) === $category) {
                return true;
            }
        }

        return false;
    }

    private function alignmentLabel(array $topMatches): string
    {
        if (empty($topMatches)) {
            return 'low';
        }

        $topScore = max(array_column($topMatches, 'score'));
        $average = array_sum(array_column($topMatches, 'score')) / count($topMatches);

        if ($topScore >= 60 || $average >= 45) {
            return 'high';
        }

        if ($topScore >= 35 || $average >= 25) {
            return 'medium';
        }

        return 'low';
    }

    private function signals(): array
    {
        return [
            [
                'id' => 'streamline_hiring',
                'title' => 'Streamline Hiring',
                'category' => 'operational-efficiency',
                'impact' => 'Reduce friction in sourcing, screening, and scheduling.',
                'explanation' => 'The text emphasizes process simplification and speed.',
                'keywords' => [
                    'streamline', 'workflow', 'automate', 'automation', 'faster', 'speed', 'time to hire',
                ],
            ],
            [
                'id' => 'reduce_costs',
                'title' => 'Reduce Recruitment Costs',
                'category' => 'operational-efficiency',
                'impact' => 'Lower repetitive manual effort and agency spend.',
                'explanation' => 'The text links decisions to cost outcomes.',
                'keywords' => [
                    'reduce costs', 'cost', 'budget', 'efficiency', 'roi', 'resource', 'optimize spend',
                ],
            ],
            [
                'id' => 'qualified_candidates',
                'title' => 'Connect to Qualified Candidates',
                'category' => 'candidate-quality',
                'impact' => 'Improve fit by matching candidate evidence to role criteria.',
                'explanation' => 'The text references quality matching and relevant skills.',
                'keywords' => [
                    'qualified', 'matching', 'fit', 'skills', 'competency', 'shortlist', 'screening',
                ],
            ],
            [
                'id' => 'trust_and_scale',
                'title' => 'Scalable and Trusted Platform',
                'category' => 'business-confidence',
                'impact' => 'Demonstrate reliability at scale for many organizations.',
                'explanation' => 'The text references trust, scale, and reliability.',
                'keywords' => [
                    'trusted', '10,000+', 'scale', 'reliable', 'secure', 'consistency', 'businesses',
                ],
            ],
            [
                'id' => 'societal_impact',
                'title' => 'Empower Society Through Intelligent Tech',
                'category' => 'societal-impact',
                'impact' => 'Show inclusive and ethical outcomes from technology use.',
                'explanation' => 'The text ties intelligence to social impact outcomes.',
                'keywords' => [
                    'empower', 'society', 'intelligent', 'inclusive', 'fairness', 'access', 'community',
                ],
            ],
        ];
    }
}
