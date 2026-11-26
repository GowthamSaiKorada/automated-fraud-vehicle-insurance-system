import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  ImagePlus,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { apiClient, extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

const DAMAGE_TYPES = [
  'Front Bumper / Grille',
  'Rear Collision',
  'Side Door / Panel',
  'Windshield / Glass',
  'Hood / Fender',
  'Multi-Panel Impact',
  'Other',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);

interface UploadedImageMeta {
  imagePath: string;
  imageUrl: string;
  imageOriginalName: string;
  imageMimeType: string;
  imageSizeBytes: number;
}

export default function SubmitClaimPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [policyNumber, setPolicyNumber] = useState(user?.policyNumber || '');
  const [vehicleRegistrationNumber, setVehicleRegistrationNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [accidentDate, setAccidentDate] = useState(new Date().toISOString().slice(0, 10));
  const [accidentLocation, setAccidentLocation] = useState('');
  const [damageType, setDamageType] = useState(DAMAGE_TYPES[0]);
  const [accidentDescription, setAccidentDescription] = useState('');

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadedImage, setUploadedImage] = useState<UploadedImageMeta | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [runYoloCheck, setRunYoloCheck] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleSelectedFile = async (file: File) => {
    setError('');
    setStatusMessage('');

    if (!ALLOWED_MIME.has(file.type.toLowerCase())) {
      setError('Unsupported file format. Please upload a JPG, JPEG, or PNG image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Image exceeds the 10 MB file size limit.');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await apiClient.post('/claims/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) {
            setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        },
      });
      setUploadedImage({
        imagePath: res.data.imagePath,
        imageUrl: res.data.imageUrl,
        imageOriginalName: res.data.imageOriginalName,
        imageMimeType: res.data.imageMimeType,
        imageSizeBytes: res.data.imageSizeBytes,
      });
      setUploadProgress(100);
      setStatusMessage('Image uploaded and verified. Ready to run AI Authenticity Analysis.');
    } catch (err) {
      setUploadedImage(null);
      setPreviewUrl('');
      setError(extractErrorMessage(err, 'Failed to upload image.'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl('');
    setUploadedImage(null);
    setUploadProgress(0);
    setStatusMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitAndAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusMessage('');

    if (
      !customerName.trim() ||
      !policyNumber.trim() ||
      !vehicleRegistrationNumber.trim() ||
      !vehicleModel.trim() ||
      !accidentDate ||
      !accidentLocation.trim() ||
      !accidentDescription.trim()
    ) {
      setError('Please complete all required claim details.');
      return;
    }

    if (!uploadedImage) {
      setError('Please upload a vehicle accident photo before analyzing.');
      return;
    }

    setAnalyzing(true);
    try {
      setStatusMessage('Saving claim record to MongoDB...');
      const claimRes = await apiClient.post('/claims', {
        customerName: customerName.trim(),
        policyNumber: policyNumber.trim(),
        vehicleRegistrationNumber: vehicleRegistrationNumber.trim(),
        vehicleModel: vehicleModel.trim(),
        accidentDate,
        accidentLocation: accidentLocation.trim(),
        accidentDescription: accidentDescription.trim(),
        damageType,
        ...uploadedImage,
      });

      const createdClaimId = claimRes.data.claim._id;

      setStatusMessage('Sending image to Python FastAPI AI service for CNN & forensic analysis...');
      await apiClient.post(
        `/claims/${createdClaimId}/analyze${runYoloCheck ? '?detectDamage=true' : ''}`
      );

      navigate(`/claims/${createdClaimId}`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Claim submission or AI analysis failed.'));
      setStatusMessage('');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <AppLayout
      title="Submit Vehicle Insurance Claim"
      subtitle="Provide incident details and upload accident photography for AI authenticity verification"
    >
      <form onSubmit={handleSubmitAndAnalyze} className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Claim Metadata Form */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1E3D]">Policyholder & Vehicle Details</h2>
            <p className="mt-1 text-xs text-slate-500">
              All fields are validated and stored securely for claims processing.
            </p>

            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Policy Number *
                </label>
                <input
                  type="text"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  placeholder="POL-VEH-2026-8841"
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm uppercase focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Vehicle Registration Number *
                </label>
                <input
                  type="text"
                  value={vehicleRegistrationNumber}
                  onChange={(e) => setVehicleRegistrationNumber(e.target.value)}
                  placeholder="KA-01-MJ-4821"
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm uppercase focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Vehicle Model *
                </label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="2024 Honda Civic Touring"
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Accident Date *
                </label>
                <input
                  type="date"
                  value={accidentDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setAccidentDate(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Damage Type *
                </label>
                <select
                  value={damageType}
                  onChange={(e) => setDamageType(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {DAMAGE_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Accident Location *
              </label>
              <input
                type="text"
                value={accidentLocation}
                onChange={(e) => setAccidentLocation(e.target.value)}
                placeholder="Highway 101 Northbound, Milepost 24"
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Accident Description *
              </label>
              <textarea
                rows={4}
                value={accidentDescription}
                onChange={(e) => setAccidentDescription(e.target.value)}
                placeholder="Describe how the incident occurred and which panels were affected..."
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>
        </div>

        {/* Right column: Drag & Drop Image Upload + Analyze CTA */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1E3D]">Accident Image Upload</h2>
            <p className="mt-1 text-xs text-slate-500">
              Supports JPG, JPEG, and PNG up to 10 MB. Avoid screenshots or re-saved images when possible.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSelectedFile(file);
              }}
            />

            {!previewUrl ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleSelectedFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
                  dragActive
                    ? 'border-sky-500 bg-sky-50'
                    : 'border-slate-300 bg-slate-50/70 hover:border-sky-400 hover:bg-sky-50/40'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-[#0B1E3D]">
                  Drag & drop vehicle image here
                </p>
                <p className="mt-1 text-xs text-slate-500">or click to browse JPG, JPEG, or PNG</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                  <img
                    src={previewUrl}
                    alt="Uploaded vehicle damage preview"
                    className="max-h-64 w-full object-contain"
                  />
                </div>

                {/* Upload Progress */}
                {(uploading || uploadProgress > 0) && (
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-600">
                      <span>{uploading ? 'Uploading image...' : 'Upload complete'}</span>
                      <span className="tabular-nums">{uploadProgress}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full transition-all ${
                          uploadProgress === 100 ? 'bg-emerald-500' : 'bg-sky-500'
                        }`}
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploadedImage && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
                    <span className="flex items-center gap-2 truncate font-medium">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      {uploadedImage.imageOriginalName} (
                      {(uploadedImage.imageSizeBytes / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || analyzing}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Replace Image
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={uploading || analyzing}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            )}

            <label className="mt-5 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={runYoloCheck}
                onChange={(e) => setRunYoloCheck(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>Also check optional YOLO vehicle damage localization endpoint</span>
            </label>

            {statusMessage && (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-medium text-sky-800">
                {statusMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={!uploadedImage || uploading || analyzing}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B1E3D] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#143666] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analyzing Image...
                </>
              ) : (
                <>
                  <Cpu className="h-4 w-4" />
                  Analyze Image & Submit Claim
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </AppLayout>
  );
}
