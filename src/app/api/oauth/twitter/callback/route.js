import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ConnectedAccount from '@/models/ConnectedAccount';
import User from '@/models/User';
import { encrypt } from '@/lib/crypto';
import jwt from 'jsonwebtoken';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is our JWT token
    const error = searchParams.get('error');

    // Retrieve the original verifier from the secure cookie
    const code_verifier = req.cookies.get('twitter_code_verifier')?.value;

    // Early exit if user denied access or something went wrong on Twitter's side
    if (error) {
        return NextResponse.redirect(new URL('/?connect=twitter&status=error&message=' + error, req.url));
    }

    // MANDATORY: Validate PKCE and state
    if (!code || !code_verifier || !state) {
        console.error('Missing OAuth data:', { hasCode: !!code, hasVerifier: !!code_verifier, hasState: !!state });
        return NextResponse.redirect(new URL('/?connect=twitter&status=error&message=session_expired', req.url));
    }

    try {
        await dbConnect();

        // 1. Decode and Validate User Identity (State)
        let userId = null;
        try {
            const decoded = jwt.verify(state, process.env.JWT_SECRET || 'your_jwt_secret_key');
            userId = decoded.userId;
        } catch (e) {
            return NextResponse.redirect(new URL('/?connect=twitter&status=error&message=invalid_auth', req.url));
        }

        const client_id = process.env.TWITTER_CLIENT_ID;
        const client_secret = process.env.TWITTER_CLIENT_SECRET;
        const basicAuth = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

        // 2. Exchange Authorization Code for Access Token
        const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: client_id,
                redirect_uri: process.env.TWITTER_REDIRECT_URI,
                code_verifier: code_verifier // This MUST match the one used to generate the challenge
            })
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
            console.error('Twitter Token Exchange Error:', tokenData);
            return NextResponse.redirect(new URL('/?connect=twitter&status=error', req.url));
        }

        // 3. SECURELY STORE CREDENTIALS
        // Get User Info from Twitter to get their permanent ID
        const userDetailsRes = await fetch('https://api.twitter.com/2/users/me?user.fields=username', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        const userDetails = await userDetailsRes.json();

        if (!userDetails.data) {
            return NextResponse.redirect(new URL('/?connect=twitter&status=error', req.url));
        }

        console.log('Twitter User Details:', JSON.stringify(userDetails.data, null, 2));
        console.log(`✅ Twitter Username: @${userDetails.data.username}`);
        console.log(`Saving Twitter account - Twitter ID: ${userDetails.data.id}, Username: ${userDetails.data.username}`);

        // Save platform connection with encrypted tokens
        const savedAccount = await ConnectedAccount.findOneAndUpdate(
            { userId, platform: 'twitter' },
            {
                platformUserId: userDetails.data.id,
                username: userDetails.data.username || 'Twitter User',
                accessToken: encrypt(tokenData.access_token),
                refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : undefined,
                isActive: true
            },
            { upsert: true, new: true }
        );

        console.log('=== SAVED TWITTER ACCOUNT ===');
        console.log(`ID: ${savedAccount._id}`);
        console.log(`Platform: ${savedAccount.platform}`);
        console.log(`Username: ${savedAccount.username}`);
        console.log(`Username type: ${typeof savedAccount.username}`);
        console.log(`Has username: ${!!savedAccount.username}`);

        // Update the User Profile state for the UI
        await User.findByIdAndUpdate(userId, { twitterConnected: true });

        console.log('✅ Twitter OAuth completed successfully');

        // 4. FINAL REDIRECT (Mandatory UX Step)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        const response = NextResponse.redirect(new URL('/?connect=twitter&status=success', baseUrl));

        // Cleanup the verifier cookie
        response.cookies.delete('twitter_code_verifier');

        return response;

    } catch (err) {
        console.error('Unexpected Twitter OAuth error:', err);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        return NextResponse.redirect(new URL(`/?connect=twitter&status=error&message=${encodeURIComponent(err.message)}`, baseUrl));
    }
}
