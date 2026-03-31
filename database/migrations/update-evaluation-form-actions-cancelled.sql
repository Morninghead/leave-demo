ALTER TABLE evaluation_form_actions
DROP CONSTRAINT IF EXISTS evaluation_form_actions_type_check;

ALTER TABLE evaluation_form_actions
ADD CONSTRAINT evaluation_form_actions_type_check CHECK (
    action_type IN ('ISSUED', 'SUBMITTED', 'ACKNOWLEDGED', 'SIGNED', 'COMPLETED', 'CANCELLED')
);
