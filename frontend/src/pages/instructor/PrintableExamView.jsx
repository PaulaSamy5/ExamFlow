import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Printer, ArrowLeft, Loader2, CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronUp, Info, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

const PrintableExamView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showValidation, setShowValidation] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const { data } = await api.get(`/exams/${id}`);
        setExam(data);
      } catch (err) {
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [id, navigate]);

  const handlePrint = () => {
    window.print();
  };

  // A4 dimensions
  const A4_PX   = 794;   // px at 96dpi
  const A4_W_MM = 210;   // mm
  const A4_H_MM = 297;   // mm

  const downloadPDF = async () => {
    if (!contentRef.current || disablePrint) return;
    setDownloading(true);
    const el = contentRef.current;

    // 1. Lock element to exact A4 width
    const orig = { width: el.style.width, maxWidth: el.style.maxWidth, minWidth: el.style.minWidth };
    el.style.width    = `${A4_PX}px`;
    el.style.maxWidth = `${A4_PX}px`;
    el.style.minWidth = `${A4_PX}px`;

    // 2. Wait two animation frames so the browser reflows before capture
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));

    const restore = () => {
      el.style.width    = orig.width;
      el.style.maxWidth = orig.maxWidth;
      el.style.minWidth = orig.minWidth;
    };

    try {
      const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 2 });
      restore();

      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => { img.onload = r; });

      // img.width = A4_PX * 2 (pixelRatio:2), img.height = full content height * 2
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      // Total image height in mm at A4 width
      const totalHeightMM = (img.height / img.width) * A4_W_MM;

      let offsetMM = 0;
      let page = 0;
      while (offsetMM < totalHeightMM) {
        if (page > 0) pdf.addPage();
        // Place the full image above the current viewport, shifted up by offset
        pdf.addImage(dataUrl, 'PNG', 0, -offsetMM, A4_W_MM, totalHeightMM);
        offsetMM += A4_H_MM;
        page++;
      }

      const filename = [
        exam?.examMeta?.examCategory || 'Exam',
        exam?.examMeta?.courseName || exam?.title || '',
      ].filter(Boolean).join('_').replace(/\s+/g, '_') + '.pdf';

      pdf.save(filename);
    } catch (e) {
      restore();
      console.error('PDF export error:', e);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-6">
      <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
      <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Loading Exam...</p>
    </div>
  );

  if (!exam) return null;
  const questions = exam.questions || [];
  const totalPoints = questions.reduce((sum, q) => sum + parseFloat(q.points || 0), 0);

  // Build sections from examMeta if available, otherwise treat all questions as one section
  const rawSections = (() => {
    const s = exam.examMeta?.sections;
    if (Array.isArray(s) && s.length > 0) return s;
    return null;
  })();
  const printSections = rawSections
    ? rawSections.map(sec => ({
        title: sec.title || '',
        description: sec.description || '',
        questions: questions.slice(sec.start, sec.start + sec.count),
        startIdx: sec.start,
      }))
    : [{ title: '', description: '', questions, startIdx: 0 }];
  const pointsMismatch = parseFloat(exam.totalGrade || 0) !== totalPoints;

  const validateQuestions = (qs) => {
    const errs = [];
    if (!qs || qs.length === 0) {
      errs.push("At least one question is required.");
      return errs;
    }
    qs.forEach((q, idx) => {
      const qNum = idx + 1;
      const cleanText = q.text ? q.text.replace(/<[^>]*>/g, '').trim() : '';
      if (!cleanText) {
        errs.push(`Question ${qNum}: Question text is empty.`);
      }
      const pts = parseFloat(q.points);
      if (isNaN(pts) || pts <= 0) {
        errs.push(`Question ${qNum}: Points must be greater than 0.`);
      }
      if (!q.type) {
        errs.push(`Question ${qNum}: Question type must be selected.`);
        return;
      }
      let parsedOptions = q.options;
      if (typeof q.options === 'string') {
        try { parsedOptions = JSON.parse(q.options); } catch (e) {}
      }
      if (q.type === 'MCQ') {
        const optsArray = Array.isArray(parsedOptions) ? parsedOptions : [];
        if (optsArray.length < 2) {
          errs.push(`Question ${qNum}: At least 2 options are required.`);
        }
        if (optsArray.some(opt => !opt || String(opt).trim() === '')) {
          errs.push(`Question ${qNum}: One or more options are empty.`);
        }
        const trimmedOpts = optsArray.map(o => String(o).trim().toLowerCase());
        const hasDuplicates = trimmedOpts.some((o, i) => trimmedOpts.indexOf(o) !== i);
        if (hasDuplicates) {
          errs.push(`Question ${qNum}: Duplicate options are not allowed.`);
        }
        const isMultipleMode = q.isMultiple === 1 || q.isMultiple === true;
        if (isMultipleMode) {
          let multipleAnswers = [];
          try { multipleAnswers = typeof q.correctAnswer === 'string' ? JSON.parse(q.correctAnswer) : q.correctAnswer; } catch (e) {}
          if (!Array.isArray(multipleAnswers) || multipleAnswers.length === 0) {
            errs.push(`Question ${qNum}: No correct answer selected.`);
          }
        } else {
          if (!q.correctAnswer || String(q.correctAnswer).trim() === '') {
            errs.push(`Question ${qNum}: No correct answer selected.`);
          } else if (String(q.correctAnswer).startsWith('idx:')) {
            const oIdx = parseInt(String(q.correctAnswer).split(':')[1]);
            if (isNaN(oIdx) || oIdx < 0 || oIdx >= optsArray.length) {
              errs.push(`Question ${qNum}: No correct answer selected.`);
            }
          }
        }
      } else if (q.type === 'TRUE_FALSE') {
        if (q.correctAnswer !== 'True' && q.correctAnswer !== 'False') {
          errs.push(`Question ${qNum}: Correct answer (True or False) must be selected.`);
        }
      } else if (q.type === 'FILL_BLANKS') {
        if (!q.correctAnswer || String(q.correctAnswer).trim() === '') {
          errs.push(`Question ${qNum}: Target correct word is required.`);
        }
      } else if (q.type === 'MATH') {
        const mathOpts = typeof parsedOptions === 'object' && parsedOptions !== null ? parsedOptions : {};
        if (!mathOpts.correctFinalAnswer || String(mathOpts.correctFinalAnswer).trim() === '') {
          errs.push(`Question ${qNum}: Correct final answer is required.`);
        }
      } else if (q.type === 'ESSAY') {
        if (!q.correctAnswer || String(q.correctAnswer).trim() === '') {
          errs.push(`Question ${qNum}: Model answer is required.`);
        }
      } else if (q.type === 'CODING') {
        const codingOpts = typeof parsedOptions === 'object' && parsedOptions !== null ? parsedOptions : {};
        if (!codingOpts.title || String(codingOpts.title).trim() === '') {
          errs.push(`Question ${qNum}: Coding problem title is required.`);
        }
        if (!q.correctAnswer || String(q.correctAnswer).trim() === '') {
          errs.push(`Question ${qNum}: Sample solution / model answer is required.`);
        }
      } else if (q.type === 'UML') {
        const umlOpts = typeof parsedOptions === 'object' && parsedOptions !== null ? parsedOptions : {};
        if (!umlOpts.title || String(umlOpts.title).trim() === '') {
          errs.push(`Question ${qNum}: UML scenario title is required.`);
        }
        if (!umlOpts.modelAnswerText || String(umlOpts.modelAnswerText).trim() === '') {
          errs.push(`Question ${qNum}: Model answer / expected components description is required.`);
        }
      }
    });
    return errs;
  };

  const questionErrors = validateQuestions(questions);

  const missingFieldsList = [];
  if (!exam.examMeta?.institutionName?.trim()) missingFieldsList.push("Institution Name");
  if (!exam.examMeta?.departmentName?.trim()) missingFieldsList.push("Department Name");
  if (!exam.examMeta?.courseName?.trim()) missingFieldsList.push("Course Name");
  if (!exam.examMeta?.instructorName?.trim()) missingFieldsList.push("Instructor Name");
  if (!exam.examMeta?.academicYear?.trim()) missingFieldsList.push("Academic Year");
  if (!exam.examMeta?.examDate) missingFieldsList.push("Exam Date");
  if (!exam.examMeta?.examCategory) missingFieldsList.push("Exam Category");

  const missingMetadata = missingFieldsList.length > 0;
  const disablePrint = pointsMismatch || missingMetadata || questionErrors.length > 0;

  // Helper to get letter for MCQ options
  const optionLetter = (idx) => String.fromCharCode(65 + idx);

  return (
    <>
      {/* Print Controls — hidden in print */}
      <div className="print-hide fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-8 py-3.5 flex flex-col gap-3">
        {/* Main Bar */}
        <div className="flex items-center justify-between">
          {/* Left: Back button + Title + Badges */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{exam.title}</h1>
                <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  <Printer className="h-2.5 w-2.5" />
                  Printable Exam
                </span>
              </div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Print Preview & Generation</p>
            </div>
          </div>

          {/* Center: status indicators row */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            {/* Questions Pill */}
            {questionErrors.length === 0 ? (
              <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Questions Valid
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full font-semibold">
                <XCircle className="h-3.5 w-3.5" />
                {questionErrors.length} Question Errors
              </span>
            )}

            {/* Metadata Pill */}
            {!missingMetadata ? (
              <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Metadata Complete
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-semibold">
                <AlertCircle className="h-3.5 w-3.5" />
                {missingFieldsList.length} Missing Fields
              </span>
            )}

            {/* Grade Pill */}
            {!pointsMismatch ? (
              <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Points Matched ({exam.totalGrade} pts)
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full font-semibold">
                <XCircle className="h-3.5 w-3.5" />
                Points Mismatch ({totalPoints} / {exam.totalGrade} pts)
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={downloadPDF}
              disabled={disablePrint || downloading}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/10 cursor-pointer active:scale-95"
            >
              {downloading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                : <><Download className="h-3.5 w-3.5" /> Download PDF</>
              }
            </button>
          </div>
        </div>

        {/* Validation Info Dropdown Header */}
        {(disablePrint || showValidation) && (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-550 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                <Info className="h-3.5 w-3.5" />
                {disablePrint ? "Printing is disabled until all requirements are met." : "All validation requirements are passed!"}
              </span>
              <button
                type="button"
                onClick={() => setShowValidation(!showValidation)}
                className="text-emerald-500 hover:text-emerald-400 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {showValidation ? "Hide Details" : "Show Details"}
                {showValidation ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>

            {showValidation && (
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed max-h-[200px] overflow-y-auto">
                {/* Academic Metadata list */}
                <div>
                  <h4 className="font-bold text-slate-755 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    {!missingMetadata ? "✅ Academic Metadata Complete" : "⚠️ Missing Academic Fields"}
                  </h4>
                  {missingMetadata ? (
                    <ul className="list-disc list-inside space-y-0.5 text-rose-500">
                      {missingFieldsList.map(f => (
                        <li key={f}>{f} is required</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">All required header info is successfully filled in.</p>
                  )}
                </div>

                {/* Question errors list */}
                <div>
                  <h4 className="font-bold text-slate-755 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    {questionErrors.length === 0 ? "✅ All Questions Valid" : "❌ Invalid Questions"}
                  </h4>
                  {questionErrors.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5 text-rose-500">
                      {questionErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-550">All questions conform to the required specifications.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Scrollable Preview Area */}
      <div className="fixed top-[56px] left-0 right-0 bottom-0 overflow-auto bg-[#525659] dark:bg-[#1a1a1a] pb-10 print:static print:overflow-visible print:bg-white print:top-0 print:pb-0">
      {/* flex justify-center so the A4 paper is always centred regardless of viewport width */}
      <div className="flex justify-center py-8 print:block print:py-0">

      {/* Printable Content — fixed A4 width on screen */}
      <div ref={contentRef} className="print-content w-[794px] flex-shrink-0 bg-white text-black px-[60px] py-[57px] mt-0 print:w-full print:px-[15mm] print:py-[10mm] print:shadow-none" style={{ fontFamily: "'Times New Roman', serif", boxShadow: '0 4px 32px rgba(0,0,0,0.45)' }}>
        
        {/* Academic Header */}
        <div className="border-2 border-black px-5 py-3 mb-5 text-black" style={{ borderColor: '#000000' }}>
          {/* Institution Row */}
          {(exam.examMeta?.institutionName || exam.examMeta?.logoUrl) && (
            <div className="flex items-center gap-4 mb-2 pb-2 border-b border-black">
              {exam.examMeta?.logoUrl && (
                <img src={exam.examMeta.logoUrl} className="h-12 w-12 object-contain" alt="Institution Logo" />
              )}
              <div className="text-left">
                {exam.examMeta?.institutionName && (
                  <h2 className="text-base font-bold uppercase">{exam.examMeta.institutionName}</h2>
                )}
                {exam.examMeta?.facultyName && (
                  <p className="text-xs font-semibold">{exam.examMeta.facultyName}</p>
                )}
                {exam.examMeta?.departmentName && (
                  <p className="text-xs text-gray-600">{exam.examMeta.departmentName}</p>
                )}
              </div>
            </div>
          )}

          {/* Exam Category */}
          {exam.examMeta?.examCategory && (
            <div className="text-center my-3">
              <h1 className="text-lg font-bold uppercase tracking-wider">
                {exam.examMeta.examCategory} Exam
              </h1>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border-t border-black pt-2">
            {exam.examMeta?.courseName && (
              <div><strong>Course:</strong> {exam.examMeta.courseName}</div>
            )}
            {exam.examMeta?.instructorName && (
              <div><strong>Instructor:</strong> {exam.examMeta.instructorName}</div>
            )}
            {exam.examMeta?.examDate && (
              <div><strong>Date:</strong> {new Date(exam.examMeta.examDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            )}
            <div><strong>Duration:</strong> {exam.duration} Minutes</div>
            {exam.examMeta?.academicYear && (
              <div><strong>Semester / Academic Year:</strong> {exam.examMeta.academicYear}</div>
            )}
            <div><strong>Total Grade:</strong> {exam.totalGrade} Points</div>
          </div>
        </div>

        {/* Student Info — Name and ID only */}
        <div className="mb-6 border border-gray-300 rounded-lg px-6 py-4">
          <div className="grid grid-cols-2 gap-y-4 gap-x-10">
            <div className="flex items-end gap-2">
              <span className="text-sm font-bold whitespace-nowrap">Student Name:</span>
              <div className="flex-1 border-b border-gray-400 min-h-[22px]"></div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-sm font-bold whitespace-nowrap">Student ID:</span>
              <div className="flex-1 border-b border-gray-400 min-h-[22px]"></div>
            </div>
          </div>
        </div>

        {/* Instructions — only rendered when the instructor provided them */}
        {exam.examMeta?.examInstructions?.trim() && (
          <div className="mb-10 bg-gray-50 border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-bold uppercase mb-3 tracking-wider">Instructions</h2>
            <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-line">
              {exam.examMeta.examInstructions.trim()}
            </p>
          </div>
        )}

        {/* Questions — grouped by section */}
        <div className="space-y-10">
          {printSections.map((section, secIdx) => (
            <div key={secIdx}>
              {/* Section Header — only shown when sections are defined */}
              {section.title && (
                <div className="mb-6" style={{ pageBreakAfter: 'avoid' }}>
                  <div className="flex items-baseline justify-between border-b-2 border-black pb-1 mb-1">
                    <h2 className="text-sm font-bold uppercase tracking-wider">
                      {rawSections && rawSections.length > 1 ? `Section ${secIdx + 1}: ` : ''}{section.title}
                    </h2>
                    <span className="text-xs font-semibold text-gray-500">
                      {section.questions.reduce((s, q) => s + parseFloat(q.points || 0), 0)} pts
                    </span>
                  </div>
                  {section.description && (
                    <p className="text-xs text-gray-600 italic mt-1">{section.description}</p>
                  )}
                </div>
              )}

              <div className="space-y-8">
                {section.questions.map((q, qIdx) => {
                  const globalIdx = section.startIdx + qIdx;
                  return (
                    <div key={q.id || globalIdx} className="print-question" style={{ pageBreakInside: 'avoid' }}>
                      {/* Question Header — no type label; section title is the group indicator */}
                      <div className="flex items-start gap-3 mb-4">
                        <span className="text-sm font-bold whitespace-nowrap">Q{globalIdx + 1}.</span>
                        <div className="flex-1 text-sm leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: q.text }} />
                        <span className="text-xs font-bold text-gray-500 whitespace-nowrap ml-4 border border-gray-300 rounded px-2 py-0.5">
                          {q.points} pts
                        </span>
                      </div>

                      {/* MCQ Options */}
                      {q.type === 'MCQ' && (() => {
                        let options = q.options;
                        if (typeof options === 'string') {
                          try { options = JSON.parse(options); } catch(e) { options = []; }
                        }
                        return (
                          <div className="ml-8 space-y-2.5">
                            {(options || []).map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-3">
                                <div className="h-5 w-5 rounded-full border-2 border-gray-400 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                  {optionLetter(oIdx)}
                                </div>
                                <span className="text-sm">{opt}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* True/False */}
                      {q.type === 'TRUE_FALSE' && (
                        <div className="ml-8 flex items-center gap-8">
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full border-2 border-gray-400"></div>
                            <span className="text-sm font-medium">True</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full border-2 border-gray-400"></div>
                            <span className="text-sm font-medium">False</span>
                          </div>
                        </div>
                      )}

                      {/* Fill in the Blanks */}
                      {q.type === 'FILL_BLANKS' && (
                        <div className="ml-8 mt-2">
                          <div className="border-b-2 border-gray-300 w-[60%] min-h-[30px]"></div>
                        </div>
                      )}

                      {/* Essay */}
                      {q.type === 'ESSAY' && (
                        <div className="ml-8 mt-3">
                          <div className="border border-gray-300 rounded-lg min-h-[180px] w-full relative">
                            <div className="absolute inset-0 p-4">
                              {Array.from({ length: 7 }).map((_, i) => (
                                <div key={i} className="border-b border-gray-200 h-[22px]"></div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Math */}
                      {q.type === 'MATH' && (
                        <div className="ml-8 mt-3 space-y-3">
                          <p className="text-[10px] text-gray-400 italic">Show your work below:</p>
                          <div className="border border-gray-300 rounded-lg min-h-[150px] w-full"></div>
                          <div className="flex items-end gap-2 mt-2">
                            <span className="text-sm font-bold">Final Answer:</span>
                            <div className="flex-1 border-b-2 border-gray-400 min-h-[24px] max-w-[200px]"></div>
                          </div>
                        </div>
                      )}

                      {/* Coding */}
                      {q.type === 'CODING' && (() => {
                        let codingOpts = { title: '', requiredLanguage: 'any' };
                        try {
                          const parsed = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                          codingOpts = { ...codingOpts, ...(parsed || {}) };
                        } catch(e) {}
                        return (
                          <div className="ml-8 mt-3 space-y-2">
                            {codingOpts.requiredLanguage && codingOpts.requiredLanguage !== 'any' && (
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                                Language: {codingOpts.requiredLanguage}
                              </p>
                            )}
                            <p className="text-[10px] text-gray-400 italic">Write your code below:</p>
                            {/* Lined code box */}
                            <div className="border border-gray-300 rounded w-full min-h-[220px] relative overflow-hidden">
                              {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="border-b border-gray-100 h-[22px] font-mono text-xs px-2 text-gray-300 select-none">
                                  {i + 1}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* UML / Diagram */}
                      {q.type === 'UML' && (() => {
                        let umlOpts = { diagramType: 'Use Case' };
                        try {
                          const parsed = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                          umlOpts = { ...umlOpts, ...(parsed || {}) };
                        } catch(e) {}
                        return (
                          <div className="ml-8 mt-3 space-y-2">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                              {umlOpts.diagramType} Diagram
                            </p>
                            <p className="text-[10px] text-gray-400 italic">Draw your diagram in the space below:</p>
                            <div className="border border-gray-300 rounded w-full min-h-[280px]"></div>
                          </div>
                        );
                      })()}

                      {/* Separator between questions within a section */}
                      {qIdx < section.questions.length - 1 && (
                        <div className="border-b border-dashed border-gray-200 mt-6"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-6 border-t-2 border-black text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">
            End of Examination — {questions.length} Questions — {exam.totalGrade} Total Points
          </p>
          <p className="text-[10px] text-gray-300 mt-2">
            Generated by ExamFlow Platform
          </p>
        </div>
      </div>{/* end print-content */}

      </div>{/* end inner centering wrapper */}
      </div>{/* end scrollable preview */}

      {/* Print Styles */}
      <style>{`
        @media print {
          .print-hide {
            display: none !important;
          }
          .print-content {
            margin-top: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-question {
            page-break-inside: avoid;
          }
          @page {
            margin: 15mm;
            size: A4;
          }
        }
      `}</style>
    </>
  );
};

export default PrintableExamView;
