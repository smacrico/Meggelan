import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Edit,
  ArrowRightLeft,
  CheckCircle2,
  Calendar,
  HeartPulse,
  Pill,
  X,
  Check,
} from 'lucide-react';
import { PatientProfile, TestSession, Gender } from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';

interface ProfilesScreenProps {
  profiles: PatientProfile[];
  sessions: TestSession[];
  selectedProfileId: string;
  onSelectProfile: (profileId: string) => void;
  onSaveProfile: (profile: PatientProfile) => void;
}

export const ProfilesScreen: React.FC<ProfilesScreenProps> = ({
  profiles,
  sessions,
  selectedProfileId,
  onSelectProfile,
  onSaveProfile,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PatientProfile | null>(null);

  // Compare Profiles state
  const [isComparing, setIsComparing] = useState(false);
  const [compareProfileIdA, setCompareProfileIdA] = useState(profiles[0]?.profileId || '');
  const [compareProfileIdB, setCompareProfileIdB] = useState(profiles[1]?.profileId || '');

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('1985-06-15');
  const [gender, setGender] = useState<Gender>('Female');
  const [bloodType, setBloodType] = useState('O+');
  const [mrn, setMrn] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [conditionsText, setConditionsText] = useState('');
  const [medicationsText, setMedicationsText] = useState('');

  const openNewProfileModal = () => {
    setEditingProfile(null);
    setFirstName('');
    setLastName('');
    setDob('1988-03-20');
    setGender('Female');
    setBloodType('A+');
    setMrn(`MRN-${Math.floor(100000 + Math.random() * 900000)}`);
    setEmail('');
    setPhone('');
    setConditionsText('');
    setMedicationsText('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: PatientProfile) => {
    setEditingProfile(p);
    setFirstName(p.firstName);
    setLastName(p.lastName);
    setDob(p.dob);
    setGender(p.gender);
    setBloodType(p.bloodType || 'A+');
    setMrn(p.mrn);
    setEmail(p.email);
    setPhone(p.phone);
    setConditionsText(p.medicalConditions.join(', '));
    setMedicationsText(p.medications.join(', '));
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) return;

    const saved: PatientProfile = {
      profileId: editingProfile ? editingProfile.profileId : `pat-${Date.now().toString(36)}`,
      firstName,
      lastName,
      dob,
      gender,
      bloodType,
      mrn: mrn || `MRN-${Math.floor(100000 + Math.random() * 900000)}`,
      email,
      phone,
      medicalConditions: conditionsText
        ? conditionsText.split(',').map((c) => c.trim()).filter(Boolean)
        : [],
      medications: medicationsText
        ? medicationsText.split(',').map((m) => m.trim()).filter(Boolean)
        : [],
      createdDate: editingProfile ? editingProfile.createdDate : new Date().toISOString(),
    };

    onSaveProfile(saved);
    setIsModalOpen(false);
  };

  const profileA = profiles.find((p) => p.profileId === compareProfileIdA);
  const profileB = profiles.find((p) => p.profileId === compareProfileIdB);

  // Latest session for profile A & B
  const sessionA = sessions
    .filter((s) => s.profileId === compareProfileIdA)
    .sort((a, b) => new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime())[0];

  const sessionB = sessions
    .filter((s) => s.profileId === compareProfileIdB)
    .sort((a, b) => new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime())[0];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              <Users className="w-4 h-4" />
              <span>Patient & Family Cohort Directory</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Patient Profiles & Cohort Registry
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Maintain individual medical identifiers, baseline diagnoses, pharmacotherapy regimens, and perform cross-profile comparative clinical analyses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsComparing(!isComparing)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                isComparing
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>{isComparing ? 'Close Comparison' : 'Compare Profiles'}</span>
            </button>

            <button
              onClick={openNewProfileModal}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compare Profiles View */}
      {isComparing && profileA && profileB && (
        <div className="bg-white border border-indigo-200 rounded-xl p-5 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Cross-Profile Comparative Analysis
              </h2>
              <p className="text-xs text-slate-500">
                Side-by-side comparative examination of biomarker concentrations and derived clinical risk quotients.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div>
                <label className="text-2xs text-slate-500 font-semibold block mb-0.5">Subject A:</label>
                <select
                  value={compareProfileIdA}
                  onChange={(e) => setCompareProfileIdA(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-md p-1.5 text-xs font-medium cursor-pointer"
                >
                  {profiles.map((p) => (
                    <option key={p.profileId} value={p.profileId}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-slate-400 font-bold self-end mb-2">VS</div>

              <div>
                <label className="text-2xs text-slate-500 font-semibold block mb-0.5">Subject B:</label>
                <select
                  value={compareProfileIdB}
                  onChange={(e) => setCompareProfileIdB(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-md p-1.5 text-xs font-medium cursor-pointer"
                >
                  {profiles.map((p) => (
                    <option key={p.profileId} value={p.profileId}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Demographics Comparison Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 bg-blue-50/40 rounded-lg border border-blue-100 text-xs space-y-2">
              <div className="font-bold text-blue-950 text-sm">
                {profileA.firstName} {profileA.lastName} ({profileA.mrn})
              </div>
              <div className="text-2xs text-slate-600">
                {profileA.gender} · Born {profileA.dob} ({new Date().getFullYear() - new Date(profileA.dob).getFullYear()}y) · Blood {profileA.bloodType}
              </div>
              <div className="text-2xs text-slate-700">
                Conditions: <span className="font-medium">{profileA.medicalConditions.join(', ') || 'None listed'}</span>
              </div>
              <div className="text-2xs text-slate-500">
                Latest Exam: {sessionA?.collectionDate || 'No records'} ({sessionA?.results.length || 0} analytes)
              </div>
            </div>

            <div className="p-3.5 bg-indigo-50/40 rounded-lg border border-indigo-100 text-xs space-y-2">
              <div className="font-bold text-indigo-950 text-sm">
                {profileB.firstName} {profileB.lastName} ({profileB.mrn})
              </div>
              <div className="text-2xs text-slate-600">
                {profileB.gender} · Born {profileB.dob} ({new Date().getFullYear() - new Date(profileB.dob).getFullYear()}y) · Blood {profileB.bloodType}
              </div>
              <div className="text-2xs text-slate-700">
                Conditions: <span className="font-medium">{profileB.medicalConditions.join(', ') || 'None listed'}</span>
              </div>
              <div className="text-2xs text-slate-500">
                Latest Exam: {sessionB?.collectionDate || 'No records'} ({sessionB?.results.length || 0} analytes)
              </div>
            </div>
          </div>

          {/* Side-by-side Biomarker Comparison Table */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Analyte</th>
                  <th className="py-2.5 px-3 font-semibold text-right">{profileA.firstName} Result</th>
                  <th className="py-2.5 px-3 font-semibold text-right">{profileB.firstName} Result</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Variance / Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MASTER_BIOMARKER_CATALOG.slice(0, 10).map((cat) => {
                  const resA = sessionA?.results.find((r) => r.biomarkerId === cat.biomarkerId);
                  const resB = sessionB?.results.find((r) => r.biomarkerId === cat.biomarkerId);

                  if (!resA && !resB) return null;

                  const delta = resA && resB ? Number((resB.resultValue - resA.resultValue).toFixed(2)) : null;

                  return (
                    <tr key={cat.biomarkerId} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {cat.name} <span className="text-2xs text-slate-500">({cat.standardUnit})</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {resA ? (
                          <span className={resA.status !== 'Normal' ? 'text-amber-700 font-bold' : 'text-slate-900 font-medium'}>
                            {resA.resultValue}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {resB ? (
                          <span className={resB.status !== 'Normal' ? 'text-amber-700 font-bold' : 'text-slate-900 font-medium'}>
                            {resB.resultValue}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums text-2xs">
                        {delta !== null ? (
                          <span className={delta > 0 ? 'text-blue-700 font-semibold' : delta < 0 ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                            {delta > 0 ? '+' : ''}{delta} {cat.standardUnit}
                          </span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profile Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {profiles.map((p) => {
          const pSessions = sessions.filter((s) => s.profileId === p.profileId);
          const isSelected = p.profileId === selectedProfileId;
          const age = new Date().getFullYear() - new Date(p.dob).getFullYear();

          return (
            <div
              key={p.profileId}
              className={`bg-white border rounded-xl p-5 shadow-2xs flex flex-col justify-between transition-all ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {p.firstName} {p.lastName}
                    </h3>
                    <div className="text-2xs text-slate-500 font-mono">{p.mrn}</div>
                  </div>
                  <button
                    onClick={() => openEditModal(p)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                    title="Edit Profile"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div>
                    <span className="text-slate-400">Demographics: </span>
                    <span className="font-medium text-slate-800">{p.gender}, {age} years ({p.dob})</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Blood Type: </span>
                    <span className="font-semibold text-slate-800">{p.bloodType || 'A+'}</span>
                  </div>
                </div>

                {p.medicalConditions.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-2xs font-semibold text-slate-500 uppercase mb-1">
                      Conditions:
                    </div>
                    <div className="text-2xs text-slate-700 leading-snug">
                      {p.medicalConditions.join(' · ')}
                    </div>
                  </div>
                )}

                {p.medications.length > 0 && (
                  <div className="pt-1">
                    <div className="text-2xs font-semibold text-slate-500 uppercase mb-1">
                      Medications:
                    </div>
                    <div className="text-2xs text-slate-600 leading-snug font-mono">
                      {p.medications.join(' · ')}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
                <span className="text-2xs text-slate-500 font-mono">
                  {pSessions.length} Exam Session{pSessions.length !== 1 ? 's' : ''}
                </span>

                <button
                  onClick={() => onSelectProfile(p.profileId)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 cursor-default font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {isSelected ? 'Active Profile' : 'Select'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Profile Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingProfile ? 'Edit Patient Profile' : 'Register New Patient Profile'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none cursor-pointer"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Blood Type</label>
                  <input
                    type="text"
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    placeholder="A+, O-, etc."
                    className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">MRN (Identifier)</label>
                  <input
                    type="text"
                    value={mrn}
                    onChange={(e) => setMrn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Diagnoses / Medical Conditions (comma-separated)
                </label>
                <input
                  type="text"
                  value={conditionsText}
                  onChange={(e) => setConditionsText(e.target.value)}
                  placeholder="e.g. Iron Deficiency Anemia, Dyslipidemia, Hypertension"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Active Medications / Supplements (comma-separated)
                </label>
                <input
                  type="text"
                  value={medicationsText}
                  onChange={(e) => setMedicationsText(e.target.value)}
                  placeholder="e.g. Ferrous sulfate 325mg, Atorvastatin 20mg"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
