import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Role } from '../types';
import { Sparkles, X } from 'lucide-react';

interface WelcomeCardProps {
  userName: string;
  role: Role;
  onDismiss: () => void;
  onCreateRequest?: () => void;
}

const roleDescriptions: Record<Role, string> = {
  [Role.REQUESTER]:
    'Create and track item/service coding requests. Get started by creating your first request.',
  [Role.MANAGER]:
    'Review and approve coding requests from your team. You\'ll see pending approvals on your dashboard.',
  [Role.POC]:
    'Assign and manage specialist workload. Incoming requests will appear in your queue.',
  [Role.SPECIALIST]:
    'Review and code items/services. Assigned requests will appear in your dashboard.',
  [Role.TECHNICAL_REVIEWER]:
    'Validate coding descriptions for accuracy. Requests awaiting validation will be shown here.',
  [Role.ADMIN]:
    'Full system access \u2014 manage users, attributes, priorities, and workflows.',
};

const roleTips: Record<Role, string[]> = {
  [Role.REQUESTER]: [
    'Click "Create Request" to submit a new item or service coding request.',
    'Fill in the required attributes to auto-generate a standardized description.',
    'Track your request status in real time from the dashboard.',
    'Use the Activity Feed to see the full history of your submissions.',
  ],
  [Role.MANAGER]: [
    'Critical-priority requests require your approval before proceeding.',
    'Use bulk actions to approve multiple requests at once.',
    'Monitor your team\'s request volume in the Analytics panel.',
    'Check the SLA indicators to identify time-sensitive items.',
  ],
  [Role.POC]: [
    'Assign incoming requests to the appropriate specialist.',
    'Use bulk assignment to efficiently distribute workload.',
    'Monitor specialist capacity in the Analytics panel.',
    'Reassign requests if a specialist is unavailable.',
  ],
  [Role.SPECIALIST]: [
    'Review assigned requests and provide accurate coding descriptions.',
    'Use the clarification thread to ask the requester for more details.',
    'Submit completed requests for technical validation.',
    'Check SLA timers to prioritize urgent items.',
  ],
  [Role.TECHNICAL_REVIEWER]: [
    'Validate that coding descriptions meet organizational standards.',
    'Approve or return requests that need corrections.',
    'Use the description preview to verify auto-generated text.',
    'Check the Activity Feed for recently submitted validations.',
  ],
  [Role.ADMIN]: [
    'Manage users, roles, and permissions from the Admin Panel.',
    'Configure attribute definitions and priority levels.',
    'Use the Workflow Builder to customize approval flows.',
    'Export reports and audit trails for compliance reviews.',
  ],
};

function getStartRoute(role: Role): string {
  switch (role) {
    case Role.REQUESTER:
      return '/requests/new';
    case Role.MANAGER:
      return '/';
    case Role.POC:
      return '/';
    case Role.SPECIALIST:
      return '/';
    case Role.TECHNICAL_REVIEWER:
      return '/';
    case Role.ADMIN:
      return '/admin';
  }
}

function getStartLabel(role: Role): string {
  switch (role) {
    case Role.REQUESTER:
      return 'Create Your First Request';
    case Role.MANAGER:
      return 'View Pending Approvals';
    case Role.POC:
      return 'View Incoming Requests';
    case Role.SPECIALIST:
      return 'View Assigned Requests';
    case Role.TECHNICAL_REVIEWER:
      return 'View Validation Queue';
    case Role.ADMIN:
      return 'Open Admin Panel';
  }
}

export const WelcomeCard: React.FC<WelcomeCardProps> = ({
  userName,
  role,
  onDismiss,
  onCreateRequest,
}) => {
  const navigate = useNavigate();
  const firstName = userName.split(' ')[0];
  const tips = roleTips[role];
  const description = roleDescriptions[role];

  const handleGetStarted = () => {
    if (role === Role.REQUESTER && onCreateRequest) {
      onCreateRequest();
    } else {
      navigate(getStartRoute(role));
    }
  };

  return (
    <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 overflow-hidden animate-fadeIn">
      {/* Gradient accent — left border on md+, top border on mobile */}
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 hidden md:block" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 md:hidden" />

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        aria-label="Dismiss welcome card"
      >
        <X size={16} strokeWidth={2} />
      </button>

      <div className="p-6 md:pl-7">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
            <Sparkles size={18} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Welcome to CodeMaster, {firstName}!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
              {role}
            </p>
          </div>
        </div>

        {/* Role description */}
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 max-w-2xl">
          {description}
        </p>

        {/* Quick-start tips */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Quick-start tips
          </p>
          <ul className="space-y-1.5">
            {tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleGetStarted}
            className="btn-primary text-white px-5 py-2 rounded-lg text-sm font-medium shadow-sm transition"
          >
            {getStartLabel(role)}
          </button>
          <button
            onClick={onDismiss}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
