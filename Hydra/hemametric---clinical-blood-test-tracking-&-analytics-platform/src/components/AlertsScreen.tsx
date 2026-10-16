import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Filter,
  Calendar,
  User,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { AlertHistory, PatientProfile, AlertSeverity } from '../types/clinical';

interface AlertsScreenProps {
  alerts: AlertHistory[];
  profiles: PatientProfile[];
  selectedProfileId: string;
  onAcknowledgeAlert: (alertId: string) => void;
}

export const AlertsScreen: React.FC<AlertsScreenProps> = ({
  alerts,
  profiles,
  selectedProfileId,
  onAcknowledgeAlert,
}) => {
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unacknowledged' | 'acknowledged'>('all');
  const [patientScope, setPatientScope] = useState<'current' | 'all'>('current');

  const filteredAlerts = alerts.filter((a) => {
    if (patientScope === 'current' && a.profileId !== selectedProfileId) return false;
    if (severityFilter !== 'All' && a.severity !== severityFilter) return false;
    if (statusFilter === 'unacknowledged' && a.acknowledged) return false;
    if (statusFilter === 'acknowledged' && !a.acknowledged) return false;
    return true;
  });

  const criticalCount = alerts.filter((a) => a.severity === 'Critical' && !a.acknowledged).length;
  const warningCount = alerts.filter((a) => a.severity === 'Warning' && !a.acknowledged).length;
  const infoCount = alerts.filter((a) => a.severity === 'Informational' && !a.acknowledged).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
              <ShieldAlert className="w-4 h-4" />
              <span>Clinical Notification & Out-of-Range Surveillance</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Clinical Alert History & Decision Support
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Automated threshold alerts, rapid longitudinal delta triggers, and clinical practice guideline recommendations.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-center">
              <div className="text-2xs font-semibold text-rose-700 uppercase">Critical</div>
              <div className="font-mono font-bold text-rose-950 text-base">{criticalCount}</div>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <div className="text-2xs font-semibold text-amber-700 uppercase">Warning</div>
              <div className="font-mono font-bold text-amber-950 text-base">{warningCount}</div>
            </div>
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <div className="text-2xs font-semibold text-blue-700 uppercase">Info</div>
              <div className="font-mono font-bold text-blue-950 text-base">{infoCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-semibold mr-1">Severity:</span>
          {(['All', 'Critical', 'Warning', 'Informational'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                severityFilter === sev
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Patient Scope:</span>
            <select
              value={patientScope}
              onChange={(e) => setPatientScope(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-md p-1 font-medium cursor-pointer"
            >
              <option value="current">Active Patient Only</option>
              <option value="all">All Patients</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-md p-1 font-medium cursor-pointer"
            >
              <option value="all">All Alerts</option>
              <option value="unacknowledged">Unacknowledged</option>
              <option value="acknowledged">Acknowledged</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alt) => {
            const patient = profiles.find((p) => p.profileId === alt.profileId);
            const isCrit = alt.severity === 'Critical';
            const isWarn = alt.severity === 'Warning';

            const severityBorder = isCrit
              ? 'border-rose-300 bg-rose-50/20'
              : isWarn
              ? 'border-amber-300 bg-amber-50/20'
              : 'border-blue-200 bg-blue-50/20';

            return (
              <div
                key={alt.alertId}
                className={`bg-white border rounded-xl p-5 shadow-2xs space-y-3 transition-colors ${severityBorder}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isCrit ? 'text-rose-700' : isWarn ? 'text-amber-700' : 'text-blue-700'
                      }`}
                    >
                      {alt.severity}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-sm font-bold text-slate-900">{alt.biomarkerName}</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-xs text-slate-600 font-medium">
                      Patient: {patient?.firstName} {patient?.lastName} ({patient?.mrn})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-slate-500 font-mono">
                      {new Date(alt.generatedOn).toLocaleDateString()}
                    </span>

                    {!alt.acknowledged ? (
                      <button
                        onClick={() => onAcknowledgeAlert(alt.alertId)}
                        className="px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                      >
                        Acknowledge Alert
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-2xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Acknowledged</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                  {alt.message}
                </p>

                {alt.valueRecorded !== undefined && (
                  <div className="text-2xs text-slate-600 font-mono flex items-center gap-3">
                    <span>Recorded: <strong className="text-slate-900">{alt.valueRecorded}</strong></span>
                    <span>Reference: <strong>{alt.referenceInterval}</strong></span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 bg-slate-50/70 p-3 rounded-lg text-2xs text-slate-700 space-y-1">
                  <div className="font-semibold text-slate-900">Clinical Protocol & Recommended Action:</div>
                  <div className="leading-relaxed">{alt.clinicalGuideline}</div>
                </div>

                {alt.acknowledged && alt.acknowledgedBy && (
                  <div className="text-3xs text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Signed by {alt.acknowledgedBy} at {alt.acknowledgedAt}</span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
            No clinical alerts match the selected criteria.
          </div>
        )}
      </div>
    </div>
  );
};
