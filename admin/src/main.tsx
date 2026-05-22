import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AdminUser, ModeratedSpot, ModeratedUser, Report, ReportStatus } from './types';
import './styles.css';

const STATUSES: ReportStatus[] = ['open', 'reviewed', 'action_taken', 'dismissed'];

type DashboardStats = {
  totalUsers: number;
  founderUsers: number;
  foundersRemaining: number;
  bannedUsers: number;
  activeUsers: number;
  openReports: number;
};

function formatDate(value: Report['createdAt']) {
  if (!value) return 'Not set';
  const date = value.toDate();
  return date.toLocaleString();
}

function getReportSortTime(report: Report) {
  return report.createdAt?.toMillis() ?? 0;
}

function getTargetUserId(report: Report) {
  return report.reportedUserId || report.targetOwnerId || report.commentOwnerId || report.replyOwnerId || report.spotOwnerId || '';
}

function getTargetSpotId(report: Report) {
  return report.spotId || (report.targetType === 'spot' ? report.targetId : '') || '';
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="loginShell">
      <form className="loginPanel" onSubmit={handleSubmit}>
        <p className="eyebrow">SPOTZ Admin</p>
        <h1>Moderation Dashboard</h1>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>
        {error && <p className="errorText">{error}</p>}
        <button type="submit" disabled={isLoading}>{isLoading ? 'Signing in...' : 'Sign In'}</button>
      </form>
    </main>
  );
}

function useAdminUser(firebaseUser: User | null) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkRole = async () => {
      setIsCheckingRole(true);
      setAdminUser(null);

      if (!firebaseUser) {
        setIsCheckingRole(false);
        return;
      }

      const snapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
      const data = snapshot.exists() ? snapshot.data() : {};

      if (isMounted && data.role === 'admin') {
        setAdminUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: 'admin',
        });
      }

      if (isMounted) setIsCheckingRole(false);
    };

    checkRole().catch(() => {
      if (isMounted) setIsCheckingRole(false);
    });

    return () => {
      isMounted = false;
    };
  }, [firebaseUser]);

  return { adminUser, isCheckingRole };
}

function ReportList({
  reports,
  selectedReportId,
  onSelect,
}: {
  reports: Report[];
  selectedReportId?: string;
  onSelect: (report: Report) => void;
}) {
  return (
    <section className="reportList">
      {reports.map((report) => (
        <button
          key={report.id}
          className={`reportListItem ${selectedReportId === report.id ? 'active' : ''}`}
          onClick={() => onSelect(report)}
          type="button"
        >
          <span className="itemTitle">{report.spotTitle || report.reportedUserDisplayName || report.targetId || 'Untitled report'}</span>
          <span className="itemMeta">{report.targetType || 'unknown'} - {report.reason || 'No reason'}</span>
          <span className="itemDate">{formatDate(report.createdAt)}</span>
        </button>
      ))}
      {reports.length === 0 && <p className="emptyState">No reports in this status.</p>}
    </section>
  );
}

function ReportDetail({
  report,
  adminUser,
}: {
  report: Report | null;
  adminUser: AdminUser;
}) {
  const [note, setNote] = useState('');
  const [targetUser, setTargetUser] = useState<ModeratedUser | null>(null);
  const [targetSpot, setTargetSpot] = useState<ModeratedSpot | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [isUnbanConfirmOpen, setIsUnbanConfirmOpen] = useState(false);
  const [isUserActionLoading, setIsUserActionLoading] = useState(false);

  const targetUserId = useMemo(() => (report ? getTargetUserId(report) : ''), [report]);
  const targetSpotId = useMemo(() => (report ? getTargetSpotId(report) : ''), [report]);
  const isTargetUserBanned = targetUser?.isBanned === true;

  useEffect(() => {
    setNote('');
    setActionMessage('');
    setIsUnbanConfirmOpen(false);
    setIsUserActionLoading(false);
  }, [report?.id]);

  useEffect(() => {
    let isMounted = true;
    setTargetUser(null);

    if (!targetUserId) return;

    getDoc(doc(db, 'users', targetUserId)).then((snapshot) => {
      if (!isMounted || !snapshot.exists()) return;
      const data = snapshot.data();
      setTargetUser({
        id: targetUserId,
        username: typeof data.username === 'string' ? data.username : undefined,
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        email: typeof data.email === 'string' ? data.email : undefined,
        isBanned: data.isBanned === true,
        banReason: typeof data.banReason === 'string' ? data.banReason : undefined,
      });
    }).catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [targetUserId]);

  useEffect(() => {
    let isMounted = true;
    setTargetSpot(null);

    if (!targetSpotId) return;

    getDoc(doc(db, 'spots', targetSpotId)).then((snapshot) => {
      if (!isMounted || !snapshot.exists()) return;
      const data = snapshot.data();
      setTargetSpot({
        id: targetSpotId,
        title: typeof data.title === 'string' ? data.title : undefined,
        isRemoved: data.isRemoved === true,
        removedReason: typeof data.removedReason === 'string' ? data.removedReason : undefined,
      });
    }).catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [targetSpotId]);

  if (!report) {
    return <section className="detailPanel emptyDetail">Select a report to review.</section>;
  }

  const updateReport = async (status: ReportStatus, actionTaken?: string) => {
    await updateDoc(doc(db, 'reports', report.id), {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUser.uid,
      reviewNote: note.trim(),
      actionTaken: actionTaken || '',
    });
    setActionMessage(`Report marked ${status}.`);
  };

  const setBanState = async (isBanned: boolean) => {
    if (!targetUserId) return;
    setIsUserActionLoading(true);

    try {
      await updateDoc(doc(db, 'users', targetUserId), isBanned
        ? {
            isBanned: true,
            banReason: note.trim() || report.reason || 'Moderation action',
            bannedAt: serverTimestamp(),
            bannedBy: adminUser.uid,
            updatedAt: serverTimestamp(),
          }
        : {
            isBanned: false,
            banReason: deleteField(),
            bannedAt: deleteField(),
            bannedBy: deleteField(),
            updatedAt: serverTimestamp(),
          });
      setTargetUser((current) => current
        ? {
            ...current,
            isBanned,
            banReason: isBanned ? note.trim() || report.reason || 'Moderation action' : undefined,
          }
        : current);
      setIsUnbanConfirmOpen(false);
      setActionMessage(isBanned ? 'User banned.' : 'User unbanned.');
    } finally {
      setIsUserActionLoading(false);
    }
  };

  const handleUserModerationPress = () => {
    if (!targetUserId) return;

    if (isTargetUserBanned) {
      setIsUnbanConfirmOpen(true);
      return;
    }

    setBanState(true).catch((error) => {
      setActionMessage(error instanceof Error ? error.message : 'Unable to ban user.');
    });
  };

  const handleConfirmUnban = () => {
    setBanState(false).catch((error) => {
      setActionMessage(error instanceof Error ? error.message : 'Unable to unban user.');
    });
  };

  const setRemovedState = async (isRemoved: boolean) => {
    if (!targetSpotId) return;
    await updateDoc(doc(db, 'spots', targetSpotId), {
      isRemoved,
      removedReason: isRemoved ? note.trim() || report.reason || 'Moderation action' : '',
      removedAt: isRemoved ? serverTimestamp() : null,
      removedBy: isRemoved ? adminUser.uid : '',
      updatedAt: serverTimestamp(),
    });
    setActionMessage(isRemoved ? 'Spot removed.' : 'Spot restored.');
  };

  return (
    <section className="detailPanel">
      <div className="detailHeader">
        <div>
          <p className="eyebrow">Report</p>
          <h2>{report.spotTitle || report.reportedUserDisplayName || report.targetId}</h2>
        </div>
        <span className={`statusPill ${report.status}`}>{report.status}</span>
      </div>

      <div className="detailGrid">
        <Info label="Target type" value={report.targetType} />
        <Info label="Target id" value={report.targetId} />
        <Info label="Target owner" value={report.targetOwnerId || targetUserId} />
        <Info label="Reporter" value={report.reporterEmail || report.reporterId} />
        <Info label="Reason" value={report.reason} />
        <Info label="Created" value={formatDate(report.createdAt)} />
      </div>

      {report.details && <TextBlock label="Details" value={report.details} />}
      {report.commentText && <TextBlock label="Comment text" value={report.commentText} />}
      {report.replyText && <TextBlock label="Reply text" value={report.replyText} />}

      {Array.isArray(report.spotImageUrls) && report.spotImageUrls.length > 0 && (
        <div className="imageGrid">
          {report.spotImageUrls.map((url) => <img key={url} src={url} alt="Reported spot" />)}
        </div>
      )}

      <div className="moderationCards">
        <div>
          <h3>User</h3>
          <p>{targetUser?.displayName || report.reportedUserDisplayName || targetUserId || 'No user target'}</p>
          {targetUserId && <p className="muted">{targetUser?.isBanned ? 'Currently banned' : 'Not banned'}</p>}
        </div>
        <div>
          <h3>Spot</h3>
          <p>{targetSpot?.title || report.spotTitle || targetSpotId || 'No spot target'}</p>
          {targetSpotId && <p className="muted">{targetSpot?.isRemoved ? 'Currently removed' : 'Visible'}</p>}
        </div>
      </div>

      <label className="noteField">
        Review note / action reason
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
      </label>

      <div className="actionBar">
        <button type="button" onClick={() => updateReport('reviewed')}>Mark reviewed</button>
        <button type="button" onClick={() => updateReport('dismissed')}>Dismiss</button>
        <button type="button" onClick={() => updateReport('action_taken', 'Manual moderation action')}>Mark action taken</button>
        <button type="button" disabled={!targetUserId || isUserActionLoading} onClick={handleUserModerationPress}>
          {isTargetUserBanned ? 'Unban user' : 'Ban user'}
        </button>
        <button type="button" disabled={!targetSpotId} onClick={() => setRemovedState(!targetSpot?.isRemoved)}>
          {targetSpot?.isRemoved ? 'Restore spot' : 'Remove spot'}
        </button>
      </div>

      {actionMessage && <p className="successText">{actionMessage}</p>}

      {isUnbanConfirmOpen && (
        <div className="modalBackdrop" role="presentation">
          <section className="confirmModal" role="dialog" aria-modal="true" aria-labelledby="unban-title">
            <p className="eyebrow">Confirm unban</p>
            <h3 id="unban-title">Unban this user?</h3>
            <p className="muted">
              This will restore account access for{' '}
              <strong>{targetUser?.displayName || targetUser?.username || targetUserId}</strong>
              {' '}and clear the saved ban reason, banned date, and banning admin.
            </p>
            <div className="modalActions">
              <button type="button" className="secondaryButton" onClick={() => setIsUnbanConfirmOpen(false)} disabled={isUserActionLoading}>
                Cancel
              </button>
              <button type="button" onClick={handleConfirmUnban} disabled={isUserActionLoading}>
                {isUserActionLoading ? 'Unbanning...' : 'Unban user'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="infoCell">
      <span>{label}</span>
      <strong>{value || 'Not set'}</strong>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="textBlock">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function StatsSection({
  stats,
  isLoading,
  error,
}: {
  stats: DashboardStats;
  isLoading: boolean;
  error: string;
}) {
  const statItems = [
    { label: 'Total users', value: stats.totalUsers },
    { label: 'Founder users', value: stats.founderUsers },
    { label: 'Founders remaining', value: stats.foundersRemaining },
    { label: 'Banned users', value: stats.bannedUsers },
    { label: 'Active users', value: stats.activeUsers },
    { label: 'Open reports', value: stats.openReports },
  ];

  return (
    <section className="statsPanel" aria-label="Admin stats">
      <div className="statsHeader">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>App stats</h2>
        </div>
        {isLoading && <span className="statsLoading">Updating...</span>}
      </div>
      {error && <p className="errorText">{error}</p>}
      <div className="statsGrid">
        {statItems.map((item) => (
          <div className="statCard" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value.toLocaleString()}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function Dashboard({ adminUser }: { adminUser: AdminUser }) {
  const [status, setStatus] = useState<ReportStatus>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    founderUsers: 0,
    foundersRemaining: 500,
    bannedUsers: 0,
    activeUsers: 0,
    openReports: 0,
  });
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    setError('');
    const reportsQuery = query(collection(db, 'reports'), where('status', '==', status));
    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const nextReports = snapshot.docs
          .map((reportDoc) => ({
            id: reportDoc.id,
            ...reportDoc.data(),
          }) as Report)
          .sort((left, right) => getReportSortTime(right) - getReportSortTime(left));
        setReports(nextReports);
        setSelectedReport((current) => {
          if (!current) return nextReports[0] || null;
          return nextReports.find((report) => report.id === current.id) || nextReports[0] || null;
        });
      },
      (snapshotError) => {
        setError(snapshotError.message);
      }
    );

    return unsubscribe;
  }, [status]);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      setIsStatsLoading(true);
      setStatsError('');

      try {
        const [
          totalUsersSnapshot,
          founderUsersSnapshot,
          bannedUsersSnapshot,
          openReportsSnapshot,
          founderProgramSnapshot,
        ] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(query(collection(db, 'users'), where('isFounder', '==', true))),
          getCountFromServer(query(collection(db, 'users'), where('isBanned', '==', true))),
          getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'open'))),
          getDoc(doc(db, 'appConfig', 'founderProgram')),
        ]);

        if (!isMounted) return;

        const totalUsers = totalUsersSnapshot.data().count;
        const founderUsers = founderUsersSnapshot.data().count;
        const bannedUsers = bannedUsersSnapshot.data().count;
        const founderProgramData = founderProgramSnapshot.exists() ? founderProgramSnapshot.data() : {};
        const maxFounders = Math.max(0, Number(founderProgramData.maxFounders) || 500);
        const claimedFounders = Math.max(founderUsers, Number(founderProgramData.claimedCount) || 0);
        setStats({
          totalUsers,
          founderUsers,
          foundersRemaining: Math.max(0, maxFounders - claimedFounders),
          bannedUsers,
          activeUsers: Math.max(0, totalUsers - bannedUsers),
          openReports: openReportsSnapshot.data().count,
        });
      } catch (statsLoadError) {
        if (isMounted) {
          setStatsError(statsLoadError instanceof Error ? statsLoadError.message : 'Unable to load stats.');
        }
      } finally {
        if (isMounted) setIsStatsLoading(false);
      }
    };

    loadStats();

    return () => {
      isMounted = false;
    };
  }, [adminUser.uid]);

  return (
    <div className="adminShell">
      <header className="topBar">
        <div>
          <p className="eyebrow">SPOTZ Admin</p>
          <h1>Reports</h1>
        </div>
        <div className="adminIdentity">
          <span>{adminUser.email}</span>
          <button type="button" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>

      <nav className="tabs">
        {STATUSES.map((item) => (
          <button key={item} className={status === item ? 'active' : ''} onClick={() => setStatus(item)} type="button">
            {item.replace('_', ' ')}
          </button>
        ))}
      </nav>

      <StatsSection stats={stats} isLoading={isStatsLoading} error={statsError} />

      {error && <p className="errorText">{error}</p>}

      <div className="workspace">
        <ReportList reports={reports} selectedReportId={selectedReport?.id} onSelect={setSelectedReport} />
        <ReportDetail report={selectedReport} adminUser={adminUser} />
      </div>
    </div>
  );
}

function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const { adminUser, isCheckingRole } = useAdminUser(firebaseUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);
    });

    return unsubscribe;
  }, []);

  if (!isAuthReady || isCheckingRole) {
    return <main className="loginShell"><p>Loading...</p></main>;
  }

  if (!firebaseUser) return <LoginScreen />;

  if (!adminUser) {
    return (
      <main className="loginShell">
        <section className="loginPanel">
          <p className="eyebrow">SPOTZ Admin</p>
          <h1>Not authorized</h1>
          <p className="muted">Your account is signed in, but it does not have `role = admin` in Firestore.</p>
          <button type="button" onClick={() => signOut(auth)}>Sign out</button>
        </section>
      </main>
    );
  }

  return <Dashboard adminUser={adminUser} />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
