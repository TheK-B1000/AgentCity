import fs from 'fs';
import path from 'path';

const SKILL_DIR = path.resolve(__dirname, '..');
const RAW_DIR = path.join(SKILL_DIR, 'output', 'raw');
const PROCESSED_DIR = path.join(SKILL_DIR, 'output', 'processed');
const CONSTITUTION_PATH = path.join(SKILL_DIR, 'config', 'constitution.md');

// Ensure output directory exists
if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

interface RawData {
    metadata: {
        id: string;
        title: string;
        publishedAt: string;
        channelId: string;
        channelName: string;
        trustScore: number;
    };
    transcript: {
        text: string;
        duration: number;
        offset: number;
    }[];
}

function cleanTranscript(raw: RawData): string {
    // Combine text segments
    const fullText = raw.transcript.map(t => t.text).join(' ');

    // Basic cleanup: fix spacing, remove encoded chars if any (youtube-transcript usually handles this well)
    // We can add more sophisticated structuring here later (e.g. segmentation by time)

    return fullText.replace(/\s+/g, ' ').trim();
}

/**
 * The Quality Gate checks if the content meets the Constitution's standards.
 * Currently a placeholder for keyword matching or LLM validation.
 */
function checkQualityGate(text: string, constitution: string): boolean {
    // Placeholder: Check for "how-to" keywords or length ??
    // Real implementation would invite the AI to judge.
    // For now, pass everything that isn't empty.
    if (text.length < 500) {
        console.log("Quality Gate Failed: Transcript too short.");
        return false;
    }
    return true;
}

async function processContent() {
    console.log("Starting content processing...");

    if (!fs.existsSync(RAW_DIR)) {
        console.log("No raw data found.");
        return;
    }

    const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} raw files.`);

    let constitution = "";
    if (fs.existsSync(CONSTITUTION_PATH)) {
        constitution = fs.readFileSync(CONSTITUTION_PATH, 'utf-8');
    } else {
        console.warn("Constitution not found!");
    }

    for (const file of files) {
        const rawPath = path.join(RAW_DIR, file);
        const rawData: RawData = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));

        console.log(`Processing ${rawData.metadata.title}...`);

        // 1. Clean Transcript
        const cleanedText = cleanTranscript(rawData);

        // 2. Structuring (Formatting as Markdown with Metadata)
        const structuredContent = `
# ${rawData.metadata.title}

**Source**: ${rawData.metadata.channelName}
**Published**: ${rawData.metadata.publishedAt}
**Trust Score**: ${rawData.metadata.trustScore}
**Video ID**: ${rawData.metadata.id}

## Transcript
${cleanedText}
`;

        // 3. Quality Gate
        if (checkQualityGate(cleanedText, constitution)) {
            const outputPath = path.join(PROCESSED_DIR, `${rawData.metadata.id}.md`);
            fs.writeFileSync(outputPath, structuredContent);
            console.log(`Passed Quality Gate. Saved to ${outputPath}`);
        } else {
            console.log(`Skipping ${rawData.metadata.title} - Failed Quality Gate.`);
        }
    }

    console.log("Processing complete.");
}

processContent().catch(console.error);
