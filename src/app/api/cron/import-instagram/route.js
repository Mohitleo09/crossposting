import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ConnectedAccount from '@/models/ConnectedAccount';
import PostStatus from '@/models/PostStatus';
import { pollInstagramAccount } from '@/lib/instagram';

export const dynamic = 'force-dynamic'; // Ensure this route is never cached

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
