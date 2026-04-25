const { execSync } = require('child_process');

const REPO_PATH = 'e:/TA/Exams Site';
const INTERVAL = 60000; // 1 minute interval for safety

function runGit(args) {
    try {
        return execSync(`git -C "${REPO_PATH}" ${args}`).toString().trim();
    } catch (err) {
        return null;
    }
}

function sync() {
    console.log(`[${new Date().toLocaleTimeString()}] Checking for changes...`);
    
    const status = runGit('status --short');
    if (status) {
        console.log('Changes detected. Committing and pushing...');
        runGit('add .');
        const commitRes = runGit('commit -m "Auto-sync: ' + new Date().toISOString() + '"');
        if (commitRes) {
            console.log('Pushing to main...');
            const pushRes = runGit('push origin main');
            if (pushRes !== null) {
                console.log('Sync successful.');
            } else {
                console.warn('Push failed. Make sure remote is set up and authenticated.');
            }
        }
    } else {
        console.log('No changes detected.');
    }
}

// Initial check
console.log('Starting Auto-GitHub Sync...');
sync();

// Set interval
setInterval(sync, INTERVAL);
