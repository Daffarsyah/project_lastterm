let allData = [];
let currentRegion = 'all';
let selectedBenefits = new Set();

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

// Simple ultra-fast CSV parser
function parseSimpleCSV(text) {
  const lines = text.split('\n');
  const result = [];
  const headers = lines[0].split(';');
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    
    const values = lines[i].split(';');
    const row = {};
    
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    
    result.push(row);
  }
  
  return result;
}

// Process data with minimal overhead
function processRawData(rawRows) {
  allData = [];
  
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const processedRow = { small_area: row.small_area || `Area_${i}` };
    
    for (let j = 0; j < benefitCategories.length; j++) {
      const category = benefitCategories[j];
      let value = row[category];
      processedRow[category] = value ? parseFloat(value.replace(',', '.')) || 0 : 0;
    }
    
    processedRow.sum = row.sum ? parseFloat(row.sum.replace(',', '.')) || 0 : 0;
    allData.push(processedRow);
  }
  
  console.log('Processed', allData.length, 'records');
  initializeDashboard();
}

// Load CSV with multiple methods
function loadCSVData() {
  console.log('Starting CSV load...');
  
  // Method 1: XMLHttpRequest (most compatible)
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'Level_1.csv', true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        console.log('CSV loaded via XHR');
        const rawData = parseSimpleCSV(xhr.responseText);
        processRawData(rawData);
      } else {
        console.log('XHR failed, trying fetch...');
        tryFetchMethod();
      }
    }
  };
  xhr.send();
}

function tryFetchMethod() {
  fetch('Level_1.csv')
    .then(response => response.text())
    .then(text => {
      console.log('CSV loaded via fetch');
      const rawData = parseSimpleCSV(text);
      processRawData(rawData);
    })
    .catch(error => {
      console.log('Fetch failed, trying Plotly...');
      tryPlotlyMethod();
    });
}

function tryPlotlyMethod() {
  if (typeof Plotly !== 'undefined' && Plotly.d3) {
    Plotly.d3.csv('Level_1.csv', function(err, rows) {
      if (!err) {
        console.log('CSV loaded via Plotly');
        processRawData(rows);
      } else {
        console.error('All methods failed');
        showError('Failed to load CSV data. Please check if Level_1.csv exists.');
      }
    });
  } else {
    console.error('Plotly not available');
    showError('Failed to load CSV data. Please check if Level_1.csv exists.');
  }
}

function showError(message) {
  console.error(message);
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'block';
  document.getElementById('error').textContent = message;
}

function initializeDashboard() {
  console.log('Initializing dashboard...');
  
  try {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard').style.display = 'grid';
    
    populateControls();
    selectedBenefits = new Set(benefitCategories);
    updateBenefitCheckboxes();
    updateCharts();
    
    console.log('Dashboard ready');
  } catch (error) {
    console.error('Dashboard error:', error);
    showError('Error initializing dashboard: ' + error.message);
  }
}

function populateControls() {
  const regions = [...new Set(allData.map(d => d.small_area))].sort();
  const regionSelect = document.getElementById('regionSelect');
  
  // Clear existing options
  while (regionSelect.children.length > 1) {
    regionSelect.removeChild(regionSelect.lastChild);
  }
  
  regions.forEach(region => {
    const option = document.createElement('option');
    option.value = region;
    option.textContent = region;
    regionSelect.appendChild(option);
  });

  regionSelect.addEventListener('change', (e) => {
    currentRegion = e.target.value;
    updateRegionInfo();
  });
}

function updateBenefitCheckboxes() {
  const container = document.getElementById('benefitCheckboxes');
  container.innerHTML = '';
  
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
    container.appendChild(label);
  });
}

function getFilteredData() {
  let filtered = allData;
  if (currentRegion !== 'all') {
    filtered = filtered.filter(d => d.small_area === currentRegion);
  }
  return filtered;
}

function updateStatsDisplay() {
  const filtered = getFilteredData();
  const container = document.getElementById('statsContainer');
  container.innerHTML = '';
  
  const totalImpact = Array.from(selectedBenefits).reduce((sum, b) => 
    sum + filtered.reduce((s, d) => s + (d[b] || 0), 0), 0);
  
  const statCards = [
    { title: 'Total Regions', value: filtered.length, label: 'Areas analyzed' },
    { title: 'Total Impact', value: totalImpact.toFixed(2), label: 'Combined score' },
    { title: 'Active Benefits', value: selectedBenefits.size, label: 'Categories' }
  ];
  
  statCards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'stat-card';
    div.innerHTML = `
      <h4>${card.title}</h4>
      <div class="stat-value">${card.value}</div>
      <div class="stat-label">${card.label}</div>
    `;
    container.appendChild(div);
  });
}

function updateRegionInfo() {
  const info = document.getElementById('regionInfo');
  if (currentRegion === 'all') {
    info.textContent = 'Showing data for all regions';
  } else {
    const regionData = allData.find(d => d.small_area === currentRegion);
    if (regionData) {
      const totalImpact = Array.from(selectedBenefits).reduce((sum, b) => sum + (regionData[b] || 0), 0);
      info.innerHTML = `<strong>${currentRegion}</strong><br>Total Impact: ${totalImpact.toFixed(3)}`;
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
        type: 'bar'
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
      type: 'pie'
    });
  }
  
  const layout = {
    title: `Co-benefits Analysis (${chartType})`,
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
    name: 'Total Impact'
  }];
  
  const layout = {
    title: 'Regional Impact Comparison',
    height: 350
  };
  
  Plotly.newPlot('comparisonChart', data, layout);
}

function createDetailChart() {
  const filtered = getFilteredData();
  
  if (currentRegion === 'all') {
    // Show top 10 regions
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
      name: 'Total Impact'
    }];
    
    const layout = {
      title: 'Top 10 Regions by Impact',
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
        name: 'Impact Value'
      }];
      
      const layout = {
        title: `Detailed Breakdown for ${currentRegion}`,
        height: 400
      };
      
      Plotly.newPlot('detailChart', data, layout);
    }
  }
}

function updateCharts() {
  if (selectedBenefits.size === 0) {
    showError('Please select at least one co-benefit category');
    return;
  }
  
  try {
    updateStatsDisplay();
    updateRegionInfo();
    createMainChart();
    createComparisonChart();
    createDetailChart();
  } catch (error) {
    console.error('Chart update error:', error);
    showError('Error updating charts: ' + error.message);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('Page loaded, starting data load...');
  
  // Check if Plotly is available
  if (typeof Plotly === 'undefined') {
    showError('Plotly library failed to load. Please check your internet connection.');
    return;
  }
  
  // Load data immediately
  loadCSVData();
});

// Global error handler
window.addEventListener('error', function(e) {
  console.error('JavaScript error:', e.error);
});