-- Evaluation Form foundation
-- Mirrors the existing Neon schema used for probation evaluation workflow.

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS direct_leader_id UUID REFERENCES employees(id);

COMMENT ON COLUMN employees.direct_leader_id IS 'Optional direct leader / team leader for workflow routing such as probation evaluations';

CREATE INDEX IF NOT EXISTS idx_employees_direct_leader_id
ON employees(direct_leader_id);

CREATE TABLE IF NOT EXISTS evaluation_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_number TEXT NOT NULL UNIQUE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id),
    issuer_hr_id UUID NOT NULL REFERENCES employees(id),
    leader_id UUID REFERENCES employees(id),
    manager_id UUID NOT NULL REFERENCES employees(id),
    hr_ack_id UUID NOT NULL REFERENCES employees(id),
    hr_manager_id UUID NOT NULL REFERENCES employees(id),
    probation_start_date DATE NOT NULL,
    probation_end_date DATE NOT NULL,
    extension_end_date DATE,
    has_leader_stage BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'PENDING_LEADER',
    current_step TEXT NOT NULL DEFAULT 'LEADER',
    pass_threshold INTEGER NOT NULL DEFAULT 65,
    total_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    recommendation TEXT,
    result_comment TEXT,
    employee_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT evaluation_forms_status_check CHECK (
        status IN (
            'DRAFT',
            'PENDING_LEADER',
            'PENDING_MANAGER',
            'PENDING_HR',
            'PENDING_HR_MANAGER',
            'COMPLETED',
            'CANCELLED'
        )
    ),
    CONSTRAINT evaluation_forms_step_check CHECK (
        current_step IN ('LEADER', 'MANAGER', 'HR', 'HR_MANAGER', 'COMPLETED')
    ),
    CONSTRAINT evaluation_forms_recommendation_check CHECK (
        recommendation IS NULL OR recommendation IN ('PASS', 'FAIL', 'EXTEND', 'OTHER', 'RESIGNED')
    ),
    CONSTRAINT evaluation_forms_score_range_check CHECK (
        total_score >= 0 AND total_score <= 100
    ),
    CONSTRAINT evaluation_forms_extension_range_check CHECK (
        extension_end_date IS NULL OR extension_end_date >= probation_end_date
    )
);

COMMENT ON TABLE evaluation_forms IS 'Probation evaluation forms issued by HR and signed through leader/manager/HR/HR manager workflow';
COMMENT ON COLUMN evaluation_forms.extension_end_date IS 'Optional final probation end date when recommendation is EXTEND; total probation cannot exceed 6 months from hire date';

CREATE INDEX IF NOT EXISTS idx_evaluation_forms_employee_id
ON evaluation_forms(employee_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_forms_status
ON evaluation_forms(status);

CREATE INDEX IF NOT EXISTS idx_evaluation_forms_leader_id
ON evaluation_forms(leader_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_forms_manager_id
ON evaluation_forms(manager_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_forms_hr_ack_id
ON evaluation_forms(hr_ack_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_forms_hr_manager_id
ON evaluation_forms(hr_manager_id);

CREATE TABLE IF NOT EXISTS evaluation_form_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_form_id UUID NOT NULL REFERENCES evaluation_forms(id) ON DELETE CASCADE,
    question_code TEXT NOT NULL,
    section_code TEXT NOT NULL,
    question_text_th TEXT NOT NULL,
    question_text_en TEXT NOT NULL,
    max_score INTEGER NOT NULL,
    score NUMERIC(5,2) NOT NULL DEFAULT 0,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT evaluation_form_scores_unique_question UNIQUE (evaluation_form_id, question_code),
    CONSTRAINT evaluation_form_scores_nonnegative CHECK (score >= 0),
    CONSTRAINT evaluation_form_scores_max_score_check CHECK (max_score > 0)
);

COMMENT ON TABLE evaluation_form_scores IS 'Per-question evaluation scores and comments for probation evaluation forms';

CREATE INDEX IF NOT EXISTS idx_evaluation_form_scores_form_id
ON evaluation_form_scores(evaluation_form_id);

CREATE TABLE IF NOT EXISTS evaluation_form_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_form_id UUID NOT NULL REFERENCES evaluation_forms(id) ON DELETE CASCADE,
    action_step TEXT NOT NULL,
    action_type TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES employees(id),
    comment TEXT,
    recommendation TEXT,
    signature_data TEXT,
    signed_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT evaluation_form_actions_step_check CHECK (
        action_step IN ('ISSUE', 'LEADER', 'MANAGER', 'HR', 'HR_MANAGER')
    ),
    CONSTRAINT evaluation_form_actions_type_check CHECK (
        action_type IN ('ISSUED', 'SUBMITTED', 'ACKNOWLEDGED', 'SIGNED', 'COMPLETED', 'CANCELLED')
    ),
    CONSTRAINT evaluation_form_actions_recommendation_check CHECK (
        recommendation IS NULL OR recommendation IN ('PASS', 'FAIL', 'EXTEND', 'OTHER', 'RESIGNED')
    )
);

COMMENT ON TABLE evaluation_form_actions IS 'Immutable action history for evaluation form workflow including signatures';

CREATE INDEX IF NOT EXISTS idx_evaluation_form_actions_form_id
ON evaluation_form_actions(evaluation_form_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_form_actions_actor_id
ON evaluation_form_actions(actor_id);

CREATE OR REPLACE FUNCTION update_evaluation_form_updated_at()
RETURNS TRIGGER
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_evaluation_forms_updated_at ON evaluation_forms;
CREATE TRIGGER trigger_update_evaluation_forms_updated_at
    BEFORE UPDATE ON evaluation_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_evaluation_form_updated_at();

DROP TRIGGER IF EXISTS trigger_update_evaluation_form_scores_updated_at ON evaluation_form_scores;
CREATE TRIGGER trigger_update_evaluation_form_scores_updated_at
    BEFORE UPDATE ON evaluation_form_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_evaluation_form_updated_at();

CREATE OR REPLACE FUNCTION validate_evaluation_form_probation_limit()
RETURNS TRIGGER
AS $$
DECLARE
    employee_hire_date DATE;
    maximum_extension_date DATE;
BEGIN
    SELECT hire_date
    INTO employee_hire_date
    FROM employees
    WHERE id = NEW.employee_id;

    IF employee_hire_date IS NULL THEN
        RAISE EXCEPTION 'Employee hire date is required to validate evaluation probation limits';
    END IF;

    maximum_extension_date := (employee_hire_date + INTERVAL '6 months')::DATE;

    IF NEW.probation_start_date <> employee_hire_date THEN
        RAISE EXCEPTION 'Probation start date must match employee hire date';
    END IF;

    IF NEW.probation_end_date <> (employee_hire_date + INTERVAL '119 days')::DATE THEN
        RAISE EXCEPTION 'Probation end date must be 119 days from hire date';
    END IF;

    IF NEW.recommendation = 'EXTEND' AND NEW.extension_end_date IS NULL THEN
        RAISE EXCEPTION 'Extension end date is required when recommendation is EXTEND';
    END IF;

    IF NEW.extension_end_date IS NOT NULL AND NEW.extension_end_date > maximum_extension_date THEN
        RAISE EXCEPTION 'Extended probation cannot exceed 6 months from hire date';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_evaluation_form_probation_limit ON evaluation_forms;
CREATE TRIGGER trigger_validate_evaluation_form_probation_limit
    BEFORE INSERT OR UPDATE ON evaluation_forms
    FOR EACH ROW
    EXECUTE FUNCTION validate_evaluation_form_probation_limit();
