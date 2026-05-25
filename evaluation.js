const evaluationCanvas = document.querySelector("#evaluationCanvas");
const evaluationCtx = evaluationCanvas.getContext("2d");
const evalKInput = document.querySelector("#evalKInput");
const evalPointInput = document.querySelector("#evalPointInput");
const overlapSlider = document.querySelector("#overlapSlider");
const noiseSlider = document.querySelector("#noiseSlider");
const runEvaluationButton = document.querySelector("#runEvaluationButton");
const stepEvaluationButton = document.querySelector("#stepEvaluationButton");
const newEvaluationDataButton = document.querySelector("#newEvaluationDataButton");
const evaluationStatus = document.querySelector("#evaluationStatus");
const selectedPointSummary = document.querySelector("#selectedPointSummary");
const selectedA = document.querySelector("#selectedA");
const selectedB = document.querySelector("#selectedB");
const selectedS = document.querySelector("#selectedS");
const metricSse = document.querySelector("#metricSse");
const metricSilhouette = document.querySelector("#metricSilhouette");
const metricDb = document.querySelector("#metricDb");
const metricDunn = document.querySelector("#metricDunn");
const metricPurity = document.querySelector("#metricPurity");
const metricNmi = document.querySelector("#metricNmi");
const metricFMeasure = document.querySelector("#metricFMeasure");
const metricJaccard = document.querySelector("#metricJaccard");
const internalTableBody = document.querySelector("#internalTableBody");
const clusterSummaryBody = document.querySelector("#clusterSummaryBody");
const confusionHead = document.querySelector("#confusionHead");
const confusionBody = document.querySelector("#confusionBody");
const externalSummaryBody = document.querySelector("#externalSummaryBody");
const sseFormulaDetail = document.querySelector("#sseFormulaDetail");
const sseBreakdownBody = document.querySelector("#sseBreakdownBody");
const silhouetteFormulaDetail = document.querySelector("#silhouetteFormulaDetail");
const silhouetteDetailBody = document.querySelector("#silhouetteDetailBody");
const dbDunnFormulaDetail = document.querySelector("#dbDunnFormulaDetail");
const dbDunnDetailBody = document.querySelector("#dbDunnDetailBody");
const externalFormulaDetail = document.querySelector("#externalFormulaDetail");
const externalFormulaBody = document.querySelector("#externalFormulaBody");
const miTermBody = document.querySelector("#miTermBody");

const evalClusterColors = ["#2f8dcb", "#43a047", "#f57c00", "#8e44ad", "#d83a4f"];
const truthClasses = [
  { label: "A", color: "#be123c", center: { x: 2.1, y: 2.4 } },
  { label: "B", color: "#5b21b6", center: { x: 7.8, y: 2.5 } },
  { label: "C", color: "#0f766e", center: { x: 4.8, y: 7.6 } },
];

const evalState = {
  points: [],
  centroids: [],
  k: 3,
  pointCount: 36,
  overlap: 30,
  noise: 5,
  iteration: 0,
  selectedPointId: null,
  metrics: null,
};

const evalClamp = (value, min, max) => Math.min(max, Math.max(min, value));
const evalFormat = (value, digits = 3) => (Number.isFinite(value) ? value.toFixed(digits) : "-");

function normalRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function chooseInitialEvaluationCentroids() {
  const indexes = new Set();
  while (indexes.size < evalState.k && indexes.size < evalState.points.length) {
    indexes.add(Math.floor(Math.random() * evalState.points.length));
  }

  evalState.centroids = [...indexes].map((pointIndex, index) => {
    const point = evalState.points[pointIndex];
    return {
      x: point.x,
      y: point.y,
      color: evalClusterColors[index],
    };
  });
}

function assignEvaluationClusters() {
  evalState.points.forEach((point) => {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    evalState.centroids.forEach((centroid, index) => {
      const d2 = distanceSquared(point, centroid);
      if (d2 < closestDistance) {
        closestDistance = d2;
        closestIndex = index;
      }
    });
    point.cluster = closestIndex;
  });
}

function updateEvaluationCentroids() {
  const groups = Array.from({ length: evalState.k }, () => ({ x: 0, y: 0, count: 0 }));
  evalState.points.forEach((point) => {
    if (point.cluster === null) return;
    groups[point.cluster].x += point.x;
    groups[point.cluster].y += point.y;
    groups[point.cluster].count += 1;
  });

  let maxShift = 0;
  evalState.centroids = evalState.centroids.map((centroid, index) => {
    const group = groups[index];
    if (!group.count) {
      const fallback = evalState.points[Math.floor(Math.random() * evalState.points.length)];
      return { x: fallback.x, y: fallback.y, color: centroid.color };
    }

    const next = { x: group.x / group.count, y: group.y / group.count, color: centroid.color };
    maxShift = Math.max(maxShift, distance(centroid, next));
    return next;
  });

  return maxShift;
}

function runKMeans(maxIterations = 25) {
  chooseInitialEvaluationCentroids();
  let shift = Number.POSITIVE_INFINITY;
  evalState.iteration = 0;

  while (evalState.iteration < maxIterations && shift > 0.001) {
    assignEvaluationClusters();
    shift = updateEvaluationCentroids();
    evalState.iteration += 1;
  }

  assignEvaluationClusters();
}

function stepKMeans() {
  if (!evalState.centroids.length) {
    chooseInitialEvaluationCentroids();
  }
  assignEvaluationClusters();
  updateEvaluationCentroids();
  assignEvaluationClusters();
  evalState.iteration += 1;
  applyClusterNoise();
  computeEvaluationMetrics();
  renderEvaluation();
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function applyClusterNoise() {
  const noiseCount = Math.round((evalState.noise / 100) * evalState.points.length);
  const indexes = shuffle([...evalState.points.keys()]).slice(0, noiseCount);

  indexes.forEach((pointIndex) => {
    const point = evalState.points[pointIndex];
    if (evalState.k <= 1 || point.cluster === null) return;
    let nextCluster = point.cluster;
    while (nextCluster === point.cluster) {
      nextCluster = Math.floor(Math.random() * evalState.k);
    }
    point.cluster = nextCluster;
  });

  const groups = Array.from({ length: evalState.k }, () => ({ x: 0, y: 0, count: 0 }));
  evalState.points.forEach((point) => {
    groups[point.cluster].x += point.x;
    groups[point.cluster].y += point.y;
    groups[point.cluster].count += 1;
  });
  evalState.centroids = evalState.centroids.map((centroid, index) => {
    const group = groups[index];
    return group.count
      ? { x: group.x / group.count, y: group.y / group.count, color: centroid.color }
      : centroid;
  });
}

function generateEvaluationData() {
  evalState.k = evalClamp(Number(evalKInput.value) || 3, 2, 5);
  evalState.pointCount = evalClamp(Number(evalPointInput.value) || 36, 18, 60);
  evalState.overlap = Number(overlapSlider.value);
  evalState.noise = Number(noiseSlider.value);
  evalKInput.value = evalState.k;
  evalPointInput.value = evalState.pointCount;

  const spread = 0.35 + (evalState.overlap / 100) * 1.45;
  evalState.points = Array.from({ length: evalState.pointCount }, (_, index) => {
    const trueClass = index % truthClasses.length;
    const spec = truthClasses[trueClass];
    return {
      id: `P${index + 1}`,
      x: evalClamp(spec.center.x + normalRandom() * spread, 0.45, 9.55),
      y: evalClamp(spec.center.y + normalRandom() * spread, 0.45, 9.55),
      trueClass,
      cluster: null,
      sse: 0,
      a: 0,
      b: 0,
      silhouette: 0,
      nearestOtherCluster: null,
    };
  });

  evalState.centroids = [];
  evalState.iteration = 0;
  evalState.selectedPointId = evalState.points[0]?.id || null;
  runEvaluation();
}

function runEvaluation() {
  evalState.k = evalClamp(Number(evalKInput.value) || 3, 2, 5);
  evalState.noise = Number(noiseSlider.value);
  evalKInput.value = evalState.k;
  runKMeans();
  applyClusterNoise();
  computeEvaluationMetrics();
  renderEvaluation();
}

function groupByCluster() {
  return Array.from({ length: evalState.k }, (_, cluster) =>
    evalState.points.filter((point) => point.cluster === cluster),
  );
}

function pairAverage(point, others) {
  if (!others.length) return 0;
  return others.reduce((sum, other) => sum + distance(point, other), 0) / others.length;
}

function maxPairDistance(points) {
  let maxDistance = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      maxDistance = Math.max(maxDistance, distance(points[i], points[j]));
    }
  }
  return maxDistance;
}

function calculateInternalMetrics(clusters) {
  let totalSse = 0;
  evalState.points.forEach((point) => {
    const centroid = evalState.centroids[point.cluster];
    point.sse = centroid ? distanceSquared(point, centroid) : 0;
    totalSse += point.sse;

    const sameCluster = clusters[point.cluster].filter((candidate) => candidate.id !== point.id);
    point.a = pairAverage(point, sameCluster);

    let bestOtherAverage = Number.POSITIVE_INFINITY;
    let nearestOtherCluster = null;
    clusters.forEach((clusterPoints, clusterIndex) => {
      if (clusterIndex === point.cluster || !clusterPoints.length) return;
      const avg = pairAverage(point, clusterPoints);
      if (avg < bestOtherAverage) {
        bestOtherAverage = avg;
        nearestOtherCluster = clusterIndex;
      }
    });

    point.b = Number.isFinite(bestOtherAverage) ? bestOtherAverage : 0;
    point.nearestOtherCluster = nearestOtherCluster;
    point.silhouette =
      sameCluster.length && point.b ? (point.b - point.a) / Math.max(point.a, point.b) : 0;
  });

  const clusterSummaries = clusters.map((clusterPoints, index) => {
    const centroid = evalState.centroids[index];
    const sse = clusterPoints.reduce((sum, point) => sum + point.sse, 0);
    const scatter = clusterPoints.length
      ? clusterPoints.reduce((sum, point) => sum + distance(point, centroid), 0) / clusterPoints.length
      : 0;
    return {
      index,
      points: clusterPoints,
      count: clusterPoints.length,
      sse,
      scatter,
      diameter: maxPairDistance(clusterPoints),
      dbR: 0,
    };
  });

  const nonEmpty = clusterSummaries.filter((summary) => summary.count > 0);
  nonEmpty.forEach((summary) => {
    let maxR = 0;
    nonEmpty.forEach((other) => {
      if (other.index === summary.index) return;
      const centroidDistance = distance(evalState.centroids[summary.index], evalState.centroids[other.index]);
      if (centroidDistance > 0) {
        maxR = Math.max(maxR, (summary.scatter + other.scatter) / centroidDistance);
      }
    });
    summary.dbR = maxR;
  });

  let minInterClusterDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < clusters.length; i += 1) {
    for (let j = i + 1; j < clusters.length; j += 1) {
      clusters[i].forEach((left) => {
        clusters[j].forEach((right) => {
          minInterClusterDistance = Math.min(minInterClusterDistance, distance(left, right));
        });
      });
    }
  }

  const maxDiameter = Math.max(...clusterSummaries.map((summary) => summary.diameter), 0);
  const silhouetteAvg =
    evalState.points.reduce((sum, point) => sum + point.silhouette, 0) / evalState.points.length;
  const dbIndex = nonEmpty.length
    ? nonEmpty.reduce((sum, summary) => sum + summary.dbR, 0) / nonEmpty.length
    : 0;
  const dunnIndex =
    Number.isFinite(minInterClusterDistance) && maxDiameter > 0
      ? minInterClusterDistance / maxDiameter
      : 0;

  return {
    totalSse,
    silhouetteAvg,
    dbIndex,
    dunnIndex,
    clusterSummaries,
    minInterClusterDistance: Number.isFinite(minInterClusterDistance) ? minInterClusterDistance : 0,
    maxDiameter,
  };
}

function calculateConfusion(clusters) {
  const matrix = clusters.map((clusterPoints) =>
    truthClasses.map((_, trueClass) => clusterPoints.filter((point) => point.trueClass === trueClass).length),
  );
  const purity =
    matrix.reduce((sum, row) => sum + Math.max(...row, 0), 0) / Math.max(evalState.points.length, 1);
  return { matrix, purity };
}

function calculateMutualInformation(matrix) {
  const n = evalState.points.length;
  const rowSums = matrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const colSums = truthClasses.map((_, colIndex) =>
    matrix.reduce((sum, row) => sum + row[colIndex], 0),
  );

  let mi = 0;
  matrix.forEach((row, rowIndex) => {
    row.forEach((count, colIndex) => {
      if (!count) return;
      mi += (count / n) * Math.log((count * n) / (rowSums[rowIndex] * colSums[colIndex]));
    });
  });

  const entropy = (counts) =>
    counts.reduce((sum, count) => {
      if (!count) return sum;
      const p = count / n;
      return sum - p * Math.log(p);
    }, 0);

  const hCluster = entropy(rowSums);
  const hTrue = entropy(colSums);
  const nmi = hCluster && hTrue ? mi / Math.sqrt(hCluster * hTrue) : 0;
  return { mi, nmi, rowSums, colSums, hCluster, hTrue };
}

function calculatePairCounts() {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (let i = 0; i < evalState.points.length; i += 1) {
    for (let j = i + 1; j < evalState.points.length; j += 1) {
      const samePredicted = evalState.points[i].cluster === evalState.points[j].cluster;
      const sameTrue = evalState.points[i].trueClass === evalState.points[j].trueClass;
      if (samePredicted && sameTrue) tp += 1;
      else if (samePredicted && !sameTrue) fp += 1;
      else if (!samePredicted && sameTrue) fn += 1;
      else tn += 1;
    }
  }

  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const fMeasure = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const jaccard = tp + fp + fn ? tp / (tp + fp + fn) : 0;
  return { tp, fp, fn, tn, precision, recall, fMeasure, jaccard };
}

function computeEvaluationMetrics() {
  const clusters = groupByCluster();
  const internal = calculateInternalMetrics(clusters);
  const confusion = calculateConfusion(clusters);
  const mutualInfo = calculateMutualInformation(confusion.matrix);
  const pairs = calculatePairCounts();

  evalState.metrics = {
    clusters,
    ...internal,
    ...confusion,
    ...mutualInfo,
    ...pairs,
  };
}

function resizeEvaluationCanvas() {
  const rect = evaluationCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const nextWidth = Math.round(rect.width * dpr);
  const nextHeight = Math.round(rect.height * dpr);
  if (evaluationCanvas.width !== nextWidth || evaluationCanvas.height !== nextHeight) {
    evaluationCanvas.width = nextWidth;
    evaluationCanvas.height = nextHeight;
  }
  evaluationCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function evaluationMapper(width, height) {
  const padding = { left: 54, right: 28, top: 26, bottom: 50 };
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
  };
}

function drawEvaluationGrid(width, height, map) {
  evaluationCtx.save();
  evaluationCtx.strokeStyle = "#edf1f6";
  evaluationCtx.fillStyle = "#73808f";
  evaluationCtx.font = "12px Inter, system-ui, sans-serif";
  for (let value = 0; value <= 10; value += 2) {
    const x = map.x(value);
    const y = map.y(value);
    evaluationCtx.beginPath();
    evaluationCtx.moveTo(x, map.padding.top);
    evaluationCtx.lineTo(x, height - map.padding.bottom);
    evaluationCtx.stroke();
    evaluationCtx.beginPath();
    evaluationCtx.moveTo(map.padding.left, y);
    evaluationCtx.lineTo(width - map.padding.right, y);
    evaluationCtx.stroke();
    evaluationCtx.fillText(String(value), x - 4, height - 20);
    evaluationCtx.fillText(String(value), 20, y + 4);
  }
  evaluationCtx.strokeStyle = "#303742";
  evaluationCtx.lineWidth = 1.5;
  evaluationCtx.beginPath();
  evaluationCtx.moveTo(map.padding.left, map.padding.top);
  evaluationCtx.lineTo(map.padding.left, height - map.padding.bottom);
  evaluationCtx.lineTo(width - map.padding.right, height - map.padding.bottom);
  evaluationCtx.stroke();
  evaluationCtx.restore();
}

function selectedPoint() {
  return evalState.points.find((point) => point.id === evalState.selectedPointId) || evalState.points[0];
}

function drawSelectedSilhouetteLines(map) {
  const point = selectedPoint();
  if (!point || point.cluster === null || !evalState.metrics) return;
  const sameCluster = evalState.metrics.clusters[point.cluster].filter((candidate) => candidate.id !== point.id);
  const nearestOther =
    point.nearestOtherCluster === null ? [] : evalState.metrics.clusters[point.nearestOtherCluster];
  const x = map.x(point.x);
  const y = map.y(point.y);

  evaluationCtx.save();
  evaluationCtx.lineWidth = 1;
  sameCluster.forEach((other) => {
    evaluationCtx.strokeStyle = "rgba(47, 141, 203, 0.24)";
    evaluationCtx.beginPath();
    evaluationCtx.moveTo(x, y);
    evaluationCtx.lineTo(map.x(other.x), map.y(other.y));
    evaluationCtx.stroke();
  });
  nearestOther.forEach((other) => {
    evaluationCtx.strokeStyle = "rgba(219, 76, 69, 0.22)";
    evaluationCtx.beginPath();
    evaluationCtx.moveTo(x, y);
    evaluationCtx.lineTo(map.x(other.x), map.y(other.y));
    evaluationCtx.stroke();
  });
  evaluationCtx.restore();
}

function drawEvaluationPlot() {
  resizeEvaluationCanvas();
  const rect = evaluationCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const map = evaluationMapper(width, height);

  evaluationCtx.clearRect(0, 0, width, height);
  evaluationCtx.fillStyle = "#ffffff";
  evaluationCtx.fillRect(0, 0, width, height);
  drawEvaluationGrid(width, height, map);
  drawSelectedSilhouetteLines(map);

  evalState.points.forEach((point) => {
    const x = map.x(point.x);
    const y = map.y(point.y);
    const selected = point.id === evalState.selectedPointId;
    const clusterColor =
      point.cluster === null ? "#111827" : evalClusterColors[point.cluster % evalClusterColors.length];
    const truthColor = truthClasses[point.trueClass].color;

    evaluationCtx.beginPath();
    evaluationCtx.arc(x, y, selected ? 8.5 : 6.5, 0, Math.PI * 2);
    evaluationCtx.fillStyle = clusterColor;
    evaluationCtx.globalAlpha = point.cluster === null ? 1 : 0.86;
    evaluationCtx.fill();
    evaluationCtx.globalAlpha = 1;
    evaluationCtx.lineWidth = selected ? 3 : 2;
    evaluationCtx.strokeStyle = truthColor;
    evaluationCtx.stroke();

    evaluationCtx.fillStyle = "#111827";
    evaluationCtx.font = "11px Inter, system-ui, sans-serif";
    evaluationCtx.fillText(truthClasses[point.trueClass].label, x + 9, y - 8);
  });

  evalState.centroids.forEach((centroid, index) => {
    const x = map.x(centroid.x);
    const y = map.y(centroid.y);
    const size = 16;
    evaluationCtx.beginPath();
    evaluationCtx.moveTo(x, y - size);
    evaluationCtx.lineTo(x - size * 0.92, y + size * 0.86);
    evaluationCtx.lineTo(x + size * 0.92, y + size * 0.86);
    evaluationCtx.closePath();
    evaluationCtx.fillStyle = centroid.color;
    evaluationCtx.strokeStyle = "#1f2933";
    evaluationCtx.lineWidth = 1.8;
    evaluationCtx.fill();
    evaluationCtx.stroke();
    evaluationCtx.fillStyle = "#111827";
    evaluationCtx.font = "700 13px Inter, system-ui, sans-serif";
    evaluationCtx.fillText(`C${index + 1}`, x + 16, y + 4);
  });
}

function renderMetricCards() {
  const metrics = evalState.metrics;
  metricSse.textContent = evalFormat(metrics.totalSse, 2);
  metricSilhouette.textContent = evalFormat(metrics.silhouetteAvg, 3);
  metricDb.textContent = evalFormat(metrics.dbIndex, 3);
  metricDunn.textContent = evalFormat(metrics.dunnIndex, 3);
  metricPurity.textContent = evalFormat(metrics.purity, 3);
  metricNmi.textContent = evalFormat(metrics.nmi, 3);
  metricFMeasure.textContent = evalFormat(metrics.fMeasure, 3);
  metricJaccard.textContent = evalFormat(metrics.jaccard, 3);
  evaluationStatus.textContent = `K = ${evalState.k}, iterasi ${evalState.iteration}`;
}

function renderSelectedPoint() {
  const point = selectedPoint();
  if (!point) return;
  const otherClusterLabel =
    point.nearestOtherCluster === null ? "-" : `C${point.nearestOtherCluster + 1}`;
  selectedPointSummary.textContent =
    `${point.id}: label asli ${truthClasses[point.trueClass].label}, cluster C${point.cluster + 1}. ` +
    `b(i) memakai rata-rata jarak ke cluster terdekat lain: ${otherClusterLabel}.`;
  selectedA.textContent = evalFormat(point.a, 3);
  selectedB.textContent = evalFormat(point.b, 3);
  selectedS.textContent = evalFormat(point.silhouette, 3);
}

function renderInternalTable() {
  internalTableBody.innerHTML = evalState.points
    .map((point) => {
      const selectedClass = point.id === evalState.selectedPointId ? "selected-row" : "";
      return `
        <tr class="${selectedClass}">
          <td><strong>${point.id}</strong></td>
          <td><span class="truth-badge" style="border-color:${truthClasses[point.trueClass].color}">${truthClasses[point.trueClass].label}</span></td>
          <td><span class="cluster-badge" style="background:${evalClusterColors[point.cluster]}">C${point.cluster + 1}</span></td>
          <td>${evalFormat(point.sse, 3)}</td>
          <td>${evalFormat(point.a, 3)}</td>
          <td>${evalFormat(point.b, 3)}</td>
          <td>${evalFormat(point.silhouette, 3)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderClusterSummary() {
  clusterSummaryBody.innerHTML = evalState.metrics.clusterSummaries
    .map((summary) => `
      <tr>
        <td><span class="cluster-badge" style="background:${evalClusterColors[summary.index]}">C${summary.index + 1}</span></td>
        <td>${summary.count}</td>
        <td>${evalFormat(summary.sse, 3)}</td>
        <td>${evalFormat(summary.scatter, 3)}</td>
        <td>${evalFormat(summary.diameter, 3)}</td>
        <td>${evalFormat(summary.dbR, 3)}</td>
      </tr>
    `)
    .join("");
}

function renderConfusionMatrix() {
  confusionHead.innerHTML = `
    <tr>
      <th>Cluster</th>
      ${truthClasses.map((truth) => `<th>True ${truth.label}</th>`).join("")}
      <th>Majority</th>
    </tr>
  `;
  confusionBody.innerHTML = evalState.metrics.matrix
    .map((row, index) => {
      const maxValue = Math.max(...row, 0);
      const majorityIndex = row.indexOf(maxValue);
      return `
        <tr>
          <td><span class="cluster-badge" style="background:${evalClusterColors[index]}">C${index + 1}</span></td>
          ${row.map((count) => `<td class="${count === maxValue && count > 0 ? "distance-min" : ""}">${count}</td>`).join("")}
          <td>${maxValue ? truthClasses[majorityIndex].label : "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function renderExternalSummary() {
  const metrics = evalState.metrics;
  const rows = [
    ["TP", metrics.tp, "Pasangan sama label asli dan sama cluster prediksi"],
    ["FP", metrics.fp, "Pasangan beda label asli tetapi sama cluster prediksi"],
    ["FN", metrics.fn, "Pasangan sama label asli tetapi beda cluster prediksi"],
    ["TN", metrics.tn, "Pasangan beda label asli dan beda cluster prediksi"],
    ["Precision", metrics.precision, "TP / (TP + FP)"],
    ["Recall", metrics.recall, "TP / (TP + FN)"],
    ["MI", metrics.mi, "Mutual information antara label asli dan cluster"],
    ["H(True)", metrics.hTrue, "Entropy label asli"],
    ["H(Cluster)", metrics.hCluster, "Entropy cluster prediksi"],
  ];

  externalSummaryBody.innerHTML = rows
    .map(([label, value, note]) => `
      <tr>
        <th>${label}</th>
        <td>${typeof value === "number" ? evalFormat(value, Number.isInteger(value) ? 0 : 4) : value}</td>
        <td>${note}</td>
      </tr>
    `)
    .join("");
}

function shortList(items, maxItems = 6) {
  if (items.length <= maxItems) return items.join(" + ");
  return `${items.slice(0, maxItems).join(" + ")} + ... + ${items.length - maxItems} lagi`;
}

function distanceList(point, points, maxItems = 7) {
  const terms = points.map((other) => `d(${point.id},${other.id})=${evalFormat(distance(point, other), 2)}`);
  return terms.length ? shortList(terms, maxItems) : "tidak ada titik lain";
}

function minPointDistanceBetween(leftPoints, rightPoints) {
  let minDistance = Number.POSITIVE_INFINITY;
  leftPoints.forEach((left) => {
    rightPoints.forEach((right) => {
      minDistance = Math.min(minDistance, distance(left, right));
    });
  });
  return Number.isFinite(minDistance) ? minDistance : 0;
}

function renderSseDetail() {
  const metrics = evalState.metrics;
  const subtotals = metrics.clusterSummaries.map((summary) => `SSE_C${summary.index + 1}=${evalFormat(summary.sse, 2)}`);
  sseFormulaDetail.innerHTML =
    `SSE dihitung dengan menjumlahkan kuadrat jarak setiap titik ke centroid cluster-nya. ` +
    `Pada data ini: ${subtotals.join(" + ")} = <strong>${evalFormat(metrics.totalSse, 2)}</strong>.`;

  sseBreakdownBody.innerHTML = metrics.clusterSummaries
    .map((summary) => {
      const centroid = evalState.centroids[summary.index];
      const terms = summary.points.map(
        (point) =>
          `${point.id}: (${evalFormat(point.x, 2)}-${evalFormat(centroid.x, 2)})<sup>2</sup> + ` +
          `(${evalFormat(point.y, 2)}-${evalFormat(centroid.y, 2)})<sup>2</sup> = ${evalFormat(point.sse, 2)}`,
      );
      return `
        <tr>
          <td><span class="cluster-badge" style="background:${evalClusterColors[summary.index]}">C${summary.index + 1}</span></td>
          <td>(${evalFormat(centroid.x, 2)}, ${evalFormat(centroid.y, 2)})</td>
          <td class="formula-cell">${shortList(terms, 4)}</td>
          <td><strong>${evalFormat(summary.sse, 2)}</strong></td>
        </tr>
      `;
    })
    .join("");
}

function renderSilhouetteDetail() {
  const point = selectedPoint();
  if (!point) return;
  const metrics = evalState.metrics;
  const sameCluster = metrics.clusters[point.cluster].filter((candidate) => candidate.id !== point.id);
  const otherClusterRows = metrics.clusters
    .map((clusterPoints, clusterIndex) => {
      if (clusterIndex === point.cluster || !clusterPoints.length) return null;
      const avg = pairAverage(point, clusterPoints);
      return { clusterIndex, clusterPoints, avg };
    })
    .filter(Boolean);
  const bSource = otherClusterRows.find((row) => row.clusterIndex === point.nearestOtherCluster);
  const sameDenominator = sameCluster.length || 1;

  silhouetteFormulaDetail.innerHTML =
    `${point.id} dipakai sebagai contoh. ` +
    `a(i) = rata-rata jarak ke titik lain dalam C${point.cluster + 1}; ` +
    `b(i) = rata-rata terkecil ke cluster lain. ` +
    `s(i) = (${evalFormat(point.b, 3)} - ${evalFormat(point.a, 3)}) / max(${evalFormat(point.a, 3)}, ${evalFormat(point.b, 3)}) = ` +
    `<strong>${evalFormat(point.silhouette, 3)}</strong>.`;

  const rows = [
    `
      <tr>
        <td>a(i)</td>
        <td class="formula-cell">(${distanceList(point, sameCluster)}) / ${sameDenominator}</td>
        <td><strong>${evalFormat(point.a, 3)}</strong></td>
      </tr>
    `,
    ...otherClusterRows.map(
      (row) => `
        <tr class="${row.clusterIndex === point.nearestOtherCluster ? "selected-row" : ""}">
          <td>avg ke C${row.clusterIndex + 1}</td>
          <td class="formula-cell">(${distanceList(point, row.clusterPoints)}) / ${row.clusterPoints.length}</td>
          <td><strong>${evalFormat(row.avg, 3)}</strong></td>
        </tr>
      `,
    ),
    `
      <tr>
        <td>b(i)</td>
        <td class="formula-cell">min(${otherClusterRows.map((row) => `avg C${row.clusterIndex + 1}=${evalFormat(row.avg, 3)}`).join(", ")})${bSource ? ` = C${bSource.clusterIndex + 1}` : ""}</td>
        <td><strong>${evalFormat(point.b, 3)}</strong></td>
      </tr>
    `,
    `
      <tr>
        <td>s(i)</td>
        <td class="formula-cell">(${evalFormat(point.b, 3)} - ${evalFormat(point.a, 3)}) / max(${evalFormat(point.a, 3)}, ${evalFormat(point.b, 3)})</td>
        <td><strong>${evalFormat(point.silhouette, 3)}</strong></td>
      </tr>
    `,
  ];

  silhouetteDetailBody.innerHTML = rows.join("");
}

function renderDbDunnDetail() {
  const metrics = evalState.metrics;
  const summaries = metrics.clusterSummaries;
  dbDunnFormulaDetail.innerHTML =
    `Untuk Davies-Bouldin: S_j adalah rata-rata jarak titik di C_j ke centroid C_j. ` +
    `R_jk = (S_j + S_k) / M_jk, lalu DB = rata-rata nilai R_j terbesar. ` +
    `Untuk Dunn: min jarak antar cluster / max diameter cluster = ` +
    `${evalFormat(metrics.minInterClusterDistance, 3)} / ${evalFormat(metrics.maxDiameter, 3)} = ` +
    `<strong>${evalFormat(metrics.dunnIndex, 3)}</strong>.`;

  const rows = [];
  for (let i = 0; i < summaries.length; i += 1) {
    for (let j = i + 1; j < summaries.length; j += 1) {
      const m = distance(evalState.centroids[i], evalState.centroids[j]);
      const r = m ? (summaries[i].scatter + summaries[j].scatter) / m : 0;
      const interMin = minPointDistanceBetween(summaries[i].points, summaries[j].points);
      rows.push(`
        <tr>
          <td>C${i + 1} vs C${j + 1}</td>
          <td>${evalFormat(m, 3)}</td>
          <td>(${evalFormat(summaries[i].scatter, 3)} + ${evalFormat(summaries[j].scatter, 3)}) / ${evalFormat(m, 3)} = <strong>${evalFormat(r, 3)}</strong></td>
          <td>${evalFormat(interMin, 3)} / ${evalFormat(metrics.maxDiameter, 3)} = ${evalFormat(metrics.maxDiameter ? interMin / metrics.maxDiameter : 0, 3)}</td>
        </tr>
      `);
    }
  }
  dbDunnDetailBody.innerHTML = rows.join("");
}

function renderExternalFormulaDetail() {
  const metrics = evalState.metrics;
  const majorityCounts = metrics.matrix.map((row) => Math.max(...row, 0));
  const n = evalState.points.length;
  const precisionDenominator = metrics.tp + metrics.fp;
  const recallDenominator = metrics.tp + metrics.fn;
  const jaccardDenominator = metrics.tp + metrics.fp + metrics.fn;

  externalFormulaDetail.innerHTML =
    `Metrik eksternal membandingkan cluster prediksi dengan label asli. ` +
    `Purity memakai mayoritas label pada setiap cluster, sedangkan F-Measure dan Jaccard memakai pasangan titik TP/FP/FN.`;

  externalFormulaBody.innerHTML = `
    <tr>
      <td>Purity</td>
      <td>(${majorityCounts.join(" + ")}) / ${n}</td>
      <td><strong>${evalFormat(metrics.purity, 3)}</strong></td>
    </tr>
    <tr>
      <td>Precision</td>
      <td>TP / (TP + FP) = ${metrics.tp} / (${metrics.tp} + ${metrics.fp})</td>
      <td><strong>${evalFormat(metrics.precision, 3)}</strong></td>
    </tr>
    <tr>
      <td>Recall</td>
      <td>TP / (TP + FN) = ${metrics.tp} / (${metrics.tp} + ${metrics.fn})</td>
      <td><strong>${evalFormat(metrics.recall, 3)}</strong></td>
    </tr>
    <tr>
      <td>F-Measure</td>
      <td>2PR / (P + R) = 2(${evalFormat(metrics.precision, 3)})(${evalFormat(metrics.recall, 3)}) / (${evalFormat(metrics.precision, 3)} + ${evalFormat(metrics.recall, 3)})</td>
      <td><strong>${evalFormat(metrics.fMeasure, 3)}</strong></td>
    </tr>
    <tr>
      <td>Jaccard</td>
      <td>TP / (TP + FP + FN) = ${metrics.tp} / ${jaccardDenominator}</td>
      <td><strong>${evalFormat(metrics.jaccard, 3)}</strong></td>
    </tr>
    <tr>
      <td>NMI</td>
      <td>MI / sqrt(H(cluster)H(true)) = ${evalFormat(metrics.mi, 4)} / sqrt(${evalFormat(metrics.hCluster, 4)} x ${evalFormat(metrics.hTrue, 4)})</td>
      <td><strong>${evalFormat(metrics.nmi, 3)}</strong></td>
    </tr>
    <tr>
      <td>Pair count</td>
      <td>TP=${metrics.tp}, FP=${metrics.fp}, FN=${metrics.fn}, TN=${metrics.tn}; P denom=${precisionDenominator}, R denom=${recallDenominator}</td>
      <td>${n} titik</td>
    </tr>
  `;

  const miRows = [];
  metrics.matrix.forEach((row, clusterIndex) => {
    row.forEach((count, trueIndex) => {
      if (!count) return;
      const rowSum = metrics.rowSums[clusterIndex];
      const colSum = metrics.colSums[trueIndex];
      const term = (count / n) * Math.log((count * n) / (rowSum * colSum));
      miRows.push(`
        <tr>
          <td>C${clusterIndex + 1}, True ${truthClasses[trueIndex].label}</td>
          <td>(${count}/${n}) ln((${count} x ${n}) / (${rowSum} x ${colSum}))</td>
          <td>${evalFormat(term, 4)}</td>
        </tr>
      `);
    });
  });
  miTermBody.innerHTML = miRows.join("");
}

function renderDetailedCalculations() {
  renderSseDetail();
  renderSilhouetteDetail();
  renderDbDunnDetail();
  renderExternalFormulaDetail();
}

function renderEvaluation() {
  if (!evalState.metrics) return;
  drawEvaluationPlot();
  renderMetricCards();
  renderSelectedPoint();
  renderDetailedCalculations();
  renderInternalTable();
  renderClusterSummary();
  renderConfusionMatrix();
  renderExternalSummary();
}

function pointerToPlotPoint(event) {
  const rect = evaluationCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };
}

evaluationCanvas.addEventListener("pointerdown", (event) => {
  const pointer = pointerToPlotPoint(event);
  const map = evaluationMapper(pointer.width, pointer.height);
  let bestPoint = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  evalState.points.forEach((point) => {
    const d = Math.hypot(pointer.x - map.x(point.x), pointer.y - map.y(point.y));
    if (d < bestDistance) {
      bestDistance = d;
      bestPoint = point;
    }
  });
  if (bestPoint && bestDistance <= 18) {
    evalState.selectedPointId = bestPoint.id;
    renderEvaluation();
  }
});

runEvaluationButton.addEventListener("click", runEvaluation);
stepEvaluationButton.addEventListener("click", stepKMeans);
newEvaluationDataButton.addEventListener("click", generateEvaluationData);
evalKInput.addEventListener("change", runEvaluation);
evalPointInput.addEventListener("change", generateEvaluationData);
overlapSlider.addEventListener("input", generateEvaluationData);
noiseSlider.addEventListener("input", runEvaluation);
window.addEventListener("resize", renderEvaluation);

generateEvaluationData();
