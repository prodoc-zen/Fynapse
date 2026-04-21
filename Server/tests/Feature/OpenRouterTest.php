<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OpenRouterTest extends TestCase
{
    protected function tearDown(): void
    {
        putenv('OPENROUTER_API_KEY');
        putenv('OPENROUTER_BASE_URL');

        parent::tearDown();
    }

    public function test_openrouter_test_endpoint_returns_llm_response(): void
    {
        putenv('OPENROUTER_API_KEY=test-key');
        putenv('OPENROUTER_BASE_URL=https://openrouter.ai/api/v1');
        $_ENV['OPENROUTER_API_KEY'] = 'test-key';
        $_ENV['OPENROUTER_BASE_URL'] = 'https://openrouter.ai/api/v1';

        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'id' => 'chatcmpl-test-1',
                'model' => 'openai/gpt-4o-mini',
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => 'The connection works.',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/openrouter/test', [
            'prompt' => 'Check if the API works.',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'OpenRouter request succeeded.')
            ->assertJsonPath('data.model', 'openai/gpt-4o-mini')
            ->assertJsonPath('data.content', 'The connection works.');

        Http::assertSent(function ($request) {
            return $request->url() === 'https://openrouter.ai/api/v1/chat/completions'
                && $request->hasHeader('Authorization', 'Bearer test-key')
                && data_get($request->data(), 'messages.0.content') === 'Check if the API works.';
        });
    }

    public function test_openrouter_test_endpoint_returns_service_error_when_key_missing(): void
    {
        putenv('OPENROUTER_API_KEY=');
        $_ENV['OPENROUTER_API_KEY'] = '';
        config(['services.openrouter.api_key' => '']);

        $response = $this->postJson('/api/v1/openrouter/test', [
            'prompt' => 'Check if the API works.',
        ]);

        $response
            ->assertStatus(503)
            ->assertJsonPath('message', 'OpenRouter request failed.');
    }
}
