import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Hotel, 
  User, 
  LogOut, 
  LayoutDashboard, 
  ClipboardCheck, 
  Bed, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Plus, 
  Moon, 
  Check, 
  AlertCircle, 
  DollarSign,
  X,
  Clock,
  FastForward,
  Calendar,
  KeyRound,
  ShieldCheck,
  Minimize2,
  Maximize2,
  Filter,
  RefreshCw,
  Heart,
  Star,
  XCircle,
  Trash2,
  History,
  Brush
} from 'lucide-react';
import { 
  db, 
  auth,
  onAuthStateChanged,
  signInAnonymously,
  deleteDoc,
  collection, 
  doc, 
  addDoc,
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch
} from './lib/firebase';
import { UserProfile, UserRole, Room, RoomStatus, Booking, Task, GuestInfo } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, differenceInDays, addDays, isValid, isSameDay } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const ensureDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (typeof dateVal === 'string') return parseISO(dateVal);
  return new Date(dateVal);
};

const Button = ({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    outline: 'border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600',
    warning: 'bg-amber-500 text-white hover:bg-amber-600',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-medium rounded-md',
    md: 'px-4 py-2 text-sm font-medium rounded-lg',
    lg: 'px-6 py-3 text-base font-medium rounded-xl',
    icon: 'p-2 rounded-full',
  };

  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )} 
      {...props} 
    />
  );
};

const Card = ({ className, children, onClick, ...props }: { className?: string; children: React.ReactNode; onClick?: () => void; [key: string]: any }) => (
  <div 
    onClick={onClick}
    className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden', className)}
    {...props}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = 'default', className }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'; className?: string }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border border-rose-100',
    info: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
    outline: 'bg-white text-slate-600 border border-slate-200',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', variants[variant], className)}>
      {children}
    </span>
  );
};

// --- Rule Set ---

const ROOM_RULES = [
  { roomNumber: '101', type: 'Standard Single', basePrice: 50, maxAdults: 1, maxChildren: 1, extraBedAllowed: false, extraBedFee: 0 },
  { roomNumber: '102', type: 'Standard Double', basePrice: 80, maxAdults: 2, maxChildren: 0, extraBedAllowed: false, extraBedFee: 0 },
  { roomNumber: '103', type: 'Deluxe', basePrice: 120, maxAdults: 2, maxChildren: 1, extraBedAllowed: true, extraBedFee: 20 },
  { roomNumber: '104', type: 'Deluxe', basePrice: 120, maxAdults: 2, maxChildren: 1, extraBedAllowed: true, extraBedFee: 20 },
  { roomNumber: '105', type: 'Junior Suite', basePrice: 180, maxAdults: 3, maxChildren: 2, extraBedAllowed: true, extraBedFee: 0 },
];

// --- Views ---

const LoginView = ({ onLoginSuccess }: { onLoginSuccess: (profile: UserProfile) => void }) => {
  const [view, setView] = useState<'selection' | 'staff' | 'guest'>('selection');
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeData = async () => {
    setIsInitializing(true);
    try {
      // 1. Purge existing data to avoid duplicates
      const roomsSnap = await getDocs(collection(db, 'rooms'));
      for (const d of roomsSnap.docs) {
        await deleteDoc(doc(db, 'rooms', d.id));
      }

      const bookingsSnap = await getDocs(collection(db, 'bookings'));
      for (const d of bookingsSnap.docs) {
        await deleteDoc(doc(db, 'bookings', d.id));
      }

      const tasksSnap = await getDocs(collection(db, 'tasks'));
      for (const d of tasksSnap.docs) {
        await deleteDoc(doc(db, 'tasks', d.id));
      }

      // 2. Initialize Staff
      const demoStaff = [
        { name: 'Sarah Receptionist', staffId: 'REC001', password: 'hotel', role: 'Receptionist' },
        { name: 'James Housekeeper', staffId: 'HK001', password: 'clean', role: 'Housekeeper' },
        { name: 'Elena Housekeeper', staffId: 'HK002', password: 'clean', role: 'Housekeeper' },
      ];
      for (const s of demoStaff) {
        await setDoc(doc(db, 'users', s.staffId), s);
      }

      // 3. Initialize Rooms strictly based on Room Category Rule-Set
      const masterEmergencyCode = '999999';
      for (const rule of ROOM_RULES) {
        await setDoc(doc(db, 'rooms', rule.roomNumber), {
          ...rule,
          status: 'Available',
          isClean: true,
          dnd: false,
          urgentCleaning: false,
          lastCleaned: null,
          assignedTo: null,
          guestUid: null,
          accessCode: null,
          masterCode: masterEmergencyCode
        });
      }

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);

      // 4. Initialize Bookings
      const demoBookings = [
        { guestName: 'John Doe', roomNumber: '101', checkInDate: Timestamp.fromDate(pastDate), checkOutDate: Timestamp.now(), status: 'Active', totalBill: 240, accessCode: '123456' },
        { guestName: 'Jane Smith', roomNumber: '105', checkInDate: Timestamp.fromDate(pastDate), checkOutDate: Timestamp.fromDate(futureDate), status: 'Active', totalBill: 360, accessCode: '654321' }
      ];
      for (const b of demoBookings) {
        await addDoc(collection(db, 'bookings'), b);
      }

      alert("Demo data fully restored! Existing duplicates purged. Logins: REC001/hotel, HK001/clean.");
    } catch (err) {
      console.error(err);
      alert("Failed to initialize data. Check console for details.");
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);
    try {
      const staffDocRef = doc(db, 'users', staffId.trim().toUpperCase());
      const staffDoc = await getDoc(staffDocRef);
      
      if (staffDoc.exists()) {
        const data = staffDoc.data();
        if (data.password === password) {
          const profile = { uid: staffDoc.id, ...data } as UserProfile;
          onLoginSuccess(profile);
        } else {
          setError('Invalid password. Please try again.');
        }
      } else {
        setError('Staff ID not found. Please try again.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);
    try {
      const roomDocRef = doc(db, 'rooms', roomNumber);
      const roomDoc = await getDoc(roomDocRef);
      
      if (roomDoc.exists()) {
        const roomData = roomDoc.data();
        // Check both guest access code and master emergency code
        const isMasterCode = roomData.masterCode === accessCode;
        const isGuestCode = roomData.accessCode === accessCode;

        if (isGuestCode || isMasterCode) {
          const guestUid = isMasterCode ? `admin-override-${roomNumber}` : `guest-${roomNumber}-${Date.now()}`;
          
          const profile: UserProfile = {
            uid: guestUid,
            name: isMasterCode ? `Staff Entry (Room ${roomNumber})` : `Guest (Room ${roomNumber})`,
            role: 'Guest',
            unlockedRoomId: roomDoc.id
          };

          if (!isMasterCode) {
            await updateDoc(doc(db, 'rooms', roomDoc.id), { guestUid: guestUid });
          }
          
          onLoginSuccess(profile);
        } else {
          setError('Invalid Access Code.');
        }
      } else {
        setError('Room Number not found.');
      }
    } catch (err: any) {
      console.error('Guest login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (view === 'selection') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-4xl w-full p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 text-center md:text-left">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto md:mx-0">
                <Hotel className="text-white w-8 h-8" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">Hotelistan</h1>
                <p className="text-lg text-slate-500">Boutique experience, streamlined management.</p>
              </div>
              <div className="space-y-3 pt-4">
                <div className="flex items-center space-x-3 text-slate-600">
                  <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Real-time status tracking</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-600">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Smart cleaning assignments</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-600">
                  <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Digital guest access codes</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => setView('guest')}
                className="w-full group p-6 bg-white border-2 border-amber-100 rounded-2xl flex flex-col items-center hover:border-amber-400 transition-all hover:bg-amber-50/30"
              >
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Bed className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Guest Access</h3>
                <p className="text-sm text-slate-500">Log in with your room details</p>
              </button>

              <button 
                onClick={() => setView('staff')}
                className="w-full group p-6 bg-white border-2 border-indigo-100 rounded-2xl flex flex-col items-center hover:border-indigo-400 transition-all hover:bg-indigo-50/30"
              >
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Staff Portal</h3>
                <p className="text-sm text-slate-500">Internal management login</p>
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <button 
          onClick={() => setView('selection')}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white transition-all shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mx-auto w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
          {view === 'staff' ? <ShieldCheck className="w-8 h-8 text-indigo-600" /> : <Bed className="w-8 h-8 text-amber-600" />}
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {view === 'staff' ? 'Staff Login' : 'Guest Check-in'}
          </h1>
          <p className="text-sm text-slate-500">
            {view === 'staff' 
              ? 'Enter your credentials to access the dashboard' 
              : 'Enter your room number and 6-digit access code'}
          </p>
        </div>

        <form onSubmit={view === 'staff' ? handleStaffLogin : handleGuestLogin} className="space-y-4">
          {view === 'staff' ? (
            <>
              <div className="text-left space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Staff ID</label>
                <input 
                  id="staff-id-input"
                  type="text" 
                  value={staffId || ''}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="e.g. REC001"
                  required
                />
              </div>
              <div className="text-left space-y-1">
                <label htmlFor="staff-password-input" className="text-xs font-bold text-slate-500 uppercase ml-1">Password</label>
                <input 
                  id="staff-password-input"
                  type="password" 
                  value={password || ''}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="text-left space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Room Number</label>
                <input 
                  id="guest-room-input"
                  type="text" 
                  value={roomNumber || ''}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="e.g. 101"
                  required
                />
              </div>
              <div className="text-left space-y-1">
                <label htmlFor="guest-code-input" className="text-xs font-bold text-slate-500 uppercase ml-1">Access Code</label>
                <input 
                  id="guest-code-input"
                  type="password" 
                  value={accessCode || ''}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 tracking-[0.5em] text-center"
                  placeholder="••••••"
                  maxLength={6}
                  required
                />
              </div>
            </>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-medium">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full py-4 text-lg font-bold mt-2" 
            variant={view === 'staff' ? 'primary' : 'warning'}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Verifying...' : 'Continue'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

// --- Main App ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
};

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [housekeepers, setHousekeepers] = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fontSize, setFontSize] = useState(16);
  const [virtualTime, setVirtualTime] = useState(new Date());
  const [simDateOffset, setSimDateOffset] = useState(0); // days to add
  const [archivedTasks, setArchivedTasks] = useState<any[]>([]); // To store missed tasks
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'All'>('All');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedRoomDetails, setSelectedRoomDetails] = useState<Room | null>(null);
  const [isGuestDetailsModalOpen, setIsGuestDetailsModalOpen] = useState(false);
  const [isMissedTasksModalOpen, setIsMissedTasksModalOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newBooking, setNewBooking] = useState({ 
    guestName: '', 
    roomId: '', 
    checkInDate: format(new Date(), 'yyyy-MM-dd'),
    checkOutDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    adults: 1,
    children: 0,
    hasExtraBed: false,
    guests: [] as { name: string, idNumber: string, type: 'Adult' | 'Child' | 'Elderly' }[],
    isHoneymoon: false,
    isElderly: false,
  });
  const [lastGeneratedCode, setLastGeneratedCode] = useState<string | null>(null);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleFakePayment = async () => {
    if (!profile?.unlockedRoomId) return;
    
    setIsPaymentProcessing(true);
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update room status in Firestore
      await updateDoc(doc(db, 'rooms', profile.unlockedRoomId), {
        isPaid: true
      });
      
      setPaymentSuccess(true);
      alert("Payment Successful! Your bill has been settled.");
    } catch (err) {
      console.error("Payment sync failed:", err);
      alert("Payment simulated, but failed to sync with server.");
    } finally {
      setIsPaymentProcessing(false);
    }
  };

  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});
  const [hkViewMode, setHkViewMode] = useState<'assigned' | 'all'>('assigned');
  const [isRoomFixed, setIsRoomFixed] = useState(false);
  const [checkoutErrorRoomId, setCheckoutErrorRoomId] = useState<string | null>(null);

  const toggleRevealCode = (roomId: string) => {
    setRevealedCodes(prev => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  useEffect(() => {
    // Reset payment state when profile changes (e.g. login/logout)
    setPaymentSuccess(false);
    
    // If guest is logged in, check their room status for payment
    if (profile?.role === 'Guest' && profile.unlockedRoomId) {
      const room = rooms.find(r => r.id === profile.unlockedRoomId);
      if (room?.isPaid) {
        setPaymentSuccess(true);
      }
    }
  }, [profile, rooms]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      now.setDate(now.getDate() + simDateOffset);
      setVirtualTime(now);
    }, 1000);
    return () => clearInterval(timer);
  }, [simDateOffset]);

  const advanceTime = async (days: number) => {
    const prevDateStr = format(virtualTime, 'yyyy-MM-dd');
    const nextOffset = simDateOffset + days;
    setSimDateOffset(nextOffset);
    
    // Calculate final destination date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + nextOffset);
    const futureDateStr = format(futureDate, 'yyyy-MM-dd');

    // Archive missed tasks if day advanced
    if (futureDateStr !== prevDateStr) {
      const pendingTasks = tasks.filter(t => t.status === 'Pending');
      for (const t of pendingTasks) {
        await addDoc(collection(db, 'missed_tasks'), {
          ...t,
          archivedAt: Timestamp.fromDate(virtualTime),
          reason: days > 1 ? `Missed during ${days}-day jump` : 'Missed on Day Roll-over'
        });
        if (t.id) await deleteDoc(doc(db, 'tasks', t.id));
      }
    }

    // Process room states for each day advanced to ensure we catch all transitions
    // For simplicity in a simulation, we'll process the state for the 'futureDate'
    for (const room of rooms) {
      // Find the booking for this room that is active and starts today or earlier
      const activeBooking = bookings.find(b => b.roomNumber === room.roomNumber && b.status === 'Active');
      
      if (activeBooking) {
        const checkIn = ensureDate(activeBooking.checkInDate);
        const checkOut = ensureDate(activeBooking.checkOutDate);
        const checkInStr = format(checkIn, 'yyyy-MM-dd');
        const checkOutStr = format(checkOut, 'yyyy-MM-dd');

        if (futureDateStr >= checkOutStr) {
          // GUEST EXPIRED -> Stay in 'Occupied' but don't add tasks. 
          // The Receptionist will manually check them out.
        } else if (futureDateStr >= checkInStr) {
          // GUEST IS IN OR CHECKED IN TODAY
          if (room.status !== 'Occupied') {
            await updateDoc(doc(db, 'rooms', room.id), { status: 'Occupied' });
          }
          
          // Add Daily Cleaning & Setup
          await addDoc(collection(db, 'tasks'), {
            roomId: room.id,
            roomNumber: room.roomNumber,
            description: `Daily Cleaning & Stay-over Setup`,
            status: 'Pending',
            type: 'Cleaning',
            createdAt: Timestamp.now()
          });
          await updateDoc(doc(db, 'rooms', room.id), { isClean: false });
        }
      } else if (room.status === 'Occupied' && !activeBooking) {
        await updateRoomStatus(room.id, 'Dirty');
      } else if (room.status === 'Dirty') {
        // Still dirty from previous day? Add a new cleaning task for the new day
        await addDoc(collection(db, 'tasks'), {
          roomId: room.id,
          roomNumber: room.roomNumber,
          description: `Cleaning backlog from previous day`,
          status: 'Pending',
          type: 'Cleaning',
          createdAt: Timestamp.now()
        });
      }
    }
  };

  useEffect(() => {
    // Silent anonymous login to ensure Firestore rules work
    const ensureAuth = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          try {
            await signInAnonymously(auth);
          } catch (err) {
            console.error("Anonymous sign-in failed:", err);
          }
        }
      });
    };
    ensureAuth();

    // Check for local session
    const savedUser = localStorage.getItem('hotelistan_user');
    if (savedUser) {
      setProfile(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (profile: UserProfile) => {
    setProfile(profile);
    localStorage.setItem('hotelistan_user', JSON.stringify(profile));
  };

  const handleLogout = () => {
    setProfile(null);
    localStorage.removeItem('hotelistan_user');
  };

  useEffect(() => {
    if (!profile) return;

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Room));
      setRooms(roomsData);
    }, (error) => {
      console.error("Rooms listener error:", error);
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      setTasks(tasksData);
    }, (error) => {
      console.error("Tasks listener error:", error);
    });

    const unsubMissed = onSnapshot(collection(db, 'missed_tasks'), (snapshot) => {
      const missedData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setArchivedTasks(missedData);
    }, (error) => {
      console.error("Missed tasks listener error:", error);
    });

    let unsubHousekeepers: (() => void) | undefined;
    let unsubBookings: (() => void) | undefined;

    // All staff need to know who the housekeepers are for assignment labels
    if (profile?.role === 'Receptionist' || profile?.role === 'Housekeeper') {
      unsubHousekeepers = onSnapshot(
        query(collection(db, 'users'), where('role', '==', 'Housekeeper')),
        (snapshot) => {
          const hkData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
          setHousekeepers(hkData);
        },
        (error) => {
          console.error("Housekeepers listener error:", error);
        }
      );
    }

    if (profile?.role === 'Receptionist') {
      unsubBookings = onSnapshot(
        collection(db, 'bookings'),
        (snapshot) => {
          const bookingsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Booking));
          setBookings(bookingsData);
        },
        (error) => {
          console.error("Bookings listener error:", error);
        }
      );
    }

    return () => {
      unsubRooms();
      unsubTasks();
      if (unsubMissed) unsubMissed();
      if (unsubHousekeepers) unsubHousekeepers();
      if (unsubBookings) unsubBookings();
    };
  }, [profile?.uid, profile?.role]);

  const handleRoleSelect = async (role: UserRole) => {
    if (!profile) return;
    const newProfile: UserProfile = {
      ...profile,
      role
    };
    await setDoc(doc(db, 'users', profile.uid), newProfile);
    setProfile(newProfile);
  };

  const updateRoomStatus = async (roomId: string, status: RoomStatus) => {
    const room = rooms.find(r => r.id === roomId);
    const updateData: any = { 
      status,
      // Only force isClean to true for Ready/Available. 
      // If setting to Occupied, it depends on whether it was just cleaned or not.
      // But usually this function is called manually to change status.
    };

    if (status === 'Ready' || status === 'Available') {
      updateData.isClean = true;
    }
    
    if (status === 'Ready') {
      updateData.lastCleaned = Timestamp.now();
      updateData.urgentCleaning = false;
      updateData.assignedTo = null;
    }

    if (status === 'Dirty' || status === 'Available') {
      // Guest checked out or room is being reset
      if (room) {
        const activeBookings = bookings.filter(b => b.roomNumber === room.roomNumber && b.status === 'Active');
        for (const booking of activeBookings) {
          await updateDoc(doc(db, 'bookings', booking.id), { status: 'Completed' });
        }

        if (status === 'Dirty') {
          await addDoc(collection(db, 'tasks'), {
            roomId: room.id,
            roomNumber: room.roomNumber,
            description: `Post-Checkout Cleaning`,
            status: 'Pending',
            type: 'Cleaning',
            createdAt: Timestamp.now()
          });
        }
      }
      updateData.guestUid = null;
      updateData.accessCode = null;
      updateData.isPaid = false;
      updateData.dnd = false;
      updateData.urgentCleaning = false;
    }
    
    await updateDoc(doc(db, 'rooms', roomId), updateData);
  };

  const toggleDND = async (roomId: string, dnd: boolean) => {
    const updateData: any = { dnd };
    if (dnd) updateData.urgentCleaning = false;
    await updateDoc(doc(db, 'rooms', roomId), updateData);
  };

  const toggleUrgentCleaning = async (roomId: string, urgentCleaning: boolean) => {
    const updateData: any = { urgentCleaning };
    if (urgentCleaning) updateData.dnd = false;
    await updateDoc(doc(db, 'rooms', roomId), updateData);
  };

  const completeTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await updateDoc(doc(db, 'tasks', taskId), { status: 'Completed' });
      
      // Complete identical pending tasks
      const identicalPending = tasks.filter(t => t.roomId === task.roomId && t.type === task.type && t.id !== taskId && t.status === 'Pending');
      for (const t of identicalPending) {
        if (t.id) await updateDoc(doc(db, 'tasks', t.id), { status: 'Completed' });
      }

      // Delete identical tasks from missed_tasks
      const identicalMissed = archivedTasks.filter(t => t.roomId === task.roomId && t.type === task.type && t.id);
      for (const t of identicalMissed) {
        if (t.id) await deleteDoc(doc(db, 'missed_tasks', t.id));
      }

      // If it was a cleaning task and no more pending cleaning tasks for this room
      const otherPendingCleaning = tasks.filter(t => t.roomId === task.roomId && t.status === 'Pending' && t.type === 'Cleaning' && t.id !== taskId);
      if (task.type === 'Cleaning' && otherPendingCleaning.length === 0) {
        const room = rooms.find(r => r.id === task.roomId);
        if (room?.status === 'Occupied') {
          // Keep it occupied but mark as clean
          await updateDoc(doc(db, 'rooms', task.roomId), { 
            isClean: true, 
            lastCleaned: Timestamp.now(),
            urgentCleaning: false,
            assignedTo: null
          });
        } else {
          // If it wasn't occupied (e.g. it was Dirty), now it's Ready
          await updateRoomStatus(task.roomId, 'Ready');
        }
      }
    } catch (error) {
      console.error("Error completing task:", error);
    }
  };

  const assignRoom = async (roomId: string, housekeeperUid: string) => {
    try {
      await updateDoc(doc(db, 'rooms', roomId), { assignedTo: housekeeperUid });
    } catch (error) {
      console.error("Error assigning room:", error);
    }
  };

  const createBooking = async () => {
    if (!newBooking.guestName || !newBooking.roomId) return;

    try {
      const room = rooms.find(r => r.id === newBooking.roomId);
      if (!room) return;

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const checkInDate = ensureDate(newBooking.checkInDate);
      const checkOutDate = ensureDate(newBooking.checkOutDate);
      const nights = Math.max(1, differenceInDays(checkOutDate, checkInDate));
      
      // PRICING CALCULATION
      const basePrice = room.basePrice || 100;
      
      let extraBedFeeTotal = 0;
      if (newBooking.hasExtraBed && room.extraBedAllowed) {
        extraBedFeeTotal = (room.extraBedFee || 0);
      }

      const packageFee = newBooking.isHoneymoon ? 30 : 0;
      const subtotalPerNight = basePrice + extraBedFeeTotal + packageFee;
      const subtotal = subtotalPerNight * nights;
      
      let discount = 0;
      if (newBooking.isElderly) {
        discount = subtotal * 0.10; // 10% discount
      }
      
      const totalBill = subtotal - discount;

      const bookingData = {
        guestName: newBooking.guestName,
        roomNumber: room.roomNumber,
        checkInDate: Timestamp.fromDate(checkInDate),
        checkOutDate: Timestamp.fromDate(checkOutDate),
        status: 'Active',
        totalBill: totalBill,
        accessCode: code,
        adults: newBooking.adults,
        children: newBooking.children,
        guests: newBooking.guests,
        isHoneymoon: newBooking.isHoneymoon,
        isElderly: newBooking.isElderly,
        hasExtraBed: newBooking.hasExtraBed,
        packageFee: packageFee,
        discount: discount
      };

      await addDoc(collection(db, 'bookings'), bookingData);

      // Create Setup Tasks
      const tasksToCreate = [];
      tasksToCreate.push({
        roomId: room.id,
        roomNumber: room.roomNumber,
        description: `Daily Cleaning for ${newBooking.guestName}`,
        status: 'Pending',
        type: 'Cleaning',
        createdAt: Timestamp.now()
      });

      if (newBooking.isHoneymoon) {
        tasksToCreate.push({
          roomId: room.id,
          roomNumber: room.roomNumber,
          description: "Honeymoon Decor: Swap sheets for Silk/Red and add flowers",
          status: 'Pending',
          type: 'Setup',
          createdAt: Timestamp.now()
        });
      }

      if (newBooking.children > 0) {
        tasksToCreate.push({
          roomId: room.id,
          roomNumber: room.roomNumber,
          description: "Child Setup: Add 1 extra small towel + crib if needed",
          status: 'Pending',
          type: 'Setup',
          createdAt: Timestamp.now()
        });
        if (room.type === 'Junior Suite') {
           tasksToCreate.push({
             roomId: room.id,
             roomNumber: room.roomNumber,
             description: "Suite Special: Add 1 glass of milk/cookie",
             status: 'Pending',
             type: 'Setup',
             createdAt: Timestamp.now()
           });
        }
      }

      for (const t of tasksToCreate) {
        await addDoc(collection(db, 'tasks'), t);
      }

      const updateData: any = { 
        status: isSameDay(checkInDate, virtualTime) || checkInDate < virtualTime ? 'Occupied' : 'Reserved',
        isClean: false,
        accessCode: code,
        isPaid: false,
        guestUid: null
      };
      await updateDoc(doc(db, 'rooms', newBooking.roomId), updateData);
      
      setLastGeneratedCode(code);
    } catch (error) {
      console.error('Error creating booking:', error);
    }
  };

  const filteredRooms = useMemo(() => {
    if (filterStatus === 'All') return rooms;
    return rooms.filter(r => r.status === filterStatus);
  }, [rooms, filterStatus]);

  const urgentCheckouts = useMemo(() => {
    const overdue = bookings.filter(b => {
      if (b.status !== 'Active') return false;
      if (!b.checkOutDate) return false;
      return b.checkOutDate.toDate() <= virtualTime;
    });

    const uniqueByRoom: Record<string, typeof bookings[0]> = {};
    overdue.forEach(b => {
      // Keep the one with the latest checkout date if multiple exist, 
      // or just ensure we don't duplicate on the UI
      if (!uniqueByRoom[b.roomNumber] || b.checkOutDate.toDate() > uniqueByRoom[b.roomNumber].checkOutDate.toDate()) {
        uniqueByRoom[b.roomNumber] = b;
      }
    });

    return Object.values(uniqueByRoom);
  }, [bookings, virtualTime]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading Hotelistan...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const { role } = profile;

  return (
    <div 
      className="min-h-screen bg-slate-50 text-slate-900" 
      style={{ fontSize: `${fontSize}px` }}
    >
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <Hotel className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">Hotelistan</span>
          </div>

          <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-4 px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex items-center space-x-2 text-indigo-600">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-bold tabular-nums">
                  {virtualTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex items-center space-x-2 text-slate-600 relative group">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {virtualTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {simDateOffset !== 0 && (
                <button 
                  onClick={() => setSimDateOffset(0)}
                  className="p-1 hover:bg-indigo-50 rounded-full text-indigo-600 transition-colors"
                  title="Reset to Today"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex items-center space-x-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-indigo-600"
                  onClick={() => advanceTime(1)}
                  title="Advance 1 Day"
                >
                  <FastForward className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <div className="w-px h-4 bg-slate-200 mx-1" />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => setFontSize(prev => Math.min(24, prev + 2))}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none">{profile.name}</p>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{profile.role}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5 text-slate-400" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {profile.role === 'Receptionist' && (
            <motion.div 
              key="receptionist"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Reception Dashboard</h2>
                  <p className="text-slate-500">Manage room assignments and guest check-ins.</p>
                </div>
                <div className="flex items-center space-x-2">
                  {archivedTasks.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => setIsMissedTasksModalOpen(true)}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Missed Tasks ({archivedTasks.length})
                    </Button>
                  )}
                  <div className="relative group">
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      {filterStatus === 'All' ? 'Filter' : filterStatus}
                    </Button>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      {['All', 'Available', 'Occupied', 'Dirty', 'Ready'].map((status) => (
                        <button
                          key={status}
                          className={cn(
                            "w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors",
                            filterStatus === status ? "text-indigo-600 font-bold" : "text-slate-600"
                          )}
                          onClick={() => setFilterStatus(status as any)}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => {
                    setLastGeneratedCode(null);
                    setNewBooking({ 
                      guestName: '', 
                      roomId: '', 
                      checkInDate: format(virtualTime, 'yyyy-MM-dd'),
                      checkOutDate: format(addDays(virtualTime, 1), 'yyyy-MM-dd'),
                      adults: 1,
                      children: 0,
                      hasExtraBed: false,
                      guests: [],
                      isHoneymoon: false,
                      isElderly: false
                    });
                    setIsRoomFixed(false);
                    setIsBookingModalOpen(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Booking
                  </Button>
                </div>
              </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Available', count: rooms.filter(r => r.status === 'Available').length, color: 'emerald', icon: CheckCircle2 },
                  { label: 'Occupied', count: rooms.filter(r => r.status === 'Occupied').length, color: 'indigo', icon: Bed },
                  { label: 'Dirty', count: rooms.filter(r => r.status === 'Dirty').length, color: 'rose', icon: AlertTriangle },
                  { label: 'Ready', count: rooms.filter(r => r.status === 'Ready').length, color: 'amber', icon: Sparkles },
                ].map((stat) => (
                  <Card key={stat.label} className="p-4 flex items-center space-x-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                      stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                      stat.color === 'rose' ? "bg-rose-50 text-rose-600" :
                      "bg-amber-50 text-amber-600"
                    )}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                      <p className="text-xl font-bold">{stat.count}</p>
                    </div>
                  </Card>
                ))}
              </div>

              {urgentCheckouts.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-rose-600 flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      Immediate Checkouts Due
                    </h3>
                    <Badge variant="danger">{urgentCheckouts.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {urgentCheckouts.map(booking => {
                      const room = rooms.find(r => r.roomNumber === booking.roomNumber);
                      return (
                        <Card key={booking.id} className="p-4 border-rose-200 bg-rose-50/50 flex justify-between items-center">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                              <Bed className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold">Room {booking.roomNumber}</p>
                              <p className="text-xs text-slate-500">{booking.guestName}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <p className="text-xs font-bold text-rose-500 uppercase">Check-out Overdue</p>
                              <p className="text-[10px] text-slate-400">Due: {booking.checkOutDate?.toDate().toLocaleDateString()}</p>
                            </div>
                            {room && (
                              <div className="flex flex-col items-end gap-1">
                                <Button 
                                  variant="danger" 
                                  size="sm" 
                                  onClick={() => {
                                    if (!room.isPaid) {
                                      setCheckoutErrorRoomId(room.id);
                                      setTimeout(() => setCheckoutErrorRoomId(null), 3000);
                                      return;
                                    }
                                    updateRoomStatus(room.id, 'Dirty');
                                  }}
                                >
                                  {checkoutErrorRoomId === room.id ? "Unpaid Bill!" : "Check Out"}
                                </Button>
                                {checkoutErrorRoomId === room.id && <span className="text-[10px] text-rose-500 font-bold">Requires Payment</span>}
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredRooms.map((room) => (
                  <Card key={room.id} className="group hover:border-indigo-200 transition-all">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-lg font-bold">Room {room.roomNumber}</span>
                          {room.isPaid && <Badge variant="success" className="w-fit text-[10px] py-0">Paid</Badge>}
                        </div>
                        <Badge variant={
                          room.status === 'Available' ? 'success' :
                          room.status === 'Occupied' ? 'info' :
                          room.status === 'Dirty' ? 'danger' : 'warning'
                        }>
                          {room.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">{room.type}</p>
                      
                      <div className="flex items-center space-x-2 pt-2">
                        <button 
                          onClick={() => toggleDND(room.id, !room.dnd)}
                          className="focus:outline-none"
                        >
                          <Badge variant={room.dnd ? "danger" : "default"}>DND</Badge>
                        </button>
                        {room.urgentCleaning && <Badge variant="warning">URGENT</Badge>}
                        
                        <div className="ml-auto">
                          {room.status === 'Occupied' && room.accessCode ? (
                            <button 
                              onClick={() => toggleRevealCode(room.id)}
                              className="focus:outline-none"
                              title="Guest Access Code"
                            >
                              <Badge variant="outline" className="font-mono text-indigo-600 border-indigo-200">
                                {revealedCodes[room.id] ? room.accessCode : "🔑 CODE"}
                              </Badge>
                            </button>
                          ) : (
                            <button 
                              onClick={() => toggleRevealCode(room.id)}
                              className="focus:outline-none"
                              title="Emergency Access Code"
                            >
                              <Badge variant="outline" className="font-mono text-slate-400 border-slate-100">
                                {revealedCodes[room.id] ? "999999" : "🔑 CODE"}
                              </Badge>
                            </button>
                          )}
                        </div>
                      </div>

                      {room.status === 'Occupied' && (
                        <div className="pt-2 border-t border-slate-50 mt-2 space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Current Bill</span>
                            <span className="text-indigo-600">
                              ${bookings.find(b => b.roomNumber === room.roomNumber && b.status === 'Active')?.totalBill || 0}
                            </span>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-[10px] h-7 border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                            onClick={() => {
                              setSelectedRoomDetails(room);
                              setIsGuestDetailsModalOpen(true);
                            }}
                          >
                            <User className="w-3 h-3 mr-1" />
                            Guest Details
                          </Button>
                        </div>
                      )}

                      <div className="pt-4 flex flex-col space-y-2">
                        {(room.status === 'Dirty' || room.urgentCleaning) && (
                          <div className="relative group/assign">
                            <Button variant="outline" size="sm" className="w-full">
                              {room.assignedTo 
                                ? `Assigned: ${housekeepers.find(h => h.uid === room.assignedTo)?.name || 'Unknown'}` 
                                : 'Assign Staff'}
                            </Button>
                            <div className="absolute left-0 bottom-full mb-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 opacity-0 invisible group-hover/assign:opacity-100 group-hover/assign:visible transition-all z-50">
                              <p className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase">Select Housekeeper</p>
                              {housekeepers.map((hk) => (
                                <button
                                  key={hk.uid}
                                  className={cn(
                                    "w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors",
                                    room.assignedTo === hk.uid ? "text-indigo-600 font-bold" : "text-slate-600"
                                  )}
                                  onClick={() => assignRoom(room.id, hk.uid)}
                                >
                                  {hk.name}
                                </button>
                              ))}
                              {housekeepers.length === 0 && (
                                <p className="px-4 py-2 text-xs text-slate-400 italic">No staff available</p>
                              )}
                            </div>
                          </div>
                        )}
                        {room.status === 'Available' && (
                          <Button 
                            variant="primary" 
                            size="sm" 
                            className="w-full" 
                            onClick={() => {
                              setLastGeneratedCode(null);
                              setNewBooking({ 
                                guestName: '', 
                                roomId: room.id, 
                                checkInDate: format(virtualTime, 'yyyy-MM-dd'),
                                checkOutDate: format(addDays(virtualTime, 1), 'yyyy-MM-dd'),
                                adults: 1,
                                children: 0,
                                hasExtraBed: false,
                                guests: [],
                                isHoneymoon: false,
                                isElderly: false
                              });
                              setIsRoomFixed(true);
                              setIsBookingModalOpen(true);
                            }}
                          >
                            Check In
                          </Button>
                        )}
                        {room.status === 'Occupied' && (
                          <div className="w-full flex justify-center">
                            <Button 
                              variant={checkoutErrorRoomId === room.id ? "danger" : "outline"} 
                              size="sm" 
                              className="w-full" 
                              onClick={() => {
                                if (!room.isPaid) {
                                  setCheckoutErrorRoomId(room.id);
                                  setTimeout(() => setCheckoutErrorRoomId(null), 3000);
                                  return;
                                }
                                updateRoomStatus(room.id, 'Dirty');
                              }}
                            >
                              {checkoutErrorRoomId === room.id ? "Guest hasn't paid!" : "Check Out"}
                            </Button>
                          </div>
                        )}
                        {room.status === 'Ready' && (
                          <Button variant="success" size="sm" className="w-full" onClick={() => updateRoomStatus(room.id, 'Available')}>Mark Available</Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {profile.role === 'Housekeeper' && (
            <motion.div 
              key="housekeeper"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Housekeeping Dashboard</h2>
                  <p className="text-slate-500">View and complete cleaning assignments by room.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button 
                      onClick={() => setHkViewMode('assigned')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        hkViewMode === 'assigned' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      My Rooms
                    </button>
                    <button 
                      onClick={() => setHkViewMode('all')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        hkViewMode === 'all' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      All Tasks
                    </button>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsMissedTasksModalOpen(true)}
                    className="bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100"
                  >
                    <History className="w-4 h-4 mr-2" />
                    Archive ({archivedTasks.length})
                  </Button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                    {hkViewMode === 'assigned' ? 'Your Active Assignments' : 'All Pending Tasks'}
                  </h3>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                
                {(() => {
                  const pendingTasks = tasks.filter(t => t.status === 'Pending');

                  const roomsToShow = rooms.filter(room => {
                    // Check assignment
                    if (hkViewMode === 'assigned' && room.assignedTo !== profile.uid) return false;
                    
                    // Check if it has tasks
                    const hasTasks = pendingTasks.some(t => t.roomId === room.id || t.roomNumber === room.roomNumber);
                    if (hasTasks) return true;
                    
                    // Or if it's explicitly dirty but has no tasks (fallback for manually deleted tasks)
                    if (room.status === 'Dirty') return true;
                    
                    return false;
                  });

                  const sortedRooms = [...roomsToShow].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));

                  if (sortedRooms.length === 0) {
                    return (
                      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                        <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                          <Check className="text-emerald-500 w-8 h-8" />
                        </div>
                        <h4 className="text-xl font-bold text-slate-900">All caught up!</h4>
                        <p className="text-slate-400 mt-1 max-w-sm mx-auto">No pending cleaning tasks assigned to you at this time.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid gap-6">
                      {sortedRooms.map(room => {
                        const roomNum = room.roomNumber;
                        const roomTasks = pendingTasks.filter(t => t.roomId === room.id || t.roomNumber === roomNum);
                        const isUrgent = room.urgentCleaning;
                        const isDND = room.dnd;
                        const assignedHk = housekeepers.find(h => h.uid === room.assignedTo);
                        
                        // Fake a default task if dirty and has no tasks
                        const hasNoTasksButDirty = roomTasks.length === 0 && room.status === 'Dirty';

                        return (
                          <Card key={roomNum} className={cn(
                            "overflow-hidden border-2 transition-all",
                            isUrgent ? "border-amber-200 shadow-amber-50" : "border-slate-100",
                            isDND && "opacity-80 grayscale-[0.5]",
                            room.assignedTo === profile.uid && "ring-2 ring-indigo-500/20 border-indigo-100"
                          )}>
                            <div className={cn(
                              "px-6 py-4 flex items-center justify-between border-b",
                              isUrgent ? "bg-amber-50 border-amber-100" : 
                              room.assignedTo === profile.uid ? "bg-indigo-50/30 border-indigo-100" : "bg-slate-50 border-slate-100"
                            )}>
                              <div className="flex items-center space-x-3">
                                <span className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg",
                                  isUrgent ? "bg-amber-200 text-amber-700" : "bg-white text-slate-700 shadow-sm"
                                )}>
                                  {roomNum}
                                </span>
                                <div>
                                  <h4 className="font-bold text-slate-900">Room {roomNum}</h4>
                                  <div className="flex gap-2 mt-0.5">
                                    {isUrgent && <Badge variant="warning">Urgent</Badge>}
                                    {isDND && <Badge variant="danger">Guest DND</Badge>}
                                    <Badge variant="outline">{hasNoTasksButDirty ? 1 : roomTasks.length} {hasNoTasksButDirty || roomTasks.length === 1 ? 'Task' : 'Tasks'}</Badge>
                                    {room.assignedTo === profile.uid && <Badge variant="info">Your Assignment</Badge>}
                                  </div>
                                </div>
                              </div>
                              
                              {isDND ? (
                                <div className="flex items-center text-rose-600 bg-white px-3 py-1.5 rounded-full border border-rose-100 text-xs font-bold uppercase tracking-tight">
                                  <Moon className="w-3.5 h-3.5 mr-1.5" />
                                  Access Blocked
                                </div>
                              ) : (
                                <div className="text-xs font-medium text-slate-400 italic">
                                  Assignee: {assignedHk?.name || 'Unassigned'}
                                </div>
                              )}
                            </div>

                            <div className="p-4 space-y-3 bg-white">
                              {roomTasks.map(task => (
                                <div key={task.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                  <div className="flex items-center space-x-3">
                                    <div className={cn(
                                      "w-8 h-8 rounded-lg flex items-center justify-center",
                                      task.type === 'Setup' ? "bg-indigo-50 text-indigo-500" : "bg-rose-50 text-rose-500"
                                    )}>
                                      {task.type === 'Setup' ? <Sparkles className="w-4 h-4" /> : <Brush className="w-4 h-4" />}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-700">{task.type}</p>
                                      <p className="text-xs text-slate-500">{task.description}</p>
                                    </div>
                                  </div>
                                  {!isDND && (
                                    <Button 
                                      variant="success" 
                                      size="sm"
                                      className="rounded-lg h-9"
                                      onClick={() => completeTask(task.id!)}
                                    >
                                      <Check className="w-4 h-4 mr-1.5" />
                                      Done
                                    </Button>
                                  )}
                                </div>
                              ))}

                              {/* Display Fallback Task if room is dirty but tasks are missing */}
                              {hasNoTasksButDirty && (
                                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-50 text-rose-500">
                                      <Brush className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-700">Cleaning</p>
                                      <p className="text-xs text-slate-500">Standard Room Cleaning</p>
                                    </div>
                                  </div>
                                  {!isDND && (
                                    <Button 
                                      variant="success" 
                                      size="sm"
                                      className="rounded-lg h-9"
                                      onClick={async () => {
                                        await updateRoomStatus(room.id, 'Ready');
                                        await updateDoc(doc(db, 'rooms', room.id), { assignedTo: null });
                                      }}
                                    >
                                      <Check className="w-4 h-4 mr-1.5" />
                                      Done
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}

          {profile.role === 'Guest' && (
            <motion.div 
              key="guest"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Welcome, {profile.name}</h2>
                <p className="text-slate-500">Manage your stay and room preferences.</p>
              </div>

              {(() => {
                const myRoom = rooms.find(r => r.id === profile.unlockedRoomId || r.guestUid === profile.uid);
                if (myRoom) {
                  return (
                    <div className="space-y-6">
                      <Card className="p-8 text-center space-y-6 bg-indigo-600 text-white border-none shadow-xl shadow-indigo-200">
                        <div className="mx-auto w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-sm">
                          <Bed className="w-10 h-10" />
                        </div>
                        <div>
                          <p className="text-indigo-100 font-medium uppercase tracking-widest text-xs mb-1">Your Room</p>
                          <h3 className="text-4xl font-bold">Room {myRoom.roomNumber}</h3>
                          <div className="flex items-center justify-center space-x-2 mt-4 text-indigo-100 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>Stay until {
                              bookings.find(b => b.roomNumber === myRoom.roomNumber && b.status === 'Active')
                                ?.checkOutDate?.toDate().toLocaleDateString() || 'N/A'
                            }</span>
                          </div>
                        </div>
                      </Card>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card 
                          className={cn(
                            "p-6 cursor-pointer transition-all border-2",
                            myRoom.dnd ? "border-rose-500 bg-rose-50" : "border-transparent hover:border-slate-200"
                          )}
                          onClick={() => toggleDND(myRoom.id, !myRoom.dnd)}
                        >
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                            myRoom.dnd ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-600"
                          )}>
                            <Moon className="w-6 h-6" />
                          </div>
                          <h4 className="text-lg font-bold">Do Not Disturb</h4>
                          <p className="text-sm text-slate-500 mt-1">Toggle to prevent staff entry.</p>
                        </Card>

                        <Card 
                          className={cn(
                            "p-6 cursor-pointer transition-all border-2",
                            myRoom.urgentCleaning ? "border-amber-500 bg-amber-50" : "border-transparent hover:border-slate-200"
                          )}
                          onClick={() => toggleUrgentCleaning(myRoom.id, !myRoom.urgentCleaning)}
                        >
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                            myRoom.urgentCleaning ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"
                          )}>
                            <Sparkles className="w-6 h-6" />
                          </div>
                          <h4 className="text-lg font-bold">Urgent Cleaning</h4>
                          <p className="text-sm text-slate-500 mt-1">Request immediate cleaning.</p>
                        </Card>
                      </div>

                      <Card className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="font-bold text-slate-900 text-lg">Current Bill</h4>
                          <DollarSign className="text-emerald-500 w-6 h-6" />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-3xl font-black text-slate-900">
                              ${bookings.find(b => b.roomNumber === myRoom.roomNumber && b.status === 'Active')?.totalBill || 0}
                            </p>
                            <p className="text-xs text-slate-500 font-medium">Room & Included Services</p>
                          </div>
                          <Button 
                            variant={paymentSuccess ? "success" : "primary"} 
                            size="lg" 
                            className="rounded-xl shadow-lg shadow-indigo-100 min-w-[120px]"
                            onClick={handleFakePayment}
                            disabled={isPaymentProcessing || paymentSuccess}
                          >
                            {isPaymentProcessing ? "Processing..." : paymentSuccess ? "Paid" : "Pay Now"}
                          </Button>
                        </div>
                      </Card>
                    </div>
                  );
                }
                return (
                  <Card className="p-12 text-center space-y-4">
                    <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold">Room Access Expired</h3>
                    <p className="text-slate-500">Your session for this room has ended or is invalid. Please log in again.</p>
                    <Button variant="outline" onClick={handleLogout}>Back to Login</Button>
                  </Card>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* New Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsBookingModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  {newBooking.roomId && rooms.find(r => r.id === newBooking.roomId) 
                    ? `Check In Room ${rooms.find(r => r.id === newBooking.roomId)?.roomNumber}` 
                    : 'New Booking'}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => {
                  setIsBookingModalOpen(false);
                  setLastGeneratedCode(null);
                  setNewBooking({ 
                    guestName: '', 
                    roomId: '', 
                    checkInDate: format(virtualTime, 'yyyy-MM-dd'),
                    checkOutDate: format(addDays(virtualTime, 1), 'yyyy-MM-dd'),
                    adults: 1,
                    children: 0,
                    guests: [],
                    isHoneymoon: false,
                    isElderly: false
                  });
                }}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {lastGeneratedCode ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Booking Confirmed!</p>
                      <p className="text-xs text-slate-400 mt-1">Please provide this code to the guest:</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <span className="text-4xl font-black tracking-[0.2em] text-indigo-600">{lastGeneratedCode}</span>
                    </div>
                    <Button variant="primary" className="w-full" onClick={() => {
                      setIsBookingModalOpen(false);
                      setLastGeneratedCode(null);
                      setNewBooking({ 
                        guestName: '', 
                        roomId: '', 
                        checkInDate: format(virtualTime, 'yyyy-MM-dd'),
                        checkOutDate: format(addDays(virtualTime, 1), 'yyyy-MM-dd'),
                        adults: 1,
                        children: 0,
                        guests: [],
                        isHoneymoon: false,
                        isElderly: false
                      });
                    }}>
                      Done
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Primary Guest Name</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="Enter guest name"
                        value={newBooking.guestName || ''}
                        onChange={(e) => setNewBooking(prev => ({ ...prev, guestName: e.target.value }))}
                        autoFocus
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Adults</label>
                        <select 
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                          value={String(newBooking.adults || 1)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setNewBooking(prev => {
                              const next = { ...prev, adults: val };
                              // Auto-check extra bed if count exceeds base capacity (usually 2 for most hotel rooms)
                              // If total guests > 2, we likely need an extra bed if the room allows it.
                              const room = rooms.find(r => r.id === next.roomId);
                              if (room && room.extraBedAllowed) {
                                if (val + next.children > (room.maxAdults + room.maxChildren - 1)) {
                                  next.hasExtraBed = true;
                                } else {
                                  next.hasExtraBed = false;
                                }
                              } else {
                                next.hasExtraBed = false;
                              }
                              return next;
                            });
                          }}
                        >
                          {[1, 2, 3].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Adult' : 'Adults'}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Children</label>
                        <select 
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                          value={String(newBooking.children || 0)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setNewBooking(prev => {
                              const next = { ...prev, children: val };
                              const room = rooms.find(r => r.id === next.roomId);
                              if (room && room.extraBedAllowed) {
                                if (next.adults + val > (room.maxAdults + room.maxChildren - 1)) {
                                  next.hasExtraBed = true;
                                } else {
                                  next.hasExtraBed = false;
                                }
                              } else {
                                next.hasExtraBed = false;
                              }
                              return next;
                            });
                          }}
                        >
                          {[0, 1, 2].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Child' : 'Children'}</option>)}
                        </select>
                      </div>
                    </div>
 
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Select Room</label>
                      <select 
                        className={cn(
                          "w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white",
                          isRoomFixed && "bg-slate-50 cursor-not-allowed opacity-70"
                        )}
                        value={newBooking.roomId || ''}
                        disabled={isRoomFixed}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBooking(prev => {
                            const next = { ...prev, roomId: val };
                            const room = rooms.find(r => r.id === val);
                            if (room && room.extraBedAllowed) {
                              if (next.adults + next.children > (room.maxAdults + room.maxChildren - 1)) {
                                next.hasExtraBed = true;
                              } else {
                                next.hasExtraBed = false;
                              }
                            } else {
                              next.hasExtraBed = false;
                            }
                            return next;
                          });
                        }}
                      >
                        <option value="">Choose a room</option>
                        {rooms
                          .filter(r => r.status === 'Available' || r.status === 'Ready' || (isRoomFixed && r.id === newBooking.roomId))
                          .map(room => {
                            const totalGuests = newBooking.adults + newBooking.children;
                            const maxTotal = room.maxAdults + room.maxChildren + (room.extraBedAllowed ? 1 : 0);
                            
                            const tooManyAdults = newBooking.adults > room.maxAdults;
                            const tooManyChildren = newBooking.children > room.maxChildren;
                            const tooManyTotal = totalGuests > maxTotal;
                            
                            const isEligible = !tooManyAdults && !tooManyChildren && !tooManyTotal;

                            let reason = "";
                            if (tooManyAdults) reason = ` (Max ${room.maxAdults} Adults)`;
                            else if (tooManyChildren) reason = ` (Max ${room.maxChildren} Children)`;
                            else if (tooManyTotal) reason = ` (Exceeds Total Pool of ${maxTotal})`;

                            return (
                              <option 
                                key={room.id} 
                                value={isEligible ? room.id : ""} 
                                disabled={!isEligible}
                                className={!isEligible ? "text-slate-400 italic" : "text-slate-900"}
                              >
                                Room {room.roomNumber} ({room.type}){reason ? reason : ` - $${room.basePrice}/night`}
                              </option>
                            );
                          })}
                      </select>
                      {newBooking.roomId === "" && (newBooking.adults > 0) && (
                        <p className="text-[10px] text-slate-400 italic px-2">
                          * Only rooms matching your guest count are selectable.
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase">Special Status</p>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" 
                            checked={newBooking.isHoneymoon}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, isHoneymoon: e.target.checked }))}
                          />
                          <span className="text-sm text-slate-700">Honeymoon</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" 
                            checked={newBooking.isElderly}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, isElderly: e.target.checked }))}
                          />
                          <span className="text-sm text-slate-700">Elderly</span>
                        </label>

                        {(() => {
                          const room = rooms.find(r => r.id === newBooking.roomId);
                          if (room?.extraBedAllowed) {
                            return (
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500" 
                                  checked={newBooking.hasExtraBed}
                                  onChange={(e) => setNewBooking(prev => ({ ...prev, hasExtraBed: e.target.checked }))}
                                />
                                <span className="text-sm text-slate-700">
                                  Extra Bed {room.extraBedFee > 0 ? `(+$${room.extraBedFee})` : '(Free)'}
                                </span>
                              </label>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Check In</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white text-sm"
                          value={newBooking.checkInDate || ''}
                          min={format(virtualTime, 'yyyy-MM-dd')}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                              setNewBooking(prev => ({ ...prev, checkInDate: val }));
                              return;
                            }
                            const checkIn = ensureDate(val);
                            if (isValid(checkIn)) {
                              setNewBooking(prev => {
                                const checkOut = ensureDate(prev.checkOutDate);
                                return {
                                  ...prev,
                                  checkInDate: val,
                                  checkOutDate: (!isValid(checkOut) || checkIn >= checkOut)
                                    ? format(addDays(checkIn, 1), 'yyyy-MM-dd')
                                    : prev.checkOutDate
                                };
                              });
                            } else {
                              setNewBooking(prev => ({ ...prev, checkInDate: val }));
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Check Out</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white text-sm"
                          value={newBooking.checkOutDate || ''}
                          min={isValid(ensureDate(newBooking.checkInDate)) ? format(addDays(ensureDate(newBooking.checkInDate), 1), 'yyyy-MM-dd') : ''}
                          onChange={(e) => setNewBooking(prev => ({ ...prev, checkOutDate: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-indigo-700">
                          <Moon className="w-4 h-4" />
                          <span className="text-sm font-bold">
                            {(() => {
                              const cin = ensureDate(newBooking.checkInDate);
                              const cout = ensureDate(newBooking.checkOutDate);
                              return isValid(cin) && isValid(cout) ? `${Math.max(1, differenceInDays(cout, cin))} Nights` : 'Calculating...';
                            })()}
                          </span>
                        </div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Pricing Breakdown</p>
                      </div>
                      
                      <div className="space-y-1 pt-2 border-t border-indigo-100">
                        {(() => {
                          const room = rooms.find(r => r.id === newBooking.roomId);
                        const cin = ensureDate(newBooking.checkInDate);
                        const cout = ensureDate(newBooking.checkOutDate);
                          if (!room || !isValid(cin) || !isValid(cout)) return <p className="text-xs text-indigo-400 italic text-center">Select a room and dates to see estimate</p>;
                          
                          const nights = Math.max(1, differenceInDays(cout, cin));
                          const base = room.basePrice * nights;
                          const packageFee = newBooking.isHoneymoon ? 30 * nights : 0;
                          const extraBed = (room.type === 'Deluxe' && (newBooking.adults + newBooking.children) > 2) ? 20 * nights : 0;
                          const subtotal = base + packageFee + extraBed;
                          const discount = newBooking.isElderly ? subtotal * 0.10 : 0;
                          
                          return (
                            <div className="text-[11px] space-y-1">
                              <div className="flex justify-between text-indigo-600">
                                <span>Base Rate ({room.type})</span>
                                <span>${base}.00</span>
                              </div>
                              {packageFee > 0 && (
                                <div className="flex justify-between text-indigo-600">
                                  <span>Honeymoon Package</span>
                                  <span>+${packageFee}.00</span>
                                </div>
                              )}
                              {extraBed > 0 && (
                                <div className="flex justify-between text-indigo-600">
                                  <span>Extra Bed Fee</span>
                                  <span>+${extraBed}.00</span>
                                </div>
                              )}
                              {discount > 0 && (
                                <div className="flex justify-between text-emerald-600 font-bold">
                                  <span>Elderly Discount (10%)</span>
                                  <span>-${discount.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-indigo-900 font-black text-sm pt-1 border-t border-indigo-200 mt-1">
                                <span>Total Bill</span>
                                <span>${(subtotal - discount).toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {!lastGeneratedCode && (
                <div className="p-6 bg-slate-50 flex items-center justify-end space-x-3 border-t border-slate-100">
                  <Button variant="ghost" onClick={() => setIsBookingModalOpen(false)}>Cancel</Button>
                  <Button 
                    variant="primary" 
                    onClick={createBooking} 
                    disabled={
                      !newBooking.guestName || 
                      !newBooking.roomId || 
                      (() => {
                        const room = rooms.find(r => r.id === newBooking.roomId);
                        if (!room) return true;
                        const totalGuests = newBooking.adults + newBooking.children;
                        const maxTotal = room.maxAdults + room.maxChildren + (room.extraBedAllowed ? 1 : 0);
                        return newBooking.adults > room.maxAdults || totalGuests > maxTotal;
                      })()
                    }
                  >
                    {(() => {
                      const room = rooms.find(r => r.id === newBooking.roomId);
                      if (room) {
                        const totalGuests = newBooking.adults + newBooking.children;
                        const maxTotal = room.maxAdults + room.maxChildren + (room.extraBedAllowed ? 1 : 0);
                        if (newBooking.adults > room.maxAdults) return "Too Many Adults";
                        if (newBooking.children > room.maxChildren) return "Too Many Children";
                        if (totalGuests > maxTotal) return "Exceeds Total Capacity";
                      }
                      return "Check In & Generate Code";
                    })()}
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Guest Details Modal */}
        {isGuestDetailsModalOpen && selectedRoomDetails && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsGuestDetailsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <div>
                  <h3 className="text-xl font-bold">Room {selectedRoomDetails.roomNumber} - Guest Information</h3>
                  <p className="text-indigo-100 text-sm">{selectedRoomDetails.type}</p>
                </div>
                <button onClick={() => setIsGuestDetailsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {(() => {
                  const booking = bookings.find(b => b.roomNumber === selectedRoomDetails.roomNumber && b.status === 'Active');
                  if (!booking) return <p className="text-center py-8 text-slate-400">No active booking found for this room.</p>;

                  const nights = differenceInDays(ensureDate(booking.checkOutDate), ensureDate(booking.checkInDate));

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Primary Guest</p>
                          <p className="font-bold text-slate-700">{booking.guestName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Access Code</p>
                          <p className="font-mono font-bold text-indigo-600 tracking-wider">
                            {selectedRoomDetails.accessCode}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Check-In</p>
                          <p className="text-sm text-slate-600 font-medium">{format(ensureDate(booking.checkInDate), 'EEE, MMM d, yyyy')}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Check-Out</p>
                          <p className="text-sm text-slate-600 font-medium">{format(ensureDate(booking.checkOutDate), 'EEE, MMM d, yyyy')}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase font-bold">Stay Overview</p>
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Duration</span>
                            <span className="font-bold text-slate-700">{nights} {nights === 1 ? 'Night' : 'Nights'}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Guests</span>
                            <div className="flex space-x-2">
                              <Badge variant="default" className="bg-amber-100 text-amber-700 border-amber-200">
                                {booking.adults} Adults
                              </Badge>
                              {booking.children > 0 && (
                                <Badge variant="default" className="bg-blue-100 text-blue-700 border-blue-200">
                                  {booking.children} Children
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {(booking.isHoneymoon || booking.isElderly || booking.hasExtraBed) && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                              {booking.isHoneymoon && (
                                <Badge variant="default" className="bg-pink-100 text-pink-700 border-pink-200">
                                  <Heart className="w-3 h-3 mr-1" /> Honeymoon
                                </Badge>
                              )}
                              {booking.isElderly && (
                                <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                  <Star className="w-3 h-3 mr-1" /> Elderly
                                </Badge>
                              )}
                              {booking.hasExtraBed && (
                                <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-200">
                                  <Bed className="w-3 h-3 mr-1" /> Extra Bed
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {booking.guests && booking.guests.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Guest List</p>
                          <div className="space-y-2">
                            {booking.guests.map((g, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                                <div>
                                  <p className="text-sm font-bold text-slate-700">{g.name}</p>
                                  <p className="text-[10px] text-slate-400 uppercase">{g.idNumber || 'No ID Provided'}</p>
                                </div>
                                <Badge variant="outline" className="text-[10px] uppercase">{g.type}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-indigo-700">Total Bill</span>
                          <span className="text-lg font-bold text-indigo-700">${booking.totalBill?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <Button variant="primary" onClick={() => setIsGuestDetailsModalOpen(false)}>Close Details</Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Missed Tasks Modal */}
        {isMissedTasksModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsMissedTasksModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-rose-600 text-white">
                <div>
                  <h3 className="text-xl font-bold">Missed Tasks History</h3>
                  <p className="text-rose-100 text-sm">Review/clear tasks that were skipped on previous days.</p>
                </div>
                <div className="flex items-center space-x-2">
                  {archivedTasks.length > 0 && (
                    <button 
                      onClick={async () => {
                        console.log("Clear All clicked. Tasks to delete:", archivedTasks.length);
                        try {
                          const batch = writeBatch(db);
                          archivedTasks.forEach(t => {
                            if (t.id) batch.delete(doc(db, 'missed_tasks', t.id));
                          });
                          await batch.commit();
                          console.log("Clear All success");
                        } catch (err) {
                          console.error("Clear All failed:", err);
                          handleFirestoreError(err, OperationType.DELETE, 'missed_tasks');
                        }
                      }}
                      className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold uppercase transition-colors border border-white/20"
                    >
                      Clear All
                    </button>
                  )}
                  <button onClick={() => setIsMissedTasksModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto bg-slate-50/50">
                {archivedTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4 opacity-20" />
                    <p className="text-slate-400 font-medium">No missed tasks recorded.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {[...archivedTasks]
                      .sort((a, b) => (b.archivedAt?.seconds || 0) - (a.archivedAt?.seconds || 0))
                      .map((task) => (
                        <div key={task.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between group">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                              <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-700">Room {task.roomNumber} - {task.type}</p>
                              <p className="text-xs text-slate-500">{task.description}</p>
                              <p className="text-[10px] text-slate-400 uppercase mt-1">Reason: <span className="text-rose-400">{task.reason}</span></p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                               <p className="text-[10px] font-bold text-slate-400 uppercase">Missed On</p>
                               <p className="text-xs font-medium text-slate-600">
                                 {task.archivedAt ? format(ensureDate(task.archivedAt), 'MMM d, h:mm a') : 'Unknown'}
                               </p>
                            </div>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!task.id) return;
                                
                                console.log("Deleting task:", task.id);
                                try {
                                  await deleteDoc(doc(db, 'missed_tasks', task.id));
                                  console.log("Deleted successfully:", task.id);
                                } catch (err) {
                                  console.error("Delete error:", err);
                                  const info = handleFirestoreError(err, OperationType.DELETE, `missed_tasks/${task.id}`);
                                  window.alert(`Could not delete: ${info.error}`);
                                }
                              }}
                              className="p-3 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-xl transition-all bg-rose-50 border border-rose-100 shadow-sm"
                              title="Delete archived task"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                <Button variant="primary" onClick={() => setIsMissedTasksModalOpen(false)}>Close Archive</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
