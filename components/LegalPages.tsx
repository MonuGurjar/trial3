
import React, { useState } from 'react';
import { ArrowLeft, Shield, FileText, AlertCircle } from 'lucide-react';

export type LegalPageType = 'privacy' | 'terms' | 'disclaimer';

interface LegalPagesProps {
  page: LegalPageType;
  onBack: () => void;
}

export const LegalPages: React.FC<LegalPagesProps> = ({ page, onBack }) => {
  const renderContent = () => {
    switch (page) {
      case 'privacy':
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                <Shield size={24} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">Privacy Policy</h1>
            </div>
            <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 text-sm leading-relaxed space-y-4">
              <p><strong>Last Updated: {new Date().getFullYear()}</strong></p>
              <p>At MedRussia, we value your trust and are committed to protecting your personal information. This Privacy Policy outlines how we collect, use, and safeguard your data.</p>
              
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-6">1. Information We Collect</h3>
              <p>We collect information you provide directly to us, such as when you fill out an inquiry form, create an account, or communicate with us via WhatsApp. This includes:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Name, email address, and phone number.</li>
                <li>Academic details (NEET score, current education level).</li>
                <li>Preferences for universities and budget.</li>
              </ul>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-6">2. How We Use Your Information</h3>
              <p>We use your data to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Provide personalized counseling for MBBS admission in Russia.</li>
                <li>Connect you with university representatives (with your consent).</li>
                <li>Send updates regarding admission deadlines and requirements.</li>
              </ul>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-6">3. Data Security</h3>
              <p>We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.</p>
            </div>
          </>
        );
      case 'terms':
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                <FileText size={24} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">Terms & Conditions</h1>
            </div>
            <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 text-sm leading-relaxed space-y-4">
              <p><strong>Welcome to MedRussia.</strong> By accessing our website and services, you agree to be bound by the following terms and conditions.</p>
              
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-6">1. Services Provided</h3>
              <p>MedRussia acts as an educational consultancy platform connecting Indian students with medical universities in Russia. We provide guidance, information, and application assistance.</p>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-6">2. Accuracy of Information</h3>
              <p>While we strive to provide accurate and up-to-date information regarding fees, rankings, and admission criteria, university policies may change without notice. MedRussia is not liable for discrepancies in third-party data.</p>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-6">3. Admission Decisions</h3>
              <p>Final admission decisions rest solely with the respective university authorities. MedRussia cannot guarantee admission.</p>
            </div>
          </>
        );
      case 'disclaimer':
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
                <AlertCircle size={24} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">Disclaimer</h1>
            </div>
            <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 text-sm leading-relaxed space-y-4">
              <p>The information provided on MedRussia is for general informational purposes only. All information on the site is provided in good faith, however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the site.</p>
              
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-6">Not an Official Government Entity</h3>
              <p>MedRussia is a private consultancy and is not affiliated with the Government of India, the National Medical Commission (NMC), or the Russian Ministry of Health unless explicitly stated.</p>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-6">Financial Advice</h3>
              <p>Currency exchange rates and tuition fees are subject to market fluctuations. Students are advised to verify official fees directly with the university before making payments.</p>
            </div>
          </>
        );
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 animate-in fade-in duration-300">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={onBack}
          className="group flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold mb-8 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <div className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm group-hover:shadow-md border border-slate-200 dark:border-slate-700 transition-all">
            <ArrowLeft size={18} />
          </div>
          Back to Home
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden">
          {renderContent()}
          
          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-400">
              For any legal queries, please contact us at <span className="font-bold text-slate-600 dark:text-slate-300">legal@medrussia.com</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
