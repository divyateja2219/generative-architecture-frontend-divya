import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Image as ImageIcon,
  Settings2,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";

// === Helper: simple price formatter ===
const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

// === Mock styles ===
const STYLES = [
  { id: "modern", label: "Modern" },
  { id: "minimal", label: "Minimal" },
  { id: "rustic", label: "Rustic" },
  { id: "luxury", label: "Luxury" },
  { id: "industrial", label: "Industrial" },
];

// === Main App ===
export default function App() {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [roomType, setRoomType] = useState("living-room");
  const [theme, setTheme] = useState("modern");
  const [palette, setPalette] = useState("neutral");
  const [budget, setBudget] = useState(300000);
  const [notes, setNotes] = useState("");

  const [useMock, setUseMock] = useState(true);
  const [apiBase, setApiBase] = useState(
    localStorage.getItem("ga_api_base") || ""
  );
  const [apiKey, setApiKey] = useState(localStorage.getItem("ga_api_key") || "");

  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const canvasRef = useRef(null);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const disabled = !imageUrl || isGenerating;

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) setImageFile(file);
  };

  const handleUploadChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) setImageFile(file);
  };

  const persistCreds = () => {
    localStorage.setItem("ga_api_base", apiBase.trim());
    localStorage.setItem("ga_api_key", apiKey.trim());
  };

  // === MOCK GENERATOR ===
  const runMockGenerator = async () => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const src = imageUrl;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = src;
    });

    const baseCanvas = canvasRef.current;
    const w = Math.min(1024, img.width);
    const scale = w / img.width;
    const h = Math.round(img.height * scale);

    baseCanvas.width = w;
    baseCanvas.height = h;
    const ctx = baseCanvas.getContext("2d");

    ctx.drawImage(img, 0, 0, w, h);

    const tint =
      theme === "modern"
        ? "rgba(56,189,248,0.15)"
        : theme === "minimal"
        ? "rgba(148,163,184,0.18)"
        : theme === "rustic"
        ? "rgba(234,179,8,0.18)"
        : theme === "luxury"
        ? "rgba(217,70,239,0.15)"
        : "rgba(163,230,53,0.15)";

    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.9);
    ctx.lineTo(w * 0.5, h * 0.6);
    ctx.lineTo(w * 0.9, h * 0.9);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 0.7;
    const block = (x, y, bw, bh, label) => {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = "white";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(label, x + 8, y + 20);
    };

    if (roomType === "living-room") {
      block(w * 0.15, h * 0.65, w * 0.35, h * 0.15, "Sofa");
      block(w * 0.55, h * 0.7, w * 0.18, h * 0.1, "TV");
      block(w * 0.32, h * 0.58, w * 0.16, h * 0.08, "Table");
    } else if (roomType === "bedroom") {
      block(w * 0.2, h * 0.6, w * 0.38, h * 0.18, "Bed");
      block(w * 0.62, h * 0.62, w * 0.16, h * 0.12, "Wardrobe");
    } else if (roomType === "kitchen") {
      block(w * 0.15, h * 0.62, w * 0.5, h * 0.12, "Counter");
      block(w * 0.7, h * 0.65, w * 0.15, h * 0.1, "Fridge");
    } else if (roomType === "office") {
      block(w * 0.2, h * 0.65, w * 0.2, h * 0.12, "Desk");
      block(w * 0.45, h * 0.65, w * 0.2, h * 0.12, "Desk");
      block(w * 0.7, h * 0.65, w * 0.12, h * 0.12, "Cabinet");
    } else {
      block(w * 0.2, h * 0.65, w * 0.25, h * 0.15, "Feature");
    }

    ctx.globalAlpha = 1;

    const caption = `${capitalize(theme)} ${labelFromPalette(
      palette
    )} ${labelFromRoom(roomType)} • ${formatINR(budget)} • ${
      notes?.slice(0, 60) || "AI layout v1"
    }`;
    drawTag(ctx, caption, w, h);

    const baseData = baseCanvas.toDataURL("image/png");
    const variations = [baseData];

    const vA = await postProcess(baseData, (ctx2, w2, h2) => {
      vignette(ctx2, w2, h2);
      contrast(ctx2, w2, h2, 1.08);
    });
    variations.push(vA);

    const vB = await postProcess(baseData, (ctx2, w2, h2) => {
      edgeGlow(ctx2, w2, h2);
    });
    variations.push(vB);

    return variations;
  };

  // === Real backend call ===
  const runBackendGenerator = async () => {
    if (!apiBase) throw new Error("Set API Base in Settings");
    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("roomType", roomType);
    fd.append("theme", theme);
    fd.append("palette", palette);
    fd.append("budget", String(budget));
    fd.append("notes", notes || "");
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/generate`, {
      method: "POST",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      body: fd,
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return data.images || [];
  };

  const onGenerate = async () => {
    setError("");
    setIsGenerating(true);
    try {
      const imgs = useMock
        ? await runMockGenerator()
        : await runBackendGenerator();
      setResults(imgs);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100">
      {/* === Header with animated gradient === */}
      <header className="sticky top-0 z-30 backdrop-blur border-b border-white/10">
        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 animate-gradient-x">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              <h1 className="text-lg sm:text-2xl font-bold drop-shadow-md">
                Generative Architecture – MVP
              </h1>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden sm:inline opacity-80">Mode:</span>
              <button
                onClick={() => setUseMock((v) => !v)}
                className={`px-3 py-1 rounded-2xl border backdrop-blur ${
                  useMock
                    ? "border-emerald-400/60 bg-emerald-400/20"
                    : "border-sky-400/60 bg-sky-400/20"
                }`}
                title="Toggle Mock vs Backend"
              >
                {useMock ? "Mock Generator" : "Backend"}
              </button>
              <button
                onClick={persistCreds}
                className="px-3 py-1 rounded-2xl border border-white/30 bg-white/10 hover:bg-white/20 flex items-center gap-2 transition"
                title="Save API Settings"
              >
                <Settings2 className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* === Main Content === */}
      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Input Panel */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/20 shadow-xl"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" /> Upload Space Photo
          </h2>

          {/* Dropzone */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="relative border-2 border-dashed border-white/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center hover:bg-white/10 transition"
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Uploaded"
                className="max-h-72 rounded-xl object-contain shadow-lg"
              />
            ) : (
              <>
                <ImageIcon className="w-10 h-10 opacity-70" />
                <p className="opacity-80">Drag & drop an image here</p>
                <p className="text-xs opacity-60">or</p>
              </>
            )}
            <label className="mt-2 cursor-pointer inline-block px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition">
              Choose Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadChange}
              />
            </label>
          </div>

          {/* Preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <SelectBox
              label="Room / Space"
              value={roomType}
              setValue={setRoomType}
              options={[
                ["living-room", "Living Room"],
                ["bedroom", "Bedroom"],
                ["kitchen", "Kitchen"],
                ["office", "Office / Workspace"],
                ["other", "Other / Empty Plot"],
              ]}
            />
            <SelectBox
              label="Theme"
              value={theme}
              setValue={setTheme}
              options={STYLES.map((s) => [s.id, s.label])}
            />
            <SelectBox
              label="Color Palette"
              value={palette}
              setValue={setPalette}
              options={[
                ["neutral", "Neutral"],
                ["warm", "Warm"],
                ["cool", "Cool"],
                ["bold", "Bold"],
                ["earthy", "Earthy"],
              ]}
            />
            <div>
              <label className="text-sm opacity-70">Budget</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full mt-1 bg-black/30 border border-white/20 rounded-xl px-3 py-2"
              />
              <div className="text-xs opacity-70 mt-1">
                Approx: {formatINR(budget)}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm opacity-70">Notes / Preferences</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="eg. maximize natural light, add bookshelves, minimalist decor"
              className="w-full mt-1 bg-black/30 border border-white/20 rounded-xl px-3 py-2 min-h-[80px]"
            />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              disabled={disabled}
              onClick={onGenerate}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-2xl border ${
                disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-white/20 transition"
              } border-white/30`}
            >
              <Wand2 className="w-4 h-4" />
              {isGenerating ? "Generating..." : "Generate Designs"}
            </button>
            {error && <span className="text-rose-400 text-sm">{error}</span>}
          </div>

          {/* Settings */}
          <div className="mt-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Backend Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputBox
                label="API Base URL"
                value={apiBase}
                setValue={setApiBase}
                placeholder="https://your-api.example.com"
              />
              <InputBox
                label="API Key (optional)"
                value={apiKey}
                setValue={setApiKey}
                placeholder="sk-..."
              />
            </div>
            <p className="text-xs opacity-60 mt-2">
              Tip: Toggle "Mode" in the header to switch between Mock and
              Backend. Click "Save" to persist settings.
            </p>
          </div>
        </motion.section>

        {/* RIGHT: Results Panel */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/20 shadow-xl"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> AI Concepts
          </h2>
          {results.length === 0 ? (
            <div className="h-[480px] grid place-items-center text-center text-sm opacity-70">
              <div>
                <p>No designs yet. Upload a photo and click Generate.</p>
                <p className="mt-1">Results will appear here with download buttons.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((src, idx) => (
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ duration: 0.2 }}
                  key={idx}
                  className="relative group rounded-xl overflow-hidden border border-white/20 bg-black/30 shadow-lg hover:shadow-2xl transition"
                >
                  <img
                    src={src}
                    alt={`Result ${idx + 1}`}
                    className="w-full h-auto object-contain"
                  />
                  <a
                    href={src}
                    download={`design-${idx + 1}.png`}
                    className="absolute bottom-3 right-3 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur hover:bg-white/25 transition"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </motion.div>
              ))}
            </div>
          )}

          {/* Hidden canvas used by mock generator */}
          <canvas ref={canvasRef} className="hidden" />
        </motion.section>
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-10 pt-4 text-xs opacity-70">
        <p>
          ⚠️ Mock mode draws indicative layouts on top of your image. Connect a real backend to generate photorealistic designs (Stable Diffusion / ControlNet / Inpainting).
        </p>
      </footer>

      {/* Local CSS for animated gradient keyframes */}
      <style>{`
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 8s ease infinite;
        }
        @keyframes gradient-x {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

// === Reusable small UI primitives ===
function SelectBox({ label, value, setValue, options }) {
  return (
    <div>
      <label className="text-sm opacity-70">{label}</label>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full mt-1 bg-black/30 border border-white/20 rounded-xl px-3 py-2"
      >
        {options.map(([val, text]) => (
          <option key={val} value={val}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputBox({ label, value, setValue, placeholder }) {
  return (
    <div>
      <label className="text-sm opacity-70">{label}</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 bg-black/30 border border-white/20 rounded-xl px-3 py-2"
      />
    </div>
  );
}

// === Small utilities ===
function capitalize(s) {
  return s?.charAt(0).toUpperCase() + s?.slice(1);
}
function labelFromPalette(p) {
  return p === "neutral"
    ? "neutral palette"
    : p === "warm"
    ? "warm palette"
    : p === "cool"
    ? "cool palette"
    : p === "bold"
    ? "bold accents"
    : "earthy tones";
}
function labelFromRoom(r) {
  return r === "living-room"
    ? "living room"
    : r === "bedroom"
    ? "bedroom"
    : r === "kitchen"
    ? "kitchen"
    : r === "office"
    ? "workspace"
    : "space";
}

function drawTag(ctx, text, w, h) {
  const padX = 16,
    padY = 10;
  ctx.font = "600 16px ui-sans-serif, system-ui, -apple-system, Segoe UI";
  const metrics = ctx.measureText(text);
  const tw = metrics.width + padX * 2;
  const th = 36;
  const x = w - tw - 16;
  const y = h - th - 16;

  // Glassy backdrop
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, x, y, tw, th, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.stroke();

  // Text
  ctx.fillStyle = "white";
  ctx.fillText(text, x + padX, y + th / 2 + 5);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function postProcess(src, fn) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = src;
  });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  fn(ctx, img.width, img.height);
  return c.toDataURL("image/png");
}

function vignette(ctx, w, h) {
  const grd = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.7
  );
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
}

function contrast(ctx, w, h, factor) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const f = (259 * (factor + 255)) / (255 * (259 - factor));
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp(f * (d[i] - 128) + 128);
    d[i + 1] = clamp(f * (d[i + 1] - 128) + 128);
    d[i + 2] = clamp(f * (d[i + 2] - 128) + 128);
  }
  ctx.putImageData(img, 0, 0);
}

function edgeGlow(ctx, w, h) {
  // quick edge detect then soft-light blend
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data,
    o = out.data;
  const idx = (x, y) => (y * w + x) * 4;
  const gx = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ];
  const gy = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sx = 0,
        sy = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const p = idx(x + i, y + j);
          const gray = 0.299 * s[p] + 0.587 * s[p + 1] + 0.114 * s[p + 2];
          sx += gray * gx[j + 1][i + 1];
          sy += gray * gy[j + 1][i + 1];
        }
      const mag = clamp(Math.sqrt(sx * sx + sy * sy));
      const p2 = idx(x, y);
      o[p2] = o[p2 + 1] = o[p2 + 2] = mag;
      o[p2 + 3] = 255;
    }
  }
  // blend soft-light
  for (let i = 0; i < s.length; i += 4) {
    s[i] = softLight(s[i], o[i]);
    s[i + 1] = softLight(s[i + 1], o[i + 1]);
    s[i + 2] = softLight(s[i + 2], o[i + 2]);
  }
  ctx.putImageData(src, 0, 0);
}

function clamp(v) {
  return Math.max(0, Math.min(255, v));
}
function softLight(a, b) {
  a /= 255;
  b /= 255;
  const res = (1 - 2 * b) * a * a + 2 * b * a;
  return clamp(Math.round(res * 255));
}
