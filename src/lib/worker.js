import dbConnect from './db';
import PostStatus from '@/models/PostStatus';
import ConnectedAccount from '@/models/ConnectedAccount';
import Post from '@/models/Post';
import { decrypt } from './crypto';
import { getValidToken } from './tokens';
import { convertImageToVideo } from './video-generator';
import fs from 'fs';

export async function executeCrosspostingJob(statusId) {
    await dbConnect();

    const status = await PostStatus.findById(statusId).populate('postId');
    if (!status || status.status !== 'pending') return;

    status.status = 'processing';
    await status.save();

    const post = status.postId;
    const account = await ConnectedAccount.findOne({ userId: post.userId, platform: status.platform });

    if (!account) {
        status.status = 'failed';
        status.errorMessage = 'No connected account found for ' + status.platform;
        await status.save();
        return;
    }

    try {
        if (status.platform === 'twitter') {
            await repostToTwitter(post, account, status);
        } else if (status.platform === 'youtube') {
            await repostToYouTube(post, account, status);
        }
    } catch (error) {
        console.error(`Post to ${status.platform} failed:`, error);
        status.status = 'failed';
        status.errorMessage = error.message;
        await status.save();
    }
}

async function repostToTwitter(post, account, status) {
    status.status = 'processing';
    await status.save();

    const token = await getValidToken(account);
    const caption = post.caption ? post.caption.substring(0, 280) : '';

    try {
        let mediaId = null;

        // 1. Download Media
        if (post.mediaUrl && (post.mediaType === 'IMAGE' || post.mediaType === 'VIDEO')) {
            console.log(`Downloading media for Twitter: ${post.mediaUrl}`);
            const { buffer, contentType } = await downloadMedia(post.mediaUrl);

            // 2. Upload Media (Twitter v1.1 upload.twitter.com)
            const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

            // Determine category
            const mediaCategory = contentType.startsWith('video') ? 'tweet_video' : 'tweet_image';

            // INIT
            const initRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    command: 'INIT',
                    total_bytes: buffer.length,
                    media_type: contentType,
                    media_category: mediaCategory
                })
            });
            const initData = await initRes.json();

            if (!initData.media_id_string) {
                throw new Error(`Twitter Media Init Failed: ${JSON.stringify(initData)}`);
            }
            mediaId = initData.media_id_string;

            // APPEND
            const formData = new FormData();
            formData.append('command', 'APPEND');
            formData.append('media_id', mediaId);
            formData.append('segment_index', '0');
            // Adding filename is sometimes required by FormData implementations
            const filename = contentType.startsWith('video') ? 'media.mp4' : 'media.jpg';
            formData.append('media', new Blob([buffer]), filename);

            await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            // FINALIZE
            const finRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    command: 'FINALIZE',
                    media_id: mediaId
                })
            });
            const finData = await finRes.json();

            // Wait for processing if video
            if (finData.processing_info) {
                // For MVP, simplistic wait or proceed. Twitter v2 Tweet creation handles 'pending' media usually,
                // but strictly one should poll STATUS.
                // We will skip polling for MVP speed.
            }
        }

        // 3. Post Tweet (v2)
        const tweetBody = { text: caption };
        if (mediaId) {
            tweetBody.media = { media_ids: [mediaId] };
        }

        const response = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tweetBody)
        });

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Twitter API returned non-JSON: ${responseText.substring(0, 200)}...`);
        }

        if (data.data) {
            status.status = 'success';
            status.externalPostId = data.data.id;
        } else {
            throw new Error(data.detail || JSON.stringify(data));
        }
        await status.save();

    } catch (e) {
        console.error('Twitter Post Error:', e);
        status.status = 'failed';
        status.errorMessage = e.message;
        await status.save();
    }
}

async function repostToYouTube(post, account, status) {
    status.status = 'processing';
    await status.save();

    // Sanitize Title for YouTube:
    // 1. Remove emojis (basic range check)
    // 2. Limit to 100 chars
    // 3. Ensure not empty
    let cleanCaption = post.caption ? post.caption.replace(/[\u1000-\uFFFF]+/g, '').trim() : '';
    // Also remove any newlines for the title
    cleanCaption = cleanCaption.split('\n')[0].trim();

    let title = cleanCaption.substring(0, 100);
    if (!title || title.length < 2) {
        title = `New Instagram Video ${new Date().toLocaleDateString()}`;
    }

    let description = post.caption || '';

    const token = await getValidToken(account);
    let tempVideoPath = null;

    try {
        console.log(`Processing media for YouTube: ${post.mediaUrl}`);
        const { buffer, contentType } = await downloadMedia(post.mediaUrl);

        let videoBuffer = buffer;
        let videoContentType = contentType;
        let videoSize = buffer.length;
        let isShort = false;

        // If Image, Convert to Video (5 seconds = Short)
        if (post.mediaType === 'IMAGE') {
            console.log('Converting Image to 5-second video for YouTube Shorts...');
            try {
                const uniqueName = `ig_post_${post.sourcePostId}_${Date.now()}`;
                tempVideoPath = await convertImageToVideo(buffer, uniqueName);

                videoBuffer = await fs.promises.readFile(tempVideoPath);
                videoContentType = 'video/mp4';
                videoSize = videoBuffer.length;
                isShort = true; // 5-second video = Short

            } catch (err) {
                throw new Error(`Image Conversion Failed: ${err.message}`);
            }
        } else if (post.mediaType === 'VIDEO') {
            // Determine if it's a Short based on duration
            // Since we don't have exact duration from Instagram API, use REELS as proxy
            // REELS are typically < 90 seconds, and we'll treat them as Shorts
            if (post.mediaProductType === 'REELS') {
                isShort = true;
            }
        }

        // Add #Shorts tag if it's a Short
        if (isShort) {
            if (!title.includes('#Shorts')) title += ' #Shorts';
            if (!description.includes('#Shorts')) description += ' #Shorts';
        }

        // YouTube Resumable Upload
        const uploadUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
        const initRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Length': videoSize.toString(),
                'X-Upload-Content-Type': videoContentType
            },
            body: JSON.stringify({
                snippet: {
                    title,
                    description,
                    categoryId: '22', // People & Blogs
                    tags: ['crossposting']
                },
                status: {
                    privacyStatus: 'public',
                    selfDeclaredMadeForKids: false
                }
            })
        });

        if (!initRes.ok) {
            const err = await initRes.text();
            throw new Error(`YouTube Init Failed: ${err}`);
        }

        const location = initRes.headers.get('Location');
        if (!location) throw new Error('YouTube API did not return upload Location header');

        // Upload Bytes
        const uploadRes = await fetch(location, {
            method: 'PUT',
            headers: {
                'Content-Length': videoSize.toString(),
                'Content-Type': videoContentType
            },
            body: videoBuffer
        });

        // Cleanup temp file if created
        if (tempVideoPath) {
            fs.unlink(tempVideoPath, (err) => {
                if (err) console.error('Cleanup failed:', err);
            });
        }

        const data = await uploadRes.json();
        if (data.id) {
            status.status = 'success';
            status.externalPostId = data.id;
            console.log(`✅ Posted to YouTube as ${isShort ? 'Short' : 'Video'}: ${data.id}`);
        } else {
            throw new Error(JSON.stringify(data));
        }
        await status.save();

    } catch (e) {
        console.error('YouTube Upload Error:', e);
        status.status = 'failed';
        status.errorMessage = e.message;

        // Cleanup on error
        if (tempVideoPath) {
            fs.unlink(tempVideoPath, () => { });
        }

        await status.save();
    }
}

async function downloadMedia(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download media: ${res.statusText}`);
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType };
}
