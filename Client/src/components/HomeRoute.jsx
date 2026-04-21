import React, { useEffect, useRef } from 'react'
import { ArrowUp, Paperclip } from 'lucide-react'

export default function HomeRoute({
  resumeText,
  setResumeText,
  onAnalyze,
  onToggleUpload,
  onCloseUpload,
  onPdfChange,
  onClearPdf,
  isUploadMenuOpen,
  uploadStatus,
  pdfFile,
  isAnalyzing,
  isTextInputDisabled,
}) {
  const uploadMenuRef = useRef(null)
  const promptRef = useRef(null)
  const MAX_PROMPT_HEIGHT = 176

  useEffect(() => {
    if (!isUploadMenuOpen) return undefined

    const onDocumentPointerDown = (event) => {
      if (!uploadMenuRef.current) return
      if (!uploadMenuRef.current.contains(event.target)) {
        onCloseUpload()
      }
    }

    document.addEventListener('pointerdown', onDocumentPointerDown)
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown)
  }, [isUploadMenuOpen, onCloseUpload])

  useEffect(() => {
    if (!promptRef.current) return

    const prompt = promptRef.current
    prompt.style.height = 'auto'
    const nextHeight = Math.min(prompt.scrollHeight, MAX_PROMPT_HEIGHT)
    prompt.style.height = `${nextHeight}px`
    prompt.style.overflowY = prompt.scrollHeight > MAX_PROMPT_HEIGHT ? 'auto' : 'hidden'
  }, [resumeText])

  return (
    <section className="relative flex flex-1 flex-col items-center justify-start overflow-hidden px-4 pt-14 md:pt-16">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #eef0f1 0%, #e7eaec 52%, #c7d8dd 78%, #8caeb7 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-3xl space-y-1 text-center">
        <p className="text-2xl font-medium tracking-wide">let's find the place</p>
        <p className="text-8xl font-black leading-none tracking-tighter md:text-9xl">CLICK!</p>
        <p className="text-2xl font-medium tracking-wide">where you actually</p>

        <div className="relative mx-auto mt-12 flex w-full max-w-3xl items-center gap-2 rounded-[2rem] border border-[#1f5d63]/20 bg-white px-3 py-3 shadow-2xl shadow-[#1f5d63]/10">
          <div className="relative" ref={uploadMenuRef}>
            <button
              type="button"
              onClick={onToggleUpload}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#1f5d63]/15 bg-[#f6fafb] text-[#1f5d63] transition hover:bg-[#eaf4f6]"
              aria-label="Upload local PDF"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            {isUploadMenuOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-2xl border border-[#1f5d63]/15 bg-white p-3 text-left shadow-xl">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#1f5d63]/70">Upload PDF</p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => onPdfChange(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-[#1f5d63] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                />
                <p className="mt-2 truncate text-xs text-[#1f5d63]/60">{uploadStatus}</p>
                {pdfFile && (
                  <button
                    type="button"
                    onClick={onClearPdf}
                    className="mt-3 rounded-lg border border-[#1f5d63]/20 px-2 py-1 text-xs font-semibold text-[#1f5d63] hover:bg-[#f5fbfc]"
                  >
                    Remove PDF
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col text-left">
            <textarea
              ref={promptRef}
              rows={1}
              placeholder="Paste your resume or skills here..."
              className="max-h-44 min-h-[24px] w-full resize-none bg-transparent px-2 text-[15px] leading-6 outline-none placeholder:text-[#1f5d63]/40 disabled:cursor-not-allowed disabled:text-[#1f5d63]/45"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onAnalyze()
                }
              }}
              disabled={isTextInputDisabled}
            />
            <p className="mt-1 truncate px-2 text-xs text-[#1f5d63]/65">{uploadStatus}</p>
          </div>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1f5d63] text-white transition hover:bg-[#184b50] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Analyze"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  )
}
