import React, { useState, useEffect } from 'react';
import {
  Navigation,
  NavTab,
} from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { ProfilesScreen } from './components/ProfilesScreen';
import { UploadScreen } from './components/UploadScreen';
import { SessionDetailsScreen } from './components/SessionDetailsScreen';
import { TrendAnalysisScreen } from './components/TrendAnalysisScreen';
import { PredictiveAnalyticsScreen } from './components/PredictiveAnalyticsScreen';
import { PowerBiAnalyticsScreen } from './components/PowerBiAnalyticsScreen';
import { AlertsScreen } from './components/AlertsScreen';
import { BiomarkerComparisonScreen } from './components/BiomarkerComparisonScreen';
import { SolutionDocModal } from './components/SolutionDocModal';
import { SqliteDatabaseModal } from './components/SqliteDatabaseModal';
import { LabPollingModal } from './components/LabPollingModal';
import {
  getPollingState,
  subscribeToPolling,
  commitPendingItem,
  LabPollingState,
  IncomingLabItem,
} from './services/labPollingService';
import {
  Radio,
  Sparkles,
  X,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import {
  getProfiles,
  getSessions,
  getLabs,
  getAlerts,
  getSelectedProfileId,
  setSelectedProfileId,
  subscribeToStore,
  addSession,
  saveOrUpdateProfile,
  acknowledgeAlert,
  resetToSeedData,
} from './services/storageService';
import { PatientProfile, TestSession, Laboratory, AlertHistory } from './types/clinical';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [alerts, setAlerts] = useState<AlertHistory[]>([]);
  const [selectedProfileId, setSelectedProfileIdState] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isSqliteModalOpen, setIsSqliteModalOpen] = useState(false);
  const [isPollingModalOpen, setIsPollingModalOpen] = useState(false);
  const [pollingState, setPollingState] = useState<LabPollingState>(getPollingState());
  const [incomingToast, setIncomingToast] = useState<IncomingLabItem | null>(null);

  // Sync state with storage service
  const refreshState = () => {
    const profs = getProfiles();
    const sess = getSessions();
    const l = getLabs();
    const al = getAlerts();
    const selId = getSelectedProfileId();

    setProfiles(profs);
    setSessions(sess);
    setLabs(l);
    setAlerts(al);
    setSelectedProfileIdState(selId);
  };

  useEffect(() => {
    refreshState();
    const unsubscribeStore = subscribeToStore(() => {
      refreshState();
    });

    let previousPendingCount = 0;
    const unsubscribePolling = subscribeToPolling((updatedState) => {
      setPollingState(updatedState);
      if (updatedState.pendingItems.length > previousPendingCount && updatedState.pendingItems.length > 0) {
        const newest = updatedState.pendingItems[0];
        setIncomingToast(newest);
        // Auto-dismiss toast after 9 seconds
        setTimeout(() => {
          setIncomingToast((prev) => (prev?.id === newest.id ? null : prev));
        }, 9000);
      }
      previousPendingCount = updatedState.pendingItems.length;
    });

    return () => {
      unsubscribeStore();
      unsubscribePolling();
    };
  }, []);

  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    setSelectedProfileIdState(id);
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setCurrentTab('session-details');
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    acknowledgeAlert(alertId, 'Dr. Clinical Reviewer');
  };

  const handleSessionCommitted = (newSession: TestSession, newAlerts?: AlertHistory[]) => {
    addSession(newSession, newAlerts || []);
    setSelectedSessionId(newSession.sessionId);
    setCurrentTab('session-details');
  };

  const handleSaveProfile = (profile: PatientProfile) => {
    saveOrUpdateProfile(profile);
    handleSelectProfile(profile.profileId);
  };

  const handleResetData = () => {
    if (window.confirm('Reset all sessions and profiles to original clinical seed data?')) {
      resetToSeedData();
      setCurrentTab('home');
    }
  };

  const currentProfile = profiles.find((p) => p.profileId === selectedProfileId) || profiles[0];
  const patientSessions = sessions.filter((s) => s.profileId === currentProfile?.profileId);
  const activeAlertCount = alerts.filter((a) => !a.acknowledged).length;

  const currentSession = sessions.find((s) => s.sessionId === selectedSessionId) || patientSessions[0] || null;
  const currentLaboratory = currentSession ? labs.find((l) => l.labId === currentSession.labId) || null : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 antialiased">
      {/* Top Navigation Bar */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onSelectProfile={handleSelectProfile}
        activeAlertCount={activeAlertCount}
        onOpenDocModal={() => setIsDocModalOpen(true)}
        onOpenSqliteModal={() => setIsSqliteModalOpen(true)}
        onOpenPollingModal={() => setIsPollingModalOpen(true)}
        pendingIncomingCount={pollingState.pendingItems.length}
        isPollingActive={pollingState.isPolling}
        onResetData={handleResetData}
      />

      {/* Main Content Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentProfile ? (
          <>
            {currentTab === 'home' && (
              <HomeScreen
                profile={currentProfile}
                sessions={patientSessions}
                labs={labs}
                alerts={alerts}
                onSelectTab={setCurrentTab}
                onSelectSession={handleSelectSession}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onOpenDocModal={() => setIsDocModalOpen(true)}
              />
            )}

            {currentTab === 'profiles' && (
              <ProfilesScreen
                profiles={profiles}
                sessions={sessions}
                selectedProfileId={selectedProfileId}
                onSelectProfile={handleSelectProfile}
                onSaveProfile={handleSaveProfile}
              />
            )}

            {currentTab === 'upload' && (
              <UploadScreen
                profiles={profiles}
                labs={labs}
                selectedProfileId={selectedProfileId}
                onSessionCommitted={handleSessionCommitted}
              />
            )}

            {currentTab === 'session-details' && (
              <SessionDetailsScreen
                session={currentSession}
                laboratory={currentLaboratory}
                profile={currentProfile}
                allSessions={patientSessions}
                onBack={() => setCurrentTab('home')}
                onSelectTab={setCurrentTab}
              />
            )}

            {currentTab === 'trends' && (
              <TrendAnalysisScreen
                profile={currentProfile}
                sessions={patientSessions}
              />
            )}

            {currentTab === 'differentials' && (
              <BiomarkerComparisonScreen
                profile={currentProfile}
                sessions={patientSessions}
                labs={labs}
              />
            )}

            {currentTab === 'predictive' && (
              <PredictiveAnalyticsScreen
                profile={currentProfile}
                sessions={patientSessions}
              />
            )}

            {currentTab === 'powerbi' && (
              <PowerBiAnalyticsScreen
                profile={currentProfile}
                sessions={patientSessions}
                labs={labs}
              />
            )}

            {currentTab === 'alerts' && (
              <AlertsScreen
                alerts={alerts}
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                onAcknowledgeAlert={handleAcknowledgeAlert}
              />
            )}
          </>
        ) : (
          <div className="py-24 text-center text-slate-500">
            Initializing Clinical Platform...
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">HemaMetric</span>
            <span>·</span>
            <span>Clinical Pathology Analytics Platform</span>
            <span>·</span>
            <span>CLIA / CAP & ISO 15189 Standards</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSqliteModalOpen(true)}
              className="text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
            >
              SQLite Database Engine (./hemametric.sqlite)
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setIsDocModalOpen(true)}
              className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
            >
              System Architecture & ERD Blueprint
            </button>
          </div>
        </div>
      </footer>

      {/* Confluence Architecture Document Modal */}
      <SolutionDocModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
      />

      {/* Local SQLite Database Inspector & Laptop Guide Modal */}
      <SqliteDatabaseModal
        isOpen={isSqliteModalOpen}
        onClose={() => setIsSqliteModalOpen(false)}
      />

      {/* Real-Time Laboratory API Polling Modal */}
      <LabPollingModal
        isOpen={isPollingModalOpen}
        onClose={() => setIsPollingModalOpen(false)}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onViewSessionDetails={(sessionId) => {
          handleSelectSession(sessionId);
          setIsPollingModalOpen(false);
        }}
      />

      {/* Real-Time Floating Notification Toast for Inbound Lab Tests */}
      {incomingToast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-40 max-w-md w-full bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-4 animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Radio className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white tracking-tight">New Laboratory Result Detected</span>
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-bold rounded-xs uppercase ${
                      incomingToast.urgency === 'Panic/Stat'
                        ? 'bg-rose-500 text-white'
                        : incomingToast.urgency === 'Priority'
                        ? 'bg-amber-500 text-slate-900'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {incomingToast.urgency}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  {incomingToast.sourceLab} · Accession #{incomingToast.accessionNumber}
                </p>
                <div className="text-[11px] text-slate-400">
                  Patient: <span className="text-white font-semibold">{incomingToast.patientName}</span> (
                  {incomingToast.session.results.length} biomarkers)
                </div>
              </div>
            </div>

            <button
              onClick={() => setIncomingToast(null)}
              className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
            <button
              onClick={async () => {
                await commitPendingItem(incomingToast.id);
                setIncomingToast(null);
                handleSelectSession(incomingToast.session.sessionId);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Direct Ingest to SQLite</span>
            </button>

            <button
              onClick={() => {
                setIsPollingModalOpen(true);
                setIncomingToast(null);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <span>Review Inbound Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
