<?php

use App\Http\Controllers\IntelligenceExtractionController;
use App\Http\Controllers\OpenRouterController;
use App\Http\Controllers\ResumeMakerController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/intelligence')->group(function (): void {
    Route::post('/extract', [IntelligenceExtractionController::class, 'extract']);
});

Route::prefix('v1/openrouter')->group(function (): void {
    Route::post('/test', [OpenRouterController::class, 'test']);
});

Route::prefix('v1/resume')->group(function (): void {
    Route::post('/make', [ResumeMakerController::class, 'make']);
    Route::post('/profile', [ResumeMakerController::class, 'profile']);
    Route::post('/name', [ResumeMakerController::class, 'name']);
    Route::post('/summary', [ResumeMakerController::class, 'summary']);
    Route::post('/skills', [ResumeMakerController::class, 'skills']);
    Route::post('/proficiency-quiz', [ResumeMakerController::class, 'proficiencyQuiz']);
    Route::post('/proficiency-grade', [ResumeMakerController::class, 'proficiencyGrade']);
});
