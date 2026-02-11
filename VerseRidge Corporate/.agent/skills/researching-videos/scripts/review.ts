import fs from 'fs';
import path from 'path';
import readline from 'readline';

const SKILL_DIR = path.resolve(__dirname, '..');
const PROCESSED_DIR = path.join(SKILL_DIR, 'output', 'processed');
const FINAL_DIR = path.join(SKILL_DIR, 'output', 'final');
const REJECTED_DIR = path.join(SKILL_DIR, 'output', 'rejected');

// Ensure directories exist
[FINAL_DIR, REJECTED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve));
}

async function review() {
    console.log("Starting Review Process...");

    if (!fs.existsSync(PROCESSED_DIR)) {
        console.log("No processed files found.");
        rl.close();
        return;
    }

    const files = fs.readdirSync(PROCESSED_DIR).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} files to review.`);

    for (const file of files) {
        const filePath = path.join(PROCESSED_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        console.log("\n------------------------------------------------");
        console.log(`REVIEWING: ${file}`);
        console.log("------------------------------------------------");
        console.log(content.slice(0, 500) + "\n... (truncated) ...");
        console.log("------------------------------------------------");

        const answer = await askQuestion("Approve this content? (y/n/skip): ");

        if (answer.toLowerCase() === 'y') {
            const dest = path.join(FINAL_DIR, file);
            fs.renameSync(filePath, dest);
            console.log(`✅ Approved! Moved to ${dest}`);
        } else if (answer.toLowerCase() === 'n') {
            const dest = path.join(REJECTED_DIR, file);
            fs.renameSync(filePath, dest);
            console.log(`❌ Rejected. Moved to ${dest}`);
        } else {
            console.log("Skipped.");
        }
    }

    console.log("\nReview session complete.");
    rl.close();
}

review().catch(console.error);
