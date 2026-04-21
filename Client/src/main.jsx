import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LoaderCircle, X } from 'lucide-react'
import './index.css'
import jobsData from './data/jobs.json'
import fynapseLogo from './assets/logo_fynapse.png'
import HomeRoute from './components/HomeRoute'
import DashboardRoute from './components/DashboardRoute'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
const ALL_SKILLS = Object.keys(jobsData.learningResources)

function compatibilityBand(score) {
  if (score <= 20) return 'Novice'
  if (score <= 40) return 'Advanced Beginner'
  if (score <= 60) return 'Competent'
  if (score <= 80) return 'Proficient'
  return 'Expert'
}

function colorByRank(score) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0))
  const hue = (safeScore / 100) * 120
  return `hsl(${hue} 72% 45%)`
}

function slugify(value) {
  return String(value || 'resume').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'resume'
}

function FynapseLogo() {
  return (
    <div className="flex items-center gap-2">
      <img src={fynapseLogo} alt="Fynapse" className="h-8 w-8" />
      <span className="text-xl font-black tracking-wide text-[#1f5d63]">FYNAPSE</span>
    </div>
  )
}

function splitHighlights(text) {
  const parts = String(text || '')
    .split(/\.|;|\n/g)
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.slice(0, 4)
}

function buildResumeHtml({ name, roleLine, contact, about, education, experience, skills }) {
  const educationRows = education.map((item) => `
    <div class="item"><p class="meta">${item.meta}</p><h4>${item.title}</h4><p>${item.description}</p></div>
  `).join('')

  const experienceRows = experience.map((item) => `
    <div class="item"><p class="meta">${item.meta}</p><h4>${item.title}</h4><ul>${item.highlights.map((point) => `<li>${point}</li>`).join('')}</ul></div>
  `).join('')

  const skillRows = skills.map((skill) => `<span class="skill">${skill}</span>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${name} Resume</title><style>
body{font-family:'Inter','Segoe UI',sans-serif;background:#eef2f7;margin:0;color:#1f2937}.page{max-width:900px;margin:24px auto;background:#fff;padding:34px 40px;box-shadow:0 12px 35px rgba(15,23,42,.12)}.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #dbe3ef;padding-bottom:16px}.name-wrap h1{margin:0;font-size:36px;letter-spacing:.02em}.role{margin:4px 0 0;font-size:18px;color:#334155;font-weight:600}.contact{text-align:right;font-size:13px;color:#334155;display:grid;gap:4px}.section{padding:16px 0;border-bottom:1px solid #e4e9f1}.section:last-child{border-bottom:0;padding-bottom:0}h2{margin:0 0 10px;font-size:13px;letter-spacing:.14em;color:#0f4c75;text-transform:uppercase}p{margin:0;line-height:1.6;font-size:14px}.item{margin-bottom:14px}.item:last-child{margin-bottom:0}.meta{margin:0 0 3px;color:#64748b;font-size:12px;font-weight:600}h4{margin:0 0 6px;font-size:15px;color:#111827}ul{margin:0;padding-left:18px}li{font-size:13px;line-height:1.5;margin:4px 0}.skills{display:flex;flex-wrap:wrap;gap:8px}.skill{border:1px solid #cbd8ea;border-radius:999px;padding:5px 10px;font-size:12px;background:#f8fbff;color:#0f3d63;font-weight:600}
  </style></head><body><main class="page"><section class="top"><div class="name-wrap"><h1>${name}</h1><p class="role">${roleLine}</p></div><div class="contact"><span>${contact.email}</span><span>${contact.phone}</span><span>${contact.location}</span></div></section><section class="section"><h2>Professional Summary</h2><p>${about}</p></section><section class="section"><h2>Work Experience</h2>${experienceRows}</section><section class="section"><h2>Education</h2>${educationRows}</section><section class="section"><h2>Skills</h2><div class="skills">${skillRows}</div></section></main></body></html>`
}

function toEducationRows(education, fallbackRoleLine) {
  if (!Array.isArray(education) || education.length === 0) {
    return [{ meta: 'Education details not detected', title: fallbackRoleLine, description: 'Provide clearer profile source for richer education details.' }]
  }

  return education.slice(0, 4).map((item) => ({
    meta: [item.school, item.period].filter(Boolean).join(' | ') || 'Education',
    title: item.degree || fallbackRoleLine,
    description: item.description || 'Academic details extracted from profile.',
  }))
}

function toExperienceRows(experience, fallbackRoleLine, fallbackCompany) {
  if (!Array.isArray(experience) || experience.length === 0) {
    return [{ meta: `${fallbackCompany} | Professional Experience`, title: fallbackRoleLine, description: 'Provide complete history for better role mapping.', highlights: ['Delivered role responsibilities and collaborated with stakeholders.'] }]
  }

  return experience.slice(0, 5).map((item) => ({
    meta: [item.company, item.period].filter(Boolean).join(' | ') || fallbackCompany,
    title: item.role || fallbackRoleLine,
    description: item.description || 'Role details extracted from profile.',
    highlights: splitHighlights(item.description || 'Role details extracted from profile.').length > 0
      ? splitHighlights(item.description || 'Role details extracted from profile.')
      : ['Delivered measurable outcomes and supported team goals.'],
  }))
}

function looksLikeResumeText(value) {
  const text = String(value || '').trim().toLowerCase()
  if (text.length < 80) return false

  const hints = ['experience', 'education', 'skills', 'summary', 'work', 'project', 'profile', 'cv', 'resume']
  const hits = hints.filter((hint) => text.includes(hint)).length
  return hits >= 2
}

function FynapseApp() {
  const [view, setView] = useState('home')
  const [resumeText, setResumeText] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [userSkills, setUserSkills] = useState([])
  const [baselineSkills, setBaselineSkills] = useState([])
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [analysisSummary, setAnalysisSummary] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [nameLoading, setNameLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false)
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizError, setQuizError] = useState('')
  const [quizPayload, setQuizPayload] = useState(null)
  const [quizSkill, setQuizSkill] = useState('')
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState([])
  const [quizDraftAnswer, setQuizDraftAnswer] = useState('')
  const [quizSecondsLeft, setQuizSecondsLeft] = useState(30)
  const [quizGrading, setQuizGrading] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [quizResult, setQuizResult] = useState(null)
  const [passedSkills, setPassedSkills] = useState([])
  const [resumeDraft, setResumeDraft] = useState('')
  const [resumeNotice, setResumeNotice] = useState('')
  const [resumeLoading, setResumeLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('No file selected yet.')
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [initialLoadingMessage, setInitialLoadingMessage] = useState('Generating applicant name...')
  const [canEnterDashboard, setCanEnterDashboard] = useState(false)
  const [hasGeneratedSummary, setHasGeneratedSummary] = useState(false)
  const [hasGeneratedSkills, setHasGeneratedSkills] = useState(false)
  const [routeGuardModal, setRouteGuardModal] = useState({ open: false, title: '', message: '' })

  const QUESTION_COUNT = 20
  const PASS_PERCENT = 60

  const getQuestionTimeLimit = (question) => {
    const isMcq = Array.isArray(question?.options) && question.options.length === 4
    return isMcq ? 30 : 60
  }

  useEffect(() => {
    if (!quizPayload?.questions || quizCompleted || quizLoading) return

    if (quizSecondsLeft <= 0) {
      setQuizAnswers((previous) => {
        const next = [...previous]
        if (!next[quizIndex]) {
          const current = quizPayload.questions?.[quizIndex]
          next[quizIndex] = {
            questionType: current?.question_type || (Array.isArray(current?.options) ? 'multiple_choice' : 'essay'),
            selected: null,
            correct: false,
            aiScore: 0,
          }
        }
        return next
      })
      if (quizIndex < quizPayload.questions.length - 1) {
        const nextIndex = quizIndex + 1
        setQuizIndex(nextIndex)
        setQuizDraftAnswer('')
        setQuizSecondsLeft(getQuestionTimeLimit(quizPayload.questions[nextIndex]))
      }
      return
    }

    const timer = setTimeout(() => setQuizSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [quizPayload, quizCompleted, quizLoading, quizSecondsLeft, quizIndex])

  const appendSourceFields = (formData) => {
    const mergedResumeText = resumeText.trim()

    if (mergedResumeText) formData.append('resume_text', mergedResumeText)
    if (pdfFile) formData.append('pdf', pdfFile)
  }

  const handlePdfFileChange = (file) => {
    setIsUploadMenuOpen(false)

    if (!file) {
      setPdfFile(null)
      setUploadStatus('No file selected yet.')
      return
    }

    setPdfFile((previous) => {
      if (!previous) {
        setUploadStatus(`${file.name} attached.`)
      } else if (previous.name !== file.name || previous.size !== file.size) {
        setUploadStatus(`${file.name} attached.`)
      } else {
        setUploadStatus(`${file.name} attached.`)
      }

      return file
    })
  }

  const clearPdfFile = () => {
    setPdfFile(null)
    setUploadStatus('No file selected yet.')
  }

  const runLocalAnalyzer = () => {
    const normalized = resumeText.toLowerCase()
    const extracted = ALL_SKILLS.filter((skill) => normalized.includes(skill.toLowerCase()))
    setUserSkills(extracted)
    setBaselineSkills(extracted)
  }

  const handleAnalyze = async () => {
    setError('')
    setRouteGuardModal({ open: false, title: '', message: '' })

    if (!pdfFile && !resumeText.trim()) {
      setError('Add resume text or upload a PDF first.')
      return
    }

    if (!pdfFile && !looksLikeResumeText(resumeText)) {
      setError('Input does not look like a resume yet. Add sections like experience, skills, or education.')
      return
    }

    setIsAnalyzing(true)
    setIsInitialLoading(true)
    setInitialLoadingMessage('Generating applicant name...')
    setHasGeneratedSummary(false)
    setHasGeneratedSkills(false)
    setSelectedJobId(null)

    try {
      const formData = new FormData()
      appendSourceFields(formData)

      setNameLoading(true)
      const nameResponse = await fetch(`${API_BASE_URL}/api/v1/resume/name`, { method: 'POST', headers: { Accept: 'application/json' }, body: formData })
      const nameData = await nameResponse.json()
      if (!nameResponse.ok) throw new Error(nameData?.error ?? nameData?.message ?? 'Name extraction failed')

      const detectedName = String(nameData?.data?.applicant_name ?? '').trim()
      if (!detectedName || detectedName.toLowerCase() === 'not detected') {
        throw new Error('No name detected. Please upload a clearer resume or include your full name in the text.')
      }

      setCanEnterDashboard(true)

      setNameLoading(false)

      setAnalysisSummary((previous) => ({
        ...(previous ?? {}),
        applicant_name: detectedName,
      }))

      setIsInitialLoading(false)
      setView('dashboard')

      setInitialLoadingMessage('Generating profile summary...')
      setSummaryLoading(true)
      const summaryResponse = await fetch(`${API_BASE_URL}/api/v1/resume/summary`, { method: 'POST', headers: { Accept: 'application/json' }, body: formData })
      const summaryData = await summaryResponse.json()
      if (!summaryResponse.ok) throw new Error(summaryData?.error ?? summaryData?.message ?? 'Summary extraction failed')
      setSummaryLoading(false)

      setAnalysisSummary((previous) => ({
        ...(previous ?? {}),
        background_summary: summaryData?.data?.background_summary ?? '',
      }))
      setHasGeneratedSummary(true)

      const skillFormData = new FormData()
      appendSourceFields(skillFormData)
      setInitialLoadingMessage('Extracting skills...')
      setSkillsLoading(true)
      const skillsResponse = await fetch(`${API_BASE_URL}/api/v1/resume/skills`, { method: 'POST', headers: { Accept: 'application/json' }, body: skillFormData })
      const skillsData = await skillsResponse.json()
      setSkillsLoading(false)

      if (!skillsResponse.ok) throw new Error(skillsData?.error ?? skillsData?.message ?? 'Skill analysis failed')

      const aiSkills = Array.isArray(skillsData?.data?.skills) ? skillsData.data.skills : []
      setUserSkills(aiSkills)
      setBaselineSkills(aiSkills)
      setAnalysisSummary({
        ...(skillsData?.data?.summary ?? {}),
        applicant_name: detectedName,
        background_summary: summaryData?.data?.background_summary ?? '',
      })
      setHasGeneratedSkills(true)
    } catch (requestError) {
      setIsInitialLoading(false)
      const message = String(requestError?.message ?? '')
      const isNameFailure = message.toLowerCase().includes('no name detected') || message.toLowerCase().includes('name extraction failed')

      if (isNameFailure) {
        setCanEnterDashboard(false)
        setHasGeneratedSummary(false)
        setHasGeneratedSkills(false)
        setView('home')
        setRouteGuardModal({
          open: true,
          title: 'Name Not Detected',
          message: 'We could not find a clear full name yet. Please add a clearer resume or include your full name, then try again.',
        })
      } else {
        setError(`${requestError.message} Falling back to local analysis.`)
        runLocalAnalyzer()
        setHasGeneratedSkills(true)
      }
    } finally {
      setNameLoading(false)
      setSummaryLoading(false)
      setSkillsLoading(false)
      setIsAnalyzing(false)
    }
  }

  const evaluatedJobs = useMemo(() => {
    return jobsData.jobs
      .map((job) => {
        const matched = job.requiredSkills.filter((skill) => userSkills.includes(skill))
        const missing = job.requiredSkills.filter((skill) => !userSkills.includes(skill))
        const score = job.requiredSkills.length > 0 ? Math.round((matched.length / job.requiredSkills.length) * 100) : 0
        return { ...job, matched, missing, score, band: compatibilityBand(score) }
      })
      .sort((a, b) => b.score - a.score)
  }, [userSkills])

  useEffect(() => {
    if (view !== 'dashboard' || !hasGeneratedSkills || selectedJobId !== null || evaluatedJobs.length === 0) return
    setSelectedJobId(evaluatedJobs[0].id)
  }, [view, hasGeneratedSkills, selectedJobId, evaluatedJobs])

  const currentJob = evaluatedJobs.find((job) => job.id === selectedJobId) ?? evaluatedJobs[0] ?? null
  const topJob = evaluatedJobs[0] ?? null
  const resumeChangeSkills = passedSkills.filter((skill) => !baselineSkills.includes(skill))

  const finishQuiz = (answers, sourceSkill) => {
    const normalizedAnswers = Array.isArray(answers) ? answers : []
    const humanAnswers = normalizedAnswers.filter((item) => item?.questionType === 'multiple_choice')
    const aiAnswers = normalizedAnswers.filter((item) => item?.questionType !== 'multiple_choice')

    const correctCount = humanAnswers.filter((item) => item?.correct).length
    const total = quizPayload?.questions?.length || QUESTION_COUNT
    const humanScore = humanAnswers.length > 0 ? Math.round((correctCount / humanAnswers.length) * 100) : 0
    const aiAverage = aiAnswers.length > 0
      ? Math.round(aiAnswers.reduce((sum, item) => sum + Number(item?.aiScore || 0), 0) / aiAnswers.length)
      : 0

    const combinedPoints = normalizedAnswers.reduce((sum, item) => {
      if (item?.questionType === 'multiple_choice') return sum + (item?.correct ? 100 : 0)
      return sum + Number(item?.aiScore || 0)
    }, 0)
    const score = total > 0 ? Math.round(combinedPoints / total) : 0
    const passed = score >= PASS_PERCENT

    setQuizCompleted(true)
    setQuizResult({
      correctCount,
      total,
      score,
      passed,
      humanScore,
      aiScore: aiAverage,
      humanCount: humanAnswers.length,
      aiCount: aiAnswers.length,
    })

    if (passed && sourceSkill) {
      setPassedSkills((previous) => (previous.includes(sourceSkill) ? previous : [...previous, sourceSkill]))
      setUserSkills((previous) => (previous.includes(sourceSkill) ? previous : [...previous, sourceSkill]))
    }
  }

  const handleQuizAnswer = (option) => {
    if (!quizPayload?.questions?.[quizIndex] || quizCompleted) return

    const current = quizPayload.questions[quizIndex]
    const correct = option === current.answer

    setQuizAnswers((previous) => {
      const next = [...previous]
      next[quizIndex] = { questionType: 'multiple_choice', selected: option, correct, aiScore: correct ? 100 : 0 }
      return next
    })

    const isLast = quizIndex >= quizPayload.questions.length - 1
    if (isLast) {
      const finalAnswers = [...quizAnswers]
      finalAnswers[quizIndex] = { questionType: 'multiple_choice', selected: option, correct, aiScore: correct ? 100 : 0 }
      finishQuiz(finalAnswers, quizSkill)
      return
    }

    setTimeout(() => {
      const nextIndex = quizIndex + 1
      setQuizIndex(nextIndex)
      setQuizDraftAnswer('')
      setQuizSecondsLeft(getQuestionTimeLimit(quizPayload.questions[nextIndex]))
    }, 180)
  }

  const submitOpenEndedAnswer = async () => {
    if (!quizPayload?.questions?.[quizIndex] || quizCompleted || quizGrading) return

    const current = quizPayload.questions[quizIndex]
    const responseText = quizDraftAnswer.trim()

    if (!responseText) {
      setQuizError('Enter your answer before submitting.')
      return
    }

    setQuizError('')
    setQuizGrading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/resume/proficiency-grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          skill: quizSkill,
          question_type: current.question_type || 'essay',
          question: current.question,
          response: responseText,
          rubric: current.rubric || '',
          expected_answer: current.answer || '',
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? data?.message ?? 'AI grading failed.')

      const aiScore = Math.max(0, Math.min(100, Number(data?.data?.score ?? 0)))
      const passed = aiScore >= PASS_PERCENT

      const nextAnswers = [...quizAnswers]
      nextAnswers[quizIndex] = {
        questionType: current.question_type || 'essay',
        responseText,
        aiScore,
        correct: passed,
        feedback: String(data?.data?.feedback ?? ''),
      }
      setQuizAnswers(nextAnswers)

      const isLast = quizIndex >= quizPayload.questions.length - 1
      if (isLast) {
        finishQuiz(nextAnswers, quizSkill)
      } else {
        const nextIndex = quizIndex + 1
        setQuizIndex(nextIndex)
        setQuizDraftAnswer('')
        setQuizSecondsLeft(getQuestionTimeLimit(quizPayload.questions[nextIndex]))
      }
    } catch (requestError) {
      setQuizError(requestError.message)
    } finally {
      setQuizGrading(false)
    }
  }

  const resetQuizModal = () => {
    setQuizPayload(null)
    setQuizError('')
    setQuizSkill('')
    setQuizLoading(false)
    setQuizIndex(0)
    setQuizAnswers([])
    setQuizDraftAnswer('')
    setQuizSecondsLeft(30)
    setQuizGrading(false)
    setQuizCompleted(false)
    setQuizResult(null)
  }

  const startProficiencyTest = async (skill, youtubeUrl) => {
    setQuizError('')
    setQuizSkill(skill)
    setQuizPayload(null)
    setQuizLoading(true)
    setQuizIndex(0)
    setQuizAnswers([])
    setQuizDraftAnswer('')
    setQuizSecondsLeft(30)
    setQuizGrading(false)
    setQuizCompleted(false)
    setQuizResult(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/resume/proficiency-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          skill,
          youtube_url: youtubeUrl ?? null,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? data?.message ?? 'Failed to prepare proficiency quiz.')

      const incoming = data?.data ?? null
      if (incoming?.questions?.length) {
        incoming.questions = incoming.questions.slice(0, QUESTION_COUNT).map((question) => ({
          ...question,
          question_type: question.question_type || (Array.isArray(question.options) && question.options.length === 4 ? 'multiple_choice' : 'essay'),
        }))
        setQuizSecondsLeft(getQuestionTimeLimit(incoming.questions[0]))
      }
      setQuizPayload(incoming)
    } catch (requestError) {
      setQuizError(requestError.message)
    } finally {
      setQuizLoading(false)
    }
  }

  const generateUpdatedResume = async () => {
    if (passedSkills.length === 0) {
      setResumeNotice('Pass at least one proficiency test before generating an updated resume.')
      return
    }

    if (resumeChangeSkills.length === 0) {
      setResumeNotice('No new verified skill changes detected yet.')
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
      if (!profileData?.data?.profile) throw new Error('Profile extraction did not return profile data.')

      const profile = profileData.data.profile
      const applicantName = profile.applicant_name && profile.applicant_name !== 'Not detected' ? profile.applicant_name : (analysisSummary?.applicant_name || 'Resume Candidate')
      const roleLine = profile.title || topJob?.title || 'Professional Candidate'
      const about = `${profile.summary || analysisSummary?.background_summary || 'Professional profile.'} Newly verified skills: ${resumeChangeSkills.join(', ')}.`
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
        about,
        education,
        experience,
        skills: mergedSkills.length > 0 ? mergedSkills : ['Communication', 'Problem Solving'],
      })

      setResumeDraft(html)
      setResumeNotice('Updated resume generated. Download is now enabled.')
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

  const matchedSkills = currentJob?.matched ?? []
  const gapSkills = currentJob?.missing ?? []

  const openDashboard = () => {
    if (!canEnterDashboard) {
      setRouteGuardModal({
        open: true,
        title: 'Dashboard Locked',
        message: 'Run an analysis first. Add resume text or upload a PDF and click analyze before entering the dashboard.',
      })
      return
    }

    setView('dashboard')
  }

  return (
    <div className="relative flex min-h-[100svh] w-full flex-col bg-[#e8eaec] font-sans text-[#1f5d63]">
      <header className="absolute left-0 right-0 top-0 z-20 mx-auto flex w-full max-w-6xl items-center justify-between p-6 md:px-12">
        <FynapseLogo />
        <nav className="flex gap-6 text-sm font-bold tracking-wide">
          <button type="button" onClick={() => setView('home')} className="transition hover:text-teal-700">HOME</button>
          <button type="button" onClick={openDashboard} className="transition hover:text-teal-700">DASHBOARD</button>
        </nav>
      </header>

      {view === 'home' && (
        <HomeRoute
          resumeText={resumeText}
          setResumeText={setResumeText}
          onAnalyze={handleAnalyze}
          onToggleUpload={() => setIsUploadMenuOpen((value) => !value)}
          onCloseUpload={() => setIsUploadMenuOpen(false)}
          onPdfChange={handlePdfFileChange}
          onClearPdf={clearPdfFile}
          isUploadMenuOpen={isUploadMenuOpen}
          uploadStatus={uploadStatus}
          pdfFile={pdfFile}
          isAnalyzing={isAnalyzing}
          isTextInputDisabled={Boolean(pdfFile)}
        />
      )}

      {view === 'dashboard' && canEnterDashboard && (
        <DashboardRoute
          analysisSummary={analysisSummary}
          evaluatedJobs={evaluatedJobs.map((job) => ({ ...job, color: colorByRank(job.score) }))}
          topJob={topJob}
          currentJob={currentJob}
          resumeChangeSkills={resumeChangeSkills}
          matchedSkills={matchedSkills}
          gapSkills={gapSkills}
          jobsData={jobsData}
          onStartProficiencyTest={startProficiencyTest}
          onGenerateUpdatedResume={generateUpdatedResume}
          resumeLoading={resumeLoading}
          onDownloadResume={downloadResume}
          resumeDraft={resumeDraft}
          resumeNotice={resumeNotice}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          colorByRank={colorByRank}
          uploadStatus={uploadStatus}
          summaryLoading={summaryLoading}
          skillsLoading={skillsLoading}
          hasGeneratedSummary={hasGeneratedSummary}
          hasGeneratedSkills={hasGeneratedSkills}
        />
      )}

      {routeGuardModal.open && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-[#1f5d63]">{routeGuardModal.title}</h3>
            <p className="mt-2 text-sm text-slate-700">{routeGuardModal.message}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setRouteGuardModal({ open: false, title: '', message: '' })}
                className="rounded-xl bg-[#1f5d63] px-4 py-2 text-sm font-semibold text-white"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {isInitialLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-[#1f5d63]" />
            <p className="mt-4 text-lg font-black text-[#1f5d63]">Preparing your dashboard</p>
            <p className="mt-2 text-sm text-slate-600">{initialLoadingMessage}</p>
            <p className="mt-1 text-xs text-slate-500">Routing to the next page after name generation.</p>
          </div>
        </div>
      )}

      {(quizLoading || quizPayload || quizError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-[#f3f4f6] p-4 shadow-2xl md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#1f5d63]">Proficiency Test: {quizSkill || 'Skill'}</h3>
              <button type="button" onClick={resetQuizModal} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            {quizLoading && (
              <div className="py-8 text-center">
                <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#1f5d63]" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Preparing quiz...</p>
              </div>
            )}

            {quizError && !quizLoading && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{quizError}</p>}

            {!quizLoading && quizPayload?.questions && !quizCompleted && (
              <div className="rounded-2xl bg-white p-4 shadow-md md:p-6">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Question {quizIndex + 1} / {quizPayload.questions.length}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{quizPayload.ai_generated ? 'AI Generated' : 'Default Quiz'}</span>
                </div>

                <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-[#1f5d63] transition-all" style={{ width: `${((quizIndex + 1) / quizPayload.questions.length) * 100}%` }} />
                </div>

                <p className="mb-3 text-center text-2xl font-semibold text-orange-500">Time Left: {quizSecondsLeft}s</p>
                <p className="mb-4 text-center text-xl font-semibold text-slate-800">{quizPayload.questions[quizIndex]?.question}</p>

                {Array.isArray(quizPayload.questions[quizIndex]?.options) && quizPayload.questions[quizIndex]?.options.length === 4 ? (
                  <div className="space-y-2">
                    {quizPayload.questions[quizIndex]?.options?.map((option) => {
                      const selected = quizAnswers[quizIndex]?.selected === option
                      return (
                        <button key={option} type="button" onClick={() => handleQuizAnswer(option)} className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition ${selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>
                          {option}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {quizPayload.questions[quizIndex]?.question_type === 'code_problem' ? 'Code problem (AI graded)' : quizPayload.questions[quizIndex]?.question_type === 'short_query' ? 'Short query (AI graded)' : 'Essay response (AI graded)'}
                    </p>
                    <textarea
                      className="h-40 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none"
                      placeholder="Write your answer here..."
                      value={quizDraftAnswer}
                      onChange={(event) => setQuizDraftAnswer(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={submitOpenEndedAnswer}
                      disabled={quizGrading}
                      className="w-full rounded-xl bg-[#1f5d63] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {quizGrading ? 'Grading with AI...' : 'Submit Answer'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!quizLoading && quizPayload?.questions && quizCompleted && quizResult && (
              <div className="rounded-2xl bg-white p-5 shadow-md">
                <p className="text-center text-2xl font-black text-[#1f5d63]">Quiz Complete</p>
                <p className="mt-2 text-center text-sm text-slate-600">Source: {quizPayload.source} | {quizPayload.ai_generated ? 'AI Generated' : 'Default Quiz'} | {quizPayload.questions.length} questions</p>
                <div className="mx-auto mt-4 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-3xl font-black text-slate-800">{quizResult.score}%</p>
                  <p className="text-sm text-slate-700">MCQ (human graded): {quizResult.correctCount} / {quizResult.humanCount} ({quizResult.humanScore}%)</p>
                  <p className="text-sm text-slate-700">Open-ended (AI graded): {quizResult.aiScore}% across {quizResult.aiCount} question(s)</p>
                  <p className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${quizResult.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                    {quizResult.passed ? 'PASSED' : 'NOT PASSED'} (threshold {PASS_PERCENT}%)
                  </p>
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <button type="button" onClick={() => { setQuizIndex(0); setQuizAnswers([]); setQuizDraftAnswer(''); setQuizSecondsLeft(getQuestionTimeLimit(quizPayload?.questions?.[0])); setQuizCompleted(false); setQuizResult(null) }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Retake</button>
                  <button type="button" onClick={resetQuizModal} className="rounded-lg bg-[#1f5d63] px-4 py-2 text-sm font-semibold text-white">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .dashboard-fade-in { animation: dashboardFadeIn 520ms ease-out both; }
        .job-card-enter { animation: jobCardEnter 460ms ease both; }
        @keyframes dashboardFadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes jobCardEnter {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
      ` }} />
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FynapseApp />
  </React.StrictMode>,
)