import React from 'react';
import {
  Activity,
  Users,
  UploadCloud,
  TrendingUp,
  BrainCircuit,
  BarChart3,
  Bell,
  FileCode2,
  RefreshCw,
  Database,
  Radio,
  Layers,
} from 'lucide-react';
import { PatientProfile } from '../types/clinical';

export type NavTab =
  | 'home'
  | 'profiles'
  | 'upload'
  | 'session-details'
  | 'trends'
  | 'differentials'
  | 'predictive'
  | 'powerbi'
  | 'alerts';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  profiles: PatientProfile[];
  selectedProfileId: string;
  onSelectProfile: (profileId: string) => void;
  activeAlertCount: number;
  onOpenDocModal: () => void;
  onOpenSqliteModal: () => void;
  onOpenPollingModal?: () => void;
  pendingIncomingCount?: number;
  isPollingActive?: boolean;
  onResetData: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  profiles,
  selectedProfileId,
  onSelectProfile,
  activeAlertCount,
  onOpenDocModal,
  onOpenSqliteModal,
  onOpenPollingModal,
  pendingIncomingCount = 0,
  isPollingActive = true,
  onResetData,
}) => {
  const selectedProfile = profiles.find((p) => p.profileId === selectedProfileId);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* 3-Zone Top Bar Contract: Brand - 4-5 links - 1 Primary Action */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <button
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2.5 text-left focus:outline-none group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold text-base shadow-xs group-hover:bg-blue-800 transition-colors">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              HemaMetric
            </span>
          </button>

          {/* Zone 2: Navigation Links (concise, single-line, whitespace-nowrap) */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <button
              onClick={() => onSelectTab('home')}
              className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                currentTab === 'home'
                  ? 'text-blue-700 bg-blue-50/70 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => onSelectTab('profiles')}
              className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                currentTab === 'profiles'
                  ? 'text-blue-700 bg-blue-50/70 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Patients
            </button>
            <button
              onClick={() => onSelectTab('upload')}
              className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                currentTab === 'upload'
                  ? 'text-blue-700 bg-blue-50/70 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Lab Ingestion
            </button>
            <button
              onClick={() => onSelectTab('trends')}
              className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                currentTab === 'trends'
                  ? 'text-blue-700 bg-blue-50/70 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Trend Analytics
            </button>
            <button
              onClick={() => onSelectTab('differentials')}
              className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                currentTab === 'differentials'
                  ? 'text-blue-700 bg-blue-50/70 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Differentials
            </button>
            <button
              onClick={() => onSelectTab('predictive')}
              className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'predictive'
                  ? 'text-indigo-700 bg-indigo-50/70 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BrainCircuit className="w-4 h-4 text-indigo-600" />
              <span>Predictive Models</span>
            </button>
            <button
              onClick={() => onSelectTab('powerbi')}
              className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                currentTab === 'powerbi'
                  ? 'text-blue-700 bg-blue-50/70 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Power BI Hub
            </button>
            <button
              onClick={() => onSelectTab('alerts')}
              className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors relative cursor-pointer ${
                currentTab === 'alerts'
                  ? 'text-blue-700 bg-blue-50/70 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>Alerts</span>
              {activeAlertCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 text-xs font-mono font-semibold bg-rose-100 text-rose-700 rounded-sm">
                  {activeAlertCount}
                </span>
              )}
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action + Utility trigger */}
          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenPollingModal && (
              <button
                onClick={onOpenPollingModal}
                title="Real-Time Laboratory API Polling Service (LIS / HL7 Feed)"
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  pendingIncomingCount > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 ring-2 ring-amber-400/30'
                    : isPollingActive
                    ? 'bg-emerald-50/80 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {isPollingActive && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      isPollingActive ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  ></span>
                </span>
                <Radio className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline font-mono">LIS Feed</span>
                {pendingIncomingCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold font-mono">
                    +{pendingIncomingCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={onOpenSqliteModal}
              title="SQLite Database Inspector & Laptop Setup Guide"
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Database className="w-3.5 h-3.5 text-blue-700" />
              <span>SQLite DB</span>
            </button>

            <button
              onClick={onOpenDocModal}
              title="View System Architecture & Interactive Visio Diagram"
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              <span className="hidden sm:inline">Architecture & Visio</span>
            </button>

            <button
              onClick={() => onSelectTab('upload')}
              className="px-3.5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors shadow-xs flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Lab Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-bar: Patient Context & Quick Switcher */}
      <div className="bg-slate-50 border-t border-slate-200/80 px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium whitespace-nowrap">Active Patient Context:</span>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-md shadow-2xs">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <select
                aria-label="Active Patient Context"
                value={selectedProfileId}
                onChange={(e) => onSelectProfile(e.target.value)}
                className="bg-transparent font-medium text-slate-900 focus:outline-none cursor-pointer pr-1"
              >
                {profiles.map((p) => (
                  <option key={p.profileId} value={p.profileId}>
                    {p.firstName} {p.lastName} ({p.mrn}) · {p.gender}, {new Date().getFullYear() - new Date(p.dob).getFullYear()}y
                  </option>
                ))}
              </select>
            </div>

            {selectedProfile && (
              <div className="hidden sm:flex items-center gap-2 text-slate-500">
                <span>DOB {selectedProfile.dob}</span>
                <span aria-hidden="true">·</span>
                <span>Blood Type {selectedProfile.bloodType || 'Unknown'}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-xs">{selectedProfile.medicalConditions.join(', ')}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onResetData}
              title="Reset application to original clinical sample sessions"
              className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Sample Data</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
