<?php

use Illuminate\Foundation\Inspiring;
use App\Services\OpenRouterService;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('openrouter:test {prompt?}', function (OpenRouterService $openRouter): int {
    $prompt = $this->argument('prompt') ?: 'Reply with a short confirmation that the OpenRouter API connection is working.';

    try {
        $result = $openRouter->chat($prompt);
    } catch (Throwable $throwable) {
        $this->error('OpenRouter request failed: '.$throwable->getMessage());

        return self::FAILURE;
    }

    $this->info('OpenRouter API is reachable.');
    $this->line('Model: '.($result['model'] ?? 'unknown'));
    $this->newLine();
    $this->line($result['content'] ?? '[no content returned]');

    return self::SUCCESS;
})->purpose('Send a live smoke-test request to OpenRouter');
