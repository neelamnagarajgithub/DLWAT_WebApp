"use client";

import React, { useRef, useState } from "react";
import { Line, Bar, Pie, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const analysisRef = useRef<HTMLDivElement | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/predict", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Upload failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle the new rich API response format
  const output = result ?? {};
  const summary = output.summary ?? {};
  const clusterProfiles = output.cluster_profiles ?? {};
  const predictionsPreview = Array.isArray(output.predictions_preview) ? output.predictions_preview : [];
  const recommendation = output.recommendation ?? {};
  
  // Extract class distribution from summary
  const classDistribution = summary.class_distribution ?? {};
  const totalWindows = summary.total_windows ?? 0;
  const dominantWorkload = summary.dominant_workload_type ?? "Unknown";
  
  // Build chart data for class distribution
  const classLabels = Object.keys(classDistribution);
  const classValues = Object.values(classDistribution) as number[];
  
  // Build cluster data
  const clusterLabels = Object.keys(clusterProfiles);
  const clusterValues = clusterLabels.map(id => clusterProfiles[id]?.members ?? 0);
  
  // Confidence distribution from predictions
  const confidenceValues = predictionsPreview.map((p: any) => p.confidence ?? 0);
  const avgConfidence = confidenceValues.length > 0 
    ? (confidenceValues.reduce((a: number, b: number) => a + b, 0) / confidenceValues.length) 
    : 0;
  
  // Group predictions by confidence ranges for visualization
  const confidenceRanges = {
    'High (0.8-1.0)': confidenceValues.filter(c => c >= 0.8).length,
    'Medium (0.6-0.8)': confidenceValues.filter(c => c >= 0.6 && c < 0.8).length,
    'Low (0.4-0.6)': confidenceValues.filter(c => c >= 0.4 && c < 0.6).length,
    'Very Low (0-0.4)': confidenceValues.filter(c => c < 0.4).length,
  };
  
  const confRangeLabels = Object.keys(confidenceRanges);
  const confRangeValues = Object.values(confidenceRanges);

  // helper: convert hex -> rgba string (avoids CSS lab() parsing)
  const hexToRgba = (hex: string, alpha = 1) => {
    const h = hex.replace("#", "");
    const bigint = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const colorPalette = (n: number, alpha = 0.85) => {
    const base = [
      "#3b82f6",
      "#ef4444",
      "#facc15",
      "#10b981",
      "#6366f1",
      "#f97316",
      "#14b8a6",
      "#f43f5e",
      "#8b5cf6",
      "#06b6d4",
    ];
    const outBg: string[] = [];
    const outBorder: string[] = [];
    for (let i = 0; i < n; i++) {
      const hex = base[i % base.length];
      outBg.push(hexToRgba(hex, alpha));
      outBorder.push(hexToRgba(hex, 1));
    }
    return { bg: outBg, border: outBorder };
  };

  const classificationCols = colorPalette(classLabels.length);
  const clusterCols = colorPalette(clusterLabels.length);
  const confidenceCols = colorPalette(confRangeLabels.length);

  const classificationChart = {
    labels: classLabels,
    datasets: [
      {
        label: "Windows",
        data: classValues,
        backgroundColor: classificationCols.bg,
        borderColor: classificationCols.border,
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const clusterChart = {
    labels: clusterLabels.map(id => `Cluster ${id}`),
    datasets: [
      {
        label: "Members",
        data: clusterValues,
        backgroundColor: clusterCols.bg,
        borderColor: clusterCols.border,
        borderWidth: 2,
      },
    ],
  };
  
  const confidenceChart = {
    labels: confRangeLabels,
    datasets: [
      {
        label: "Predictions",
        data: confRangeValues,
        backgroundColor: confidenceCols.bg,
        borderColor: confidenceCols.border,
        borderWidth: 2,
      },
    ],
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "bottom" as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          font: { size: 12 }
        }
      },
      tooltip: { 
        mode: "index" as const, 
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1
      },
    },
    scales: {
      x: { 
        ticks: { color: "#6b7280" },
        grid: { color: 'rgba(107, 114, 128, 0.1)' }
      },
      y: { 
        ticks: { color: "#6b7280" }, 
        beginAtZero: true,
        grid: { color: 'rgba(107, 114, 128, 0.1)' }
      },
    },
  };
  
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "right" as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          font: { size: 12 }
        }
      },
      tooltip: { 
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((context.parsed * 100) / total).toFixed(1);
            return `${context.label}: ${context.parsed} (${percentage}%)`;
          }
        }
      },
    },
  };

  const downloadPdf = async () => {
    if (!analysisRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const original = analysisRef.current;
    // clone the node to avoid modifying live UI
    const clone = original.cloneNode(true) as HTMLElement;

    // replace canvases in the clone with images copied from the originals
    try {
      const origCanvases = Array.from(original.querySelectorAll("canvas"));
      const cloneCanvases = Array.from(clone.querySelectorAll("canvas"));
      origCanvases.forEach((origCanvas, i) => {
        try {
          const dataUrl = (origCanvas as HTMLCanvasElement).toDataURL("image/png");
          const img = document.createElement("img");
          img.src = dataUrl;
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          const target = cloneCanvases[i];
          if (target && target.parentNode) target.parentNode.replaceChild(img, target);
        } catch (e) {
          // ignore canvas->image failures
        }
      });
    } catch (e) {}

    // Create an offscreen iframe with no stylesheets and write the clone into it.
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = `${Math.max(original.clientWidth, 800)}px`;
    iframe.style.height = `${Math.max(original.clientHeight, 600)}px`;
    // allow same-origin access
    document.body.appendChild(iframe);

    try {
      const idoc = iframe.contentDocument!;
      idoc.open();
      idoc.write("<!doctype html><html><head></head><body></body></html>");
      idoc.close();

      // import the clone into iframe document
      const imported = idoc.importNode(clone, true) as HTMLElement;
      idoc.body.style.margin = "0";
      idoc.body.appendChild(imported);

      // remove any style/link nodes just in case
      const head = idoc.head;
      Array.from(head.querySelectorAll("link, style")).forEach((n) => n.parentNode?.removeChild(n));

      // Inline computed styles from the original into the iframe nodes to avoid lab() in CSS rules
      const origAll = [original as HTMLElement, ...Array.from(original.querySelectorAll("*"))] as HTMLElement[];
      const iframeAll = [imported as HTMLElement, ...Array.from(imported.querySelectorAll("*"))] as HTMLElement[];

      const propsToCopy = [
        "background-color",
        "color",
        "background",
        "border-top-color",
        "border-right-color",
        "border-bottom-color",
        "border-left-color",
        "outline-color",
        "fill",
        "stroke",
        "box-shadow",
        "font",
        "font-size",
        "font-weight",
        "line-height",
        "text-decoration-color",
        "text-align",
        "padding",
        "margin",
        "display",
        "width",
        "height",
      ];

      for (let i = 0; i < origAll.length && i < iframeAll.length; i++) {
        const o = origAll[i];
        const c = iframeAll[i];
        try {
          const cs = window.getComputedStyle(o);
          propsToCopy.forEach((prop) => {
            const val = cs.getPropertyValue(prop as any);
            if (val) c.style.setProperty(prop, val);
          });
          // set explicit background-color if computed is transparent
          const bg = cs.getPropertyValue("background-color");
          if (bg) c.style.setProperty("background-color", bg);
        } catch (_) {
          // ignore per-element failures
        }
      }

      // Wait a tick for fonts/images to settle
      await new Promise((r) => setTimeout(r, 300));

      // Render iframe content with html2canvas (targets the imported element)
      const targetEl = idoc.body.firstElementChild as HTMLElement;
      const canvas = await html2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        // instruct html2canvas to use the iframe's window/document
        windowWidth: targetEl.scrollWidth || targetEl.clientWidth,
        windowHeight: targetEl.scrollHeight || targetEl.clientHeight,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = (pdf as any).getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("dlwat-analysis.pdf");
    } finally {
      // cleanup iframe
      try {
        document.body.removeChild(iframe);
      } catch (e) {}
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black font-sans">
      <main className="w-full max-w-5xl p-8 bg-white dark:bg-gray-900 rounded shadow-lg">
        <h1 className="text-4xl font-bold text-center text-black dark:text-white mb-6">
          DLWAT Workload Prediction
        </h1>

        <div className="flex flex-col gap-4 items-center">
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleUpload}
              disabled={loading}
            >
              {loading ? "Predicting..." : "Predict"}
            </button>
            {/* {result && (
              <button
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                onClick={downloadPdf}
              >
                Download PDF
              </button>
            )} */}
          </div>
          {error && <p className="text-red-500">{error}</p>}
        </div>

        {result && (
          <div ref={analysisRef}>
            {/* Success Message */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-green-800 dark:text-green-200 font-semibold">Analysis Complete!</h3>
                  <p className="text-green-600 dark:text-green-300 text-sm">{output.message || "Workload characterized successfully"}</p>
                </div>
              </div>
            </div>

            {/* Key Insights */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                Key Insights
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalWindows.toLocaleString()}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Total Windows</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Data points analyzed</div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900 dark:text-white">{dominantWorkload}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Dominant Type</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Primary workload pattern</div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{(avgConfidence * 100).toFixed(1)}%</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Avg Confidence</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Prediction accuracy</div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a2 2 0 012-2h6a2 2 0 012 2v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{clusterLabels.length}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Clusters</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Identified patterns</div>
                </div>
              </div>
            </section>

            {/* Charts */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="p-4 bg-white dark:bg-gray-900 rounded shadow" style={{ height: 340 }}>
                <h3 className="text-lg font-medium text-black dark:text-white text-center mb-2">Classification Distribution</h3>
                <div style={{ height: 220 }}>
                  <Pie data={classificationChart} options={{ ...commonOptions, plugins: { legend: { position: "bottom" } } }} />
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 text-center">
                  {classification.labels.map((lab, idx) => {
                    const val = classification.values[idx] ?? 0;
                    const pct = classification.total ? ((val / classification.total) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={lab}>
                        Class {lab}: {val} ({pct}%)
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-gray-900 rounded shadow" style={{ height: 340 }}>
                <h3 className="text-lg font-medium text-black dark:text-white text-center mb-2">Cluster Distribution</h3>
                <div style={{ height: 220 }}>
                  <Bar data={clusterChart} options={{ ...commonOptions, indexAxis: "x" }} />
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 text-center">
                  {clusters.labels.map((lab, idx) => {
                    const val = clusters.values[idx] ?? 0;
                    const pct = clusters.total ? ((val / clusters.total) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={lab}>
                        Cluster {lab}: {val} ({pct}%)
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Raw + sample preview */}
            <section className="mb-6">
              <h3 className="text-xl font-semibold text-black dark:text-white mb-2">Sample & Raw Output</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                  <strong>Classification (first 20)</strong>
                  <pre className="text-sm">{JSON.stringify(classificationData.slice(0, 20), null, 2)}</pre>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                  <strong>Clusters (first 20)</strong>
                  <pre className="text-sm">{JSON.stringify(clusterData.slice(0, 20), null, 2)}</pre>
                </div>
              </div>

              <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-sm">
                <strong>Raw JSON</strong>
                <pre>{JSON.stringify(output, null, 2)}</pre>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
} 