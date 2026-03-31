// netlify/functions/employee-signature.ts
import { Handler } from '@netlify/functions';
import { sql, supabase } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';

/**
 * Employee Signature Management API
 * POST: Upload/update employee signature
 * GET: Get employee signature
 * DELETE: Remove employee signature
 */

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
    const corsResponse = handleCORS(event);
    if (corsResponse) return corsResponse;

    const userId = event.user?.userId;
    const userRole = event.user?.role?.toLowerCase();

    try {
        // GET - Retrieve signature
        if (event.httpMethod === 'GET') {
            const employeeId = event.queryStringParameters?.employee_id || userId;

            // Only allow getting own signature or admin/hr can get any
            if (employeeId !== userId && !['admin', 'hr'].includes(userRole || '')) {
                return errorResponse('Not authorized to view this signature', 403);
            }

            const [employee] = await sql`
        SELECT id, signature_image, signature_uploaded_at
        FROM employees
        WHERE id = ${employeeId}
      `;

            if (!employee) {
                return errorResponse('Employee not found', 404);
            }

            return successResponse({
                success: true,
                data: {
                    signature_image: employee.signature_image,
                    signature_uploaded_at: employee.signature_uploaded_at,
                },
            });
        }

        // POST - Upload/update signature
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { signature_data, employee_id } = body;

            // Target employee (own or specified if admin/hr)
            let targetEmployeeId = userId;
            if (employee_id && ['admin', 'hr'].includes(userRole || '')) {
                targetEmployeeId = employee_id;
            }

            if (!signature_data) {
                return errorResponse('Signature data is required', 400);
            }

            let signatureUrl = signature_data;

            // If signature is base64, upload to Supabase Storage
            if (signature_data.startsWith('data:image')) {
                try {
                    console.log('📝 Uploading employee signature to Supabase Storage...');

                    // Convert base64 to buffer
                    const base64Data = signature_data.replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');

                    // Generate filename
                    const timestamp = Date.now();
                    const filename = `employee-signatures/${targetEmployeeId}_${timestamp}.png`;

                    // Upload to Supabase Storage
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('Signature')
                        .upload(filename, buffer, {
                            contentType: 'image/png',
                            upsert: true
                        });

                    if (uploadError) {
                        console.error('❌ Signature upload error:', uploadError);
                        // Continue with base64 as fallback
                    } else {
                        // Get public URL
                        const { data: urlData } = supabase.storage
                            .from('Signature')
                            .getPublicUrl(filename);

                        signatureUrl = urlData.publicUrl;
                        console.log('✅ Signature uploaded:', signatureUrl);
                    }
                } catch (uploadErr) {
                    console.error('❌ Signature upload exception:', uploadErr);
                    // Continue with original base64
                }
            }

            // Update employee signature
            const [updated] = await sql`
        UPDATE employees
        SET 
          signature_image = ${signatureUrl},
          signature_uploaded_at = NOW(),
          updated_at = NOW()
        WHERE id = ${targetEmployeeId}
        RETURNING id, signature_image, signature_uploaded_at
      `;

            if (!updated) {
                return errorResponse('Employee not found', 404);
            }

            return successResponse({
                success: true,
                message: 'Signature updated successfully',
                data: {
                    signature_image: updated.signature_image,
                    signature_uploaded_at: updated.signature_uploaded_at,
                },
            });
        }

        // DELETE - Remove signature
        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body || '{}');
            const { employee_id } = body;

            // Target employee (own or specified if admin/hr)
            let targetEmployeeId = userId;
            if (employee_id && ['admin', 'hr'].includes(userRole || '')) {
                targetEmployeeId = employee_id;
            }

            // Get current signature to delete from storage
            const [employee] = await sql`
        SELECT signature_image FROM employees WHERE id = ${targetEmployeeId}
      `;

            if (employee?.signature_image && employee.signature_image.includes('supabase')) {
                // Try to delete from storage
                try {
                    const urlParts = employee.signature_image.split('/');
                    const filename = urlParts.slice(-2).join('/'); // employee-signatures/xxx.png
                    await supabase.storage.from('Signature').remove([filename]);
                    console.log('✅ Deleted signature from storage:', filename);
                } catch (e) {
                    console.error('⚠️ Failed to delete signature from storage:', e);
                }
            }

            // Update employee
            await sql`
        UPDATE employees
        SET 
          signature_image = NULL,
          signature_uploaded_at = NULL,
          updated_at = NOW()
        WHERE id = ${targetEmployeeId}
      `;

            return successResponse({
                success: true,
                message: 'Signature removed successfully',
            });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error: any) {
        console.error('❌ Employee signature error:', error);
        return errorResponse(error.message || 'Failed to process signature', 500);
    }
});

export { handler };
