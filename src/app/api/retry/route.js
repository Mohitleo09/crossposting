import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PostStatus from '@/models/PostStatus';
import { getUserFromRequest } from '@/lib/auth';
import { executeCrosspostingJob } from '@/lib/worker';

export const dynamic = 'force-dynamic';

export async function POST(req) {
    try {
        const decoded = await getUserFromRequest(req);
        if (!decoded) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        const { statusId } = await req.json();

        const status = await PostStatus.findById(statusId).populate('postId');
        if (!status) {
            return NextResponse.json({ error: 'Status not found' }, { status: 404 });
        }

        // Verify ownership
        if (status.postId.userId.toString() !== decoded.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Reset to pending
        status.status = 'pending';
        status.errorMessage = null;
        status.retryCount = (status.retryCount || 0) + 1;
        await status.save();

        // Trigger job
        executeCrosspostingJob(statusId).catch(err =>
            console.error('Retry job failed:', err)
        );

        return NextResponse.json({ success: true, message: 'Retry triggered' });

    } catch (error) {
        console.error('Retry error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
