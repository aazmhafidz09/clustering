import React, { useMemo, useState } from "react";

const DEFAULT_POINTS = [
  { id: "A", x: 80, y: 90 },
  { id: "B", x: 125, y: 115 },
  { id: "C", x: 255, y: 85 },
  { id: "D", x: 295, y: 125 },
  { id: "E", x: 190, y: 235 },
  { id: "F", x: 230, y: 265 },
];

const PALETTE = [
  "bg-sky-100 border-sky-400 text-sky-800",
  "bg-emerald-100 border-emerald-400 text-emerald-800",
  "bg-violet-100 border-violet-400 text-violet-800",
  "bg-amber-100 border-amber-400 text-amber-800",
  "bg-rose-100 border-rose-400 text-rose-800",
  "bg-cyan-100 border-cyan-400 text-cyan-800",
];

function euclidean(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function centroid(cluster) {
  const x = cluster.points.reduce((sum, p) => sum + p.x, 0) / cluster.points.length;
  const y = cluster.points.reduce((sum, p) => sum + p.y, 0) / cluster.points.length;
  return { x, y };
}

function clusterDistance(c1, c2, linkage) {
  const distances = [];
  for (const p1 of c1.points) {
    for (const p2 of c2.points) {
      distances.push(euclidean(p1, p2));
    }
  }

  if (linkage === "single") return Math.min(...distances);
  if (linkage === "complete") return Math.max(...distances);
  if (linkage === "average") return distances.reduce((a, b) => a + b, 0) / distances.length;

  const cen1 = centroid(c1);
  const cen2 = centroid(c2);
  return euclidean(cen1, cen2);
}

function makeInitialClusters(points) {
  return points.map((p) => ({
    id: p.id,
    label: p.id,
    members: [p.id],
    points: [p],
    height: 0,
    left: null,
    right: null,
  }));
}

function formatMembers(cluster) {
  return `{${cluster.members.join(", ")}}`;
}

function buildHierarchy(points, linkage) {
  let clusters = makeInitialClusters(points);
  const snapshots = [{
    step: 0,
    clusters: clusters.map(cloneClusterLight),
    merge: null,
    candidatePairs: getCandidatePairs(clusters, linkage),
  }];

  let mergeNumber = 1;
  while (clusters.length > 1) {
    const pairs = getCandidatePairs(clusters, linkage);
    const best = pairs[0];

    const merged = {
      id: `M${mergeNumber}`,
      label: `${best.a.label}${best.b.label}`,
      members: [...best.a.members, ...best.b.members].sort(),
      points: [...best.a.points, ...best.b.points],
      height: best.distance,
      left: best.a,
      right: best.b,
    };

    clusters = clusters
      .filter((c) => c.id !== best.a.id && c.id !== best.b.id)
      .concat(merged)
      .sort((x, y) => x.members.join("").localeCompare(y.members.join("")));

    snapshots.push({
      step: mergeNumber,
      clusters: clusters.map(cloneClusterLight),
      merge: {
        a: cloneClusterLight(best.a),
        b: cloneClusterLight(best.b),
        distance: best.distance,
      },
      candidatePairs: getCandidatePairs(clusters, linkage),
    });

    mergeNumber += 1;
  }

  return snapshots;
}

function cloneClusterLight(cluster) {
  return {
    id: cluster.id,
    label: cluster.label,
    members: [...cluster.members],
    points: [...cluster.points],
    height: cluster.height,
    left: cluster.left,
    right: cluster.right,
  };
}

function getCandidatePairs(clusters, linkage) {
  const pairs = [];
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      pairs.push({
        a: clusters[i],
        b: clusters[j],
        distance: clusterDistance(clusters[i], clusters[j], linkage),
      });
    }
  }

  return pairs.sort((p, q) => {
    if (Math.abs(p.distance - q.distance) > 1e-9) return p.distance - q.distance;
    return `${p.a.label}-${p.b.label}`.localeCompare(`${q.a.label}-${q.b.label}`);
  });
}

function Button({ children, onClick, disabled, variant = "primary" }) {
  const base = "rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
  const style = variant === "primary"
    ? "bg-slate-900 text-white hover:bg-slate-700"
    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

function ClusterChip({ cluster, index }) {
  const color = PALETTE[index % PALETTE.length];
  return (
    <div className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${color}`}>
      {formatMembers(cluster)}
    </div>
  );
}

function PointMap({ points, clusters }) {
  const pointToCluster = new Map();
  clusters.forEach((cluster, index) => {
    cluster.members.forEach((member) => pointToCluster.set(member, index));
  });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Peta Titik Data</h3>
        <span className="text-xs text-slate-500">Jarak memakai Euclidean distance</span>
      </div>
      <svg viewBox="0 0 380 340" className="h-[340px] w-full rounded-2xl bg-slate-50">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgb(226 232 240)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="380" height="340" fill="url(#grid)" />

        {clusters.map((cluster, clusterIndex) => {
          if (cluster.points.length < 2) return null;
          const c = centroid(cluster);
          const maxDistance = Math.max(...cluster.points.map((p) => euclidean(p, c)), 26);
          return (
            <circle
              key={`cluster-area-${cluster.id}`}
              cx={c.x}
              cy={c.y}
              r={maxDistance + 22}
              className="fill-slate-300/20 stroke-slate-400/40"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
          );
        })}

        {points.map((point) => {
          const clusterIndex = pointToCluster.get(point.id) ?? 0;
          return (
            <g key={point.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r="16"
                className="fill-white stroke-slate-800"
                strokeWidth="2"
              />
              <text
                x={point.x}
                y={point.y + 5}
                textAnchor="middle"
                className="fill-slate-900 text-sm font-bold"
              >
                {point.id}
              </text>
              <text
                x={point.x}
                y={point.y + 35}
                textAnchor="middle"
                className="fill-slate-500 text-[10px]"
              >
                C{clusterIndex + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DistanceTable({ snapshot }) {
  const pairs = snapshot.candidatePairs.slice(0, 8);
  const bestPair = pairs[0];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-slate-900">Pasangan Cluster Terdekat</h3>
      {pairs.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          Semua titik sudah menjadi satu cluster besar.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Pasangan</th>
                <th className="px-3 py-2 text-right">Jarak</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair, index) => (
                <tr key={`${pair.a.id}-${pair.b.id}`} className={index === 0 ? "bg-emerald-50" : "bg-white"}>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {formatMembers(pair.a)} + {formatMembers(pair.b)}
                    {index === 0 && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">dipilih</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{pair.distance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {bestPair && (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Pada langkah berikutnya, cluster dengan jarak paling kecil akan digabung terlebih dahulu.
        </p>
      )}
    </div>
  );
}

function ExplanationPanel({ snapshot, linkage }) {
  const linkageText = {
    single: "Single linkage melihat jarak paling dekat antara dua titik dari dua cluster.",
    complete: "Complete linkage melihat jarak paling jauh antara dua titik dari dua cluster.",
    average: "Average linkage memakai rata-rata semua jarak antartitik dari dua cluster.",
    centroid: "Centroid linkage memakai jarak antara titik pusat dari dua cluster.",
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-slate-900">Penjelasan Langkah</h3>
      <div className="space-y-3 text-sm leading-6 text-slate-700">
        <p>
          <span className="font-semibold">Metode:</span> {linkageText[linkage]}
        </p>
        {snapshot.step === 0 ? (
          <p>
            Awalnya, setiap titik dianggap sebagai cluster sendiri. Jadi A, B, C, D, E, dan F masih berdiri sendiri.
          </p>
        ) : (
          <p>
            Langkah {snapshot.step}: cluster {formatMembers(snapshot.merge.a)} dan {formatMembers(snapshot.merge.b)} digabung karena jaraknya paling kecil, yaitu {snapshot.merge.distance.toFixed(2)}.
          </p>
        )}
        <p>
          Setelah langkah ini, jumlah cluster menjadi <span className="font-semibold">{snapshot.clusters.length}</span>.
        </p>
      </div>
    </div>
  );
}

function MiniDendrogram({ snapshots, step }) {
  const completed = snapshots.slice(1, step + 1);
  const maxDistance = Math.max(...snapshots.slice(1).map((s) => s.merge?.distance ?? 0), 1);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-slate-900">Dendrogram Sederhana</h3>
      <div className="space-y-2">
        {snapshots.slice(1).map((s, index) => {
          const active = index < completed.length;
          const width = `${Math.max(10, ((s.merge.distance / maxDistance) * 100))}%`;
          return (
            <div key={index} className="grid grid-cols-[72px_1fr_64px] items-center gap-3 text-sm">
              <div className={active ? "font-semibold text-slate-800" : "text-slate-400"}>Step {index + 1}</div>
              <div className="h-7 rounded-full bg-slate-100 p-1">
                <div
                  className={`h-5 rounded-full ${active ? "bg-slate-800" : "bg-slate-300"}`}
                  style={{ width }}
                />
              </div>
              <div className={active ? "font-mono text-slate-700" : "font-mono text-slate-400"}>
                {s.merge.distance.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Bar yang makin panjang berarti cluster digabung pada jarak yang makin besar. Dalam dendrogram asli, ini menjadi tinggi percabangan.
      </p>
    </div>
  );
}

export default function AgglomerativePlayground() {
  const [points, setPoints] = useState(DEFAULT_POINTS);
  const [linkage, setLinkage] = useState("single");
  const [step, setStep] = useState(0);

  const snapshots = useMemo(() => buildHierarchy(points, linkage), [points, linkage]);
  const snapshot = snapshots[Math.min(step, snapshots.length - 1)];
  const maxStep = snapshots.length - 1;

  function reset() {
    setPoints(DEFAULT_POINTS);
    setStep(0);
  }

  function shufflePoints() {
    const shifted = DEFAULT_POINTS.map((p, index) => ({
      ...p,
      x: Math.max(45, Math.min(330, p.x + ((index % 3) - 1) * 24 + (index % 2) * 18)),
      y: Math.max(45, Math.min(295, p.y + ((index % 2) ? -22 : 18))),
    }));
    setPoints(shifted);
    setStep(0);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Data Mining Playground</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                Agglomerative Hierarchical Clustering
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                Playground ini memperlihatkan cara kerja clustering hierarkis dari bawah ke atas: setiap titik mulai sebagai cluster sendiri, lalu dua cluster terdekat digabung berulang sampai menjadi satu cluster besar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Sebelumnya</Button>
              <Button onClick={() => setStep((s) => Math.min(maxStep, s + 1))} disabled={step === maxStep}>Langkah Berikutnya</Button>
              <Button variant="secondary" onClick={reset}>Reset</Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Kontrol Eksperimen</h2>
                  <p className="text-sm text-slate-500">Pilih cara menghitung jarak antarkelompok.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["single", "Single"],
                    ["complete", "Complete"],
                    ["average", "Average"],
                    ["centroid", "Centroid"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => { setLinkage(value); setStep(0); }}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${linkage === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      {label}
                    </button>
                  ))}
                  <Button variant="secondary" onClick={shufflePoints}>Ubah Posisi Titik</Button>
                </div>
              </div>
            </div>

            <PointMap points={points} clusters={snapshot.clusters} />
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Status Cluster</h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  Step {step} / {maxStep}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {snapshot.clusters.map((cluster, index) => (
                  <ClusterChip key={cluster.id} cluster={cluster} index={index} />
                ))}
              </div>
            </div>

            <ExplanationPanel snapshot={snapshot} linkage={linkage} />
            <DistanceTable snapshot={snapshot} />
            <MiniDendrogram snapshots={snapshots} step={step} />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">1. Mulai dari titik tunggal</h3>
            <p className="text-sm leading-6 text-slate-600">Setiap data dianggap sebagai satu cluster. Jika ada 6 titik, maka awalnya ada 6 cluster.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">2. Cari dua cluster terdekat</h3>
            <p className="text-sm leading-6 text-slate-600">Jarak antarkelompok dihitung sesuai linkage yang dipilih: single, complete, average, atau centroid.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">3. Gabungkan berulang</h3>
            <p className="text-sm leading-6 text-slate-600">Proses berhenti ketika semua data sudah tergabung menjadi satu hierarki cluster.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
