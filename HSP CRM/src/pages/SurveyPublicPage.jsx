import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { apiUrl } from "../api";
import { Loader2, CheckCircle2 } from "lucide-react";

function SurveyField({ question }) {
  const base = "input-dark w-full rounded-lg px-3 py-2 text-sm";

  switch (question.type) {
    case "select":
      return <select name={question.id} id={question.id} className={base} required={question.required}><option value="">Choose an answer</option>{question.options.map(opt => <option key={opt}>{opt}</option>)}</select>;
    case "textarea":
      return <textarea name={question.id} id={question.id} className={base} rows={3} required={question.required} />;
    case "radio":
      return (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label
              key={opt}
              className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <input
                type="radio"
                name={question.id}
                value={opt}
                required={question.required}
                className="mt-0.5 accent-blue-500"
              />
              <span className="text-sm text-slate-600">{opt}</span>
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label
              key={opt}
              className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <input type="checkbox" name={question.id} value={opt} className="mt-0.5 accent-blue-500" />
              <span className="text-sm text-slate-600">{opt}</span>
            </label>
          ))}
        </div>
      );
    default:
      return (
        <input
          type={["email", "number", "tel", "date"].includes(question.type) ? question.type : "text"}
          name={question.id}
          id={question.id}
          className={base}
          required={question.required}
        />
      );
  }
}

export default function SurveyPublicPage() {
  const { surveyId } = useParams();
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false), [retry, setRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true); setNotFound(false); setLoadError(false);
      try {
        const snap = await getDocs(query(collection(db, "surveys"), where("id", "==", surveyId), where("active", "==", true)));
        if (snap.empty) {
          setNotFound(true);
        } else {
          setSurvey({ docId: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [surveyId, retry]);

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = {};
    const newErrors = {};

    survey.questions.forEach((q) => {
      if (q.type === "checkbox") {
        data[q.id] = formData.getAll(q.id);
        if (q.required && data[q.id].length === 0) newErrors[q.id] = "Required";
      } else {
        data[q.id] = formData.get(q.id) || "";
        if (q.required && !data[q.id].trim()) newErrors[q.id] = "Required";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch(apiUrl("/api/submit-survey"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: survey.id || survey.docId,
          data,
          website: formData.get("website") || "",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Submission failed");

      setDone(true);
    } catch (err) {
      setErrors({ form: err.message || "Submission failed. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (loadError) return <div role="alert" className="min-h-screen grid place-content-center gap-4 p-6"><h1>Survey could not load</h1><p>Check your connection and try again.</p><button onClick={() => setRetry(n => n + 1)}>Retry</button></div>;

  if (notFound || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <p className="text-4xl font-bold text-slate-200 mb-2">404</p>
          <p className="text-slate-500">This survey wasn't found or is no longer active.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
        <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-xl border border-slate-200">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={36} className="text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h1>
          <p className="font-semibold text-slate-600 mb-1">"{survey.title}" — completed</p>
          <p className="text-sm text-slate-500">
            Your response has been recorded. We appreciate you taking the time to share your feedback.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200">
          <div className="px-8 py-6 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-900">
            <h1 className="text-2xl font-bold text-white">{survey.title}</h1>
            {survey.description && <p className="text-blue-200 mt-2 text-sm">{survey.description}</p>}
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
            <input type="text" name="website" tabIndex="-1" autoComplete="off" className="hidden" aria-hidden="true" />
            {survey.questions.map((q, i) => (
              <div key={q.id}>
                <label htmlFor={q.id} className="block text-sm font-medium text-slate-700 mb-2">
                  {i + 1}. {q.label}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <SurveyField question={q} />
                {errors[q.id] && <p className="text-xs text-red-500 mt-1">{errors[q.id]}</p>}
              </div>
            ))}

            {errors.form && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{errors.form}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="btn-green w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {submitting ? "Submitting..." : "Submit Response"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
