<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Smalot\PdfParser\Parser;
use Throwable;

class PdfTextExtractorService
{
    public function extractFromUpload(UploadedFile $file): string
    {
        try {
            $parser = new Parser();
            $document = $parser->parseFile($file->getRealPath());
            $text = preg_replace('/\s+/', ' ', $document->getText() ?? '');

            return trim((string) $text);
        } catch (Throwable) {
            return '';
        }
    }
}