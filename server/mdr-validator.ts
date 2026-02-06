/**
 * MDR Data Validator & Normalizer
 * Ensures that any data sent to the frontend is consistent and safe.
 */

export interface MdrQuestion {
  id: string | number;
  questionText: string;
  questionShort?: string;
  article?: string;
  annexe?: string;
  title?: string;
  chapter?: string;
  section?: string;
  criticality: string;
  expectedEvidence?: string;
  riskIfNonCompliant?: string;
  guidanceNotes?: string;
  processId?: string | number;
  questionType?: string;
  interviewFunctions?: string[];
  applicableRoles?: string[];
  applicableProcesses?: string[];
}

export function normalizeMdrQuestion(q: any, index: number): MdrQuestion {
  // 1. Ensure ID is never empty or undefined
  let safeId = q.id;
  if (safeId === undefined || safeId === null || safeId === "") {
    const articleHash = String(q.article || q.annexe || "unknown").replace(/\s+/g, "_");
    safeId = `mdr_q_${articleHash}_${index}`;
    console.warn(`[WARNING] Question without id detected at index ${index} -> auto-generated: ${safeId}`);
  }

  // 2. Ensure all text fields are strings (never undefined/null)
  return {
    id: safeId,
    questionText: String(q.questionText ?? q.question ?? "Question sans texte"),
    questionShort: String(q.questionShort ?? q.title ?? ""),
    article: String(q.article ?? q.article_mdr ?? ""),
    annexe: String(q.annexe ?? ""),
    chapter: String(q.chapter ?? ""),
    section: String(q.section ?? ""),
    title: String(q.title ?? ""),
    criticality: String(q.criticality ?? q.criticite ?? "medium").toLowerCase(),
    expectedEvidence: String(q.expectedEvidence ?? ""),
    riskIfNonCompliant: String(q.riskIfNonCompliant ?? ""),
    guidanceNotes: String(q.guidanceNotes ?? ""),
    processId: String(q.processId ?? q.processus ?? q.process ?? "general"),
    questionType: String(q.questionType ?? ""),
    interviewFunctions: Array.isArray(q.interviewFunctions) 
      ? q.interviewFunctions 
      : (Array.isArray(q.interview_functions) 
          ? q.interview_functions 
          : (typeof q.interview_functions === "string" && q.interview_functions.startsWith("[") 
              ? JSON.parse(q.interview_functions) 
              : [])),
    economicRole: String(q.economicRole ?? (Array.isArray(q.roles_applicables) ? q.roles_applicables[0] : (q.roles && q.roles[0] ? q.roles[0] : "fabricant"))),
    applicableRoles: Array.isArray(q.applicableRoles) 
      ? q.applicableRoles 
      : (Array.isArray(q.roles_applicables) 
          ? q.roles_applicables 
          : (Array.isArray(q.roles) ? q.roles : ["fabricant"])),
    applicableProcesses: Array.isArray(q.applicableProcesses) 
      ? q.applicableProcesses 
      : (typeof q.applicableProcesses === "string" && q.applicableProcesses.startsWith("[") 
          ? JSON.parse(q.applicableProcesses) 
          : [])
  };
}

export function normalizeMdrResponse(data: any) {
  if (!data) return { questions: [], totalQuestions: 0 };
  
  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
  const normalizedQuestions = rawQuestions.map((q: any, idx: number) => normalizeMdrQuestion(q, idx));
  
  return {
    ...data,
    questions: normalizedQuestions,
    totalQuestions: normalizedQuestions.length
  };
}
