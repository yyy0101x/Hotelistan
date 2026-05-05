import { Timestamp } from 'firebase/firestore';

export type UserRole = 'Receptionist' | 'Housekeeper' | 'Guest';

export interface UserProfile {
  uid: string;
  name: string;
  staffId?: string;
  password?: string;
  role: UserRole;
  unlockedRoomId?: string;
}

export type RoomStatus = 'Available' | 'Occupied' | 'Dirty' | 'Ready';

export interface Room {
  id: string;
  roomNumber: string;
  type: string;
  status: RoomStatus;
  isClean: boolean;
  dnd: boolean;
  urgentCleaning: boolean;
  lastCleaned?: Timestamp;
  assignedTo?: string; // Housekeeper UID
  accessCode?: string; // 6-digit code for guest access
  guestUid?: string; // UID of the guest who claimed the room
  // New Specification Fields
  basePrice: number;
  maxAdults: number;
  maxChildren: number;
  extraBedAllowed: boolean;
  extraBedFee: number;
}

export interface GuestInfo {
  name: string;
  idNumber: string;
  type: 'Adult' | 'Child' | 'Elderly';
}

export interface Booking {
  id: string;
  guestName: string;
  roomNumber: string;
  checkInDate: Timestamp;
  checkOutDate?: Timestamp;
  totalBill: number;
  status: 'Active' | 'Completed';
  guestUid?: string;
  // New Specification Fields
  adults: number;
  children: number;
  guests: GuestInfo[];
  isHoneymoon: boolean;
  isElderly: boolean;
  hasExtraBed: boolean;
  packageFee: number;
  discount: number;
}

export interface Task {
  id: string;
  roomId: string;
  roomNumber: string;
  description: string;
  status: 'Pending' | 'Completed';
  createdAt: Timestamp;
  type: 'Cleaning' | 'Setup' | 'Maintenance';
}
