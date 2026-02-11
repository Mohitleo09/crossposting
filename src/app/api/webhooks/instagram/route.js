import { NextResponse } from 'next/server';
import { processInstagramMedia } from '@/lib/instagram';

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'crossposting_verify_token';

export async function GET(req) {
    const { searchParams } = new URL(req.url);

    // Parse query params directly for clean access
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return new Response(challenge, { status: 200 });
    } else {
        return new Response('Verification failed', { status: 403 });
    }
}

export async function POST(req) {
    try {
        const payload = await req.json();
        console.log('Received Instagram Webhook:', JSON.stringify(payload, null, 2));

        if (payload.object === 'instagram') {
            for (const entry of payload.entry || []) {
                const igUserId = entry.id; // Instagram Business Account ID

                for (const change of entry.changes || []) {
                    const field = change.field;
                    const value = change.value;

                    // Handle different webhook types
                    if (field === 'mentions') {
                        // When someone mentions you (including self-mentions)
                        // value.media_id contains the media where you were mentioned
                        const mediaId = value.media_id;
                        if (mediaId) {
                            console.log(`Mention detected on media: ${mediaId}`);
                            processInstagramMedia(mediaId, igUserId).catch(err =>
                                console.error(`Mention webhook processing failed:`, err)
                            );
                        }
                    } else if (field === 'comments') {
                        // When someone comments on your post
                        // value.media.id contains the media that was commented on
                        const mediaId = value.media?.id;
                        if (mediaId) {
                            console.log(`Comment detected on media: ${mediaId}`);
                            processInstagramMedia(mediaId, igUserId).catch(err =>
                                console.error(`Comment webhook processing failed:`, err)
                            );
                        }
                    } else if (field === 'media' || field === 'media_product_type') {
                        // Standard media webhook (if available)
                        const mediaId = value.id;
                        if (mediaId) {
                            console.log(`Media update detected: ${mediaId}`);
                            processInstagramMedia(mediaId, igUserId).catch(err =>
                                console.error(`Media webhook processing failed:`, err)
                            );
                        }
                    }
                }
            }
            return new Response('EVENT_RECEIVED', { status: 200 });
        } else {
            return new Response('Not an instagram event', { status: 404 });
        }

    } catch (error) {
        console.error('Webhook Error:', error);
        return new Response('Webhook Error', { status: 500 });
    }
}
