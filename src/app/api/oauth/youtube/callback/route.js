import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ConnectedAccount from '@/models/ConnectedAccount';
import User from '@/models/User';
import { encrypt } from '@/lib/crypto';
import jwt from 'jsonwebtoken';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // Our JWT token

    if (!code || !state) {
        return NextResponse.json({ error: 'OAuth failed or unauthorized' }, { status: 400 });
    }

    try {
        await dbConnect();

        // 1. Decode userId from state
        let userId = null;
        try {
            const decoded = jwt.verify(state, process.env.JWT_SECRET || 'your_jwt_secret_key');
            userId = decoded.userId;
        } catch (e) {
            return NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 });
        }

        // 2. Exchange code for tokens
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.YOUTUBE_CLIENT_ID,
                client_secret: process.env.YOUTUBE_CLIENT_SECRET,
                redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        const data = await response.json();
        if (data.error) {
            return NextResponse.json({ error: data.error_description || data.error }, { status: 400 });
        }

        // 3. Get User Profile for ID
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        const userData = await userResponse.json();

        // 4. Get YouTube Channel Info for username
        let channelTitle = null;
        try {
            const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
                headers: { 'Authorization': `Bearer ${data.access_token}` }
            });
            const channelData = await channelResponse.json();

            console.log('YouTube Channel API Response:', JSON.stringify(channelData, null, 2));

            if (channelData.error) {
                console.error('YouTube Channel API Error:', channelData.error);
            } else if (channelData.items && channelData.items.length > 0) {
                channelTitle = channelData.items[0].snippet.title;
                console.log(`✅ YouTube Channel Title: ${channelTitle}`);
            } else {
                console.warn('No YouTube channel found for this account');
                if (userData.name) {
                    channelTitle = userData.name;
                    console.log(`Using Google Profile Name as fallback: ${channelTitle}`);
                }
            }
        } catch (err) {
            console.error('Could not fetch YouTube channel title:', err.message);
            if (userData.name) channelTitle = userData.name;
        }

        console.log(`Saving YouTube account - User ID: ${userData.id}, Channel/Name: ${channelTitle || 'N/A'}`);

        // 5. Save/Update Connection
        const savedAccount = await ConnectedAccount.findOneAndUpdate(
            { userId, platform: 'youtube' },
            {
                platformUserId: userData.id,
                username: channelTitle || userData.name || 'YouTube User',
                accessToken: encrypt(data.access_token),
                refreshToken: data.refresh_token ? encrypt(data.refresh_token) : undefined,
                isActive: true
            },
            { upsert: true, new: true }
        );

        console.log('=== SAVED ACCOUNT ===');
        console.log(`ID: ${savedAccount._id}`);
        console.log(`Platform: ${savedAccount.platform}`);
        console.log(`Username: ${savedAccount.username}`);
        console.log(`Username type: ${typeof savedAccount.username}`);
        console.log(`Has username: ${!!savedAccount.username}`);

        // 6. Mark user as connected
        await User.findByIdAndUpdate(userId, { youtubeConnected: true });

        console.log('✅ YouTube OAuth completed successfully');

        // Use the correct base URL for redirect (HTTPS)
        // Use the correct base URL for redirect (HTTPS)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        return NextResponse.redirect(new URL('/?connect=youtube&status=success', baseUrl));

    } catch (error) {
        console.error('YouTube Callback Error:', error);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        return NextResponse.redirect(new URL(`/?connect=youtube&status=error&message=${encodeURIComponent(error.message)}`, baseUrl));
    }
}
