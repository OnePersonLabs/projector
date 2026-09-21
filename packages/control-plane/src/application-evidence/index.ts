/**
 * Domain adapters are supplied at the application boundary. Projector keeps
 * only the generic, strict Core evidence contract in its shipped runtime.
 */
export {
  ApplicationEvidenceAssessmentRequestSchema,
  ApplicationEvidenceAssessmentSchema,
  assessApplicationEvidence,
  hashApplicationEvidenceAssessment,
  type ApplicationEvidenceAssessment,
  type ApplicationEvidenceAssessmentRequest,
  type ApplicationEvidencePort,
} from "@projector/core";
