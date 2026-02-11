import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PostStatus from '@/models/PostStatus';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
    try {
        const decoded = await getUserFromRequest(req);
        if (!decoded) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        // Find all processing jobs older than 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const stuckJobs = await PostStatus.find({
            status: 'processing',
            updatedAt: { $lt: fiveMinutesAgo }
        }).populate('postId');

        // Filter to only this user's jobs
        const userStuckJobs = stuckJobs.filter(job =>
            job.postId && job.postId.userId && job.postId.userId.toString() === decoded.userId
        );

        // Reset them to failed with timeout message
        for (const job of userStuckJobs) {
            job.status = 'failed';
            job.errorMessage = 'Job timed out after 5 minutes';
            await job.save();
        }

        return NextResponse.json({
            success: true,
            resetCount: userStuckJobs.length,
            jobs: userStuckJobs.map(j => ({ id: j._id, platform: j.platform }))
        });

    } catch (error) {
        console.error('Reset stuck jobs error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
