import { useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, LoaderCircle, Upload, X } from 'lucide-react'
import jobsData from './data/jobs.json'
import proficiencyQuizzes from './data/proficiency_quizzes.json'
import fynapseLogo from './assets/logo_fynapse.png'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

const ALL_SKILLS = Object.keys(jobsData.learningResources)
function compatibilityBand(score) {
  if (score >= 80) return 'Advanced'
  if (score >= 40) return 'Intermediate'
  if (score >= 20) return 'Beginner'
  return 'Novice'
}

function badgeTone(level) {
  if (level === 'Advanced') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (level === 'Intermediate') return 'bg-amber-100 text-amber-800 border-amber-200'
  if (level === 'Beginner') return 'bg-cyan-100 text-cyan-800 border-cyan-200'
  return 'bg-slate-200 text-slate-700 border-slate-300'
}

function scoreColor(score) {
  const clamped = Math.max(0, Math.min(100, score))
  const hue = Math.round((clamped / 100) * 165)
  return `hsl(${hue} 62% 45%)`
}

function PieChart({ jobs }) {
  const data = jobs.filter((job) => job.score > 0).slice(0, 5).map((job) => ({
    ...job,
    value: job.score,
    color: scoreColor(job.score),
  }))

  const total = data.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) {
    return null
  }

  let cursor = 0
  const segments = data.map((item) => {
    const from = cursor
    const size = (item.value / total) * 100
    const to = from + size
    cursor = to
    return `${item.color} ${from}% ${to}%`
  })

  const top = data[0]

  return (
    <div className="rounded-3xl bg-[#7ea1ab] p-4 text-white">
      <div className="mx-auto mb-3 h-44 w-44 rounded-full transition-all duration-700" style={{ background: `conic-gradient(${segments.join(', ')})` }}>
        <div className="m-auto flex h-full w-full scale-[0.58] items-center justify-center rounded-full bg-white text-center text-slate-700">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Most Compatible</p>
            <p className="text-sm font-bold leading-tight">{top?.title ?? 'N/A'}</p>
            <p className="text-xs">{top?.score ?? 0}%</p>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {data.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.title}</span>
            </div>
            <span className="font-semibold">{item.score}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function slugify(value) {
  return String(value || 'resume').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'resume'
}

function buildResumeHtml({ name, roleLine, contact, about, education, experience, skills }) {
  const educationRows = education.map((item) => `
    <div class="item">
      <p class="meta">${item.meta}</p>
      <h4>${item.title}</h4>
      <p>${item.description}</p>
    </div>
  `).join('')

  const experienceRows = experience.map((item) => `
    <div class="item">
      <p class="meta">${item.meta}</p>
      <h4>${item.title}</h4>
      <p>${item.description}</p>
    </div>
  `).join('')

  const skillRows = skills.map((skill) => `<li>${skill}</li>`).join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${name} Resume</title>
  <style>
    body { font-family: 'Poppins', 'Segoe UI', sans-serif; background: #f1f2f4; margin: 0; color: #2b2b33; }
    .page { max-width: 820px; margin: 30px auto; background: #f6f6f7; padding: 48px 56px; box-shadow: 0 10px 32px rgba(0,0,0,0.08); }
    h1 { margin: 0; text-align: center; letter-spacing: 2px; font-size: 48px; font-weight: 800; }
    .subtitle { margin: 4px 0 18px; text-align: center; font-size: 28px; }
    .contact { display: flex; justify-content: space-between; gap: 10px; font-size: 18px; border-bottom: 2px solid #3f3f47; padding-bottom: 12px; }
    .section { border-bottom: 2px solid #3f3f47; padding: 20px 0; }
    .section:last-child { border-bottom: 0; }
    h2 { margin: 0 0 12px; font-size: 36px; letter-spacing: 2px; }
    p { margin: 0; line-height: 1.65; font-size: 21px; }
    .item { margin-bottom: 16px; }
    .meta { color: #4c4c56; margin-bottom: 2px; }
    h4 { margin: 0 0 4px; font-size: 30px; }
    ul { columns: 2; margin: 0; padding-left: 22px; }
    li { font-size: 24px; margin: 6px 0; }
  </style>
</head>
<body>
  <main class="page">
    <h1>${name.toUpperCase()}</h1>
    <p class="subtitle">${roleLine}</p>
    <div class="contact">
      <span>${contact.phone}</span>
      <span>${contact.email}</span>
      <span>${contact.location}</span>
    </div>

    <section class="section">
      <h2>ABOUT ME</h2>
      <p>${about}</p>
    </section>

    <section class="section">
      <h2>EDUCATION</h2>
      ${educationRows}
    </section>

    <section class="section">
      <h2>WORK EXPERIENCE</h2>
      ${experienceRows}
    </section>

    <section class="section">
      <h2>SKILLS</h2>
      <ul>${skillRows}</ul>
    </section>
  </main>
</body>
</html>`
}

function toEducationRows(education, fallbackRoleLine) {
  if (!Array.isArray(education) || education.length === 0) {
    return [
      {
        meta: 'Education details not detected',
        title: fallbackRoleLine,
        description: 'Education records can be refined by providing a clearer resume PDF source.',
      },
    ]
  }

  return education.slice(0, 4).map((item) => ({
    meta: [item.school, item.period].filter(Boolean).join(' | ') || 'Education',
    title: item.degree || fallbackRoleLine,
    description: item.description || 'Academic details were extracted from the provided resume source.',
  }))
}

function toExperienceRows(experience, fallbackRoleLine, fallbackCompany) {
  if (!Array.isArray(experience) || experience.length === 0) {
    return [
      {
        meta: `${fallbackCompany} | Professional Experience`,
        title: fallbackRoleLine,
        description: 'Experience details can be enriched by providing complete resume history.',
      },
    ]
  }

  return experience.slice(0, 5).map((item) => ({
    meta: [item.company, item.period].filter(Boolean).join(' | ') || fallbackCompany,
    title: item.role || fallbackRoleLine,
    description: item.description || 'Role details extracted from the latest resume profile.',
  }))
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false)
  const [resumeText, setResumeText] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [userSkills, setUserSkills] = useState([])
  const [baselineSkills, setBaselineSkills] = useState([])
  const [selectedJobId, setSelectedJobId] = useState(jobsData.jobs[0]?.id ?? 1)
  const [skillsModel, setSkillsModel] = useState('')
  const [analysisPath, setAnalysisPath] = useState('')
  const [analysisSummary, setAnalysisSummary] = useState(null)
  const [error, setError] = useState('')
  const [analysisMode, setAnalysisMode] = useState('AI (OpenRouter)')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [nameLoading, setNameLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadPrompt, setUploadPrompt] = useState('')
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizError, setQuizError] = useState('')
  const [quizPayload, setQuizPayload] = useState(null)
  const [quizSkill, setQuizSkill] = useState('')
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState([])
  const [quizSecondsLeft, setQuizSecondsLeft] = useState(30)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [quizResult, setQuizResult] = useState(null)
  const [passedSkills, setPassedSkills] = useState([])
  const [resumeDraft, setResumeDraft] = useState('')
  const [resumeNotice, setResumeNotice] = useState('')
  const [resumeLoading, setResumeLoading] = useState(false)

  const QUESTION_COUNT = 20
  const PASS_PERCENT = 60

  useEffect(() => {
    const tick = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(tick)
  }, [])

  useEffect(() => {
    if (!quizPayload?.questions || quizCompleted || quizLoading) {
      return
    }

    if (quizSecondsLeft <= 0) {
      setQuizAnswers((previous) => {
        const next = [...previous]
        if (!next[quizIndex]) {
          next[quizIndex] = { selected: null, correct: false }
        }
        return next
      })

      if (quizIndex < quizPayload.questions.length - 1) {
        setQuizIndex((value) => value + 1)
        setQuizSecondsLeft(30)
      }

      return
    }

    const timer = setTimeout(() => setQuizSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [quizPayload, quizCompleted, quizLoading, quizSecondsLeft, quizIndex])

  const runLocalAnalyzer = () => {
    setIsAnalyzing(true)
    const normalized = resumeText.toLowerCase()
    const extracted = ALL_SKILLS.filter((skill) => normalized.includes(skill.toLowerCase()))
    setUserSkills(extracted)
    setBaselineSkills(extracted)
    setAnalysisMode('Local keyword fallback')
    setAnalysisPath('local-fallback')
    setTimeout(() => setIsAnalyzing(false), 180)
  }

  const appendSourceFields = (formData) => {
    const mergedResumeText = [
      resumeText.trim(),
      uploadPrompt.trim() ? `Additional applicant context: ${uploadPrompt.trim()}` : '',
    ].filter(Boolean).join('\n\n')

    if (mergedResumeText) {
      formData.append('resume_text', mergedResumeText)
    }

    if (pdfUrl.trim()) {
      formData.append('pdf_url', pdfUrl.trim())
    }

    if (pdfFile) {
      formData.append('pdf', pdfFile)
    }
  }

  const handleAnalyze = async () => {
    setError('')
    setIsAnalyzing(true)
    setAnalysisSummary(null)

    try {
      const formData = new FormData()
      appendSourceFields(formData)

      setNameLoading(true)

      const nameResponse = await fetch(`${API_BASE_URL}/api/v1/resume/name`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      })

      const nameData = await nameResponse.json()
      setNameLoading(false)

      if (nameResponse.ok) {
        setAnalysisSummary((previous) => ({
          ...(previous ?? {}),
          applicant_name: nameData?.data?.applicant_name ?? 'Not detected',
        }))
      }

      setSummaryLoading(true)

      const summaryResponse = await fetch(`${API_BASE_URL}/api/v1/resume/summary`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      })

      const summaryData = await summaryResponse.json()
      setSummaryLoading(false)

      if (summaryResponse.ok) {
        setAnalysisSummary((previous) => ({
          ...(previous ?? {}),
          background_summary: summaryData?.data?.background_summary ?? '',
        }))
      }

      const skillFormData = new FormData()
      appendSourceFields(skillFormData)

      setSkillsLoading(true)

      const response = await fetch(`${API_BASE_URL}/api/v1/resume/skills`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: skillFormData,
      })

      const data = await response.json()
      setSkillsLoading(false)

      if (!response.ok) {
        throw new Error(data?.error ?? data?.message ?? 'AI skill analysis failed.')
      }

      const aiSkills = Array.isArray(data?.data?.skills) ? data.data.skills : []
      setUserSkills(aiSkills)
      setBaselineSkills(aiSkills)
      setSkillsModel(data?.data?.model ?? '')
      setAnalysisPath(data?.data?.analysis_path ?? '')
      setAnalysisSummary((previous) => ({
        ...(data?.data?.summary ?? {}),
        applicant_name: previous?.applicant_name ?? data?.data?.summary?.applicant_name ?? 'Not detected',
        background_summary: previous?.background_summary ?? '',
      }))
      setAnalysisMode('AI (OpenRouter)')
    } catch (requestError) {
      setError(`${requestError.message} Falling back to local analysis.`)
      setNameLoading(false)
      setSummaryLoading(false)
      setSkillsLoading(false)
      runLocalAnalyzer()
    } finally {
      setIsAnalyzing(false)
    }
  }

  const evaluatedJobs = useMemo(() => {
    return jobsData.jobs
      .map((job) => {
        const matched = job.requiredSkills.filter((skill) => userSkills.includes(skill))
        const missing = job.requiredSkills.filter((skill) => !userSkills.includes(skill))
        const score = job.requiredSkills.length > 0
          ? Math.round((matched.length / job.requiredSkills.length) * 100)
          : 0

        return { ...job, matched, missing, score, band: compatibilityBand(score) }
      })
      .sort((a, b) => b.score - a.score)
  }, [userSkills])

  const currentJob = evaluatedJobs.find((job) => job.id === selectedJobId) ?? evaluatedJobs[0] ?? null
  const topJob = evaluatedJobs[0] ?? null
  const hasCompatibleJob = Boolean(topJob && topJob.score > 0)

  const fallbackMiniSummary = useMemo(() => {
    const source = resumeText.trim()
    if (!source) {
      return 'Upload a PDF or paste resume text to generate a short profile summary and compatibility analysis.'
    }

    const compact = source.replace(/\s+/g, ' ').trim()
    if (compact.length <= 220) return compact
    return `${compact.slice(0, 220)}...`
  }, [resumeText])

  const hasPassedQuiz = passedSkills.length > 0
  const resumeChangeSkills = passedSkills.filter((skill) => !baselineSkills.includes(skill))
  const hasEnteredDashboard = Boolean(analysisSummary || userSkills.length > 0 || isAnalyzing || skillsLoading)

  const finishQuiz = (answers, sourceSkill) => {
    const correctCount = answers.filter((item) => item?.correct).length
    const total = quizPayload?.questions?.length || QUESTION_COUNT
    const score = Math.round((correctCount / total) * 100)
    const passed = score >= PASS_PERCENT

    setQuizCompleted(true)
    setQuizResult({ correctCount, total, score, passed })

    if (passed && sourceSkill) {
      setPassedSkills((previous) => (previous.includes(sourceSkill) ? previous : [...previous, sourceSkill]))
      setUserSkills((previous) => (previous.includes(sourceSkill) ? previous : [...previous, sourceSkill]))
    }
  }

  const handleQuizAnswer = (option) => {
    if (!quizPayload?.questions?.[quizIndex] || quizCompleted) {
      return
    }

    const current = quizPayload.questions[quizIndex]
    const correct = option === current.answer

    setQuizAnswers((previous) => {
      const next = [...previous]
      next[quizIndex] = { selected: option, correct }
      return next
    })

    const isLast = quizIndex >= quizPayload.questions.length - 1

    if (isLast) {
      const finalAnswers = [...quizAnswers]
      finalAnswers[quizIndex] = { selected: option, correct }
      finishQuiz(finalAnswers, quizSkill)
      return
    }

    setTimeout(() => {
      setQuizIndex((value) => value + 1)
      setQuizSecondsLeft(30)
    }, 240)
  }

  const resetQuizModal = () => {
    setQuizPayload(null)
    setQuizError('')
    setQuizSkill('')
    setQuizLoading(false)
    setQuizIndex(0)
    setQuizAnswers([])
    setQuizSecondsLeft(30)
    setQuizCompleted(false)
    setQuizResult(null)
  }

  const generateUpdatedResume = async () => {
    if (!hasPassedQuiz) {
      setResumeNotice('Pass at least one proficiency test before generating an updated resume.')
      return
    }

    if (resumeChangeSkills.length === 0) {
      setResumeNotice('No new verified skill changes detected yet. Pass a quiz for a gap skill to update the resume.')
      return
    }

    setResumeLoading(true)
    setResumeNotice('')

    try {
      const profileFormData = new FormData()
      appendSourceFields(profileFormData)

      const profileResponse = await fetch(`${API_BASE_URL}/api/v1/resume/profile`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: profileFormData,
      })

      const profileData = await profileResponse.json()

      if (!profileData?.data?.profile) {
        throw new Error('Profile extraction did not return profile data.')
      }

      const profile = profileData.data.profile
      const applicantName = profile.applicant_name && profile.applicant_name !== 'Not detected'
        ? profile.applicant_name
        : (analysisSummary?.applicant_name && analysisSummary.applicant_name !== 'Not detected' ? analysisSummary.applicant_name : 'Resume Candidate')

      const roleLine = profile.title || topJob?.title || 'Professional Candidate'
      const aboutBase = profile.summary || analysisSummary?.background_summary || fallbackMiniSummary
      const about = `${aboutBase} Newly verified skills from proficiency tests: ${resumeChangeSkills.join(', ')}.`

      const education = toEducationRows(profile.education, roleLine)
      const experience = toExperienceRows(profile.experience, roleLine, topJob?.company || 'Company')

      const mergedSkills = Array.from(new Set([...(Array.isArray(profile.skills) ? profile.skills : []), ...userSkills, ...passedSkills])).slice(0, 14)

      const html = buildResumeHtml({
        name: applicantName,
        roleLine,
        contact: {
          phone: profile.phone || '+123-456-7890',
          email: profile.email || 'hello@reallygreatsite.com',
          location: profile.location || '123 Anywhere St., Any City',
        },
        about: String(about).replace(/\s+/g, ' ').slice(0, 520),
        education,
        experience,
        skills: mergedSkills.length > 0 ? mergedSkills : ['Communication', 'Problem Solving'],
      })

      setResumeDraft(html)
      setResumeNotice('Updated resume generated. You can now download it.')
    } catch (requestError) {
      setResumeNotice(`Resume generation failed: ${requestError.message}`)
    } finally {
      setResumeLoading(false)
    }
  }

  const downloadResume = () => {
    if (!resumeDraft) {
      setResumeNotice('Generate an updated resume first.')
      return
    }

    const applicantName = analysisSummary?.applicant_name || 'resume-candidate'
    const blob = new Blob([resumeDraft], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${slugify(applicantName)}-updated-resume.html`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const startProficiencyTest = async (skill, youtubeUrl) => {
    setQuizError('')
    setQuizSkill(skill)
    setQuizPayload(null)
    setQuizLoading(true)
    setQuizIndex(0)
    setQuizAnswers([])
    setQuizSecondsLeft(30)
    setQuizCompleted(false)
    setQuizResult(null)

    try {
      const providedQuiz = proficiencyQuizzes?.[skill]

      const response = await fetch(`${API_BASE_URL}/api/v1/resume/proficiency-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          skill,
          youtube_url: youtubeUrl ?? null,
          provided_quiz: Array.isArray(providedQuiz) && providedQuiz.length > 0 ? providedQuiz : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error ?? data?.message ?? 'Failed to prepare proficiency quiz.')
      }

      const incoming = data?.data ?? null
      if (incoming?.questions?.length) {
        incoming.questions = incoming.questions.slice(0, QUESTION_COUNT)
      }
      setQuizPayload(incoming)
    } catch (requestError) {
      setQuizError(requestError.message)
    } finally {
      setQuizLoading(false)
    }
  }

  const panelClass = 'rounded-[24px] border-[3px] border-[#2a6b73] bg-[#2a6b73] shadow-[0_10px_26px_rgba(24,84,92,0.18)] transition-all duration-500'
  const slotClass = 'rounded-[20px] bg-[#eceef0] transition-all duration-300'

  return (
    <main className="min-h-screen bg-[#e8eaec] p-3 md:p-6">
      <style>{`
        .fy-enter { opacity: 0; transform: translateY(18px) scale(0.98); }
        .fy-enter.fy-ready { opacity: 1; transform: translateY(0) scale(1); transition: all 620ms cubic-bezier(0.22,1,0.36,1); }
        .fy-pop { animation: fy-pop .42s cubic-bezier(0.22,1,0.36,1); }
        .fy-float { animation: fy-float 2.7s ease-in-out infinite; }
        @keyframes fy-pop { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1);} }
        @keyframes fy-float { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-4px);} }
      `}</style>

      <section className={`mx-auto max-w-[1260px] border-[3px] border-[#2a6b73] bg-[#e8eaec] p-4 md:p-6 fy-enter ${mounted ? 'fy-ready' : ''}`}>
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#2a6b73]">
            <img src={fynapseLogo} alt="Fynapse logo" className="h-8 w-8" />
            <p className="text-xl font-black">FYNAPSE</p>
          </div>
          <nav className="flex items-center gap-6 text-base font-black text-[#2a6b73]">
            <button type="button" className="transition hover:scale-105">HOME</button>
            <button type="button" className="transition hover:scale-105">ABOUT US</button>
          </nav>
        </header>

        {!hasEnteredDashboard && (
          <section className="fy-pop">
            <div className="rounded-[14px] bg-gradient-to-b from-[#f0f1f2] via-[#e6eaec] to-[#79a0ab] px-6 py-14 text-center">
              <p className="text-3xl font-bold text-[#2a6b73]">let's find the place</p>
              <p className="text-8xl font-black leading-none tracking-tight text-[#1f6670]">CLICK!</p>
              <p className="text-3xl font-bold text-[#2a6b73]">where you actually</p>

              <div className="mx-auto mt-12 flex w-full max-w-[760px] items-center rounded-full border-2 border-[#2a6b73] bg-[#f8f9fa] px-4 py-2 shadow-sm transition hover:shadow-md">
                <button type="button" onClick={() => setIsUploadModalOpen(true)} className="mr-3 text-3xl font-black text-[#2a6b73]">+</button>
                <input
                  value={resumeText}
                  onChange={(event) => setResumeText(event.target.value)}
                  placeholder="Paste resume text then press Enter to analyze"
                  className="w-full bg-transparent text-lg text-slate-700 outline-none placeholder:text-slate-500"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleAnalyze()
                    }
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {hasEnteredDashboard && (
          <section className="space-y-5">
            <article className={`${panelClass} fy-pop p-4 md:p-5`}>
              <div className="grid items-center gap-4 md:grid-cols-[120px_1fr_160px]">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className={`${slotClass} flex h-[120px] w-[120px] items-center justify-center text-7xl font-black text-[#2a6b73] transition hover:scale-[1.03]`}
                >
                  +
                </button>

                <div className="text-[#eff6f7]">
                  <p className="text-4xl font-black uppercase tracking-wide">{analysisSummary?.applicant_name || 'JOHN DOE'}</p>
                  <p className="mt-2 text-base opacity-90">{analysisSummary?.background_summary || 'Analyze to reveal profile summary and matching details.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white/15 px-3 py-1">Mode: {analysisMode}</span>
                    <span className="rounded-full bg-white/15 px-3 py-1">Path: {analysisPath || 'pending'}</span>
                    <span className="rounded-full bg-white/15 px-3 py-1">Model: {skillsModel || 'pending'}</span>
                  </div>
                </div>

                <div className="fy-float">
                  {evaluatedJobs.some((job) => job.score > 0) ? (
                    <PieChart jobs={evaluatedJobs} />
                  ) : (
                    <div className="flex h-[140px] items-center justify-center rounded-full bg-white text-sm font-semibold text-[#2a6b73]">No Data</div>
                  )}
                </div>
              </div>
            </article>

            <article className={`${panelClass} fy-pop p-4`}>
              <div className="grid gap-4 md:grid-cols-[320px_1fr]">
                <div className={`${slotClass} min-h-[260px] p-5 text-[#2a6b73]`}>
                  <p className="mb-2 text-lg font-black">MATCH DETAILS</p>
                  <p className="text-sm">Top Role: <span className="font-bold">{topJob?.title || 'N/A'}</span></p>
                  <p className="text-sm">Score: <span className="font-bold">{topJob?.score || 0}%</span></p>
                  <p className="text-sm">Level: <span className="font-bold">{topJob?.band || compatibilityBand(topJob?.score || 0)}</span></p>
                  {error && <p className="mt-2 rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700">{error}</p>}
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="mt-4 rounded-xl bg-[#2a6b73] px-4 py-2 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-60"
                  >
                    {isAnalyzing ? 'ANALYZING...' : 'ANALYZE'}
                  </button>
                </div>

                <div className="grid gap-4 text-white md:grid-cols-2">
                  <div>
                    <p className="mb-3 text-3xl font-black">MATCHED SKILLS</p>
                    <div className="space-y-2">
                      {(currentJob?.matched || []).length > 0 ? currentJob.matched.map((skill) => (
                        <div key={skill} className="rounded-xl bg-white/15 px-3 py-2">
                          <p className="text-base font-bold">{skill}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            {jobsData.learningResources[skill]?.youtube && (
                              <a href={jobsData.learningResources[skill].youtube} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                                Reference <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {jobsData.learningResources[skill]?.youtube && (
                              <button
                                type="button"
                                onClick={() => startProficiencyTest(skill, jobsData.learningResources[skill].youtube)}
                                className="rounded-md bg-white px-2 py-1 font-bold text-[#2a6b73]"
                              >
                                Proficiency Test
                              </button>
                            )}
                          </div>
                        </div>
                      )) : <p className="text-sm text-cyan-100">No matched skills yet.</p>}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-3xl font-black">GAPS</p>
                    <div className="space-y-2">
                      {(currentJob?.missing || []).length > 0 ? currentJob.missing.map((skill) => {
                        const resource = jobsData.learningResources[skill]
                        return (
                          <div key={skill} className="rounded-xl bg-white/15 px-3 py-2">
                            <p className="text-base font-bold">{skill}</p>
                            {resource && (
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                <a href={resource.youtube} target="_blank" rel="noreferrer" className="underline">{resource.title}</a>
                                <button
                                  type="button"
                                  onClick={() => startProficiencyTest(skill, resource.youtube)}
                                  className="rounded-md bg-white px-2 py-1 font-bold text-[#2a6b73]"
                                >
                                  Proficiency Test
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      }) : <p className="text-sm text-cyan-100">No skill gaps.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <section className="grid gap-4 md:grid-cols-[1fr_330px]">
              <article className={`${panelClass} fy-pop p-4`}>
                <div className={`${slotClass} min-h-[360px] p-6 text-[#1f1f24]`}>
                  <p className="text-center text-4xl font-black">JOB DESCRIPTION</p>
                  {currentJob ? (
                    <div className="mt-5 space-y-2 text-sm text-slate-700">
                      <p><span className="font-black">Role:</span> {currentJob.title}</p>
                      <p><span className="font-black">Company:</span> {currentJob.company}</p>
                      <p><span className="font-black">Location:</span> {currentJob.location}</p>
                      <p><span className="font-black">Compatibility:</span> {currentJob.score}%</p>
                      <p><span className="font-black">Verified Added Skills:</span> {resumeChangeSkills.length > 0 ? resumeChangeSkills.join(', ') : 'none yet'}</p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={generateUpdatedResume}
                          disabled={resumeLoading}
                          className="rounded-lg bg-[#2a6b73] px-4 py-2 text-xs font-black text-white transition hover:scale-[1.02] disabled:opacity-60"
                        >
                          {resumeLoading ? 'Generating...' : 'Update Resume'}
                        </button>
                        <button
                          type="button"
                          onClick={downloadResume}
                          disabled={!resumeDraft}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#ecf0f1] px-4 py-2 text-xs font-black text-[#2a6b73] transition hover:scale-[1.02] disabled:opacity-60"
                        >
                          <Download className="h-3.5 w-3.5" /> Download Resume
                        </button>
                      </div>
                      {resumeNotice && <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs">{resumeNotice}</p>}
                    </div>
                  ) : (
                    <p className="mt-5 text-center text-sm text-slate-600">Analyze first to populate description details.</p>
                  )}
                </div>
              </article>

              <article className={`${panelClass} fy-pop p-3`}>
                <div className="mb-3 rounded-2xl bg-[#eceef0] px-4 py-5 text-center text-3xl font-black text-[#1f1f24]">JOB LIST</div>
                <div className="space-y-3">
                  {evaluatedJobs.slice(0, 5).map((job) => {
                    const active = selectedJobId === job.id
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setSelectedJobId(job.id)}
                        className={`w-full rounded-2xl px-4 py-4 text-left transition-all duration-300 ${active ? 'bg-[#ecf0f1] shadow-md' : 'bg-[#ecf0f1]/90 hover:bg-[#ecf0f1]'}`}
                      >
                        <p className="text-sm font-black text-[#1f1f24]">{job.title}</p>
                        <p className="text-xs text-slate-600">{job.company} • {job.score}% • {job.band}</p>
                      </button>
                    )
                  })}
                </div>
              </article>
            </section>
          </section>
        )}
      </section>

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl fy-pop">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#2a6270]">Upload PDF Source</h3>
              <button type="button" onClick={() => setIsUploadModalOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">Choose PDF file</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
              className="mb-4 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#2a6270] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
            />

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">Or PDF URL</label>
            <input
              className="mb-4 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none"
              value={pdfUrl}
              onChange={(event) => setPdfUrl(event.target.value)}
              placeholder="https://example.com/resume.pdf"
            />

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">Upload prompt/context (optional)</label>
            <textarea
              className="h-24 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none"
              value={uploadPrompt}
              onChange={(event) => setUploadPrompt(event.target.value)}
              placeholder="Add context to help extraction, e.g. focus on technical experience and project impact."
            />

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setIsUploadModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                Close
              </button>
              <button type="button" onClick={() => setIsUploadModalOpen(false)} className="rounded-xl bg-[#2a6270] px-4 py-2 text-sm font-semibold text-white">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {(quizLoading || quizPayload || quizError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-[#f3f4f6] p-4 shadow-2xl md:p-6 fy-pop">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#2a6270]">Proficiency Test: {quizSkill || 'Skill'}</h3>
              <button
                type="button"
                onClick={resetQuizModal}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {quizLoading && (
              <div className="py-8 text-center">
                <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#2a6270]" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Preparing quiz from video captions...</p>
              </div>
            )}

            {quizError && !quizLoading && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{quizError}</p>
            )}

            {!quizLoading && quizPayload?.questions && !quizCompleted && (
              <div className="rounded-2xl bg-white p-4 shadow-md md:p-6">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Question {quizIndex + 1} / {quizPayload.questions.length}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{quizPayload.ai_generated ? 'AI Generated' : 'Default Quiz'}</span>
                </div>

                <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-[#2a6270] transition-all" style={{ width: `${((quizIndex + 1) / quizPayload.questions.length) * 100}%` }} />
                </div>

                <p className="mb-3 text-center text-2xl font-semibold text-orange-500">Time Left: {quizSecondsLeft}s</p>
                <p className="mb-4 text-center text-xl font-semibold text-slate-800">{quizPayload.questions[quizIndex]?.question}</p>

                <div className="space-y-2">
                  {quizPayload.questions[quizIndex]?.options?.map((option) => {
                    const selected = quizAnswers[quizIndex]?.selected === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleQuizAnswer(option)}
                        className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition ${selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {!quizLoading && quizPayload?.questions && quizCompleted && quizResult && (
              <div className="rounded-2xl bg-white p-5 shadow-md">
                <p className="text-center text-2xl font-black text-[#2a6270]">Quiz Complete</p>
                <p className="mt-2 text-center text-sm text-slate-600">Source: {quizPayload.source} | {quizPayload.ai_generated ? 'AI Generated' : 'Default Quiz'} | {quizPayload.questions.length} questions</p>
                <div className="mx-auto mt-4 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-3xl font-black text-slate-800">{quizResult.score}%</p>
                  <p className="text-sm text-slate-700">Correct: {quizResult.correctCount} / {quizResult.total}</p>
                  <p className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${quizResult.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                    {quizResult.passed ? 'PASSED' : 'NOT PASSED'} (threshold {PASS_PERCENT}%)
                  </p>
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuizIndex(0)
                      setQuizAnswers([])
                      setQuizSecondsLeft(30)
                      setQuizCompleted(false)
                      setQuizResult(null)
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={resetQuizModal}
                    className="rounded-lg bg-[#2a6270] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
