let allData = [];
let currentRegion = "all";
let selectedBenefits = new Set();
let topN = 30;

const benefitCategories = [
  "air_quality", "congestion", "dampness", "diet_change",
  "excess_cold", "excess_heat", "hassle_costs", "noise",
  "physical_activity", "road_repairs", "road_safety"
];

const benefitLabels = {
  air_quality: "Air Quality",
  congestion: "Congestion",
  dampness: "Dampness",
  diet_change: "Diet Change",
  excess_cold: "Excess Cold",
  excess_heat: "Excess Heat",
  hassle_costs: "Hassle Costs",
  noise: "Noise",
  physical_activity: "Physical Activity",
  road_repairs: "Road Repairs",
  road_safety: "Road Safety",
};

// Cache for speed + credibility
const cache = {
  byArea: new Map(),              // small_area -> row
  totalsByBenefitAll: {},         // benefit -> total (all rows)
  topAreasBySum: [],              // ranked by dataset sum desc
  meta: { rows: 0, areas: 0, sumMin: 0, sumMax: 0, sumTotal: 0 }
};

function toNum(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// CSV parser (delimiter ;)
function parseSimpleCSV(text) {
  const lines = text.split("\n");
  const headers = lines[0].trim().split(";");
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;

    const values = line.split(";");
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    result.push(row);
  }
  return result;
}

function showError(message) {
  console.error(message);
  document.getElementById("loading").style.display = "none";
  document.getElementById("dashboard").style.display = "none";
  document.getElementById("error").style.display = "block";
  document.getElementById("error").textContent = message;
}

function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function loadCSVData() {
  fetch("Level_1.csv")
    .then(r => {
      if (!r.ok) throw new Error("CSV not found / blocked. Use Live Server.");
      return r.text();
    })
    .then(text => processRawData(parseSimpleCSV(text)))
    .catch(err => showError("Failed to load CSV: " + err.message));
}

function processRawData(rawRows) {
  allData = [];
  cache.byArea.clear();
  cache.totalsByBenefitAll = {};
  for (const b of benefitCategories) cache.totalsByBenefitAll[b] = 0;

  let sumMin = Infinity, sumMax = -Infinity, sumTotal = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const small_area = row.small_area || `Area_${i}`;
    const processed = { small_area };

    // co-benefits
    let selectedColsTotalAll = 0;
    for (const b of benefitCategories) {
      const val = toNum(row[b]);
      processed[b] = val;
      selectedColsTotalAll += val;
      cache.totalsByBenefitAll[b] += val;
    }

    // dataset sum (credible total metric)
    const s = toNum(row.sum);
    processed.sum = s;

    processed._selectedColsTotalAll = selectedColsTotalAll;

    allData.push(processed);
    cache.byArea.set(small_area, processed);

    sumMin = Math.min(sumMin, s);
    sumMax = Math.max(sumMax, s);
    sumTotal += s;
  }

  cache.meta.rows = allData.length;
  cache.meta.areas = allData.length; // in your dataset: 1 row = 1 area
  cache.meta.sumMin = Number.isFinite(sumMin) ? sumMin : 0;
  cache.meta.sumMax = Number.isFinite(sumMax) ? sumMax : 0;
  cache.meta.sumTotal = sumTotal;

  // Rank by dataset sum descending (no abs) for accuracy
  cache.topAreasBySum = [...allData]
    .sort((a, b) => (b.sum - a.sum))
    .map(d => d.small_area);

  initializeDashboard();
}

function initializeDashboard() {
  document.getElementById("loading").style.display = "none";
  document.getElementById("error").style.display = "none";
  document.getElementById("dashboard").style.display = "grid";

  selectedBenefits = new Set(benefitCategories);

  wireControls();
  renderBenefitCheckboxes();
  refreshRegionOptions(""); // initial list
  updateAllUI();            // first render

  // Footer meta (credibility)
  document.getElementById("footerMeta").textContent =
    `Loaded ${cache.meta.rows.toLocaleString()} rows | Total Impact (all) = ${cache.meta.sumTotal.toFixed(2)} | Range: [${cache.meta.sumMin.toFixed(2)} … ${cache.meta.sumMax.toFixed(2)}]`;
}

function wireControls() {
  const regionSelect = document.getElementById("regionSelect");
  const chartType = document.getElementById("chartType");
  const topNSelect = document.getElementById("topN");

  const updateDebounced = debounce(updateAllUI, 150);

  // dropdown change -> update
  regionSelect.addEventListener("change", (e) => {
    currentRegion = e.target.value;
    updateDebounced();
  });

  chartType.addEventListener("change", updateDebounced);

  topNSelect.addEventListener("change", (e) => {
    topN = parseInt(e.target.value, 10) || 30;
    updateDebounced();
  });
}


function renderBenefitCheckboxes() {
  const container = document.getElementById("benefitCheckboxes");
  container.innerHTML = "";

  const updateDebounced = debounce(updateAllUI, 150);

  for (const b of benefitCategories) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = b;
    cb.checked = selectedBenefits.has(b);

    cb.addEventListener("change", (e) => {
      if (e.target.checked) selectedBenefits.add(b);
      else selectedBenefits.delete(b);
      updateDebounced();
    });

    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + benefitLabels[b]));
    container.appendChild(label);
  }
}

function refreshRegionOptions(query) {
  const regionSelect = document.getElementById("regionSelect");
  while (regionSelect.children.length > 1) regionSelect.removeChild(regionSelect.lastChild);

  const q = (query || "").trim().toLowerCase();
  let list;

  if (!q) {
    list = cache.topAreasBySum.slice(0, 300);
  } else {
    const matches = [];
    for (let i = 0; i < cache.topAreasBySum.length; i++) {
      const area = cache.topAreasBySum[i];
      if (area.toLowerCase().includes(q)) {
        matches.push(area);
        if (matches.length >= 200) break;
      }
    }
    list = matches.length ? matches : cache.topAreasBySum.slice(0, 50);
  }

  for (const area of list) {
    const opt = document.createElement("option");
    opt.value = area;
    opt.textContent = area;
    regionSelect.appendChild(opt);
  }

  return list; // ✅ penting
}


function setModeBadge() {
  const badge = document.getElementById("modeBadge");
  badge.textContent = (currentRegion === "all") ? "Overview Mode" : "Detail Mode";
}

function sumSelectedBenefitsRow(row) {
  let t = 0;
  for (const b of selectedBenefits) t += row[b] || 0;
  return t;
}

function sumSelectedBenefitsAll() {
  let t = 0;
  for (const b of selectedBenefits) t += cache.totalsByBenefitAll[b] || 0;
  return t;
}

function getTopNAreasBySum(n) {
  const list = cache.topAreasBySum.slice(0, n);
  return list.map(area => {
    const row = cache.byArea.get(area);
    return { area, value: row ? row.sum : 0 };
  });
}

function getTopNAreasBySelected(n) {
  // only used for heatmap/scatter sampling; keep size small
  const arr = new Array(allData.length);
  for (let i = 0; i < allData.length; i++) {
    const row = allData[i];
    arr[i] = { area: row.small_area, value: sumSelectedBenefitsRow(row) };
  }
  arr.sort((a, b) => (b.value - a.value));
  return arr.slice(0, n);
}

function updateRegionInfo() {
  const info = document.getElementById("regionInfo");
  if (currentRegion === "all") {
    info.innerHTML =
      `Showing <strong>All Areas</strong><br>
       <strong>Total Impact</strong> uses dataset <code>sum</code> (ranking Top-N).<br>
       <strong>Selected Impact</strong> uses chosen co-benefit columns (interactive).`;
  } else {
    const row = cache.byArea.get(currentRegion);
    if (!row) {
      info.textContent = "Area not found in loaded data";
      return;
    }
    const selectedImpact = sumSelectedBenefitsRow(row);
    info.innerHTML =
      `<strong>${currentRegion}</strong><br>
       Total Impact (sum): <strong>${row.sum.toFixed(3)}</strong><br>
       Selected Impact: <strong>${selectedImpact.toFixed(3)}</strong>`;
  }
}

function updateStatsCards() {
  const container = document.getElementById("statsContainer");
  container.innerHTML = "";

  const selectedImpact = (currentRegion === "all")
    ? sumSelectedBenefitsAll()
    : (cache.byArea.get(currentRegion) ? sumSelectedBenefitsRow(cache.byArea.get(currentRegion)) : 0);

  const totalImpactSum = (currentRegion === "all")
    ? cache.meta.sumTotal
    : (cache.byArea.get(currentRegion)?.sum || 0);

  // Insight: top benefit based on totals (all) or selected region
  const topBenefit = getTopBenefit();

  const cards = [
    { title: "Rows Loaded", value: cache.meta.rows.toLocaleString(), label: "Data records" },
    { title: "Total Impact", value: totalImpactSum.toFixed(2), label: "Dataset reference metric" },
    { title: "Selected Impact", value: selectedImpact.toFixed(2), label: "From chosen co-benefits" },
    { title: "Active Benefits", value: selectedBenefits.size, label: "Selected categories" },
    { title: "Top Benefit", value: topBenefit ? topBenefit.label : "-", label: "Highest contribution" },
  ];

  for (const c of cards) {
    const div = document.createElement("div");
    div.className = "stat-card";
    div.innerHTML = `
      <h4>${c.title}</h4>
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${c.label}</div>
    `;
    container.appendChild(div);
  }
}

function getTopBenefit() {
  let best = null;
  let bestScore = -Infinity;

  if (selectedBenefits.size === 0) return null;

  if (currentRegion === "all") {
    for (const b of selectedBenefits) {
      const v = cache.totalsByBenefitAll[b] || 0;
      if (v > bestScore) {
        bestScore = v;
        best = b;
      }
    }
  } else {
    const row = cache.byArea.get(currentRegion);
    if (!row) return null;
    for (const b of selectedBenefits) {
      const v = row[b] || 0;
      if (v > bestScore) {
        bestScore = v;
        best = b;
      }
    }
  }

  return best ? { key: best, label: benefitLabels[best], value: bestScore } : null;
}

function updateTakeaways() {
  const ul = document.getElementById("takeawaysList");
  ul.innerHTML = "";

  const topSum = getTopNAreasBySum(1)[0];
  const topBenefit = getTopBenefit();

  const li1 = document.createElement("li");
  li1.textContent =
    topBenefit
      ? `Top co-benefit contribution is “${topBenefit.label}” (based on current view).`
      : "Select at least one co-benefit category to see insights.";

  const li2 = document.createElement("li");
  li2.textContent =
    topSum
      ? `Highest Total Impact area is “${topSum.area}” with Total Impact = ${topSum.value.toFixed(3)}.`
      : "Top area could not be computed.";

  const li3 = document.createElement("li");
  if (currentRegion === "all") {
    li3.textContent =
      `Overview charts aggregate all areas; comparison charts show Top-${topN} by dataset sum to remain fast and readable.`;
  } else {
    const row = cache.byArea.get(currentRegion);
    const selectedImpact = row ? sumSelectedBenefitsRow(row) : 0;
    li3.textContent =
      `For “${currentRegion}”: Total Impact (sum) = ${(row?.sum || 0).toFixed(3)}, Selected Impact = ${selectedImpact.toFixed(3)}.`;
  }

  ul.appendChild(li1);
  ul.appendChild(li2);
  ul.appendChild(li3);
}

const plotConfig = { responsive: true, displayModeBar: false };

function baseLayout(title, height, xTitle, yTitle) {
  return {
    title,
    height,
    margin: { l: 50, r: 20, t: 50, b: 70 },
    xaxis: { title: xTitle || "", automargin: true },
    yaxis: { title: yTitle || "Score", automargin: true },
    transition: { duration: 0 },
  };
}

function renderCharts() {
  if (selectedBenefits.size === 0) {
    showError("Please select at least one co-benefit category.");
    return;
  }

  const chartType = document.getElementById("chartType").value;

  // --- MAIN (Overview / Breakdown) ---
  if (currentRegion === "all") {
    const labels = [];
    const values = [];
    for (const b of selectedBenefits) {
      labels.push(benefitLabels[b]);
      values.push(cache.totalsByBenefitAll[b] || 0);
    }

    let data;
    if (chartType === "pie") {
      data = [{
        type: "pie",
        labels,
        values: values.map(v => Math.max(0, v)),
        textinfo: "label+percent",
      }];
      Plotly.react("mainChart", data, baseLayout("Overview of Co-benefits (Selected Impact)", 350), plotConfig);
    } else if (chartType === "heatmap") {
      const top = getTopNAreasBySum(Math.min(topN, 50));
      const xAreas = top.map(t => t.area);
      const yBenefits = Array.from(selectedBenefits).map(b => benefitLabels[b]);

      const z = [];
      for (const b of selectedBenefits) {
        const rowZ = [];
        for (const a of xAreas) rowZ.push(cache.byArea.get(a)?.[b] || 0);
        z.push(rowZ);
      }

      data = [{
        type: "heatmap",
        x: xAreas,
        y: yBenefits,
        z,
        hovertemplate: "%{y}<br>%{x}<br>Score=%{z}<extra></extra>",
      }];

      Plotly.react("mainChart", data, baseLayout("Heatmap (Top-N Areas x Benefits)", 350), plotConfig);
    } else if (chartType === "scatter") {
      const chosen = Array.from(selectedBenefits);
      const bx = chosen[0], by = chosen[1];
      const top = getTopNAreasBySum(Math.min(topN, 50)); // sample by sum for credibility

      if (!bx || !by) {
        data = [{ type: "bar", x: labels, y: values, name: "Selected Impact" }];
        Plotly.react("mainChart", data, baseLayout("Overview (Selected Impact)", 350, "Benefit", "Score"), plotConfig);
      } else {
        const x = [];
        const y = [];
        const text = [];
        for (const t of top) {
          const row = cache.byArea.get(t.area);
          x.push(row?.[bx] || 0);
          y.push(row?.[by] || 0);
          text.push(t.area);
        }
        data = [{
          type: "scattergl",
          mode: "markers",
          x, y, text,
          hovertemplate: "%{text}<br>x=%{x}<br>y=%{y}<extra></extra>",
          name: `${benefitLabels[bx]} vs ${benefitLabels[by]} (Top-${Math.min(topN, 50)} by sum)`
        }];
        Plotly.react("mainChart", data, baseLayout("Scatter (WebGL) – Sampled for Performance", 350, benefitLabels[bx], benefitLabels[by]), plotConfig);
      }
    } else {
      data = [{
        type: "bar",
        x: labels,
        y: values,
        name: "Selected Impact",
        hovertemplate: "%{x}<br>Score=%{y}<extra></extra>"
      }];
      Plotly.react("mainChart", data, baseLayout("Overview of Co-benefits (Selected Impact)", 350, "Benefit", "Score"), plotConfig);
    }
  } else {
  const row = cache.byArea.get(currentRegion);
  if (!row) return;

  const labels = Array.from(selectedBenefits).map(b => benefitLabels[b]);
  const values = Array.from(selectedBenefits).map(b => row[b] || 0);

  let data;

  if (chartType === "pie") {
    data = [{
      type: "pie",
      labels,
      values: values.map(v => Math.max(0, v)),
      textinfo: "label+percent",
    }];
  } else {
    // fallback aman untuk bar / heatmap / scatter
    data = [{
      type: "bar",
      x: labels,
      y: values,
      hovertemplate: "%{x}<br>Score=%{y}<extra></extra>"
    }];
  }

  Plotly.react(
    "mainChart",
    data,
    baseLayout(`Breakdown for ${currentRegion} (Selected Impact)`, 350, "Benefit", "Score"),
    plotConfig
  );
}

  // --- COMPARISON (Ranking by dataset sum) ---
  const top = getTopNAreasBySum(topN);
  Plotly.react(
    "comparisonChart",
    [{
      type: "bar",
      x: top.map(t => t.area),
      y: top.map(t => t.value),
      name: `Top-${topN} by sum`,
      hovertemplate: "%{x}<br>sum=%{y}<extra></extra>"
    }],
    baseLayout(`Top-${topN} Areas by Total Impact`, 350, "Area (small_area)", "Total Impact"),
    plotConfig
  );

  // --- DETAILS ---
  if (currentRegion === "all") {
    const top10 = getTopNAreasBySum(10);
    Plotly.react(
      "detailChart",
      [{
        type: "bar",
        x: top10.map(t => t.area),
        y: top10.map(t => t.value),
        name: "Top 10 by sum",
        hovertemplate: "%{x}<br>sum=%{y}<extra></extra>"
      }],
      baseLayout("Top 10 Areas (Total Impact)", 400, "Area (small_area)", "Total Impact"),
      plotConfig
    );
  } else {
    const row = cache.byArea.get(currentRegion);
    const x = ["Total Impact (sum)", "Selected Impact"];
    const y = [row?.sum || 0, row ? sumSelectedBenefitsRow(row) : 0];

    Plotly.react(
      "detailChart",
      [{
        type: "bar",
        x, y,
        name: "Impact Summary",
        hovertemplate: "%{x}<br>%{y}<extra></extra>"
      }],
      baseLayout(`Impact Summary for ${currentRegion}`, 400, "Metric", "Score"),
      plotConfig
    );
  }
}

function updateAllUI() {
  setModeBadge();
  updateRegionInfo();
  updateStatsCards();
  updateTakeaways();
  renderCharts();
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof Plotly === "undefined") {
    showError("Plotly failed to load (check internet).");
    return;
  }
  loadCSVData();
});
