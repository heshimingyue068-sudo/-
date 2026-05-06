import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  balance: number;
  role: 'user' | 'admin';
  realName?: string;
  idCard?: string;
  phoneNumber?: string;
  alipayAccount?: string;
  createdAt: string;
}

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for virtual user in localStorage, if none, create a default one
    let virtualUserId = localStorage.getItem('virtual_user_id');
    
    if (!virtualUserId) {
      virtualUserId = 'user_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('virtual_user_id', virtualUserId);
    }
    
    // Ensure we have a default phone or stored one
    const storedPhone = localStorage.getItem('user_phone') || '13988886666';
    if (!localStorage.getItem('user_phone')) {
      localStorage.setItem('user_phone', storedPhone);
    }

    // Simulate a user object
    const mockUser = {
      uid: virtualUserId,
      email: `${storedPhone}@phone.user`,
      displayName: `用户${storedPhone.slice(-4)}`,
      photoURL: `https://ui-avatars.com/api/?name=${storedPhone.slice(-4)}&background=4f46e5&color=fff`,
    };
    
    setUser(mockUser);
    
    const userDocRef = doc(db, 'users', virtualUserId);
    const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        const initialProfile: UserProfile = {
          uid: virtualUserId,
          email: mockUser.email,
          displayName: mockUser.displayName,
          photoURL: mockUser.photoURL,
          balance: 0,
          phoneNumber: storedPhone,
          role: 'admin', // Default to admin for easier dev preview
          createdAt: new Date().toISOString(),
        };
        setDoc(userDocRef, initialProfile).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${virtualUserId}`));
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${virtualUserId}`);
      setLoading(false);
    });

    return () => unsubProfile();
  }, []);

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, data, { merge: true });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return { user, profile, loading, updateProfile, isAdmin: profile?.role === 'admin' };
}
