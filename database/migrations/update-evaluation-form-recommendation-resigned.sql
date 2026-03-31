ALTER TABLE evaluation_forms
DROP CONSTRAINT IF EXISTS evaluation_forms_recommendation_check;

ALTER TABLE evaluation_forms
ADD CONSTRAINT evaluation_forms_recommendation_check CHECK (
    recommendation IS NULL OR recommendation IN ('PASS', 'FAIL', 'EXTEND', 'OTHER', 'RESIGNED')
);

ALTER TABLE evaluation_form_actions
DROP CONSTRAINT IF EXISTS evaluation_form_actions_recommendation_check;

ALTER TABLE evaluation_form_actions
ADD CONSTRAINT evaluation_form_actions_recommendation_check CHECK (
    recommendation IS NULL OR recommendation IN ('PASS', 'FAIL', 'EXTEND', 'OTHER', 'RESIGNED')
);
