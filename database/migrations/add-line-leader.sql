-- Add line_leader_id to manufacturing_lines table
ALTER TABLE manufacturing_lines 
ADD COLUMN IF NOT EXISTS line_leader_id UUID REFERENCES employees(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_manufacturing_lines_leader ON manufacturing_lines(line_leader_id);
