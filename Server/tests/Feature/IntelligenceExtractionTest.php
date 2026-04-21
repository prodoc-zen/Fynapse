<?php

namespace Tests\Feature;

use Illuminate\Testing\Fluent\AssertableJson;
use Tests\TestCase;

class IntelligenceExtractionTest extends TestCase
{
    public function test_it_extracts_relevant_signals_from_text(): void
    {
        $payload = [
            'text' => 'Our platform helps employers streamline workflow, reduce costs, and connect faster with qualified candidates through intelligent screening.',
        ];

        $response = $this->postJson('/api/v1/intelligence/extract', $payload);

        $response
            ->assertOk()
            ->assertJson(fn (AssertableJson $json): AssertableJson => $json
                ->where('meta.engine', 'heuristic-keyword-matcher')
                ->whereNot('summary.overall_alignment', 'low')
                ->etc())
            ->assertJsonStructure([
                'meta' => ['engine', 'version', 'language'],
                'input' => ['characters', 'numbers_detected'],
                'summary' => ['top_signals', 'overall_alignment'],
                'matches' => [
                    '*' => ['id', 'title', 'category', 'impact', 'score', 'matched_terms', 'keyword_hits', 'explanation'],
                ],
                'recommended_next_steps',
            ]);
    }

    public function test_it_requires_text_field(): void
    {
        $response = $this->postJson('/api/v1/intelligence/extract', []);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['text']);
    }
}
