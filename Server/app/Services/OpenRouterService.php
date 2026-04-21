<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenRouterService
{
    private const FALLBACK_MODEL = 'openai/gpt-4o-mini';

    /**
     * @throws ConnectionException
     */
    public function chat(string $prompt): array
    {
        return $this->chatWithPayload([
            'model' => $this->model(),
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt,
                ],
            ],
        ]);
    }

    /**
     * @throws ConnectionException
     */
    public function chatWithPayload(array $payload): array
    {
        $apiKey = (string) (getenv('OPENROUTER_API_KEY') ?: Config::get('services.openrouter.api_key', ''));
        $baseUrl = rtrim((string) (getenv('OPENROUTER_BASE_URL') ?: Config::get('services.openrouter.base_url', 'https://openrouter.ai/api/v1')), '/');

        if ($apiKey === '') {
            throw new RuntimeException('OPENROUTER_API_KEY is not configured.');
        }

        $payload['model'] = (string) ($payload['model'] ?? $this->model());

        $response = Http::timeout(45)
            ->retry(2, 400)
            ->withHeaders([
                'Authorization' => 'Bearer '.$apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])
            ->post($baseUrl.'/chat/completions', $payload);

        $response->throw();

        $payload = $response->json();
        $message = Arr::get($payload, 'choices.0.message.content');

        return [
            'id' => Arr::get($payload, 'id'),
            'model' => Arr::get($payload, 'model', $this->model()),
            'content' => $this->normalizeContent($message),
            'raw' => $payload,
        ];
    }

    private function model(): string
    {
        return (string) (Config::get('services.openrouter.model') ?: self::FALLBACK_MODEL);
    }

    private function normalizeContent(mixed $message): string
    {
        if (is_string($message)) {
            return $message;
        }

        if (is_array($message)) {
            $textParts = [];

            foreach ($message as $part) {
                if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                    $textParts[] = $part['text'];
                }
            }

            if (! empty($textParts)) {
                return trim(implode("\n\n", $textParts));
            }
        }

        return (string) json_encode($message, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
