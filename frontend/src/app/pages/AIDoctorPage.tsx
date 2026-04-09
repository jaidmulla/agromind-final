import { useParams, useNavigate } from 'react-router';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AIDoctor } from '../components/AIDoctor';

export function AIDoctorPage() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>('en');

  if (!scanId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
        <div className="max-w-md mx-auto mt-20 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Scan ID Required
          </h1>
          <p className="text-gray-600 mb-6">
            Please select a scan first to view AI Doctor recommendations.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <div className="flex gap-2">
            {(['en', 'hi', 'mr'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  language === lang
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {lang === 'en' ? '🇬🇧' : lang === 'hi' ? '🇮🇳 हि' : '🇮🇳 मर'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-blue-50 min-h-screen p-6">
        <AIDoctor scanId={scanId} language={language} />
      </div>
    </div>
  );
}
