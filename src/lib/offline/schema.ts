/**
 * Columns and server defaults of every table the device keeps a copy of.
 * Mirrors the database schema so rows created offline look exactly like rows read from the server.
 * Regenerate when a synced table gains or loses a column.
 */
export const NOW = "__now__";

export const TABLE_COLUMNS = {
  "students": {
    "id": null,
    "lin": null,
    "full_name": null,
    "admission_number": null,
    "class_id": null,
    "stream_id": null,
    "promotion_status": 0,
    "promoted_to_class_id": null,
    "promotion_processed_at": null,
    "date_of_birth": null,
    "gender": null,
    "is_active": true,
    "termination_reason": 0,
    "termination_date": null,
    "photo_path": null,
    "guardian_name": null,
    "guardian_relationship": null,
    "guardian_phone": null,
    "guardian_email": null,
    "guardian_address": null,
    "has_custody_documents": false,
    "residence_proof_type": null,
    "residence_district": null,
    "residence_zone": null,
    "has_immunization_card": false,
    "has_medical_exam_report": false,
    "allergies_or_conditions": null,
    "health_insurance": null,
    "emergency_name": null,
    "emergency_relationship": null,
    "emergency_phone": null,
    "authorized_pickup_person": null,
    "created_at": "__now__"
  },
  "classes": {
    "id": null,
    "name": null,
    "class_teacher_id": null,
    "grading_system_id": null,
    "created_at": "__now__"
  },
  "streams": {
    "id": null,
    "name": null
  },
  "class_streams": {
    "class_id": null,
    "stream_id": null,
    "stream_teacher_id": null
  },
  "subjects": {
    "id": null,
    "name": null
  },
  "class_subjects": {
    "class_id": null,
    "subject_id": null
  },
  "terms": {
    "id": null,
    "name": null,
    "start_date": null,
    "end_date": null,
    "is_active": false,
    "created_at": "__now__"
  },
  "academic_years": {
    "id": null,
    "name": null
  },
  "assessments": {
    "id": null,
    "name": null,
    "class_id": null,
    "subject_id": null,
    "academic_year_id": null,
    "term_id": null,
    "stream_id": null,
    "stream_ids": [],
    "is_class_wide": true,
    "is_school_wide": false,
    "weight_percent": 0,
    "due_date": null,
    "is_verified": false,
    "is_published": false,
    "marks_entered_percent": 0,
    "promotion_role": 0,
    "author_user_id": null,
    "author_name": null,
    "created_at": "__now__"
  },
  "assessment_subjects": {
    "assessment_id": null,
    "subject_id": null
  },
  "marks": {
    "id": null,
    "student_id": null,
    "assessment_id": null,
    "subject_id": null,
    "mark": null,
    "grade": null,
    "remarks": null,
    "entered_by": null,
    "entered_at": "__now__"
  },
  "grading_systems": {
    "id": null,
    "name": null,
    "is_default": false,
    "pass_mark": 50,
    "created_at": "__now__"
  },
  "grade_bands": {
    "id": null,
    "grading_system_id": null,
    "label": null,
    "min_score": null,
    "max_score": null,
    "is_promotional_pass": false,
    "is_repeater": false,
    "is_promotional_fail": false
  },
  "teachers": {
    "id": null,
    "full_name": null,
    "email": null,
    "phone": null,
    "subjects_taught": null,
    "classes_taught": null,
    "next_of_kin_name": null,
    "next_of_kin_relationship": null,
    "next_of_kin_phone": null,
    "previous_schools": null,
    "is_registered_teacher": false,
    "is_student_teacher": false,
    "created_at": "__now__"
  },
  "term_fees": {
    "id": null,
    "term_id": null,
    "class_id": null,
    "amount": 0
  },
  "fee_payments": {
    "id": null,
    "student_id": null,
    "amount": null,
    "payment_date": "__now__",
    "term_id": null,
    "recorded_by": null,
    "description": null
  },
  "student_credits": {
    "id": null,
    "student_id": null,
    "from_term_id": null,
    "applied_to_term_id": null,
    "amount": null,
    "created_at": "__now__",
    "applied_at": null,
    "description": null
  },
  "budget_lines": {
    "id": null,
    "category": null,
    "budgeted": 0,
    "spent": 0,
    "financial_year": "",
    "created_at": "__now__"
  },
  "head_teacher_comments": {
    "id": null,
    "student_id": null,
    "term_id": null,
    "comment": "",
    "head_teacher_name": "",
    "created_at": "__now__"
  },
  "termination_logs": {
    "id": null,
    "student_id": null,
    "student_name_at_termination": "",
    "termination_reason": null,
    "termination_date": null,
    "anonymized": false,
    "logged_at": "__now__"
  },
  "enrollments": {
    "id": null,
    "full_name": null,
    "lin": "",
    "date_of_birth": null,
    "gender": "",
    "nationality": "",
    "religion": "",
    "previous_school": "",
    "admission_number": "",
    "guardian_name": "",
    "guardian_relationship": "",
    "guardian_phone": "",
    "guardian_email": "",
    "guardian_address": "",
    "has_custody_documents": false,
    "residence_proof_type": "",
    "residence_district": "",
    "residence_zone": "",
    "has_immunization_card": false,
    "has_medical_exam_report": false,
    "allergies_or_conditions": "",
    "health_insurance": "",
    "emergency_name": "",
    "emergency_relationship": "",
    "emergency_phone": "",
    "authorized_pickup_person": "",
    "submitted_at": "__now__",
    "status": "New"
  },
  "invite_codes": {
    "id": null,
    "code": null,
    "role": "data_entrant",
    "label": null,
    "allowed_pages": null,
    "is_used": false,
    "used_by": null,
    "created_by": null,
    "created_at": "__now__",
    "expires_at": null
  },
  "school_settings": {
    "id": 1,
    "school_name": "AutoTable Academy",
    "school_address": "",
    "school_phone": "",
    "head_teacher_name": "",
    "motto": "",
    "logo_path": null,
    "updated_at": "__now__"
  }
} as const satisfies Record<string, Record<string, unknown>>;

export type SyncedTable = keyof typeof TABLE_COLUMNS;
export const SYNCED_TABLES = Object.keys(TABLE_COLUMNS) as SyncedTable[];

/** Primary key per table: "id", or the column pair for link tables. */
export const PRIMARY_KEY: Record<SyncedTable, string | readonly [string, string]> = {
  "students": "id",
  "classes": "id",
  "streams": "id",
  "class_streams": [
    "class_id",
    "stream_id"
  ],
  "subjects": "id",
  "class_subjects": [
    "class_id",
    "subject_id"
  ],
  "terms": "id",
  "academic_years": "id",
  "assessments": "id",
  "assessment_subjects": [
    "assessment_id",
    "subject_id"
  ],
  "marks": "id",
  "grading_systems": "id",
  "grade_bands": "id",
  "teachers": "id",
  "term_fees": "id",
  "fee_payments": "id",
  "student_credits": "id",
  "budget_lines": "id",
  "head_teacher_comments": "id",
  "termination_logs": "id",
  "enrollments": "id",
  "invite_codes": "id",
  "school_settings": "id"
};
