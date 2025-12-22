let allData = [];
let currentRegion = 'all';
let selectedBenefits = new Set();
let isLoading = false;

// Co-benefit categories from CSV
const benefitCategories = [
  'air_quality', 'congestion', 'dampness', 'diet_change', 
  'excess_cold', 'excess_heat', 'hassle_costs', 'noise', 
  'physical_activity', 'road_repairs', 'road_safety'
];

const benefitLabels = {
  'air_quality': 'Air Quality',
  'congestion': 'Congestion',
  'dampness': 'Dampness',
  'diet_change': 'Diet Change',
  'excess_cold': 'Excess Cold',
  'excess_heat': 'Excess Heat',
  'hassle_costs': 'Hassle Costs',
  'noise': 'Noise',
  'physical_activity': 'Physical Activity',
  'road_repairs': 'Road Repairs',
  'road_safety': 'Road Safety'
};

function log(message) {
  if (window.DEBUG || false) {
    console.log(message);
  }
}

function showError(message) {
  log('ERROR: ' + message);
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'block';
  document.getElementById('error').textContent = message;
  isLoading = false;
}

function hideError() {
  document.getElementById('error').style.display = 'none';
}

function showLoading(message = 'Loading data...') {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('loading').textContent = message;
  document.getElementById('dashboard').style.display = 'none';
  isLoading = true;
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
  isLoading = false;
}

// Optimized CSV parser
function parseCSV(csvText) {
  log('Parsing CSV...');
  const lines = csvText.split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file appears to be empty or invalid');
  }
  
  const headers = lines[0].split(';');
  const rows = [];
  
  // Process all rows without async to avoid complexity
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    
    const values = lines[i].split(';');
    if (values.length >= headers.length) {
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j].trim()] = values[j] ? values[j].trim() : '';
      }
      rows.push(row);
    }
  }
  
  log(`Parsed ${rows.length} data rows`);
  return rows;
}

// Optimized data processing
function processData(rows) {
  log('Processing data...');
  
  // Pre-allocate array for better performance
  allData = new Array(rows.length);
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const processedRow = { small_area: row.small_area || `Area_${i}` };
    
    // Process all benefits in one loop
    for (let j = 0; j < benefitCategories.length; j++) {
      const category = benefitCategories[j];
      let value = row[category];
      if (value && value !== '') {
        value = value.replace(',', '.');
        processedRow[category] = parseFloat(value) || 0;
      } else {
        processedRow[category] = 0;
      }
    }
    
    // Handle sum column
    let sumValue = row.sum;
    if (sumValue && sumValue !== '') {
      sumValue = sumValue.replace(',', '.');
      processedRow.sum = parseFloat(sumValue) || 0;
    } else {
      processedRow.sum = 0;
    }
    
    allData[i] = processedRow;
  }

  log(`Processed ${allData.length} records`);
  if (allData.length > 0) {
    log('Sample record: ' + JSON.stringify(allData[0], null, 2));
    initializeDashboard();
  } else {
    showError('No valid data records found after processing');
  }
}

// Optimized CSV loading
function loadCSV() {
  if (isLoading) return;
  
  showLoading('Loading CSV data...');
  log('Starting CSV loading...');
  
  // Method 1: Try fetch first (most reliable)
  fetch('Level_1.csv')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    })
    .then(csvText => {
      log('CSV fetched successfully (' + csvText.length + ' characters)');
      
      // Use setTimeout to prevent blocking
      setTimeout(() => {
        try {
          const rows = parseCSV(csvText);
          processData(rows);
        } catch (error) {
          log('Error processing CSV: ' + error.message);
          tryPlotlyMethod();
        }
      }, 10);
    })
    .catch(fetchError => {
      log('Fetch failed: ' + fetchError.message);
      tryPlotlyMethod();
    });
}

function tryPlotlyMethod() {
  // Method 2: Try Plotly.d3.csv
  if (typeof Plotly !== 'undefined' && Plotly.d3) {
    log('Trying Plotly.d3.csv...');
    Plotly.d3.csv('Level_1.csv', function(err, rows) {
      if (err) {
        log('Plotly.d3.csv failed: ' + err.message);
        showError('Failed to load CSV data. Please check if Level_1.csv exists in the same directory.');
      } else {
        log('Plotly.d3.csv succeeded');
        setTimeout(() => processData(rows), 10);
      }
    });
  } else {
    log('Plotly.d3 not available');
    showError('Failed to load CSV data. Please check if Level_1.csv exists in the same directory.');
  }
}

function initializeDashboard() {
  if (isLoading) return;
  
  log('Initializing dashboard...');
  
  try {
    hideLoading();
    document.getElementById('dashboard').style.display = 'grid';
    
    // Use setTimeout to defer heavy operations
    setTimeout(() => {
      populateControls();
      selectedBenefits = new Set(benefitCategories);
      updateBenefitCheckboxes();
      
      // Defer chart creation
      setTimeout(() => {
        updateCharts();
      }, 50);
      
      log('Dashboard initialized successfully');
    }, 10);
    
  } catch (error) {
    log('Dashboard initialization error: ' + error.message);
    showError('Error initializing dashboard: ' + error.message);
  }
}

function populateControls() {
  log('Populating controls...');
  
  try {
    const regions = [...new Set(allData.map(d => d.small_area))].sort();
    const regionSelect = document.getElementById('regionSelect');
    
    log(`Found ${regions.length} regions`);
    
    // Clear existing options except first one
    while (regionSelect.children.length > 1) {
      regionSelect.removeChild(regionSelect.lastChild);
    }
    
    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    regions.forEach(region => {
      const option = document.createElement('option');
      option.value = region;
      option.textContent = region;
      fragment.appendChild(option);
    });
    
    regionSelect.appendChild(fragment);

    regionSelect.addEventListener('change', (e) => {
      currentRegion = e.target.value;
      updateRegionInfo();
    });
    
    log('Controls populated successfully');
  } catch (error) {
    log('Error populating controls: ' + error.message);
    throw error;
  }
}

function updateBenefitCheckboxes() {
  const container = document.getElementById('benefitCheckboxes');
  container.innerHTML = '';
  
  // Use fragment for better performance
  const fragment = document.createDocumentFragment();
  
  benefitCategories.forEach(category => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = category;
    checkbox.checked = selectedBenefits.has(category);
    
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedBenefits.add(category);
      } else {
        selectedBenefits.delete(category);
      }
    });
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(benefitLabels[category]));
    fragment.appendChild(label);
  });
  
  container.appendChild(fragment);
}

function getFilteredData() {
  let filtered = allData;
  if (currentRegion !== 'all') {
    filtered = filtered.filter(d => d.small_area === currentRegion);
  }
  return filtered;
}

function calculateStats() {
  const filtered = getFilteredData();
  const stats = {};
  
  selectedBenefits.forEach(benefit => {
    const values = filtered.map(d => d[benefit] || 0);
    stats[benefit] = {
      total: values.reduce((a, b) => a + b, 0),
      average: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
      positive: values.filter(v => v > 0).length,
      negative: values.filter(v => v < 0).length
    };
  });
  
  return stats;
}

function updateStatsDisplay() {
  const stats = calculateStats();
  const container = document.getElementById('statsContainer');
  container.innerHTML = '';
  
  const totalImpact = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
  const avgImpact = Object.keys(stats).length > 0 ? 
    Object.values(stats).reduce((sum, s) => sum + s.average, 0) / Object.keys(stats).length : 0;
  
  const statCards = [
    { title: 'Total Regions', value: getFilteredData().length, label: 'Areas analyzed' },
    { title: 'Total Impact', value: totalImpact.toFixed(2), label: 'Combined co-benefit score' },
    { title: 'Average Impact', value: avgImpact.toFixed(3), label: 'Per category average' },
    { title: 'Active Benefits', value: selectedBenefits.size, label: 'Categories selected' }
  ];
  
  // Use fragment for better performance
  const fragment = document.createDocumentFragment();
  
  statCards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'stat-card';
    div.innerHTML = `
      <h4>${card.title}</h4>
      <div class="stat-value">${card.value}</div>
      <div class="stat-label">${card.label}</div>
    `;
    fragment.appendChild(div);
  });
  
  container.appendChild(fragment);
}

function updateRegionInfo() {
  const info = document.getElementById('regionInfo');
  if (currentRegion === 'all') {
    info.textContent = 'Showing data for all regions';
  } else {
    const regionData = allData.find(d => d.small_area === currentRegion);
    if (regionData) {
      const totalImpact = selectedBenefits.size > 0 ? 
        Array.from(selectedBenefits).reduce((sum, b) => sum + (regionData[b] || 0), 0) : 0;
      info.innerHTML = `
        <strong>${currentRegion}</strong><br>
        Total Impact: ${totalImpact.toFixed(3)}<br>
        Categories: ${selectedBenefits.size} selected
      `;
    }
  }
}

function createMainChart() {
  const filtered = getFilteredData();
  const chartType = document.getElementById('chartType').value;
  
  let data = [];
  
  if (chartType === 'bar') {
    selectedBenefits.forEach(benefit => {
      const values = filtered.map(d => d[benefit] || 0);
      data.push({
        x: filtered.map(d => d.small_area),
        y: values,
        name: benefitLabels[benefit],
        type: 'bar',
        marker: { color: getColorForBenefit(benefit) }
      });
    });
  } else if (chartType === 'scatter') {
    selectedBenefits.forEach(benefit => {
      const values = filtered.map(d => d[benefit] || 0);
      data.push({
        x: filtered.map((d, i) => i),
        y: values,
        mode: 'markers',
        name: benefitLabels[benefit],
        type: 'scatter',
        marker: { 
          color: getColorForBenefit(benefit),
          size: 8
        }
      });
    });
  } else if (chartType === 'pie') {
    const aggregated = {};
    selectedBenefits.forEach(benefit => {
      const total = filtered.reduce((sum, d) => sum + (d[benefit] || 0), 0);
      aggregated[benefitLabels[benefit]] = Math.abs(total);
    });
    
    data.push({
      labels: Object.keys(aggregated),
      values: Object.values(aggregated),
      type: 'pie',
      hole: 0.4
    });
  } else if (chartType === 'heatmap') {
    const matrix = [];
    selectedBenefits.forEach(benefit => {
      const row = filtered.map(d => d[benefit] || 0);
      matrix.push(row);
    });
    
    data.push({
      z: matrix,
      x: filtered.map(d => d.small_area),
      y: Array.from(selectedBenefits).map(b => benefitLabels[b]),
      type: 'heatmap',
      colorscale: 'RdYlBu'
    });
  }
  
  const layout = {
    title: `Co-benefits Analysis (${chartType.charAt(0).toUpperCase() + chartType.slice(1)})`,
    xaxis: { title: chartType === 'heatmap' ? 'Regions' : 'Region' },
    yaxis: { title: chartType === 'heatmap' ? 'Co-benefit Category' : 'Impact Value' },
    margin: { b: 100 },
    height: 350
  };
  
  Plotly.newPlot('mainChart', data, layout);
}

function createComparisonChart() {
  const filtered = getFilteredData();
  
  const data = [{
    type: 'bar',
    x: filtered.map(d => d.small_area),
    y: filtered.map(d => {
      return Array.from(selectedBenefits).reduce((sum, b) => sum + (d[b] || 0), 0);
    }),
    marker: { 
      color: filtered.map(d => {
        const total = Array.from(selectedBenefits).reduce((sum, b) => sum + (d[b] || 0), 0);
        return total >= 0 ? '#2ecc71' : '#e74c3c';
      })
    },
    name: 'Total Impact'
  }];
  
  const layout = {
    title: 'Regional Total Impact Comparison',
    xaxis: { title: 'Region' },
    yaxis: { title: 'Total Impact Score' },
    margin: { b: 100 },
    height: 350
  };
  
  Plotly.newPlot('comparisonChart', data, layout);
}

function createDetailChart() {
  const filtered = getFilteredData();
  
  if (currentRegion === 'all') {
    // Show top 10 regions by total impact
    const regionTotals = {};
    filtered.forEach(d => {
      const total = Array.from(selectedBenefits).reduce((sum, b) => sum + (d[b] || 0), 0);
      regionTotals[d.small_area] = total;
    });
    
    const sortedRegions = Object.entries(regionTotals)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 10);
    
    const data = [{
      type: 'bar',
      x: sortedRegions.map(r => r[0]),
      y: sortedRegions.map(r => r[1]),
      marker: { 
        color: sortedRegions.map(r => r[1] >= 0 ? '#3498db' : '#e67e22')
      },
      name: 'Total Impact'
    }];
    
    const layout = {
      title: 'Top 10 Regions by Impact',
      xaxis: { title: 'Region' },
      yaxis: { title: 'Total Impact Score' },
      margin: { b: 100 },
      height: 400
    };
    
    Plotly.newPlot('detailChart', data, layout);
  } else {
    // Show detailed breakdown for selected region
    const regionData = filtered.find(d => d.small_area === currentRegion);
    if (regionData) {
      const benefitData = Array.from(selectedBenefits).map(benefit => ({
        category: benefitLabels[benefit],
        value: regionData[benefit] || 0
      }));
      
      const data = [{
        type: 'bar',
        x: benefitData.map(d => d.category),
        y: benefitData.map(d => d.value),
        marker: { 
          color: benefitData.map(d => d.value >= 0 ? '#27ae60' : '#c0392b')
        },
        name: 'Impact Value'
      }];
      
      const layout = {
        title: `Detailed Breakdown for ${currentRegion}`,
        xaxis: { title: 'Co-benefit Category' },
        yaxis: { title: 'Impact Value' },
        margin: { b: 100 },
        height: 400
      };
      
      Plotly.newPlot('detailChart', data, layout);
    }
  }
}

function getColorForBenefit(benefit) {
  const colors = {
    'air_quality': '#3498db',
    'congestion': '#e74c3c',
    'dampness': '#f39c12',
    'diet_change': '#2ecc71',
    'excess_cold': '#9b59b6',
    'excess_heat': '#e67e22',
    'hassle_costs': '#34495e',
    'noise': '#16a085',
    'physical_activity': '#27ae60',
    'road_repairs': '#d35400',
    'road_safety': '#c0392b'
  };
  return colors[benefit] || '#95a5a6';
}

function updateCharts() {
  if (isLoading) return;
  
  log('Updating charts...');
  
  if (selectedBenefits.size === 0) {
    showError('Please select at least one co-benefit category');
    return;
  }
  
  try {
    // Update stats first (fast operation)
    updateStatsDisplay();
    updateRegionInfo();
    
    // Defer chart creation to prevent blocking
    setTimeout(() => {
      try {
        createMainChart();
        createComparisonChart();
        createDetailChart();
        log('Charts updated successfully');
      } catch (error) {
        log('Error creating charts: ' + error.message);
        showError('Error creating charts: ' + error.message);
      }
    }, 10);
    
  } catch (error) {
    log('Error updating charts: ' + error.message);
    showError('Error updating charts: ' + error.message);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  log('Page loaded');
  
  // Check if Plotly is available
  if (typeof Plotly === 'undefined') {
    showError('Plotly library failed to load. Please check your internet connection and refresh.');
    return;
  }
  
  log('Plotly loaded successfully');
  
  // Start loading data immediately with minimal delay
  setTimeout(() => {
    hideError();
    loadCSV();
  }, 100);
});

// Global error handler
window.addEventListener('error', function(e) {
  log('JavaScript error: ' + e.error.message);
});