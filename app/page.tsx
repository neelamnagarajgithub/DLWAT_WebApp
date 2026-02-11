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
      const res = await fetch("http://localhost:8000/api/predict", { method: "POST", body: formData });
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
    
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      // Simple approach: capture the element directly without complex styling manipulation
      const canvas = await html2canvas(analysisRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        ignoreElements: (element) => {
          // Skip elements that might have problematic CSS
          return element.tagName === 'CANVAS';
        },
        onclone: (clonedDoc) => {
          // Replace all canvas elements with static images
          const originalCanvases = Array.from(analysisRef.current!.querySelectorAll("canvas"));
          const clonedCanvases = Array.from(clonedDoc.querySelectorAll("canvas"));
          
          originalCanvases.forEach((originalCanvas, i) => {
            try {
              const clonedCanvas = clonedCanvases[i];
              if (clonedCanvas && clonedCanvas.parentNode) {
                const img = clonedDoc.createElement("img");
                img.src = (originalCanvas as HTMLCanvasElement).toDataURL("image/png");
                img.style.width = "100%";
                img.style.height = "auto";
                img.style.display = "block";
                clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
              }
            } catch (e) {
              console.warn("Failed to replace canvas:", e);
            }
          });
          
          // Apply simple inline styles to avoid color function issues
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el: any) => {
            if (el.style) {
              // Remove any problematic color functions
              el.style.background = '';
              el.style.backgroundColor = '#ffffff';
              el.style.color = '#000000';
              el.style.borderColor = '#e5e7eb';
            }
          });
        }
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = (pdf as any).getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Add the image to PDF
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("dlwat-analysis.pdf");
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 dark:bg-gray-900/80 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                DLWAT Workload Analyzer
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Deep Learning Workload Analysis Tool</p>
            </div>
            {/* {result && (
              <button
                onClick={downloadPdf}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Report
              </button>
            )} */}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 mb-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Upload Workload Data</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Upload your CSV file to analyze workload patterns and get predictions</p>
            
            <div className="flex flex-col items-center gap-4">
              <label className="relative">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <div className="px-8 py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600">
                  <div className="text-center">
                    <svg className="mx-auto h-8 w-8 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-blue-600 hover:text-blue-500">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">CSV files only</p>
                  </div>
                </div>
              </label>
              
              {file && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                </div>
              )}
              
              <button
                onClick={handleUpload}
                disabled={loading || !file}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Analyze Workload
                  </>
                )}
              </button>
              
              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}
            </div>
          </div>
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

            {/* Charts Section */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                Workload Analysis Charts
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    Workload Distribution
                  </h3>
                  <div style={{ height: 300 }}>
                    <Pie data={classificationChart} options={pieOptions} />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-500 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    Cluster Analysis
                  </h3>
                  <div style={{ height: 300 }}>
                    <Bar data={clusterChart} options={commonOptions} />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    Confidence Distribution
                  </h3>
                  <div style={{ height: 300 }}>
                    <Doughnut data={confidenceChart} options={pieOptions} />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                      </svg>
                    </div>
                    Cluster Details
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(clusterProfiles).map(([id, profile]: [string, any]) => (
                      <div key={id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 dark:text-white">Cluster {id}</span>
                          <span className="text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 px-2 py-1 rounded">
                            {profile?.members || 0} members
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{profile?.label || "No description"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Recommendation Section */}
            {recommendation?.action && (
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  AI Recommendations
                </h2>
                
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200 mb-2">Recommended Action</h3>
                      <p className="text-emerald-700 dark:text-emerald-300 mb-3 text-lg">{recommendation.action}</p>
                      <div className="text-sm text-emerald-600 dark:text-emerald-400">
                        <strong>Reason:</strong> {recommendation.reason}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Predictions Table */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                Prediction Details
                <span className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded ml-2">
                  {showFullPreview ? "All" : "Top 20"} Results
                </span>
              </h2>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Window ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Workload Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Confidence</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cluster</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {(showFullPreview ? predictionsPreview : predictionsPreview.slice(0, 20)).map((prediction, index) => (
                        <tr key={prediction.window_id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            #{prediction.window_id ?? index}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                              {prediction.label || `Class ${prediction.class_id}`}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mr-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    prediction.confidence >= 0.8 ? 'bg-green-500' :
                                    prediction.confidence >= 0.6 ? 'bg-yellow-500' :
                                    prediction.confidence >= 0.4 ? 'bg-orange-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${(prediction.confidence * 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {(prediction.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            Cluster {prediction.cluster_id ?? 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {predictionsPreview.length > 20 && (
                  <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                    <button
                      onClick={() => setShowFullPreview(!showFullPreview)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                    >
                      {showFullPreview ? 'Show Less' : `Show All ${predictionsPreview.length} Predictions`}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}