const calcCanvas = document.querySelector("#calcCanvas");
const calcCtx = calcCanvas.getContext("2d");
const kInput = document.querySelector("#kInput");
const pointInput = document.querySelector("#pointInput");
const initializeButton = document.querySelector("#initializeButton");
const assignCalcButton = document.querySelector("#assignCalcButton");
const recomputeButton = document.querySelector("#recomputeButton");
const runUntilButton = document.querySelector("#runUntilButton");
const newDataButton = document.querySelector("#newDataButton");
const distanceTableHead = document.querySelector("#distanceTableHead");
const distanceTableBody = document.querySelector("#distanceTableBody");
const centroidTableBody = document.querySelector("#centroidTableBody");
const calcIterationStatus = document.querySelector("#calcIterationStatus");
const sseValue = document.querySelector("#sseValue");
const shiftValue = document.querySelector("#shiftValue");
const convergenceStatus = document.querySelector("#convergenceStatus");
const activeExplanation = document.querySelector("#activeExplanation");
const repeatIteration = document.querySelector("#repeatIteration");
const latestMovement = document.querySelector("#latestMovement");
const repeatDecision = document.querySelector("#repeatDecision");
const repeatNode2 = document.querySelector("#repeatNode2");
const repeatNode3 = document.querySelector("#repeatNode3");
const repeatNode4 = document.querySelector("#repeatNode4");
const repeatNode5 = document.querySelector("#repeatNode5");
const historyTableBody = document.querySelector("#historyTableBody");

const calcColors = ["#2f8dcb", "#43a047", "#f57c00", "#8e44ad"];
const epsilon = 0.001;

const calcState = {
  points: [],
  centroids: [],
  k: 3,
  pointCount: 12,
  iteration: 0,
  assigned: false,
  initialized: false,
  converged: false,
  sse: null,
  maxShift: null,
  shifts: [],
  activeLine: 1,
  phase: "line1",
  previousCentroids: [],
  history: [],
};

const calcRand = (min, max) => min + Math.random() * (max - min);
const calcClamp = (value, min, max) => Math.min(max, Math.max(min, value));
const format = (value) => (Number.isFinite(value) ? value.toFixed(2) : "-");

function cloneCentroids(centroids) {
  return centroids.map((centroid) => ({ ...centroid }));
}

function roundPoint(value) {
  return Math.round(value * 100) / 100;
}

function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function euclidean(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function generateCalculationPoints() {
  const centers = [
    { x: 2.1, y: 2.3 },
    { x: 7.7, y: 2.5 },
    { x: 4.7, y: 7.4 },
    { x: 8.1, y: 7.5 },
  ];

  calcState.points = Array.from({ length: calcState.pointCount }, (_, index) => {
    const center = centers[index % calcState.k];
    return {
      id: `P${index + 1}`,
      x: roundPoint(calcClamp(center.x + gaussianRandom() * 0.74, 0.45, 9.55)),
      y: roundPoint(calcClamp(center.y + gaussianRandom() * 0.74, 0.45, 9.55)),
      cluster: null,
      distances: [],
    };
  });
}

function chooseInitialCentroids() {
  const indexes = new Set();
  while (indexes.size < calcState.k) {
    indexes.add(Math.floor(Math.random() * calcState.points.length));
  }

  calcState.centroids = [...indexes].map((pointIndex, centroidIndex) => {
    const point = calcState.points[pointIndex];
    return {
      x: point.x,
      y: point.y,
      color: calcColors[centroidIndex],
      sourceId: point.id,
    };
  });

  calcState.points.forEach((point) => {
    point.cluster = null;
    point.distances = [];
  });
  calcState.iteration = 0;
  calcState.assigned = false;
  calcState.initialized = true;
  calcState.converged = false;
  calcState.sse = null;
  calcState.maxShift = null;
  calcState.shifts = [];
  calcState.previousCentroids = [];
  calcState.history = [];
  calcState.activeLine = 3;
  calcState.phase = "assign";
  activeExplanation.textContent =
    "Line 1 selesai: centroid awal dipilih langsung dari titik data. Lanjutkan ke Line 3 untuk menghitung jarak Euclidean dan membentuk cluster.";
  renderCalculation();
}

function assignClusters({ silent = false } = {}) {
  if (!calcState.initialized) {
    chooseInitialCentroids();
  }

  let sse = 0;
  calcState.points.forEach((point) => {
    point.distances = calcState.centroids.map((centroid) => euclidean(point, centroid));
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    point.distances.forEach((distance, index) => {
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    point.cluster = closestIndex;
    sse += closestDistance * closestDistance;
  });

  calcState.sse = sse;
  calcState.assigned = true;
  calcState.converged = false;
  calcState.activeLine = 4;
  calcState.phase = "recompute";
  activeExplanation.textContent =
    `Line 3 selesai untuk repeat ke-${calcState.iteration + 1}: setiap titik masuk ke cluster dengan jarak Euclidean paling kecil. Lanjutkan ke Line 4 untuk menghitung centroid baru.`;

  if (!silent) renderCalculation();
}

function buildClusterSummaries() {
  return calcState.centroids.map((centroid, index) => {
    const members = calcState.points.filter((point) => point.cluster === index);
    const sumX = members.reduce((sum, point) => sum + point.x, 0);
    const sumY = members.reduce((sum, point) => sum + point.y, 0);
    return {
      members,
      count: members.length,
      sumX,
      sumY,
      meanX: members.length ? sumX / members.length : centroid.x,
      meanY: members.length ? sumY / members.length : centroid.y,
    };
  });
}

function refreshDistancesForCurrentCentroids() {
  let sse = 0;
  calcState.points.forEach((point) => {
    point.distances = calcState.centroids.map((centroid) => euclidean(point, centroid));
    if (point.cluster !== null && calcState.centroids[point.cluster]) {
      sse += point.distances[point.cluster] ** 2;
    }
  });
  calcState.sse = calcState.points.some((point) => point.cluster !== null) ? sse : null;
}

function summarizeClusterMembers(summaries) {
  return summaries
    .map((summary, index) => ({
      label: `C${index + 1}`,
      count: summary.count,
      members: summary.members.map((point) => point.id),
    }));
}

function centroidMovementRows(before, after, shifts) {
  return after.map((centroid, index) => ({
    label: `C${index + 1}`,
    before: { x: before[index].x, y: before[index].y },
    after: { x: centroid.x, y: centroid.y },
    shift: shifts[index] || 0,
  }));
}

function recomputeCentroids({ silent = false } = {}) {
  if (!calcState.initialized) {
    chooseInitialCentroids();
  }
  if (!calcState.assigned) {
    assignClusters({ silent: true });
  }

  const summaries = buildClusterSummaries();
  const oldCentroids = cloneCentroids(calcState.centroids);
  const sseBefore = calcState.sse;
  let maxShift = 0;
  const nextShifts = [];

  calcState.centroids = calcState.centroids.map((centroid, index) => {
    const next = summaries[index];
    const updated = {
      x: roundPoint(next.meanX),
      y: roundPoint(next.meanY),
      color: centroid.color,
      sourceId: centroid.sourceId,
    };
    const shift = euclidean(centroid, updated);
    nextShifts[index] = shift;
    maxShift = Math.max(maxShift, shift);
    return updated;
  });

  calcState.previousCentroids = oldCentroids;
  calcState.shifts = nextShifts;
  calcState.maxShift = maxShift;
  calcState.iteration += 1;
  calcState.assigned = false;
  calcState.converged = maxShift <= epsilon;
  calcState.activeLine = 5;
  refreshDistancesForCurrentCentroids();
  calcState.history.push({
    iteration: calcState.iteration,
    members: summarizeClusterMembers(summaries),
    sseBefore,
    sseAfter: calcState.sse,
    movement: centroidMovementRows(oldCentroids, calcState.centroids, nextShifts),
    maxShift,
    converged: calcState.converged,
  });
  calcState.phase = calcState.converged ? "converged" : "decision";
  activeExplanation.textContent = calcState.converged
    ? `Line 5 tercapai pada repeat ke-${calcState.iteration}: centroid tidak berubah lagi, sehingga iterasi berhenti.`
    : `Line 4 selesai untuk repeat ke-${calcState.iteration}: centroid dipindahkan ke rata-rata anggota cluster. Line 5 mengecek max shift ${maxShift.toFixed(4)}, jadi repeat kembali ke Line 3.`;

  if (!silent) renderCalculation();
}

function runUntilConverged() {
  if (!calcState.initialized) {
    chooseInitialCentroids();
  }

  let reachedConvergence = false;
  for (let step = 0; step < 30; step += 1) {
    assignClusters({ silent: true });
    recomputeCentroids({ silent: true });
    if (calcState.converged) {
      reachedConvergence = true;
      break;
    }
  }

  assignClusters({ silent: true });
  calcState.converged = reachedConvergence;
  calcState.activeLine = 5;
  calcState.phase = reachedConvergence ? "converged" : "decision";
  activeExplanation.textContent = reachedConvergence
    ? "Algoritma dijalankan sampai Line 5: assignment dan centroid sudah stabil."
    : "Iterasi dihentikan pada batas 30 langkah. Jalankan lagi atau gunakan data baru untuk melanjutkan eksplorasi.";
  renderCalculation();
}

function resetCalculationData() {
  calcState.k = calcClamp(Number(kInput.value) || 3, 2, 4);
  calcState.pointCount = calcClamp(Number(pointInput.value) || 12, 8, 16);
  kInput.value = calcState.k;
  pointInput.value = calcState.pointCount;
  calcState.centroids = [];
  calcState.iteration = 0;
  calcState.assigned = false;
  calcState.initialized = false;
  calcState.converged = false;
  calcState.sse = null;
  calcState.maxShift = null;
  calcState.shifts = [];
  calcState.previousCentroids = [];
  calcState.history = [];
  calcState.activeLine = 1;
  calcState.phase = "line1";
  generateCalculationPoints();
  activeExplanation.textContent =
    "Mulai dari Line 1: pilih K titik data sebagai centroid awal.";
  renderCalculation();
}

function resizeCalculationCanvas() {
  const rect = calcCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const nextWidth = Math.round(rect.width * dpr);
  const nextHeight = Math.round(rect.height * dpr);

  if (calcCanvas.width !== nextWidth || calcCanvas.height !== nextHeight) {
    calcCanvas.width = nextWidth;
    calcCanvas.height = nextHeight;
  }

  calcCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function plotMapper(width, height) {
  const padding = { left: 54, right: 24, top: 24, bottom: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  return {
    x(value) {
      return padding.left + (value / 10) * plotWidth;
    },
    y(value) {
      return padding.top + (1 - value / 10) * plotHeight;
    },
    padding,
    plotWidth,
    plotHeight,
  };
}

function drawCalculationGrid(width, height, map) {
  calcCtx.save();
  calcCtx.strokeStyle = "#edf1f6";
  calcCtx.lineWidth = 1;
  calcCtx.fillStyle = "#73808f";
  calcCtx.font = "12px Inter, system-ui, sans-serif";

  for (let value = 0; value <= 10; value += 2) {
    const x = map.x(value);
    const y = map.y(value);
    calcCtx.beginPath();
    calcCtx.moveTo(x, map.padding.top);
    calcCtx.lineTo(x, height - map.padding.bottom);
    calcCtx.stroke();
    calcCtx.beginPath();
    calcCtx.moveTo(map.padding.left, y);
    calcCtx.lineTo(width - map.padding.right, y);
    calcCtx.stroke();
    calcCtx.fillText(String(value), x - 4, height - 20);
    calcCtx.fillText(String(value), 20, y + 4);
  }

  calcCtx.strokeStyle = "#303742";
  calcCtx.lineWidth = 1.5;
  calcCtx.beginPath();
  calcCtx.moveTo(map.padding.left, map.padding.top);
  calcCtx.lineTo(map.padding.left, height - map.padding.bottom);
  calcCtx.lineTo(width - map.padding.right, height - map.padding.bottom);
  calcCtx.stroke();
  calcCtx.restore();
}

function drawCalculationPoint(point, width, map) {
  const assigned = point.cluster !== null && calcState.centroids[point.cluster];
  const x = map.x(point.x);
  const y = map.y(point.y);
  calcCtx.beginPath();
  calcCtx.arc(x, y, 6, 0, Math.PI * 2);
  calcCtx.fillStyle = assigned ? calcState.centroids[point.cluster].color : "#111827";
  calcCtx.globalAlpha = assigned ? 0.86 : 1;
  calcCtx.fill();
  calcCtx.globalAlpha = 1;
  calcCtx.fillStyle = "#27313b";
  calcCtx.font = width < 680 ? "11px Inter, system-ui, sans-serif" : "12px Inter, system-ui, sans-serif";
  calcCtx.fillText(point.id, x + 8, y - 8);
}

function drawCentroidMarker(centroid, index, width, map) {
  const x = map.x(centroid.x);
  const y = map.y(centroid.y);
  const size = 17;

  calcCtx.beginPath();
  calcCtx.moveTo(x, y - size);
  calcCtx.lineTo(x - size * 0.92, y + size * 0.86);
  calcCtx.lineTo(x + size * 0.92, y + size * 0.86);
  calcCtx.closePath();
  calcCtx.fillStyle = centroid.color;
  calcCtx.strokeStyle = "#1f2933";
  calcCtx.lineWidth = 1.8;
  calcCtx.fill();
  calcCtx.stroke();
  calcCtx.fillStyle = "#111827";
  calcCtx.font = width < 680 ? "700 12px Inter, system-ui, sans-serif" : "700 14px Inter, system-ui, sans-serif";
  calcCtx.fillText(`C${index + 1}`, x + 16, y + 4);
}

function drawPreviousCentroidMarker(centroid, index, width, map) {
  const x = map.x(centroid.x);
  const y = map.y(centroid.y);
  const size = 15;

  calcCtx.save();
  calcCtx.globalAlpha = 0.72;
  calcCtx.setLineDash([5, 4]);
  calcCtx.beginPath();
  calcCtx.moveTo(x, y - size);
  calcCtx.lineTo(x - size * 0.92, y + size * 0.86);
  calcCtx.lineTo(x + size * 0.92, y + size * 0.86);
  calcCtx.closePath();
  calcCtx.strokeStyle = centroid.color;
  calcCtx.lineWidth = 2;
  calcCtx.stroke();
  calcCtx.setLineDash([]);
  calcCtx.fillStyle = "#4b5563";
  calcCtx.font = width < 680 ? "700 10px Inter, system-ui, sans-serif" : "700 11px Inter, system-ui, sans-serif";
  calcCtx.fillText(`C${index + 1} lama`, x + 14, y - 12);
  calcCtx.restore();
}

function drawMovementArrow(from, to, color, map) {
  const startX = map.x(from.x);
  const startY = map.y(from.y);
  const endX = map.x(to.x);
  const endY = map.y(to.y);
  const angle = Math.atan2(endY - startY, endX - startX);
  const length = Math.hypot(endX - startX, endY - startY);

  if (length < 3) {
    return;
  }

  calcCtx.save();
  calcCtx.strokeStyle = color;
  calcCtx.fillStyle = color;
  calcCtx.globalAlpha = 0.72;
  calcCtx.lineWidth = 2.4;
  calcCtx.beginPath();
  calcCtx.moveTo(startX, startY);
  calcCtx.lineTo(endX, endY);
  calcCtx.stroke();
  calcCtx.beginPath();
  calcCtx.moveTo(endX, endY);
  calcCtx.lineTo(endX - Math.cos(angle - 0.45) * 13, endY - Math.sin(angle - 0.45) * 13);
  calcCtx.lineTo(endX - Math.cos(angle + 0.45) * 13, endY - Math.sin(angle + 0.45) * 13);
  calcCtx.closePath();
  calcCtx.fill();
  calcCtx.restore();
}

function drawCalculationPlot() {
  resizeCalculationCanvas();
  const rect = calcCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const map = plotMapper(width, height);

  calcCtx.clearRect(0, 0, width, height);
  calcCtx.fillStyle = "#ffffff";
  calcCtx.fillRect(0, 0, width, height);
  drawCalculationGrid(width, height, map);

  calcState.previousCentroids.forEach((centroid, index) => {
    if (!calcState.centroids[index]) return;
    drawMovementArrow(centroid, calcState.centroids[index], centroid.color, map);
    drawPreviousCentroidMarker(centroid, index, width, map);
  });

  calcCtx.save();
  calcCtx.globalAlpha = 0.24;
  calcCtx.lineWidth = 1;
  calcState.points.forEach((point) => {
    if (point.cluster === null || !calcState.centroids[point.cluster]) return;
    const centroid = calcState.centroids[point.cluster];
    calcCtx.strokeStyle = centroid.color;
    calcCtx.beginPath();
    calcCtx.moveTo(map.x(point.x), map.y(point.y));
    calcCtx.lineTo(map.x(centroid.x), map.y(centroid.y));
    calcCtx.stroke();
  });
  calcCtx.restore();

  calcState.points.forEach((point) => drawCalculationPoint(point, width, map));
  calcState.centroids.forEach((centroid, index) => drawCentroidMarker(centroid, index, width, map));
}

function renderDistanceTable() {
  const distanceHeaders = calcState.centroids
    .map((_, index) => `<th>d(P,C${index + 1})</th>`)
    .join("");
  distanceTableHead.innerHTML = `
    <tr>
      <th>Point</th>
      <th>x</th>
      <th>y</th>
      ${distanceHeaders}
      <th>Cluster</th>
    </tr>
  `;

  distanceTableBody.innerHTML = calcState.points
    .map((point) => {
      const minDistance = point.distances.length ? Math.min(...point.distances) : null;
      const distanceCells = calcState.centroids
        .map((_, index) => {
          const distance = point.distances[index];
          const isMin = minDistance !== null && Math.abs(distance - minDistance) < 0.000001;
          return `<td class="${isMin ? "distance-min" : ""}">${format(distance)}</td>`;
        })
        .join("");
      const cluster =
        point.cluster === null
          ? `<span class="muted-cell">-</span>`
          : `<span class="cluster-badge" style="background:${calcState.centroids[point.cluster].color}">C${point.cluster + 1}</span>`;

      return `
        <tr>
          <td><strong>${point.id}</strong></td>
          <td>${format(point.x)}</td>
          <td>${format(point.y)}</td>
          ${distanceCells}
          <td>${cluster}</td>
        </tr>
      `;
    })
    .join("");
}

function renderCentroidTable() {
  if (!calcState.centroids.length) {
    centroidTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="muted-cell">Klik "1. Initial centroids" untuk memilih centroid awal dari data.</td>
      </tr>
    `;
    return;
  }

  const summaries = buildClusterSummaries();
  centroidTableBody.innerHTML = calcState.centroids
    .map((centroid, index) => {
      const summary = summaries[index];
      const shift = calcState.shifts[index];
      const formula = summary.count
        ? `(${format(summary.sumX)} / ${summary.count}, ${format(summary.sumY)} / ${summary.count}) = (${format(summary.meanX)}, ${format(summary.meanY)})`
        : `Cluster kosong, centroid tetap di (${format(centroid.x)}, ${format(centroid.y)})`;
      return `
        <tr>
          <td><span class="cluster-badge" style="background:${centroid.color}">C${index + 1}</span></td>
          <td>${summary.count || `<span class="muted-cell">-</span>`}</td>
          <td>${summary.count ? format(summary.sumX) : `<span class="muted-cell">-</span>`}</td>
          <td>${summary.count ? format(summary.sumY) : `<span class="muted-cell">-</span>`}</td>
          <td class="formula-cell">${formula}</td>
          <td>${Number.isFinite(shift) ? format(shift) : `<span class="muted-cell">-</span>`}</td>
        </tr>
      `;
    })
    .join("");
}

function renderAlgorithmLines() {
  [1, 2, 3, 4, 5].forEach((line) => {
    const element = document.querySelector(`#algoLine${line}`);
    element?.classList.toggle("active-line", calcState.activeLine === line);
  });
}

function currentRepeatNumber() {
  if (!calcState.initialized) return 0;
  if (calcState.phase === "converged") return calcState.iteration;
  if (calcState.phase === "decision") return calcState.iteration;
  return calcState.iteration + 1;
}

function renderRepeatFlow() {
  const nodes = [repeatNode2, repeatNode3, repeatNode4, repeatNode5];
  nodes.forEach((node) => {
    node.classList.remove("active-repeat", "done-repeat");
  });

  if (!calcState.initialized) {
    repeatIteration.textContent = "0";
    latestMovement.textContent = "belum ada";
    repeatDecision.textContent = "mulai Line 1";
    return;
  }

  repeatNode2.classList.add("done-repeat");

  if (calcState.phase === "assign") {
    repeatNode3.classList.add("active-repeat");
  }

  if (calcState.phase === "recompute") {
    repeatNode3.classList.add("done-repeat");
    repeatNode4.classList.add("active-repeat");
  }

  if (calcState.phase === "converged") {
    repeatNode3.classList.add("done-repeat");
    repeatNode4.classList.add("done-repeat");
    repeatNode5.classList.add("active-repeat");
  }

  if (calcState.phase === "decision") {
    repeatNode3.classList.add("done-repeat");
    repeatNode4.classList.add("done-repeat");
    repeatNode5.classList.add("active-repeat");
  }

  repeatIteration.textContent = String(currentRepeatNumber());
  latestMovement.textContent =
    calcState.maxShift === null ? "belum ada" : `max shift ${calcState.maxShift.toFixed(4)}`;

  if (calcState.phase === "assign") {
    repeatDecision.textContent = calcState.iteration === 0 ? "mulai repeat pertama" : "ulang ke Line 3";
  } else if (calcState.phase === "recompute") {
    repeatDecision.textContent = "lanjut Line 4";
  } else if (calcState.phase === "decision") {
    repeatDecision.textContent = "centroid berubah, ulangi Line 3";
  } else if (calcState.phase === "converged") {
    repeatDecision.textContent = "stop di Line 5";
  }
}

function renderHistoryTable() {
  if (!calcState.history.length) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="muted-cell">Belum ada repeat. Jalankan Line 3 lalu Line 4 untuk mencatat iterasi pertama.</td>
      </tr>
    `;
    return;
  }

  historyTableBody.innerHTML = calcState.history
    .map((entry) => {
      const members = entry.members
        .map(
          (cluster) =>
            `<span><strong>${cluster.label}</strong>: ${cluster.count} titik (${cluster.members.join(", ") || "-"})</span>`,
        )
        .join("");
      const movement = entry.movement
        .map(
          (move) =>
            `<span><strong>${move.label}</strong>: (${format(move.before.x)}, ${format(move.before.y)}) -> (${format(move.after.x)}, ${format(move.after.y)}) shift ${format(move.shift)}</span>`,
        )
        .join("");
      const decision = entry.converged
        ? `<span class="decision-stop">Stop, centroid tidak berubah</span>`
        : `<span class="decision-repeat">Ulangi Line 3</span>`;

      return `
        <tr>
          <td><strong>${entry.iteration}</strong></td>
          <td><div class="history-list">${members}</div></td>
          <td>${entry.sseBefore === null ? "-" : entry.sseBefore.toFixed(4)}</td>
          <td><div class="history-list">${movement}</div></td>
          <td>${entry.maxShift.toFixed(4)}</td>
          <td>${decision}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMetrics() {
  calcIterationStatus.textContent = `Iterasi ${calcState.iteration}`;
  sseValue.textContent = calcState.sse === null ? "belum dihitung" : calcState.sse.toFixed(4);
  shiftValue.textContent =
    calcState.maxShift === null ? "belum dihitung" : calcState.maxShift.toFixed(4);
  convergenceStatus.textContent = calcState.converged
    ? "Konvergen"
    : calcState.initialized
      ? "Berjalan"
      : "Belum mulai";
}

function renderCalculation() {
  drawCalculationPlot();
  renderDistanceTable();
  renderCentroidTable();
  renderAlgorithmLines();
  renderRepeatFlow();
  renderHistoryTable();
  renderMetrics();
}

initializeButton.addEventListener("click", chooseInitialCentroids);
assignCalcButton.addEventListener("click", () => assignClusters());
recomputeButton.addEventListener("click", () => recomputeCentroids());
runUntilButton.addEventListener("click", runUntilConverged);
newDataButton.addEventListener("click", resetCalculationData);
kInput.addEventListener("change", resetCalculationData);
pointInput.addEventListener("change", resetCalculationData);
window.addEventListener("resize", renderCalculation);

resetCalculationData();
