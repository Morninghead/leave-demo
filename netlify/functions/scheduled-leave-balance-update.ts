
import { schedule } from '@netlify/functions';
import { syncAllEmployeeBalances } from './utils/sync-all-balances';

// This scheduled function runs automatically every day at 17:00 UTC
// (Which corresponds to 00:00 midnight in Thailand, UTC+7)
const handler = schedule('0 17 * * *', async (event) => {
    const currentYear = new Date().getFullYear();
    console.log(`⏰ [Scheduled-Daily] Starting leave balance sync for year ${currentYear}...`);

    try {
        const result = await syncAllEmployeeBalances(currentYear);

        console.log('✅ [Scheduled-Daily] Sync completed successfully:', result);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Daily leave balance sync completed successfully',
                result
            }),
        };
    } catch (error) {
        console.error('❌ [Scheduled-Daily] Sync failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to sync leave balances',
                error: (error as Error).message
            }),
        };
    }
});

export { handler };
