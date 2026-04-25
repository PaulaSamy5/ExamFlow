const { run, query, get } = require('../../config/db');
const { detectLanguage } = require('../../utils/languageDetector');
const { 
  evaluateDiagramWithAI, 
  evaluateEssayWithAI,
  evaluateMathWithAI
} = require('../../services/aiEvaluation');

const semanticNormCache = new Map();
const semanticTokensCache = new Map();
const similarityScoreCache = new Map();

const startSubmission = async (req, res) => {
  const { examId } = req.params;
  const studentId = req.user.id;

  try {
    const examCheck = await get('SELECT startTime, endTime, GETDATE() as serverNow FROM Exams WHERE id = ?', [examId]);
    if (!examCheck) return res.status(404).json({ error: 'Assessment not found' });

    if (examCheck.startTime) {
       const start = new Date(examCheck.startTime);
       const now = new Date(examCheck.serverNow);
       if (now < start) return res.status(403).json({ error: 'This exam has not started yet.' });
    }

    if (examCheck.endTime) {
       const end = new Date(examCheck.endTime);
       const now = new Date(examCheck.serverNow);
       if (now > end) return res.status(403).json({ error: 'The access window for this exam has already closed.' });
    }

    const existing = await get('SELECT * FROM Submissions WHERE examId = ? AND studentId = ? AND status = ?', [examId, studentId, 'IN_PROGRESS']);
    if (existing) {
      return res.json(existing);
    }

    const result = await run('INSERT INTO Submissions (examId, studentId, status) VALUES (?, ?, ?)', [examId, studentId, 'IN_PROGRESS']);
    const submission = await get('SELECT * FROM Submissions WHERE id = ?', [result.lastID]);

    res.status(201).json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const saveDraft = async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body;

  try {
    const submission = await get('SELECT * FROM Submissions WHERE id = ?', [id]);
    if (!submission || submission.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Invalid submission session' });
    }

    for (const ans of answers) {
      const existingAns = await get('SELECT id FROM Answers WHERE submissionId = ? AND questionId = ?', [id, ans.questionId]);

      if (existingAns) {
        await run('UPDATE Answers SET studentAnswer = ? WHERE id = ?', [ans.studentAnswer, existingAns.id]);
      } else {
        await run('INSERT INTO Answers (submissionId, questionId, studentAnswer) VALUES (?, ?, ?)', [id, ans.questionId, ans.studentAnswer]);
      }
    }

    res.json({ status: 'Saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const submitExam = async (req, res) => {
  const { id } = req.params;

  try {
    const submission = await get('SELECT * FROM Submissions WHERE id = ?', [id]);
    if (!submission || submission.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Invalid submission session' });
    }

    const questions = await query('SELECT * FROM Questions WHERE examId = ?', [submission.examId]);
    const answers = await query('SELECT * FROM Answers WHERE submissionId = ?', [id]);
    const examSettings = await get('SELECT showResults, requireAIGradeApproval, endTime FROM Exams WHERE id = ?', [submission.examId]);
    const examReleaseMode = examSettings?.requireAIGradeApproval === 1 ? 'manual_review' : (examSettings?.showResults === 2 ? 'after_deadline' : 'immediate');

    let totalScore = 0;

    for (const q of questions) {
      const studentAns = answers.find(a => a.questionId === q.id);
      if (!studentAns) continue;

      let isCorrect = 0; 
      let earned = 0;
      let isApproved = 1;
      let testRunDetails = [];
      let aiScoreValue = null;

      if (q.type === 'MCQ' || q.type === 'TRUE_FALSE') {
        const student = studentAns.studentAnswer || '';
        const correct = q.correctAnswer || '';
        if (q.isMultiple === 1) {
          try {
            const sArr = Array.isArray(JSON.parse(student)) ? JSON.parse(student).sort() : [student];
            const cArr = Array.isArray(JSON.parse(correct)) ? JSON.parse(correct).sort() : [correct];
            isCorrect = JSON.stringify(sArr) === JSON.stringify(cArr) ? 1 : 0;
          } catch(e) { isCorrect = (student === correct) ? 1 : 0; }
        } else { isCorrect = (student === correct) ? 1 : 0; }
        earned = parseFloat((isCorrect ? q.points : 0).toFixed(2));
      } else if (q.type === 'FILL_BLANKS') {
        isCorrect = studentAns.studentAnswer.toLowerCase().trim() === (q.correctAnswer?.toLowerCase().trim()) ? 1 : 0;
        earned = parseFloat((isCorrect ? q.points : 0).toFixed(2));
      } else if (q.type === 'ESSAY') {
        const shouldUseAIForEssay = typeof q.correctAnswer === 'string' && q.correctAnswer.trim().length > 0;

        console.log("\n=== ESSAY GRADING DECISION ===");
        console.log("Question ID:", q.id);
        console.log("Final AI Eligibility:", shouldUseAIForEssay);
        console.log("Exam Release Mode:", examReleaseMode);

        if (shouldUseAIForEssay) {
          try {
            const aiResult = await evaluateEssayWithAI(
              q.text, 
              q.correctAnswer || '', 
              studentAns.studentAnswer || '', 
              q.points
            );

            const aiIsFailed = aiResult.failed === true;

            if (aiIsFailed) {
              console.warn("AI service returned failed=true, marking as ai_error");
              earned = null;
              isCorrect = 0;
              isApproved = 0;
              aiScoreValue = null;
              testRunDetails.push({ status: 'ai_error', message: 'AI evaluation failed. Awaiting manual review.', feedback: aiResult.feedback });
            } else {
              aiScoreValue = aiResult.score;
              const similarity = aiResult.details?.similarity || 0;
              isCorrect = similarity >= 80 ? 1 : 0;
              
              let finalStatus = "released";
              if (examReleaseMode === 'manual_review') {
                isApproved = 0;
                earned = 0; 
                finalStatus = "pending_review";
              } else {
                isApproved = 1;
                earned = aiScoreValue;
                finalStatus = examReleaseMode === 'after_deadline' ? "scheduled_release" : "released";
              }

              console.log("Decision Path:", { shouldUseAI: true, examReleaseMode, isApproved, earned, aiScore: aiScoreValue, status: finalStatus, similarity });
              aiResult.status = finalStatus;
              testRunDetails.push(aiResult);
            }

            console.log("=== ESSAY GRADING COMPLETE ===\n");
          } catch (e) {
            console.error("!!! ESSAY AI ERROR:", e.message);
            earned = null; isCorrect = 0; 
            isApproved = 0;
            testRunDetails.push({ error: e.message, status: 'ai_error', message: 'AI Evaluation Failed' });
          }
        } else {
          // Both explicitly disabled AND no reference answer provided
          console.log("Essay AI disabled: No model answer and AI toggle is OFF.");
          earned = 0; isCorrect = 0; isApproved = 0;
          testRunDetails.push({ status: 'manual_pending', message: 'No model answer provided. Manual grading required.' });
        }
      } else if (q.type === 'CODING') {
        let studentCode = '';
        let studentLang = 'javascript';
        try {
          const parsedAns = JSON.parse(studentAns.studentAnswer || '{}');
          studentCode = parsedAns.code || studentAns.studentAnswer || '';
          studentLang = parsedAns.language || 'javascript';
        } catch(e) { studentCode = studentAns.studentAnswer || ''; }

        let passedCases = 0;
        let testCases = [];
        let requiredLang = 'any';
        try {
           const optionsObj = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || {});
           testCases = optionsObj.testCases || [];
           requiredLang = optionsObj.requiredLanguage || 'any';
        } catch(e) {}
         
        const detectedMode = detectLanguage(studentCode);
        const reqL = (requiredLang || 'any').toString().trim().toLowerCase();
        const studentL = (studentLang || 'javascript').toString().trim().toLowerCase();
        
        const isMismatch = (reqL !== 'any') && (studentL !== reqL);
        const isSyntaxBreach = detectedMode && (detectedMode.toLowerCase() !== studentL);

        if (isMismatch) {
          isCorrect = 0; earned = 0;
          testRunDetails.push({ status: 'fail', message: `Exam Policy Violation: Required ${reqL.toUpperCase()} but used ${studentL.toUpperCase()}` });
        } else if (isSyntaxBreach) {
          isCorrect = 0; earned = 0;
          testRunDetails.push({ status: 'fail', message: `Language Mismatch: You selected ${studentL.toUpperCase()} but wrote ${detectedMode.toUpperCase()} code.` });
        } else {
          let totalCases = testCases.length;
          if (totalCases === 0) {
            isCorrect = 1; earned = q.points;
            testRunDetails.push({ status: 'pass', message: 'No test cases defined.' });
          } else {
            if (studentLang === 'javascript') {
              const vm = require('vm');
              for (let tc of testCases) {
                try {
                  let output = [];
                  const inputLines = (tc.input || "").split(/\r?\n/);
                  let lineCursor = 0;
                  const context = vm.createContext({
                    console: { log: (...args) => output.push(args.join(' ')) },
                    input: tc.input || "",
                    readline: () => lineCursor < inputLines.length ? inputLines[lineCursor++] : null
                  });
                  new vm.Script(studentCode).runInContext(context, { timeout: 1000 });
                  const actualOut = output.join('\n').trim();
                  const expectedOut = (tc.expectedOutput || '').trim();
                  const normalize = str => str.replace(/\r\n/g, '\n').split('\n').map(s=>s.trim()).filter(s=>s!=='').join('\n');
                  const isMatch = normalize(actualOut) === normalize(expectedOut);
                  if (isMatch) passedCases++;
                  testRunDetails.push({ input: tc.input, expected: tc.expectedOutput, actual: actualOut, status: isMatch ? 'pass' : 'fail' });
                } catch(e) { testRunDetails.push({ input: tc.input, expected: tc.expectedOutput, actual: `Runtime Error: ${e.message}`, status: 'fail' }); }
              }
              isCorrect = passedCases === totalCases ? 1 : 0;
              earned = Math.round(((passedCases / (totalCases || 1)) * q.points) * 100) / 100;
            } else if (studentLang === 'python') {
              const { execSync } = require('child_process');
              const fs = require('fs'), path = require('path');
              const tmpFile = path.join(process.cwd(), `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
              fs.writeFileSync(tmpFile, studentCode);
              try {
                for (let tc of testCases) {
                  try {
                    const actualOut = execSync(`python "${tmpFile}"`, { input: tc.input || "", timeout: 2000, encoding: 'utf8' }).trim();
                    const normalize = str => str.replace(/\r\n/g, '\n').split('\n').map(s=>s.trim()).filter(s=>s!=='').join('\n');
                    const isMatch = normalize(actualOut) === normalize((tc.expectedOutput || '').trim());
                    if (isMatch) passedCases++;
                    testRunDetails.push({ input: tc.input, expected: tc.expectedOutput, actual: actualOut, status: isMatch ? 'pass' : 'fail' });
                  } catch (e) { testRunDetails.push({ input: tc.input, expected: tc.expectedOutput, actual: `Error: ${e.stderr || e.message}`, status: 'fail' }); }
                }
                isCorrect = passedCases === totalCases ? 1 : 0;
                earned = Math.round(((passedCases / (totalCases || 1)) * q.points) * 100) / 100;
              } finally { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); }
            } else if (studentLang === 'cpp' || studentLang === 'cc') {
              const { execSync } = require('child_process');
              const fs = require('fs'), path = require('path');
              const base = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
              const src = path.join(process.cwd(), `${base}.cpp`), exe = path.join(process.cwd(), `${base}.exe`);
              fs.writeFileSync(src, studentCode);
              try {
                const mingw = 'C:\\msys64\\mingw64\\bin';
                const env = { ...process.env, PATH: `${mingw};${process.env.PATH}` };
                try { execSync(`"C:\\msys64\\mingw64\\bin\\g++.exe" -o "${exe}" "${src}"`, { timeout: 15000, env }); }
                catch (e) { 
                  testRunDetails.push({ status: 'fail', message: `Compilation Error: ${e.stderr || e.message}` });
                  throw new Error('compilation_failed'); 
                }
                for (let tc of testCases) {
                  try {
                    const actualOut = execSync(`"${exe}"`, { input: tc.input || "", timeout: 2000, encoding: 'utf8', env }).trim();
                    const normalize = str => str.replace(/\r\n/g, '\n').split('\n').map(s=>s.trim()).filter(s=>s!=='').join('\n');
                    const isMatch = normalize(actualOut) === normalize((tc.expectedOutput || '').trim());
                    if (isMatch) passedCases++;
                    testRunDetails.push({ input: tc.input, expected: tc.expectedOutput, actual: actualOut, status: isMatch ? 'pass' : 'fail' });
                  } catch (e) { testRunDetails.push({ input: tc.input, expected: tc.expectedOutput, actual: `Runtime Error: ${e.stderr || e.message}`, status: 'fail' }); }
                }
                isCorrect = passedCases === totalCases ? 1 : 0;
                earned = Math.round(((passedCases / (totalCases || 1)) * q.points) * 100) / 100;
              } catch (e) {
                if (e.message === 'compilation_failed') { /* error already pushed */ }
                else { testRunDetails.push({ status: 'fail', message: `Unexpected Error: ${e.message}` }); }
                isCorrect = 0; earned = 0;
              } finally { if (fs.existsSync(src)) fs.unlinkSync(src); if (fs.existsSync(exe)) fs.unlinkSync(exe); }
            } else {
              isCorrect = 0; earned = 0;
              testRunDetails.push({ status: 'manual_pending', message: `Automated testing for ${studentLang.toUpperCase()} is not available because the required compiler is missing. Reviewing manually.` });
            }
          }
        }
      } else if (q.type === 'UML') {
        let studentData = {};
        try { studentData = JSON.parse(studentAns.studentAnswer || '{}'); } catch(e) { studentData = { graph: studentAns.studentAnswer }; }

        let modelData = {};
        try { modelData = JSON.parse(q.correctAnswer || '{}'); } catch(e) { modelData = { graph: q.correctAnswer }; }

        let options = {};
        try { options = JSON.parse(q.options || '{}'); } catch(e) {}

        const useAI = options.useAI === true;
        const diagramType = options.diagramType || 'Use Case';
        
        if (useAI && examSettings?.requireAIGradeApproval === 1) {
           isApproved = 0;
        }

        let aiResult = null;
        let graphResult = null;

        // ── Graph-Based Evaluation (always runs) ──
        try {
          const studentGraph = studentData.graph || studentData;
          const modelGraph = modelData.graph || modelData;
          
          const sNodes = studentGraph.nodes || [];
          const sEdges = studentGraph.edges || [];
          const mNodes = modelGraph.nodes || [];
          const mEdges = modelGraph.edges || [];

          let matchedNodes = 0;
          let matchedEdges = 0;
          const missingNodes = [];
          const missingEdges = [];
          const matchedSNodeIds = new Set();
          const matchedSEdgeIds = new Set();

        // ── Stage 1 & 2 & 3: Normalization and Semantic Synonym Dictionary ──
        const SYNONYMS = [
          ['signup', 'sign up', 'register', 'registration', 'create account', 'new account', 'join'],
          ['signin', 'sign in', 'login', 'log in', 'authenticate', 'authentication', 'auth'],
          ['signout', 'sign out', 'logout', 'log out', 'exit', 'leave'],
          ['forget password', 'forgot password', 'reset password', 'recover password', 'password recovery'],
          ['db', 'database', 'data store', 'storage', 'data', 'repo', 'repository'],
          ['api', 'backend', 'server', 'service', 'system', 'controller'],
          ['ui', 'frontend', 'client', 'app', 'application', 'interface', 'view'],
          ['user', 'client', 'customer', 'actor', 'person', 'member', 'guest'],
          ['admin', 'administrator', 'manager', 'superuser', 'owner'],
          ['edit', 'update', 'modify', 'change', 'alter'],
          ['delete', 'remove', 'destroy', 'drop', 'clear'],
          ['create', 'add', 'insert', 'new', 'make', 'build'],
          ['view', 'read', 'see', 'show', 'display', 'get', 'fetch'],
          ['home', 'dashboard', 'index', 'main', 'landing'],
          ['settings', 'preferences', 'options', 'config', 'configuration'],
          ['payment', 'checkout', 'purchase', 'buy', 'transaction', 'billing']
        ];

        const normalizeLabel = (str) => {
          if (!str) return "";
          if (semanticNormCache.has(str)) return semanticNormCache.get(str);
          let s = str.replace(/([a-z])([A-Z])/g, '$1 $2'); // Split camelCase
          s = s.toLowerCase();
          s = s.replace(/\b(system|module|component|process|function|action|page|screen)\b/g, ''); // Remove fillers
          const result = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          semanticNormCache.set(str, result);
          return result;
        };

        const getBaseSemanticTokens = (normStr) => {
          if (semanticTokensCache.has(normStr)) return semanticTokensCache.get(normStr);
          const stripped = normStr.replace(/\s+/g, '');
          
          const getBigrams = str => {
             let bigrams = new Set();
             for (let i = 0; i < str.length - 1; i++) bigrams.add(str.substring(i, i + 2));
             return bigrams;
          };

          for (let group of SYNONYMS) {
             const matched = group.some(syn => {
                const sStrip = syn.replace(/\s+/g, '');
                // Try exact stripped match first
                if (normStr === syn || stripped === sStrip) return true;
                
                // Allow fuzzy matching for typos against the dictionary entry (e.g. regester vs register)
                const b1 = getBigrams(stripped);
                const b2 = getBigrams(sStrip);
                if (b1.size > 0 && b2.size > 0) {
                   const intersection = new Set([...b1].filter(x => b2.has(x)));
                   const dice = (2.0 * intersection.size) / (b1.size + b2.size);
                   if (dice > 0.65) return true; 
                }

                // Check if the synonym exists as a distinct whole concept within the normalized string
                const regex = new RegExp(`\\b${syn}\\b`, 'i');
                return regex.test(normStr);
             });
             if (matched) {
                semanticTokensCache.set(normStr, group[0]);
                return group[0];
             }
          }
          semanticTokensCache.set(normStr, normStr);
          return normStr;
        };

        const getSemanticSimilarity = (s1, s2) => {
          const key1 = s1 || '';
          const key2 = s2 || '';
          const cacheKey = key1 < key2 ? `${key1}|${key2}` : `${key2}|${key1}`;
          if (similarityScoreCache.has(cacheKey)) return similarityScoreCache.get(cacheKey);

          const _compute = () => {
            const n1 = normalizeLabel(s1);
            const n2 = normalizeLabel(s2);
            
            if (n1 === n2 && n1 !== '') return { score: 1.0, reason: "exact normalized match" };
            
            const sem1 = getBaseSemanticTokens(n1);
            const sem2 = getBaseSemanticTokens(n2);
            if (sem1 === sem2 && sem1 !== '') return { score: 0.95, reason: "synonym match" };

            // Fuzzy bigram match fallback (Stage 5)
            const str1 = n1.replace(/\s+/g, '');
            const str2 = n2.replace(/\s+/g, '');
            if (!str1 || !str2) return { score: 0, reason: "empty" };

            const getBigrams = str => {
              let bigrams = new Set();
              for (let i = 0; i < str.length - 1; i++) bigrams.add(str.substring(i, i + 2));
              return bigrams;
            };
            const b1 = getBigrams(str1), b2 = getBigrams(str2);
            if (b1.size === 0 || b2.size === 0) return { score: 0, reason: "too short" };
            
            const intersection = new Set([...b1].filter(x => b2.has(x)));
            const dice = (2.0 * intersection.size) / (b1.size + b2.size);
            return { score: dice, reason: "fuzzy text match" };
          };

          const result = _compute();
          similarityScoreCache.set(cacheKey, result);
          return result;
        };
        
        const semanticLog = [];
        const mToSNodeMap = new Map();

        // Stage 4: Context-Aware Node Matching
        mNodes.forEach(mNode => {
          let bestMatch = null;
          let bestScore = 0;
          let bestReason = "";

          sNodes.forEach(sNode => {
            if (matchedSNodeIds.has(sNode.id)) return;
            
            const sim = getSemanticSimilarity(sNode.label, mNode.label);
            
            // Allow nodes of slightly different types to match if semantic intent is overwhelming
            let typePenalty = 0;
            if (sNode.type !== mNode.type) {
               const sT = sNode.type; const mT = mNode.type;
               const isTextSwap = sT === 'text' || mT === 'text';
               const isNoteSwap = sT === 'note' || mT === 'note';
               const isActionSwap = ['usecase', 'activity', 'process'].includes(sT) && ['usecase', 'activity', 'process'].includes(mT);
               
               if (isTextSwap || isNoteSwap || isActionSwap) typePenalty = 0.15;
               else typePenalty = 0.4; // Heavy penalty for completely unrelated logical concepts
            }

            let score = sim.score - typePenalty;
            let reason = sim.reason;

            // Context awareness: if labels are vague but structural topology is identical, boost score
            if (score >= 0.2) {
               const mNeighbors = mEdges.filter(e => e.from === mNode.id || e.to === mNode.id).length;
               const sNeighbors = sEdges.filter(e => e.from === sNode.id || e.to === sNode.id).length;
               
               if (mNeighbors > 0 && mNeighbors === sNeighbors) {
                  score += 0.35; // Major structural boost
                  reason += (sim.score >= 0.9 ? "" : " + structural inference");
               }
            }

            if (score > bestScore) {
              bestScore = score;
              bestMatch = sNode;
              bestReason = reason;
            }
          });

          if (bestScore >= 0.65 && bestMatch) {
            matchedNodes++;
            matchedSNodeIds.add(bestMatch.id);
            mToSNodeMap.set(mNode.id, bestMatch.id);
            if (bestReason !== "exact normalized match") {
              semanticLog.push(`[${bestMatch.label || bestMatch.type}] \u2192 [${mNode.label || mNode.type}] (${Math.round(bestScore*100)}%: ${bestReason.trim()})`);
            }
          } else {
            missingNodes.push(mNode.label || mNode.type);
          }
        });

        // Stage 4: Context-Aware Edge Matching (using the resolved node mappings!)
        mEdges.forEach(mEdge => {
          const mFrom = mNodes.find(n => n.id === mEdge.from);
          const mTo = mNodes.find(n => n.id === mEdge.to);
          if (!mFrom || !mTo) return;

          const expectedSFromId = mToSNodeMap.get(mFrom.id);
          const expectedSToId = mToSNodeMap.get(mTo.id);

          const foundEdge = sEdges.find(sEdge => {
            if (matchedSEdgeIds.has(sEdge.id)) return false;
            // For some diagrams like Use Case edge type differences (e.g. association vs dir_association) can be ignored, but generally must match concept
            if (sEdge.type !== mEdge.type && !(sEdge.type.includes('association') && mEdge.type.includes('association'))) return false;

            if (expectedSFromId && expectedSToId) {
               // Primary mapping: topology matches perfectly
               if (sEdge.from === expectedSFromId && sEdge.to === expectedSToId) return true;
               // Reverse mapping allowance (if arrow direction was accidental or non-strict)
               if (sEdge.to === expectedSFromId && sEdge.from === expectedSToId) return true;
            }

            // Fallback if structural mapping failed: try string matching the connected nodes
            const sFrom = sNodes.find(n => n.id === sEdge.from);
            const sTo = sNodes.find(n => n.id === sEdge.to);
            if (!sFrom || !sTo) return false;

            const fromMatch = getSemanticSimilarity(sFrom.label, mFrom.label).score >= 0.65;
            const toMatch = getSemanticSimilarity(sTo.label, mTo.label).score >= 0.65;
            return fromMatch && toMatch;
          });

          if (foundEdge) {
            matchedEdges++;
            matchedSEdgeIds.add(foundEdge.id);
          } else {
            missingEdges.push(`${mFrom.label || mFrom.type} \u2192 ${mTo.label || mTo.type}`);
          }
        });

          const nodeWeight = 0.6;
          const edgeWeight = 0.4;
          const nScore = mNodes.length > 0 ? (matchedNodes / mNodes.length) : 1;
          const eScore = mEdges.length > 0 ? (matchedEdges / mEdges.length) : 1;
          
          const graphRatio = (nScore * nodeWeight) + (eScore * edgeWeight);

          // Identify extra elements student added that weren't in model
          const extraNodes = sNodes.filter(n => !matchedSNodeIds.has(n.id)).map(n => n.label || n.type);
          
          let graphFeedback = `Graph: ${matchedNodes}/${mNodes.length} nodes, ${matchedEdges}/${mEdges.length} connections matched.`;
          if (missingNodes.length > 0) graphFeedback += ` Missing: ${missingNodes.slice(0,3).join(', ')}${missingNodes.length > 3 ? '...' : ''}.`;
          if (semanticLog.length > 0) graphFeedback += `\n[Semantic Insights]: ${semanticLog.join(' | ')}`;
          
          graphResult = {
            ratio: graphRatio,
            matchedNodes,
            totalNodes: mNodes.length,
            matchedEdges,
            totalEdges: mEdges.length,
            missingNodes,
            missingEdges,
            extraNodes,
            feedback: graphFeedback
          };

        } catch (e) {
          console.error("UML Graph Evaluation Error:", e);
          graphResult = { ratio: 0, feedback: "Graph evaluation failed: " + e.message };
        }

        // ── AI-Based Evaluation (optional) ──
        if (useAI) {
          const studentImg = studentData.image || options.studentImage;
          const modelImg = modelData.image || options.modelImage;
          
          if (studentImg && modelImg) {
            aiResult = await evaluateDiagramWithAI(studentImg, modelImg, diagramType);
          } else {
            aiResult = { score: 0, feedback: "AI skipped: No diagram images available.", failed: true };
          }
        }

        // ── Compute Final Score ──
        if (useAI && aiResult && !aiResult.failed && graphResult) {
          // Hybrid: Blend AI (70%) + Graph (30%) for best accuracy
          const aiRatio = (aiResult.score || 0) / 100;
          const blendedRatio = (aiRatio * 0.7) + (graphResult.ratio * 0.3);
          aiScoreValue = blendedRatio * q.points;
          isCorrect = blendedRatio >= 0.95 ? 1 : 0;
          
          testRunDetails.push({
            status: 'ai_graded',
            aiScore: aiResult.score,
            graphScore: Math.round(graphResult.ratio * 100),
            blendedScore: Math.round(blendedRatio * 100),
            feedback: aiResult.feedback,
            graphFeedback: graphResult.feedback,
            missingNodes: graphResult.missingNodes || [],
            missingEdges: graphResult.missingEdges || [],
            extraNodes: graphResult.extraNodes || [],
            details: aiResult.details || {}
          });
        } else {
          // Pure graph-based (AI disabled, failed, or no images)
          const ratio = graphResult ? graphResult.ratio : 0;
          aiScoreValue = ratio * q.points;
          isCorrect = ratio >= 0.95 ? 1 : 0;

          const detail = {
            status: 'graph_graded',
            matchedNodes: graphResult?.matchedNodes || 0,
            totalNodes: graphResult?.totalNodes || 0,
            matchedEdges: graphResult?.matchedEdges || 0,
            totalEdges: graphResult?.totalEdges || 0,
            missingNodes: graphResult?.missingNodes || [],
            missingEdges: graphResult?.missingEdges || [],
            extraNodes: graphResult?.extraNodes || [],
            feedback: graphResult?.feedback || 'Graph evaluation completed.'
          };

          if (useAI && aiResult && aiResult.failed) {
            detail.aiStatus = 'failed';
            detail.aiFeedback = aiResult.feedback;
          }

          testRunDetails.push(detail);
        }

        // Apply release protection for UML
        if (examReleaseMode === 'manual_review') {
          isApproved = 0;
          earned = 0;
        } else {
           isApproved = 1;
           earned = aiScoreValue;
         }
       } else if (q.type === 'MATH') {
         let studentData = { steps: '', finalAnswer: '' };
         try { 
           studentData = JSON.parse(studentAns.studentAnswer || '{}'); 
         } catch(e) { studentData = { steps: '', finalAnswer: studentAns.studentAnswer }; }

         let options = {};
         try { options = JSON.parse(q.options || '{}'); } catch(e) {}
         
         const modelSteps = options.modelSteps || [];
         const tolerance = options.tolerance || 0.01;
         const gradingMode = options.gradingMode || 'final_answer';
         const checkpoints = options.checkpoints || [];

         try {
           const aiRes = await evaluateMathWithAI(
             q.text,
             q.correctAnswer,
             studentData.finalAnswer,
             modelSteps,
             studentData.steps,
             q.points,
             tolerance,
             gradingMode,
             checkpoints
           );

           if (!aiRes.failed) {
             earned = aiRes.score;
             isCorrect = earned >= q.points * 0.95 ? 1 : 0;
             aiScoreValue = earned;
             
             testRunDetails.push({
               status: 'math_graded',
               finalAnswerCorrect: aiRes.details.finalAnswerCorrect,
               stepQuality: aiRes.details.stepQuality,
               feedback: aiRes.feedback
             });
           } else {
             // Fallback to basic logic if AI failed
             const normalizeMath = (str) => {
               if (!str) return "";
               let s = str.toLowerCase().replace(/\s+/g, '');
               s = s.replace(/^[a-z]=/, ''); 
               return s;
             };

             const evalFinal = (student, correct) => {
               const s = normalizeMath(student);
               const c = normalizeMath(correct);
               if (s === c && s !== '') return 1.0;
               try {
                 const sNum = eval(s.replace(/[^0-9./*-+()]/g, ''));
                 const cNum = eval(c.replace(/[^0-9./*-+()]/g, ''));
                 if (!isNaN(sNum) && !isNaN(cNum)) {
                   if (Math.abs(sNum - cNum) <= tolerance) return 1.0;
                 }
               } catch(e) {}
               return 0;
             };

             const finalScoreRatio = evalFinal(studentData.finalAnswer, q.correctAnswer);
             let stepScoreRatio = finalScoreRatio > 0 ? 0.3 : 0;
             const finalRatio = (finalScoreRatio * 0.7) + stepScoreRatio;
             earned = finalRatio * q.points;
             isCorrect = finalRatio >= 0.95 ? 1 : 0;
             aiScoreValue = earned;
             
             testRunDetails.push({
               status: 'math_graded_fallback',
               finalAnswerCorrect: finalScoreRatio === 1,
               feedback: aiRes.feedback || "AI evaluation unavailable. Basic matching used."
             });
           }
         } catch(err) {
            console.error("Math evaluation error:", err);
            earned = 0;
            aiScoreValue = 0;
         }
       }
      
      earned = Math.round(earned * 100) / 100;
      let finalAiScore = aiScoreValue !== null ? Math.round(aiScoreValue * 100) / 100 : null;
      let testRunDetailsStr = JSON.stringify(testRunDetails);

      console.log(`Answer Persistence: QType=${q.type} | scoreEarned=${earned} | aiScore=${finalAiScore} | isApproved=${isApproved}`);

      await run('UPDATE Answers SET isCorrect = ?, scoreEarned = ?, aiScore = ?, testResults = ?, isAIGradeApproved = ? WHERE id = ?', 
        [isCorrect, earned, finalAiScore, testRunDetailsStr, isApproved, studentAns.id]);
      
      // Total score should only reflect visible/approved grades for the final submission snapshot
      if (isApproved === 1) {
         totalScore += earned;
      }
    }

    await run('UPDATE Submissions SET status = ?, score = ?, submittedAt = ? WHERE id = ?', ['SUBMITTED', Math.round(totalScore * 100) / 100, new Date().toISOString(), id]);
    
    // FETCH FULL RECORD FOR FRONTEND NAVIGATION
    const updated = await get(`
      SELECT s.*, e.showResults 
      FROM Submissions s 
      JOIN Exams e ON s.examId = e.id 
      WHERE s.id = ?
    `, [id]);
    
    res.json({ ...updated, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getSubmission = async (req, res) => {
  const { id } = req.params;
  try {
    const submission = await get('SELECT s.*, u.name as studentName FROM Submissions s JOIN Users u ON s.studentId = u.id WHERE s.id = ?', [id]);
    if (!submission) return res.status(404).json({ error: 'Not found' });

    submission.exam = await get('SELECT * FROM Exams WHERE id = ?', [submission.examId]);
    if (submission.exam) {
      const qResult = await query('SELECT * FROM Questions WHERE examId = ?', [submission.examId]);
      submission.exam.questions = qResult.map(q => {
        let parsedOptions = null;
        try {
          parsedOptions = q.options ? JSON.parse(q.options) : null;
        } catch(e) {
          console.error("Failed to parse options for question", q.id, e);
          parsedOptions = (typeof q.options === 'object') ? q.options : null;
        }
        if (req.user.role !== 'INSTRUCTOR' && q.type === 'CODING' && parsedOptions) {
            parsedOptions.testCases = undefined;
        }
        return {
          ...q,
          options: parsedOptions,
          ...(req.user.role !== 'INSTRUCTOR' && { correctAnswer: undefined })
        };
      });
    }
    submission.answers = await query('SELECT * FROM Answers WHERE submissionId = ?', [id]);
    
    // Visibility Logic — Exam-level release mode is the single source of truth
    if (req.user.role !== 'INSTRUCTOR') {
       const showResults = submission.exam.showResults;
       const requireApproval = submission.exam.requireAIGradeApproval;
       const examEndTime = submission.exam.endTime;
       const now = new Date();
       const endTime = examEndTime ? new Date(examEndTime) : null;

       // Determine exam-level release mode
       const releaseMode = requireApproval === 1 ? 'manual_review' : (showResults === 2 ? 'after_deadline' : 'immediate');

       if (releaseMode === 'manual_review') {
          // Hide scores for unapproved answers
          const hasPendingAI = submission.answers.some(a => a.isAIGradeApproved === 0);
          submission.scoreVisible = !hasPendingAI;
          submission.answers = submission.answers.map(a => ({
             ...a,
             scoreEarned: a.isAIGradeApproved === 0 ? null : a.scoreEarned,
             testResults: a.isAIGradeApproved === 0 ? null : a.testResults,
             status: a.isAIGradeApproved === 0 ? 'PENDING_REVIEW' : 'GRADED'
          }));
       } else if (releaseMode === 'after_deadline' && endTime && now < endTime) {
          // Hide all scores until deadline passes
          submission.scoreVisible = false;
          submission.answers = submission.answers.map(a => ({
             ...a,
             scoreEarned: null,
             testResults: null,
             status: 'SCHEDULED_RELEASE'
          }));
       } else {
          // Immediate or after_deadline (past deadline): show everything
          submission.scoreVisible = true;
          submission.answers = submission.answers.map(a => ({
             ...a,
             status: 'GRADED'
          }));
       }
    }
    
    // Compute elapsed securely on the server to prevent Database/Browser DB Date interpretation timezone jumps
    const examDate = new Date(submission.createdAt);
    // Remove local offset effect from SQL Server GETDATE() without timezones
    const localNow = new Date();
    localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset());
    const offsetExamDate = new Date(examDate);
    offsetExamDate.setMinutes(offsetExamDate.getMinutes() - offsetExamDate.getTimezoneOffset());
    
    // Wait, the simplest robust way: Just send backend's fresh Date().toISOString() and let the browser compare JS to JS.
    // Or just calculate elapsed realistically if both originated from Node.js (but createdAt originated from GETDATE()!).
    // For ultimate accuracy:
    // When startSubmission runs, it's GETDATE() in SQL.
    // Let's just pass `serverTime: new Date().toISOString()` back, 
    // BUT wait! SQL Server `GETDATE()` is local DB time. 
    submission.serverNow = (await get('SELECT GETDATE() as now')).now;

    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getStudentStats = async (req, res) => {
  const studentId = req.user.id;
  try {
    const stats = await get(`
      SELECT 
        COUNT(*) as examsTaken,
        AVG(score) as avgScore,
        MAX(score) as bestScore
      FROM Submissions 
      WHERE studentId = ? AND status = 'SUBMITTED'
    `, [studentId]);
    
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getExamSubmissions = async (req, res) => {
  const { examId } = req.params;
  try {
    const submissions = await query(`
      SELECT s.*, u.name as studentName, u.email as studentEmail
      FROM Submissions s
      JOIN Users u ON s.studentId = u.id
      WHERE s.examId = ? AND s.status = 'SUBMITTED'
      ORDER BY s.submittedAt DESC
    `, [examId]);
    
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getMySubmissions = async (req, res) => {
  const studentId = req.user.id;
  try {
    const submissions = await query(`
      SELECT s.*, e.title as examTitle, e.totalGrade as examTotalGrade, e.showResults, e.endTime, e.requireAIGradeApproval
      FROM Submissions s
      JOIN Exams e ON s.examId = e.id
      WHERE s.studentId = ? AND s.status = 'SUBMITTED'
      ORDER BY s.submittedAt DESC
    `, [studentId]);
    
    for (const s of submissions) {
       const releaseMode = s.requireAIGradeApproval === 1 ? 'manual_review' 
         : (s.showResults === 2 ? 'after_deadline' : (s.showResults === 0 ? 'hidden' : 'immediate'));

       if (releaseMode === 'manual_review') {
          const pending = await get('SELECT COUNT(*) as count FROM Answers WHERE submissionId = ? AND isAIGradeApproved = 0', [s.id]);
          if (pending && pending.count > 0) {
             s.score = null;
             s.isPending = true;
          }
       } else if (releaseMode === 'after_deadline') {
          const now = new Date();
          const endTime = s.endTime ? new Date(s.endTime) : null;
          if (endTime && now < endTime) {
             s.score = null;
             s.isPending = false;
          }
       } else if (releaseMode === 'hidden') {
          s.score = null;
          s.isPending = false;
       }
    }

    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const updateAnswerScore = async (req, res) => {
  const { submissionId, answerId } = req.params;
  const { scoreEarned } = req.body;

  try {
    await run('UPDATE Answers SET scoreEarned = ?, isAIGradeApproved = 1 WHERE id = ? AND submissionId = ?', [parseFloat(scoreEarned), answerId, submissionId]);
    
    // Recalculate total score for submission
    const allAnswers = await query('SELECT scoreEarned FROM Answers WHERE submissionId = ?', [submissionId]);
    const totalScore = parseFloat(allAnswers.reduce((acc, curr) => acc + (curr.scoreEarned || 0), 0).toFixed(2));
    
    await run('UPDATE Submissions SET score = ? WHERE id = ?', [totalScore, submissionId]);
    
    res.json({ message: 'Grade updated successfully', totalScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const approveAIGrade = async (req, res) => {
  const { submissionId, answerId } = req.params;
  const { scoreEarned } = req.body;

  try {
    if (scoreEarned !== undefined) {
      await run('UPDATE Answers SET scoreEarned = ?, isAIGradeApproved = 1 WHERE id = ? AND submissionId = ?', [parseFloat(scoreEarned), answerId, submissionId]);
    } else {
      await run('UPDATE Answers SET scoreEarned = aiScore, isAIGradeApproved = 1 WHERE id = ? AND submissionId = ?', [answerId, submissionId]);
    }
    
    // Recalculate total score
    const allAnswers = await query('SELECT scoreEarned FROM Answers WHERE submissionId = ?', [submissionId]);
    const totalScore = parseFloat(allAnswers.reduce((acc, curr) => acc + (curr.scoreEarned || 0), 0).toFixed(2));
    await run('UPDATE Submissions SET score = ? WHERE id = ?', [totalScore, submissionId]);
    
    res.json({ message: 'AI Grade Approved', totalScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { startSubmission, saveDraft, submitExam, getSubmission, getStudentStats, getExamSubmissions, getMySubmissions, updateAnswerScore, approveAIGrade };
