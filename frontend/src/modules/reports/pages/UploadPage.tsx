import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchMyPatientId, uploadReport } from '../api';
import { fetchLinkedPatients } from '../../../api/helpers';
import type { Patient } from '../../../types/patient';
import type { ExplanationLanguage, ReportRole } from '../types';
import { getApiErrorMessage } from '../../../utils/errors';
import { formatBytes } from '../labels';
import Button from '../../../components/ui/Button';
import { primaryButtonLink } from '../../../components/ui/buttonLink';

interface Props {
  role: ReportRole;
  basePath: string;
}

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg'];

const isAccepted = (file: File): boolean => {
  const type = file.type.toLowerCase();
  if (ACCEPTED.includes(type)) return true;
  return /\.(pdf|png|jpe?g)$/i.test(file.name);
};

const ACCEPT_ATTR = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

export default function UploadPage({ role, basePath }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [myPatientId, setMyPatientId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [contextError, setContextError] = useState('');
  // Roles that cannot upload never need to load a patient; start settled for them.
  const [loadingContext, setLoadingContext] = useState(
    role === 'PATIENT' || role === 'HELPER',
  );

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [language, setLanguage] = useState<ExplanationLanguage>('en');

  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(0);
  const [submitting, setSubmitting] = useState(false);

  const canUpload = role === 'PATIENT' || role === 'HELPER';

  useEffect(() => {
    if (!canUpload) return;

    let active = true;
    const load = async () => {
      try {
        if (role === 'PATIENT') {
          const id = await fetchMyPatientId();
          if (!active) return;
          if (!id) {
            setContextError('Your patient profile is missing.');
          } else {
            setMyPatientId(id);
            setPatientId(id);
          }
        } else if (role === 'HELPER') {
          const linked = await fetchLinkedPatients();
          if (!active) return;
          setPatients(linked);
          if (linked.length === 1) setPatientId(linked[0].id);
        }
      } catch (err) {
        if (active) {
          setContextError(
            getApiErrorMessage(err, 'Could not load the patient details needed for the upload.'),
          );
        }
      } finally {
        if (active) setLoadingContext(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [role, canUpload]);

  const previewRef = useRef<string | null>(null);

  /** Replace the image preview and release the previous object URL. */
  const showPreview = (next: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = next && next.type.startsWith('image/') ? URL.createObjectURL(next) : null;
    previewRef.current = url;
    setPreviewUrl(url);
  };

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const acceptFile = (candidate: File | undefined) => {
    setError('');
    setFileError('');
    if (!candidate) return;

    if (!isAccepted(candidate)) {
      setFile(null);
      showPreview(null);
      setFileError('Choose a PDF, PNG or JPEG file. Other formats cannot be read.');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setFile(null);
      showPreview(null);
      setFileError(`That file is ${formatBytes(candidate.size)}. The limit is 15 MB.`);
      return;
    }
    if (candidate.size === 0) {
      setFile(null);
      showPreview(null);
      setFileError('That file is empty.');
      return;
    }

    setFile(candidate);
    showPreview(candidate);
    if (!title) {
      setTitle(candidate.name.replace(/\.[^.]+$/, '').slice(0, 120));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!file) {
      setFileError('Choose the report you want to upload.');
      return;
    }
    if (!patientId) {
      setError(
        role === 'HELPER'
          ? 'Choose the patient this report belongs to.'
          : 'Your patient profile could not be found.',
      );
      return;
    }

    setSubmitting(true);
    setProgress(0);
    try {
      const report = await uploadReport(
        {
          file,
          patientId,
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(reportDate ? { reportDate } : {}),
          language,
        },
        setProgress,
      );
      navigate(`${basePath}/${report.id}`, { replace: true });
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'The report could not be processed. Check your connection and try again.',
        ),
      );
      setSubmitting(false);
      setProgress(0);
    }
  };

  if (!canUpload) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Upload is not available for this account</h2>
        <p className="mt-1 text-sm text-slate-600">
          Reports are uploaded by the patient or by a helper linked to the patient. You can open
          reports that have been shared with you from the reports list.
        </p>
        <Link to={`${basePath}/history`} className={`${primaryButtonLink} mt-4`}>
          Go to shared reports
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Upload a medical report</h2>
        <p className="mt-1 text-sm text-slate-600">
          Use a clear photo of every printed page, or the PDF from the lab. The file is read once
          and is not kept on the server.
        </p>
      </div>

      {loadingContext && (
        <p className="text-sm text-slate-500" role="status">
          Loading patient details…
        </p>
      )}

      {!loadingContext && contextError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{contextError}</p>
          {role === 'PATIENT' && (
            <p className="mt-2">
              Complete your profile first, then come back to upload a report.{' '}
              <Link to="/patient/profile" className="underline font-medium">
                Complete profile
              </Link>
            </p>
          )}
        </div>
      )}

      {!loadingContext && role === 'HELPER' && patients.length === 0 && !contextError && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          No patient is linked to your account yet, so there is nobody to upload a report for.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {role === 'HELPER' && patients.length > 0 && (
          <div>
            <label htmlFor="upload-patient" className="mb-1.5 block text-sm font-medium text-slate-700">
              Patient
            </label>
            <select
              id="upload-patient"
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Choose a patient…</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName}
                  {patient.phone ? ` · ${patient.phone}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {role === 'PATIENT' && myPatientId && (
          <p className="text-xs text-slate-500">
            The report will be added to your own record. You can delete it later.
          </p>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Report file</span>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              acceptFile(event.dataTransfer.files?.[0]);
            }}
            className={`rounded-xl border-2 border-dashed px-5 py-7 text-center transition-colors ${
              dragging
                ? 'border-blue-400 bg-blue-50'
                : fileError
                  ? 'border-red-300 bg-red-50/40'
                  : 'border-slate-300 bg-slate-50'
            }`}
          >
            <p className="text-sm font-medium text-slate-800">
              Drag the report here, or choose a file
            </p>
            <p className="mt-1 text-xs text-slate-500">PDF, PNG or JPEG · up to 15 MB</p>

            <input
              ref={inputRef}
              id="report-file"
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              onChange={(event) => {
                acceptFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />

            <label
              htmlFor="report-file"
              className="mt-3 inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-400"
            >
              Choose file
            </label>

            <p className="mt-2 text-xs text-slate-500" aria-live="polite">
              {file ? 'File selected below' : 'No file selected'}
            </p>
          </div>

          {fileError && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {fileError}
            </p>
          )}

          {file && (
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={`Preview of ${file.name}`}
                  className="h-20 w-20 shrink-0 rounded border border-slate-200 object-cover"
                />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  PDF
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {formatBytes(file.size)} · {file.type || 'type detected on the server'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    showPreview(null);
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                  className="mt-2 text-xs font-medium text-blue-700 underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Remove file
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="report-title" className="mb-1.5 block text-sm font-medium text-slate-700">
              Report name <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="report-title"
              type="text"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="For example: Blood test, March"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label htmlFor="report-date" className="mb-1.5 block text-sm font-medium text-slate-700">
              Date printed on the report{' '}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="report-date"
              type="date"
              value={reportDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setReportDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <p className="mt-1 text-xs text-slate-500">
              Needed to compare this report with earlier ones. Without it, the comparison is skipped.
            </p>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">
            Explanation language
          </legend>
          <div className="flex gap-4">
            {(['en', 'hi'] as ExplanationLanguage[]).map((code) => (
              <label key={code} className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="upload-language"
                  value={code}
                  checked={language === code}
                  onChange={() => setLanguage(code)}
                  className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {code === 'en' ? 'English' : 'हिंदी'}
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {submitting && (
          <div aria-live="polite">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>
                {progress !== null && progress < 100
                  ? `Uploading… ${progress}%`
                  : 'Reading the report. This can take up to a minute.'}
              </span>
              {progress !== null && progress < 100 && <span>{progress}%</span>}
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress ?? 100}
              className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className={`h-full rounded-full bg-blue-600 transition-all ${
                  progress === null || progress >= 100 ? 'animate-pulse' : ''
                }`}
                style={{ width: `${progress === null ? 100 : Math.max(5, progress)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Keep this page open. The results appear as soon as reading finishes.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={submitting} loadingText="Reading report…">
            Upload and explain
          </Button>
          <Link
            to={basePath}
            className="text-sm font-medium text-slate-600 underline rounded hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
