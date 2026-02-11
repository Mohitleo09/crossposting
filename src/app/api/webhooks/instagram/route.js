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
    console.log('🔔 WEBHOOK CALLED - Instagram webhook endpoint hit!');

    try {
        const payload = await req.json();
        console.log('📦 WEBHOOK PAYLOAD:', JSON.stringify(payload, null, 2));

        if (payload.object === 'instagram') {
            console.log('✅ Payload object is "instagram"');

            for (const entry of payload.entry || []) {
                const igUserId = entry.id;
                console.log(`👤 Processing entry for IG User ID: ${igUserId}`);

                for (const change of entry.changes || []) {
                    const field = change.field;
                    const value = change.value;

                    console.log(`🔄 Change detected - Field: ${field}, Value:`, JSON.stringify(value, null, 2));

                    // Handle different webhook types
                    if (field === 'mentions') {
                        console.log('📢 MENTIONS webhook triggered');
                        const mediaId = value.media_id;
                        console.log(`Media ID from mentions: ${mediaId}`);

                        if (mediaId) {
                            console.log(`✨ Processing mention for media: ${mediaId}`);
                            processInstagramMedia(mediaId, igUserId).catch(err =>
                                console.error(`❌ Mention webhook processing failed:`, err)
                            );
                        } else {
                            console.log('⚠️ No media_id found in mentions webhook');
                        }
                    } else if (field === 'comments') {
                        console.log('💬 COMMENTS webhook triggered');
                        const mediaId = value.media?.id;
                        console.log(`Media ID from comments: ${mediaId}`);

                        if (mediaId) {
                            console.log(`✨ Processing comment for media: ${mediaId}`);
                            processInstagramMedia(mediaId, igUserId).catch(err =>
                                console.error(`❌ Comment webhook processing failed:`, err)
                            );
                        } else {
                            console.log('⚠️ No media.id found in comments webhook');
                        }
                    } else if (field === 'media' || field === 'media_product_type') {
                        console.log('🎬 MEDIA webhook triggered');
                        const mediaId = value.id;
                        console.log(`Media ID from media webhook: ${mediaId}`);

                        if (mediaId) {
                            console.log(`✨ Processing media update: ${mediaId}`);
                            processInstagramMedia(mediaId, igUserId).catch(err =>
                                console.error(`❌ Media webhook processing failed:`, err)
                            );
                        } else {
                            console.log('⚠️ No id found in media webhook');
                        }
                    } else {
                        console.log(`⚠️ Unknown field type: ${field}`);
                    }
                }
            }
            console.log('✅ Webhook processing complete, returning EVENT_RECEIVED');
            return new Response('EVENT_RECEIVED', { status: 200 });
        } else {
            console.log(`❌ Payload object is NOT instagram, got: ${payload.object}`);
            return new Response('Not an instagram event', { status: 404 });
        }

    } catch (error) {
        console.error('❌ WEBHOOK ERROR:', error);
        console.error('Error stack:', error.stack);
        return new Response('Webhook Error', { status: 500 });
    }
}
