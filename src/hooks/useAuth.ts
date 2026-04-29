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
    // Check for virtual user in localStorage
    const virtualUserId = localStorage.getItem('virtual_user_id');
    
    if (virtualUserId) {
      // Simulate a user object
      const mockUser = {
        uid: virtualUserId,
        email: 'mock@example.com',
        displayName: '体验用户',
        photoURL: 'https://ui-avatars.com/api/?name=Guest&background=4f46e5&color=fff',
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
            balance: 888.88, // Give some mock balance
            phoneNumber: '138****8888',
            role: 'admin',
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
    } else {
      // Fallback to real auth for now if someone still wants it, 
      // but usually virtualUserId will be set by AuthPage
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);
        if (firebaseUser) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            } else {
              const initialProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || '',
                photoURL: firebaseUser.photoURL || '',
                balance: 0,
                role: 'user',
                createdAt: new Date().toISOString(),
              };
              setDoc(userDocRef, initialProfile);
            }
            setLoading(false);
          });
          return () => unsubProfile();
        } else {
          setProfile(null);
          setLoading(false);
        }
      });
      return () => unsubscribe();
    }
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
