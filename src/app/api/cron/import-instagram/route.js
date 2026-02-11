import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ConnectedAccount from '@/models/ConnectedAccount';
import PostStatus from '@/models/PostStatus';
import { pollInstagramAccount } from '@/lib/instagram';

export const dynamic = 'force-dynamic'; // Ensure this route is never cached
export const maxDuration = 60; // Allow 60 seconds (requires Pro plan but good practice)

export async function GET(req) {
    try {
        await dbConnect();

        // 0. Clean up stuck jobs (processing for more than 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const stuckJobs = await PostStatus.updateMany(
            {
                status: 'processing',
                updatedAt: { $lt: twoMinutesAgo }
            },
            {
                $set: {
                    status: 'failed',
                    errorMessage: 'Job timed out (Vercel 10s limit exceeded)'
                }
            }
        );

        console.log(`🧹 Cleaned up ${stuckJobs.modifiedCount} stuck jobs`);

        // 1. Find all active Instagram accounts
        const accounts = await ConnectedAccount.find({ platform: 'instagram', isActive: true });

        const results = [];

        // 2. Poll each account (in parallel or sequence)
        // Using sequence to be gentle on resources for localhost
        for (const account of accounts) {
            const count = await pollInstagramAccount(account);
            results.push({
                user: account.userId,
                platformId: account.platformUserId,
                newPosts: count
            });
        }

        // 3. Process Pending/Failed Jobs (Retry Mechanism)
        // Find jobs that are 'pending' or recently 'failed' (auto-retry once)
        const pendingJobs = await PostStatus.find({
            status: { $in: ['pending', 'failed'] },
            // Only retry failed jobs if they failed recently (e.g. within last hour) and haven't been retried too many times
            // For MVP, just retry all pending.
            updatedAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) }
        }).limit(3); // Limit to 3 to avoid timeout

        const { executeCrosspostingJob } = await import('@/lib/worker');

        let processedCount = 0;
        for (const job of pendingJobs) {
            // Check retry count to avoid infinite loops
            if (job.retryCount >= 3) continue;

            console.log(`Retrying job ${job._id} (Attempt ${job.retryCount + 1})`);

            // Increment retry count
            job.retryCount = (job.retryCount || 0) + 1;
            await job.save();

            // Run in background (fire & forget) but Vercel might kill it
            // Better to await essential parts? No, await full to update status.
            try {
                await executeCrosspostingJob(job._id);
                processedCount++;
            } catch (e) {
                console.error(`Job ${job._id} failed again:`, e);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Polling complete',
            cleanedJobs: stuckJobs.modifiedCount,
            details: results
        });

    } catch (error) {
        console.error('Cron Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
