const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'src');

const map = {
  "text-white": "text-slate-900 dark:text-white",
  "text-slate-200": "text-slate-700 dark:text-slate-200",
  "text-slate-300": "text-slate-600 dark:text-slate-300",
  "text-slate-400": "text-slate-500 dark:text-slate-400",
  
  "bg-slate-950": "bg-white dark:bg-slate-950",
  "bg-slate-900": "bg-slate-50 dark:bg-slate-900",
  "bg-slate-800": "bg-slate-100 dark:bg-slate-800",
  
  "border-slate-800": "border-slate-200 dark:border-slate-800",
  "border-slate-700": "border-slate-300 dark:border-slate-700"
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  
  Object.keys(map).forEach(darkClass => {
    // Only match standalone classes, not already prefixed with dark:
    const regex = new RegExp(`(?<!dark:)(?<![\\w-])(${darkClass})(?![\\w-])`, 'g');
    content = content.replace(regex, map[darkClass]);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

function traverseDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.css')) {
      processFile(fullPath);
    }
  });
}

traverseDir(directory);
console.log("Done adding dark prefixes.");
