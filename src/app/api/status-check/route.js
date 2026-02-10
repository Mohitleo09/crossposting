import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PostStatus from '@/models/PostStatus';
import Post from '@/models/Post'; // Ensure model is loaded

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();

        const statuses = await PostStatus.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('postId');

        return NextResponse.json({
            count: statuses.length,
            statuses
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
