<?php

namespace App\Http\Controllers;

use App\Services\OpenRouterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class OpenRouterController extends Controller
{
    public function __construct(private readonly OpenRouterService $openRouter)
    {
    }

    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string', 'min:5', 'max:4000'],
        ]);

        try {
            $result = $this->openRouter->chat($validated['prompt']);
        } catch (Throwable $throwable) {
            return response()->json([
                'message' => 'OpenRouter request failed.',
                'error' => $throwable->getMessage(),
            ], 503);
        }

        return response()->json([
            'message' => 'OpenRouter request succeeded.',
            'data' => [
                'id' => $result['id'],
                'model' => $result['model'],
                'content' => $result['content'],
            ],
        ]);
    }
}
