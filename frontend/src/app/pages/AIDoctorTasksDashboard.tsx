import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { AIDoctorDashboard } from '../components/AIDoctorDashboard';

export function AIDoctorTasksDashboard() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>('en');

  return (
    <div>
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            {language === 'en' && 'Back'}
            {language === 'hi' && 'वापस'}
            {language === 'mr' && 'परत'}
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
                {lang === 'en' ? '🇬🇧 EN' : lang === 'hi' ? '🇮🇳 HI' : '🇮🇳 MR'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <AIDoctorDashboard language={language} />
    </div>
  );
}
