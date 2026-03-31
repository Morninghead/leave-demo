
import { sql } from '../utils/db';

async function inspectConstraints() {
    try {
        console.log('Inspecting constraints for "employees" table...');

        // Query to find constraints
        const result = await sql`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'employees'::regclass
      AND contype = 'u';
    `;

        console.log('Current Unique Constraints:', result);

        // Also check indices incase they are not constraints
        const indices = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'employees';
    `;

        console.log('Current Indexes:', indices);

    } catch (error) {
        console.error('Error inspecting DB:', error);
    }
}

inspectConstraints();
