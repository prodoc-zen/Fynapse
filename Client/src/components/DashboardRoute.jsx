import React from 'react'
import { Download, ExternalLink } from 'lucide-react'

function ShimmerBar({ className = '' }) {
  return <div className={`h-3 animate-pulse rounded-full bg-white/25 ${className}`} />
}

function RainbowPieChart({ jobs }) {
  const data = jobs.filter((job) => job.score > 0)
  const total = data.reduce((sum, item) => sum + item.score, 0)

  if (total <= 0) {
    return <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-xs font-bold text-[#1f5d63]">0%</div>
  }

  let cursor = 0
  const segments = data.map((item) => {
    const from = cursor
    const size = (item.score / total) * 100
    const to = from + size
    cursor = to
    return `${item.color} ${from}% ${to}%`
  })

  return (
    <div className="relative h-24 w-24 rounded-full shadow-inner">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${segments.join(',')})` }} />
      <div className="absolute inset-[22%] rounded-full bg-white" />
      <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-[#1f5d63]">{data[0]?.score ?? 0}%</div>
    </div>
  )
}

function JobLegend({ jobs }) {
  const items = jobs.filter((job) => job.score > 0).slice(0, 6)

  if (items.length === 0) {
    return <p className="text-xs text-white/75">No scored job matches yet.</p>
  }

  return (
    <div className="grid gap-1.5">
      {items.map((job) => (
        <div key={job.id} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: job.color }} />
          <span className="truncate text-white/90">{job.title}</span>
          <span className="ml-auto font-black text-white">{job.score}%</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardRoute({
  analysisSummary,
  evaluatedJobs,
  topJob,
  currentJob,
  resumeChangeSkills,
  matchedSkills,
  gapSkills,
  jobsData,
  onStartProficiencyTest,
  onGenerateUpdatedResume,
  resumeLoading,
  onDownloadResume,
  resumeDraft,
  resumeNotice,
  selectedJobId,
  onSelectJob,
  colorByRank,
  uploadStatus,
  summaryLoading,
  skillsLoading,
  hasGeneratedSummary,
  hasGeneratedSkills,
}) {
  const summaryDescription = hasGeneratedSummary ? (analysisSummary?.background_summary || '') : ''
  const hasScoredJobs = evaluatedJobs.some((job) => job.score > 0)

  return (
    <section className="flex flex-1 justify-center bg-[#e8eaec] px-3 pb-10 pt-20 md:px-6 md:pt-22">
      <div className="flex w-full max-w-6xl flex-col gap-4 dashboard-fade-in">
        <article className="rounded-[2rem] bg-gradient-to-br from-[#1f5d63] via-[#1f5d63] to-[#22756d] p-4 text-white shadow-lg ring-1 ring-white/30 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl md:p-6">
          <div className="grid items-center gap-4 md:grid-cols-[1fr_320px]">
            <div>
              <p className="text-4xl font-black uppercase tracking-wide">{analysisSummary?.applicant_name || 'JOHN DOE'}</p>
              {summaryLoading && !hasGeneratedSummary ? (
                <div className="mt-3 space-y-2">
                  <ShimmerBar className="w-[90%]" />
                  <ShimmerBar className="w-[75%]" />
                </div>
              ) : hasGeneratedSummary && summaryDescription ? (
                <p className="mt-2 text-sm text-white/85">{summaryDescription}</p>
              ) : null}
              <p className="mt-3 text-xs text-white/75">{uploadStatus}</p>
            </div>
            <div className="grid gap-3 rounded-2xl bg-white/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black tracking-wide text-white/90">JOB MATCH COLOR MAP</p>
                <RainbowPieChart jobs={evaluatedJobs.slice(0, 7)} />
              </div>
              <JobLegend jobs={evaluatedJobs} />
            </div>
          </div>
        </article>

        <article className="rounded-[2rem] bg-gradient-to-br from-[#1f5d63] via-[#1f5d63] to-[#1d6a74] p-4 text-white shadow-lg ring-1 ring-white/30 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl md:p-6">
          <div className="grid gap-4 md:grid-cols-[280px_1fr_1fr]">
            <div className="rounded-3xl bg-gradient-to-b from-[#f6f8f9] to-[#dce8e8] p-4 text-[#1f5d63] transition duration-300 hover:-translate-y-0.5 hover:shadow-xl">
              <p className="text-xs font-black tracking-[0.22em] text-[#1f5d63]/70">MATCH DETAILS</p>
              {skillsLoading && !hasGeneratedSkills ? (
                <div className="mt-3 space-y-2">
                  <div className="h-8 w-full animate-pulse rounded-lg bg-[#1f5d63]/15" />
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-[#1f5d63]/15" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-[#1f5d63]/15" />
                </div>
              ) : hasGeneratedSkills ? (
                <>
                  {hasScoredJobs ? (
                    <>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1f5d63]/65">Top Role</p>
                      <p className="text-[2rem] font-black leading-none tracking-tight md:text-[2.25rem]">{topJob?.title || 'N/A'}</p>
                      <p className="mt-4 text-sm">Compatibility: <span className="font-black">{topJob?.score || 0}%</span></p>
                      <p className="text-sm">Level: <span className="font-black">{topJob?.band || 'Novice'}</span></p>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1f5d63]/65">Top Role</p>
                      <p className="text-lg font-bold leading-tight text-[#1f5d63]/80">No suggested role yet</p>
                      <p className="mt-3 text-xs text-[#1f5d63]/70">Add clearer resume details or upload a stronger CV to get role matching.</p>
                    </>
                  )}
                </>
              ) : null}
            </div>

            <div>
              <p className="mb-3 text-2xl font-black">MATCHED SKILLS</p>
              {skillsLoading && !hasGeneratedSkills ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-white/15" />)}
                </div>
              ) : hasGeneratedSkills ? (
                <div className="space-y-2">
                  {matchedSkills.length > 0 ? matchedSkills.map((skill) => (
                  <div key={skill} className="rounded-xl bg-white/15 px-3 py-2">
                    <p className="text-sm font-bold">{skill}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {jobsData.learningResources[skill]?.youtube && (
                        <a href={jobsData.learningResources[skill].youtube} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Reference <ExternalLink className="h-3 w-3" /></a>
                      )}
                      {jobsData.learningResources[skill]?.youtube && (
                        <button type="button" onClick={() => onStartProficiencyTest(skill, jobsData.learningResources[skill].youtube)} className="rounded-md bg-white px-2 py-1 font-bold text-[#1f5d63]">Proficiency Test</button>
                      )}
                    </div>
                  </div>
                  )) : <p className="text-sm text-white/80">No matched skills identified.</p>}
                </div>
              ) : null}
            </div>

            <div>
              <p className="mb-3 text-2xl font-black">GAPS</p>
              {skillsLoading && !hasGeneratedSkills ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-white/15" />)}
                </div>
              ) : hasGeneratedSkills ? (
                <div className="space-y-2">
                  {gapSkills.length > 0 ? gapSkills.map((skill) => {
                  const resource = jobsData.learningResources[skill]
                  return (
                    <div key={skill} className="rounded-xl bg-white/15 px-3 py-2">
                      <p className="text-sm font-bold">{skill}</p>
                      {resource && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <a href={resource.youtube} target="_blank" rel="noreferrer" className="underline">{resource.title}</a>
                          <button type="button" onClick={() => onStartProficiencyTest(skill, resource.youtube)} className="rounded-md bg-white px-2 py-1 font-bold text-[#1f5d63]">Proficiency Test</button>
                        </div>
                      )}
                    </div>
                  )
                  }) : <p className="text-sm text-white/80">No skill gaps found for this role.</p>}
                </div>
              ) : null}
            </div>
          </div>
        </article>

        <section className="grid gap-4 md:grid-cols-[1fr_330px]">
          <article className="rounded-[2rem] border-4 border-[#1f5d63] bg-gradient-to-b from-white to-[#f4fbf8] p-6 shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl">
            <p className="text-center text-3xl font-black">JOB DESCRIPTION</p>
            {(summaryLoading && !hasGeneratedSummary) || (skillsLoading && !hasGeneratedSkills) ? (
              <div className="mt-5 space-y-2">
                {[1, 2, 3, 4].map((index) => <div key={index} className="h-4 animate-pulse rounded-full bg-[#1f5d63]/12" />)}
              </div>
            ) : hasGeneratedSummary && hasGeneratedSkills ? (
              <div className="mt-5 space-y-2 text-sm text-[#1f5d63]">
                <p><span className="font-black">Role:</span> {currentJob?.title || 'N/A'}</p>
                <p><span className="font-black">Company:</span> {currentJob?.company || 'N/A'}</p>
                <p><span className="font-black">Location:</span> {currentJob?.location || 'N/A'}</p>
                {summaryDescription && <p><span className="font-black">Description:</span> {summaryDescription}</p>}
                <p><span className="font-black">Verified Added Skills:</span> {resumeChangeSkills.length > 0 ? resumeChangeSkills.join(', ') : 'none yet'}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={onGenerateUpdatedResume} disabled={resumeLoading} className="rounded-lg bg-[#1f5d63] px-4 py-2 text-xs font-black text-white disabled:opacity-60">{resumeLoading ? 'Generating...' : 'Update Resume'}</button>
                  <button type="button" onClick={onDownloadResume} disabled={!resumeDraft} className="inline-flex items-center gap-1 rounded-lg bg-[#eff2f3] px-4 py-2 text-xs font-black text-[#1f5d63] disabled:opacity-60"><Download className="h-3.5 w-3.5" />Download Resume</button>
                </div>
                {resumeNotice && <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-xs">{resumeNotice}</p>}
              </div>
            ) : null}
          </article>

          <article className="rounded-[2rem] bg-gradient-to-b from-[#1f5d63] to-[#2f7f68] p-4 shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl">
            <div className="mb-3 rounded-2xl bg-gradient-to-r from-[#eceef0] to-[#dbe9e2] px-4 py-4 text-center text-2xl font-black text-[#1f5d63]">JOB LIST</div>
            {skillsLoading && !hasGeneratedSkills ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-white/25" />)}
              </div>
            ) : hasGeneratedSkills ? (
              <div className="scrollbar-none max-h-[460px] space-y-3 overflow-y-auto pr-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {evaluatedJobs.map((job, index) => {
                const active = selectedJobId === job.id
                const barColor = job.color ?? colorByRank(job.score)
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => onSelectJob(job.id)}
                    style={{ animationDelay: `${index * 45}ms` }}
                    className={`job-card-enter w-full rounded-xl bg-white px-4 py-3 text-left transition duration-300 ${active ? 'ring-4 ring-white/40 scale-[1.01] shadow-lg' : 'hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-md'}`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-black text-[#1f5d63]">{job.title}</p>
                      <span className="text-xs font-black text-[#1f5d63]">{job.score}%</span>
                    </div>
                    <p className="text-[11px] text-slate-600">{job.company} • {job.band}</p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${job.score}%`, backgroundColor: barColor }} />
                    </div>
                  </button>
                )
                })}
              </div>
            ) : null}
          </article>
        </section>
      </div>
    </section>
  )
}
