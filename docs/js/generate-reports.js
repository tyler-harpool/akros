/**
 * This script generates the GitHub Pages website content from the betting reports.
 * It should be run as part of the GitHub Actions workflow after the betting analysis.
 */

const fs = require('fs');
const path = require('path');
const marked = require('marked');

// Directories
const reportsDir = path.join(__dirname, '../../reports');
const docsDir = path.join(__dirname, '..');
const dataDir = path.join(docsDir, 'data');

// Create directories if they don't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Generate index of all betting reports
 */
function generateReportsIndex() {
  const reports = [];

  // Walk through the reports directory
  const dates = fs.readdirSync(reportsDir)
    .filter(item => {
      const fullPath = path.join(reportsDir, item);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort()
    .reverse(); // Most recent first

  // Process each date directory
  dates.forEach(date => {
    const dateDir = path.join(reportsDir, date);
    const files = fs.readdirSync(dateDir)
      .filter(file => file.startsWith('recommended_bets_') && file.endsWith('.md'));

    if (files.length > 0) {
      // Sort by time if multiple reports on same day
      files.sort().reverse();

      // Get the first (most recent) report
      const reportFile = files[0];
      const reportPath = path.join(dateDir, reportFile);
      const content = fs.readFileSync(reportPath, 'utf8');

      // Extract meta information
      const betsCount = (content.match(/\| /g) || []).length - 1; // Count table rows excluding header

      reports.push({
        date: date,
        timestamp: reportFile.replace('recommended_bets_', '').replace('.md', ''),
        path: `data/${date}_${reportFile}`,
        betsCount: betsCount > 0 ? betsCount : 'N/A'
      });

      // Copy the file to docs/data
      fs.copyFileSync(
        reportPath,
        path.join(dataDir, `${date}_${reportFile}`)
      );
    }
  });

  // Write the index file
  fs.writeFileSync(
    path.join(dataDir, 'reports-index.json'),
    JSON.stringify(reports, null, 2)
  );

  return reports;
}

/**
 * Generate the latest report data
 */
function generateLatestReport(reports) {
  if (reports.length === 0) {
    console.log('No reports found');
    return;
  }

  // Get the most recent report
  const latest = reports[0];
  const reportPath = path.join(dataDir, latest.path.split('/').pop());

  // Read the content
  const content = fs.readFileSync(reportPath, 'utf8');

  // Convert markdown to HTML
  const html = marked.parse(content);

  // Write the latest report data
  fs.writeFileSync(
    path.join(dataDir, 'latest.json'),
    JSON.stringify({
      date: latest.date,
      timestamp: latest.timestamp,
      content: html
    }, null, 2)
  );

  return latest;
}

/**
 * Update the main page script with the latest date
 */
function updateMainPage(latest) {
  if (!latest) {
    console.log('No latest report to update main page with');
    return;
  }

  // Format the date for display
  const dateParts = latest.date.split('-');
  const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Read the main.js file
  const mainJsPath = path.join(docsDir, 'js', 'main.js');
  let mainJs = fs.existsSync(mainJsPath) ?
    fs.readFileSync(mainJsPath, 'utf8') :
    '// NBA Edge Detection main JavaScript file\n\n';

  // Update the latest date
  mainJs = mainJs.replace(
    /const LATEST_REPORT_DATE = .*;/,
    `const LATEST_REPORT_DATE = "${formattedDate}";`
  );

  // If the constant doesn't exist yet, add it
  if (!mainJs.includes('LATEST_REPORT_DATE')) {
    mainJs += `\n// Latest report information
const LATEST_REPORT_DATE = "${formattedDate}";
const LATEST_REPORT_PATH = "data/${latest.path.split('/').pop()}";
`;
  }

  // Write back the updated main.js
  fs.writeFileSync(mainJsPath, mainJs);
}

/**
 * Main function
 */
function main() {
  console.log('Generating GitHub Pages content from betting reports...');

  // Generate the reports index
  const reports = generateReportsIndex();
  console.log(`Found ${reports.length} reports`);

  // Generate the latest report data
  const latest = generateLatestReport(reports);
  if (latest) {
    console.log(`Latest report: ${latest.date}`);
  }

  // Update the main page
  updateMainPage(latest);

  console.log('GitHub Pages content generation complete');
}

// Run the main function
main();
