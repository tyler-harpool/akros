// NBA Edge Detection main JavaScript file

// Latest report information - will be updated by generate-reports.js
const LATEST_REPORT_DATE = "Saturday, May 10, 2025";
const LATEST_REPORT_FILE = "latest.json";

// Function to load the latest bets
async function loadLatestBets() {
  try {
    const response = await fetch(`data/${LATEST_REPORT_FILE}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Update the latest date
    document.getElementById('latest-date').textContent = data.date;

    // Extract just the table from the HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = data.content;

    // Find the first table in the content
    const table = tempDiv.querySelector('table');

    if (table) {
      // Add custom classes
      table.classList.add('bet-table');

      // Process the rows to add unit badges
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
          const stakeCell = cells[4]; // The stake column (assuming it's the 5th column)
          const stakeText = stakeCell.textContent.trim();
          const unitMatch = stakeText.match(/(\d+)\s*Units?/i);

          if (unitMatch) {
            const units = parseInt(unitMatch[1]);
            if (units >= 1 && units <= 5) {
              stakeCell.innerHTML = `<span class="unit-badge unit-${units}">${units} Units</span>`;
            }
          }
        }
      });

      document.getElementById('latest-bets').innerHTML = '';
      document.getElementById('latest-bets').appendChild(table);
    } else {
      document.getElementById('latest-bets').innerHTML = '<p class="text-center">No betting recommendations available for today.</p>';
    }
  } catch (error) {
    console.error('Error loading latest bets:', error);
    document.getElementById('latest-bets').innerHTML = '<p class="text-center text-danger">Error loading the latest betting recommendations. Please try again later.</p>';
  }
}

// Function to load the reports archive
async function loadReportsArchive() {
  try {
    const response = await fetch('data/reports-index.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const reports = await response.json();

    if (reports.length === 0) {
      document.getElementById('archive-list').innerHTML = '<p class="text-center">No archived reports available yet.</p>';
      return;
    }

    let archiveHtml = '';
    reports.forEach(report => {
      // Format the date
      const dateParts = report.date.split('-');
      const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });

      archiveHtml += `
        <div class="col-md-4 col-lg-3 mb-4">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">${formattedDate}</h5>
              <p class="card-text">
                ${report.betsCount} recommended bets
              </p>
              <a href="${report.path}" class="btn btn-primary" target="_blank">View Bets</a>
            </div>
          </div>
        </div>
      `;
    });

    document.getElementById('archive-list').innerHTML = archiveHtml;
  } catch (error) {
    console.error('Error loading reports archive:', error);
    document.getElementById('archive-list').innerHTML = '<p class="text-center text-danger">Error loading the archive. Please try again later.</p>';
  }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  // Update the welcome message with today's date
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  const welcomeDate = document.getElementById('welcome-date');
  if (welcomeDate) {
    welcomeDate.textContent = formattedDate;
  }

  // Load the latest bets
  loadLatestBets();

  // Load the reports archive
  loadReportsArchive();
});
