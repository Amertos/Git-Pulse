"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState("");

  const startAnalysis = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    
    console.log("running analysis on", url); // debug lol

    try {
      const response = await fetch("/api/analyze?repo=" + url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRes(data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 max-w-2xl mx-auto font-sans">
      <h1 className="text-center text-4xl font-black mb-10 text-emerald-600 italic">GitPulse ⚡</h1>
      
      <form onSubmit={startAnalysis} className="flex gap-2 mb-8">
        <input 
          className="border-2 border-emerald-200 p-3 rounded-lg flex-1 outline-none focus:border-emerald-500"
          placeholder="https://github.com/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="bg-emerald-500 text-white p-3 rounded-lg hover:bg-emerald-600">
          {loading ? "..." : "Go"}
        </button>
      </form>

      {err && <div className="p-4 bg-red-100 text-red-700 rounded-lg mb-5">💀 {err}</div>}

      {res && (
        <div className="border-4 border-emerald-500 p-6 rounded-2xl shadow-2xl">
          <h2 className="text-2xl font-bold">{res.repo}</h2>
          <p className="text-gray-500 mb-5 italic">{res.description || "No description fr"}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-100 p-4 rounded-xl text-center">
              <span className="block text-xs uppercase text-gray-400">Stars</span>
              <span className="text-2xl font-bold">{res.stars}</span>
            </div>
            <div className="bg-gray-100 p-4 rounded-xl text-center">
              <span className="block text-xs uppercase text-gray-400">Forks</span>
              <span className="text-2xl font-bold">{res.forks}</span>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm font-bold mb-2">Lang Breakdown:</p>
            <div className="flex h-5 rounded-full overflow-hidden bg-gray-200">
              {res.languages.map((l: any, i: number) => (
                <div key={i} style={{width: l.percent + "%"}} className={`h-full bg-emerald-${400 + (i*100)}`} />
              ))}
            </div>
          </div>

          <div>
             <p className="text-sm font-bold mb-2">Weekly Commits (vibe check):</p>
             <div className="flex items-end gap-1 h-20 bg-emerald-50 p-2">
                {res.recentCommitWeeks.map((v: number, i: number) => (
                  <div key={i} className="flex-1 bg-emerald-400" style={{height: `${v * 5}px`}} />
                ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}