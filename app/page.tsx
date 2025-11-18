"use client";

import React, { useRef, useState } from "react";
import { Line, Bar, Pie } from "react-chartjs-2";
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

  // Normalize result shape (API returns [ { ... } ] in your example)
  const output = Array.isArray(result) ? result[0] ?? {} : result ?? {};

  const classificationData: number[] = Array.isArray(output?.classification)
    ? output.classification
    : [];
  const clusterData: number[] = Array.isArray(output?.clusters) ? output.clusters : [];

  // helper to build counts and sorted labels
  const buildCounts = (arr: number[]) => {
    const counts: Record<string, number> = {};
    arr.forEach((v) => {
      const k = String(v);
      counts[k] = (counts[k] || 0) + 1;
    });
    // sort labels numerically
    const labels = Object.keys(counts).sort((a, b) => Number(a) - Number(b));
    const values = labels.map((l) => counts[l]);
    return { counts, labels, values, total: arr.length };
  };

  const classification = buildCounts(classificationData);
  const clusters = buildCounts(clusterData);

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

  const classificationCols = colorPalette(classification.labels.length);
  const clusterCols = colorPalette(clusters.labels.length);

  const classificationChart = {
    labels: classification.labels,
    datasets: [
      {
        label: "Sequences",
        data: classification.values,
        backgroundColor: classificationCols.bg,
        borderColor: classificationCols.border,
        borderWidth: 1,
      },
    ],
  };

  const clusterChart = {
    labels: clusters.labels,
    datasets: [
      {
        label: "Sequences",
        data: clusters.values,
        backgroundColor: clusterCols.bg,
        borderColor: clusterCols.border,
        borderWidth: 1,
      },
    ],
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      x: { ticks: { color: "#111827" } },
      y: { ticks: { color: "#111827" }, beginAtZero: true },
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
          <div ref={analysisRef} className="mt-8">
            {/* Summary / Uploaded file details */}
            <section className="mb-6">
              <h2 className="text-2xl font-semibold text-black dark:text-white mb-2">Dataset Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                  <strong>File</strong>
                  <div>{file?.name ?? "uploaded.csv"}</div>
                  <div className="text-sm text-gray-500">{file ? `${Math.round(file.size / 1024)} KB` : ""}</div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                  <strong>Total sequences</strong>
                  <div>{classification.total}</div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                  <strong>Unique classes / clusters</strong>
                  <div>{classification.labels.length} classes · {clusters.labels.length} clusters</div>
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