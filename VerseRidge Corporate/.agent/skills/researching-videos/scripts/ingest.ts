import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { YoutubeTranscript } from 'youtube-transcript';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
    console.error("Error: YOUTUBE_API_KEY environment variable is not set.");
    process.exit(1);
}

const youtube = google.youtube({
    version: 'v3',
    auth: API_KEY
});

// Paths
const SKILL_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(SKILL_DIR, 'config', 'sources.json');
const OUTPUT_DIR = path.join(SKILL_DIR, 'output', 'raw');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface Source {
    id: string; // Channel ID
    name: string;
    trustScore: number;
}

interface SourcesConfig {
    sources: Source[];
}

async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
    try {
        const response = await youtube.channels.list({
            part: ['contentDetails'],
            id: [channelId]
        });

        const items = response.data.items;
        if (items && items.length > 0 && items[0].contentDetails?.relatedPlaylists?.uploads) {
            return items[0].contentDetails.relatedPlaylists.uploads;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching channel details for ${channelId}:`, error);
        return null;
    }
}

async function fetchRecentVideos(playlistId: string, maxResults: number = 5) {
    try {
        const response = await youtube.playlistItems.list({
            part: ['snippet', 'contentDetails'],
            playlistId: playlistId,
            maxResults: maxResults
        });
        return response.data.items || [];
    } catch (error) {
        console.error(`Error fetching playlist items for ${playlistId}:`, error);
        return [];
    }
}

async function ingest() {
    console.log("Starting video ingestion...");

    // Load sources
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(`Config file not found at ${CONFIG_PATH}`);
        return;
    }

    const config: SourcesConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    console.log(`Loaded ${config.sources.length} sources.`);

    for (const source of config.sources) {
        console.log(`Processing source: ${source.name} (${source.id})`);

        // 1. Get Uploads Playlist ID (Cost: 1 unit)
        const uploadsPlaylistId = await getUploadsPlaylistId(source.id);
        if (!uploadsPlaylistId) {
            console.warn(`Could not find uploads playlist for ${source.name}. Skipping.`);
            continue;
        }

        // 2. Fetch Recent Videos (Cost: 1 unit)
        const videos = await fetchRecentVideos(uploadsPlaylistId, 3); // Limit to 3 for now
        console.log(`Found ${videos.length} recent videos.`);

        for (const video of videos) {
            const videoId = video.contentDetails?.videoId;
            const title = video.snippet?.title;
            const publishedAt = video.snippet?.publishedAt;

            if (!videoId) continue;

            const outputFile = path.join(OUTPUT_DIR, `${videoId}.json`);
            if (fs.existsSync(outputFile)) {
                console.log(`Video ${videoId} already ingested. Skipping.`);
                continue;
            }

            console.log(`Ingesting video: ${title} (${videoId})`);

            try {
                // 3. Fetch Transcript
                const transcript = await YoutubeTranscript.fetchTranscript(videoId);

                // 4. Save Data
                const data = {
                    metadata: {
                        id: videoId,
                        title,
                        publishedAt,
                        channelId: source.id,
                        channelName: source.name,
                        trustScore: source.trustScore
                    },
                    transcript
                };

                fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
                console.log(`Saved to ${outputFile}`);
            } catch (error) {
                console.warn(`Could not fetch transcript for video ${videoId}:`, error);
                // Save metadata even if transcript fails? strict mode: no.
            }
        }
    }

    console.log("Ingestion complete.");
}

ingest().catch(console.error);
