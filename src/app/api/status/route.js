import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PostStatus from '@/models/PostStatus';
import Post from '@/models/Post';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    try {
        // Verify user authentication
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        await dbConnect();

        // Fetch post statuses for this user's posts
        const statuses = await PostStatus.find({})
            .populate('postId')
            .sort({ createdAt: -1 })
            .limit(50);

        // Filter to only show posts belonging to this user
        const userStatuses = statuses.filter(s =>
            s.postId && s.postId.userId && s.postId.userId.toString() === decoded.userId
        );

        // Transform to match the expected format for Status.jsx
        const formattedStatuses = userStatuses.map(status => ({
            id: status._id.toString(),
            platform: status.platform,
            status: status.status,
            instagram_media_id: status.postId?.sourcePostId || '',
            last_error: status.errorMessage || null,
            created_at: status.createdAt,
            updated_at: status.updatedAt
        }));

        return NextResponse.json(formattedStatuses);

    } catch (error) {
        console.error('Status fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
