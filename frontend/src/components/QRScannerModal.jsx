import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, AlertCircle, CheckCircle2, ScanLine, ChevronDown, Play, RefreshCw, Upload, ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../lib/api';

const QRScannerModal = ({ onClose }) => {
  const [status, setStatus] = useState('idle');    // idle | loading | scanning | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [loadingCameras, setLoadingCameras] = useState(true);
  const [mode, setMode] = useState('camera');       // 'camera' | 'upload'
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | processing | success | error
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const scannerRef = useRef(null);
  const navigate = useNavigate();
  const isProcessing = useRef(false);

  // ─── On mount: fetch available cameras ──────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    fetchCameras();
    return () => {
      document.body.style.overflow = 'unset';
      destroyScanner();
    };
  }, []);

  const fetchCameras = async () => {
    setLoadingCameras(true);
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setStatus('error');
        setErrorMsg('No cameras found on this device.');
        return;
      }
      setCameras(devices);

      // Auto-select DroidCam if available, otherwise default to first
      const droid = devices.find(d => d.label?.toLowerCase().includes('droidcam'));
      setSelectedCamera(droid ? droid.id : devices[0].id);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      if (err?.toString().includes('NotAllowed') || err?.toString().includes('permission')) {
        setErrorMsg('Camera permission denied. Please allow camera access in your browser settings.');
      } else {
        setErrorMsg(`Could not access cameras: ${err?.message || err}`);
      }
    } finally {
      setLoadingCameras(false);
    }
  };

  // ─── Start scanning with selected camera ────────────────────────────────────
  const startScanner = async () => {
    if (!selectedCamera) return;
    await destroyScanner();   // properly stop any existing session first

    // small pause after stop to let browser release the stream
    await new Promise(r => setTimeout(r, 300));

    const el = document.getElementById('qr-reader');
    if (!el) return;

    setStatus('loading');
    isProcessing.current = false;

    try {
      const scanner = new Html5Qrcode('qr-reader', { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 180, height: 180 },
          aspectRatio: 4 / 3,      // 4:3 is the most compatible ratio
          disableFlip: false,
        },
        async (decodedText) => {
          if (isProcessing.current) return;
          isProcessing.current = true;
          setStatus('success');
          await destroyScanner();
          await handleQRResult(decodedText);
        },
        () => {} // per-frame decode errors — ignore silently
      );

      // Fix green screen: force the video element to display correctly
      setTimeout(() => {
        const video = document.querySelector('#qr-reader video');
        if (video) {
          video.style.objectFit = 'contain';  // 'cover' causes green on some cameras
          video.style.width = '100%';
          video.style.maxHeight = '210px';
          video.style.display = 'block';
          video.style.borderRadius = '12px';
        }
      }, 500);

      setStatus('scanning');
    } catch (err) {
      scannerRef.current = null;
      setStatus('error');
      if (err?.toString().includes('NotAllowed') || err?.toString().includes('permission')) {
        setErrorMsg('Camera permission denied. Please allow access and try again.');
      } else if (err?.toString().includes('abort') || err?.toString().includes('in use') || err?.toString().includes('Could not start')) {
        setErrorMsg('Camera is already in use by another app. Close it and try again.');
      } else {
        setErrorMsg(`Failed to start: ${err?.message || err}`);
      }
    }
  };

  // ─── Stop / destroy running scanner ─────────────────────────────────────────
  const destroyScanner = async () => {
    if (scannerRef.current) {
      try {
        // Must stop BEFORE clear, and both must be awaited
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (_) {}
      scannerRef.current = null;
    }
  };

  // ─── Handle decoded QR text ──────────────────────────────────────────────────
  const handleQRResult = async (text) => {
    try {
      let code = null;
      const urlMatch = text.match(/\/exams\/join\/(\w+)/);
      if (urlMatch) code = urlMatch[1];

      const directCode = text.trim().replace(/\D/g, '');
      if (!code && directCode.length === 6) code = directCode;

      if (!code) {
        toast.error('Not a valid ExamFlow QR code.');
        isProcessing.current = false;
        setStatus('idle');
        return;
      }

      toast.loading('Verifying exam...', { id: 'qr-verify' });
      const { data } = await api.get(`/exams/access/${code}`);
      toast.success(`Joining: ${data.title}`, { id: 'qr-verify' });
      onClose();
      navigate(`/exams/${data.id}`);
    } catch (err) {
      toast.error('Invalid or expired exam code.', { id: 'qr-verify' });
      isProcessing.current = false;
      setStatus('idle');
    }
  };

  const handleClose = async () => {
    await destroyScanner();
    onClose();
  };

  const handleStopAndReset = async () => {
    await destroyScanner();
    setStatus('idle');
  };

  // ─── Scan from uploaded image file ───────────────────────────────────────────
  const scanFromFile = async (file) => {
    if (!file) return;
    setUploadStatus('processing');
    setUploadError('');
    try {
      const scanner = new Html5Qrcode('qr-upload-region', { verbose: false });
      const result = await scanner.scanFile(file, /* showImage= */ false);
      scanner.clear();
      setUploadStatus('success');
      await handleQRResult(result);
    } catch (err) {
      setUploadStatus('error');
      setUploadError('No QR code found in this image. Please try a clearer photo.');
    }
  };

  const switchMode = async (newMode) => {
    await destroyScanner();
    setStatus('idle');
    setUploadStatus('idle');
    setUploadError('');
    setMode(newMode);
  };

  // ─── UI ──────────────────────────────────────────────────────────────────────
  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', overflow: 'hidden' }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, x: '-50%', y: '-45%' }}
        animate={{ scale: 1, opacity: 1, x: '-50%', y: '-50%' }}
        exit={{ scale: 0.95, opacity: 0, x: '-50%', y: '-45%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="glass rounded-[2rem] p-5 border-indigo-500/20 shadow-2xl bg-white dark:bg-[#0f172a]"
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 'min(390px, calc(100vw - 32px))',
          maxHeight: 'calc(92vh)', overflowY: 'auto',
        }}
      >
        {/* Top accent */}
        <div className="absolute top-0 left-0 w-full h-1 rounded-t-[2rem] bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-600" />

        {/* Close */}
        <button onClick={handleClose} className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-400 transition-all active:scale-90 border border-white/5 z-10">
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-3">
            <Camera className="h-2.5 w-2.5" />
            QR Scanner
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Scan Exam QR</h2>
        </div>

        {/* ── Mode tabs ── */}
        <div className="flex gap-2 mb-4 bg-slate-50 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => switchMode('camera')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              mode === 'camera'
                ? 'bg-indigo-600 text-slate-900 dark:text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-500 hover:text-slate-600 dark:text-slate-300'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            Camera
          </button>
          <button
            onClick={() => switchMode('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              mode === 'upload'
                ? 'bg-indigo-600 text-slate-900 dark:text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-500 hover:text-slate-600 dark:text-slate-300'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Upload Image
          </button>
        </div>

        {/* Success overlay */}
        {status === 'success' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-950/95 rounded-[2rem]">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-emerald-400 font-black uppercase tracking-widest text-sm">Code Detected!</p>
            <p className="text-slate-500 text-xs">Redirecting to exam...</p>
          </div>
        )}

        {/* Error message */}
        {status === 'error' && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-rose-300 text-xs font-bold">{errorMsg}</p>
              <button onClick={fetchCameras} className="mt-2 flex items-center gap-1.5 text-indigo-400 text-[9px] font-black uppercase tracking-widest hover:text-indigo-300 transition-colors">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          </div>
        )}

        {/* ════ CAMERA MODE ════ */}
        {mode === 'camera' && (
          <>
            {cameras.length > 0 && status !== 'success' && (
              <div className="mb-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Camera</p>
                <div className="relative">
                  <select
                    value={selectedCamera}
                    onChange={(e) => {
                      setSelectedCamera(e.target.value);
                      if (status === 'scanning') handleStopAndReset();
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-indigo-300 font-semibold appearance-none focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer pr-10"
                  >
                    {cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `Camera ${cam.id.slice(0, 8)}`}
                        {cam.label?.toLowerCase().includes('droidcam') ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Camera feed — do NOT add overflow:hidden, causes green screen */}
            <div
              id="qr-reader"
              className="w-full rounded-2xl bg-white dark:bg-slate-950"
              style={{
                minHeight: status === 'scanning' || status === 'loading' ? '200px' : '0',
                maxHeight: '220px',
                overflow: 'clip',
              }}
            />

            {status === 'scanning' && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <ScanLine className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Scanning for QR Code...</p>
              </div>
            )}
            {status === 'loading' && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <RefreshCw className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 animate-spin" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Starting Camera...</p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {status !== 'scanning' && status !== 'loading' && status !== 'success' && cameras.length > 0 && (
                <button
                  onClick={startScanner}
                  disabled={loadingCameras || !selectedCamera}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-indigo-600 text-slate-900 dark:text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20 disabled:opacity-40"
                >
                  <Play className="h-4 w-4" />
                  Start Scan
                </button>
              )}
              {status === 'scanning' && (
                <button
                  onClick={handleStopAndReset}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-all active:scale-[0.98]"
                >
                  <X className="h-4 w-4" />
                  Stop Camera
                </button>
              )}
            </div>
          </>
        )}

        {/* ════ UPLOAD MODE ════ */}
        {mode === 'upload' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) scanFromFile(file);
                e.target.value = '';
              }}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-3 py-10 ${
                uploadStatus === 'processing'
                  ? 'border-indigo-500/40 bg-indigo-500/5 pointer-events-none'
                  : uploadStatus === 'error'
                  ? 'border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:bg-indigo-500/5 hover:border-indigo-500/40'
              }`}
            >
              {uploadStatus === 'processing' ? (
                <>
                  <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Reading QR Code...</p>
                </>
              ) : uploadStatus === 'error' ? (
                <>
                  <AlertCircle className="h-8 w-8 text-rose-400" />
                  <p className="text-rose-300 text-xs font-bold text-center px-4">{uploadError}</p>
                  <p className="text-indigo-400 text-[9px] font-black uppercase tracking-widest">Tap to try again</p>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <Upload className="h-7 w-7 text-indigo-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-900 dark:text-white text-sm font-black">Upload QR Image</p>
                    <p className="text-slate-500 text-[10px] font-medium mt-0.5">Screenshot the QR code and upload it here</p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full">
                    Tap to Browse
                  </span>
                </>
              )}
            </div>

            {/* Hidden div for html5-qrcode image scanning */}
            <div id="qr-upload-region" className="hidden" />
          </>
        )}

        {/* Cancel */}
        <button
          onClick={handleClose}
          className="w-full py-2.5 rounded-xl text-slate-500 text-[9px] font-bold uppercase tracking-widest hover:text-slate-600 dark:text-slate-300 transition-colors mt-3"
        >
          Cancel — Use Access Key Instead
        </button>
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default QRScannerModal;
