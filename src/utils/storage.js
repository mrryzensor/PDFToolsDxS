// LocalStorage Persistence Layer for DocuCraft Extended Suite
// Handles Certificates, Learning Sessions, Rubrics, Student Submissions, and Gemini API Keys

const STORAGE_KEYS = {
  CERT_TEMPLATES: 'docucraft_cert_templates_v1',
  CERT_EMISSIONS: 'docucraft_cert_emissions_v1',
  LEARNING_SESSIONS: 'docucraft_learning_sessions_v1',
  RUBRICS: 'docucraft_rubrics_v1',
  EXAM_SUBMISSIONS: 'docucraft_exam_submissions_v1',
  GEMINI_KEYS: 'docucraft_gemini_keys_v1',
  GEMINI_ACTIVE_MODEL: 'docucraft_gemini_active_model_v1',
};

// Safe JSON parser with fallback
function safeGet(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Error saving ${key} to localStorage:`, err);
    return false;
  }
}

// ----------------- CERTIFICATES -----------------

export const getCertTemplates = () => safeGet(STORAGE_KEYS.CERT_TEMPLATES, []);

export const saveCertTemplate = (template) => {
  const templates = getCertTemplates();
  const existingIdx = templates.findIndex((t) => t.id === template.id);
  if (existingIdx >= 0) {
    templates[existingIdx] = { ...templates[existingIdx], ...template, updatedAt: new Date().toISOString() };
  } else {
    templates.unshift({
      ...template,
      id: template.id || `template_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  safeSet(STORAGE_KEYS.CERT_TEMPLATES, templates);
  return template;
};

export const deleteCertTemplate = (id) => {
  const templates = getCertTemplates().filter((t) => t.id !== id);
  safeSet(STORAGE_KEYS.CERT_TEMPLATES, templates);
  return true;
};

// Emitted Certificates (Records of students)
export const getCertEmissions = () => safeGet(STORAGE_KEYS.CERT_EMISSIONS, []);

export const findEmissionByEmailOrPhone = (courseId, email, phone) => {
  const emissions = getCertEmissions();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = (phone || '').replace(/\D/g, '');

  return emissions.find((em) => {
    if (em.courseId !== courseId) return false;
    const emEmail = (em.recipientEmail || '').trim().toLowerCase();
    const emPhone = (em.recipientPhone || '').replace(/\D/g, '');
    if (cleanEmail && emEmail && emEmail === cleanEmail) return true;
    if (cleanPhone && emPhone && emPhone === cleanPhone) return true;
    return false;
  });
};

export const findEmissionByCode = (certCode) => {
  const emissions = getCertEmissions();
  const clean = (certCode || '').trim().toUpperCase();
  return emissions.find((em) => (em.code || '').toUpperCase() === clean);
};

export const saveCertEmission = (record) => {
  const emissions = getCertEmissions();
  const existingIdx = emissions.findIndex(
    (em) => em.id === record.id || (record.code && em.code === record.code)
  );

  if (existingIdx >= 0) {
    emissions[existingIdx] = {
      ...emissions[existingIdx],
      ...record,
      updatedAt: new Date().toISOString(),
      editCount: (emissions[existingIdx].editCount || 0) + 1,
    };
    safeSet(STORAGE_KEYS.CERT_EMISSIONS, emissions);
    return { record: emissions[existingIdx], isUpdate: true };
  } else {
    const newRecord = {
      ...record,
      id: record.id || `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      code: record.code || generateCertCode(record.courseTitle),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editCount: 0,
    };
    emissions.unshift(newRecord);
    safeSet(STORAGE_KEYS.CERT_EMISSIONS, emissions);
    return { record: newRecord, isUpdate: false };
  }
};

export const deleteCertEmission = (id) => {
  const emissions = getCertEmissions().filter((em) => em.id !== id);
  safeSet(STORAGE_KEYS.CERT_EMISSIONS, emissions);
  return true;
};

export function generateCertCode(coursePrefix = 'CERT') {
  const cleanPrefix = (coursePrefix || 'CERT')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 4) || 'CERT';
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${cleanPrefix}-${year}-${randomPart}`;
}

// ----------------- LEARNING SESSIONS -----------------

export const getLearningSessions = () => safeGet(STORAGE_KEYS.LEARNING_SESSIONS, []);

export const saveLearningSession = (session) => {
  const sessions = getLearningSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], ...session, updatedAt: new Date().toISOString() };
  } else {
    sessions.unshift({
      ...session,
      id: session.id || `session_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  safeSet(STORAGE_KEYS.LEARNING_SESSIONS, sessions);
  return session;
};

export const deleteLearningSession = (id) => {
  const sessions = getLearningSessions().filter((s) => s.id !== id);
  safeSet(STORAGE_KEYS.LEARNING_SESSIONS, sessions);
  return true;
};

// ----------------- RUBRICS & EVALUATIONS -----------------

export const getRubrics = () => safeGet(STORAGE_KEYS.RUBRICS, []);

export const saveRubric = (rubric) => {
  const rubrics = getRubrics();
  const idx = rubrics.findIndex((r) => r.id === rubric.id);
  if (idx >= 0) {
    rubrics[idx] = { ...rubrics[idx], ...rubric, updatedAt: new Date().toISOString() };
  } else {
    rubrics.unshift({
      ...rubric,
      id: rubric.id || `rubric_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  safeSet(STORAGE_KEYS.RUBRICS, rubrics);
  return rubric;
};

export const deleteRubric = (id) => {
  const rubrics = getRubrics().filter((r) => r.id !== id);
  safeSet(STORAGE_KEYS.RUBRICS, rubrics);
  return true;
};

// Student exam submissions
export const getExamSubmissions = () => safeGet(STORAGE_KEYS.EXAM_SUBMISSIONS, []);

export const saveExamSubmission = (submission) => {
  const submissions = getExamSubmissions();
  const newSubmission = {
    ...submission,
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    submittedAt: new Date().toISOString(),
  };
  submissions.unshift(newSubmission);
  safeSet(STORAGE_KEYS.EXAM_SUBMISSIONS, submissions);
  return newSubmission;
};

// ----------------- GEMINI API KEYS & FAILOVER -----------------

export const getStoredGeminiKeys = () => {
  const keys = safeGet(STORAGE_KEYS.GEMINI_KEYS, []);
  if (!Array.isArray(keys) || keys.length === 0) {
    // If environment or default exists, check
    return [];
  }
  return keys;
};

export const saveStoredGeminiKeys = (keys) => {
  safeSet(STORAGE_KEYS.GEMINI_KEYS, keys);
};

export const addStoredGeminiKey = (keyString, label = '') => {
  const clean = (keyString || '').trim();
  if (!clean) return false;
  const current = getStoredGeminiKeys();
  if (current.some((k) => k.key === clean)) return false;
  current.push({
    id: `key_${Date.now()}`,
    key: clean,
    label: label.trim() || `API Key #${current.length + 1}`,
    addedAt: new Date().toISOString(),
    status: 'untested', // 'valid', 'invalid', 'quota_exceeded', 'untested'
    lastUsed: null,
  });
  saveStoredGeminiKeys(current);
  return true;
};

export const removeStoredGeminiKey = (id) => {
  const filtered = getStoredGeminiKeys().filter((k) => k.id !== id);
  saveStoredGeminiKeys(filtered);
  return true;
};

export const updateStoredGeminiKey = (id, updates) => {
  const keys = getStoredGeminiKeys().map((k) => (k.id === id ? { ...k, ...updates } : k));
  saveStoredGeminiKeys(keys);
  return true;
};
