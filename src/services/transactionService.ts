import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Transaction } from '../types';

const COLLECTION_NAME = 'transactions';

interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

const handleFirestoreError = (error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null) => {
  const user = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: error.message || String(error),
    operationType,
    path,
    authInfo: {
      userId: user?.uid || 'unauthenticated',
      email: user?.email || '',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || false,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || ''
      })) || []
    }
  };
  throw new Error(JSON.stringify(errorInfo));
};

const cleanData = (data: any) => {
  const cleaned: any = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  });
  return cleaned;
};

export const transactionService = {
  testConnection: async () => {
    try {
      await getDocFromServer(doc(db, 'config', 'status'));
      return true;
    } catch (error: any) {
      const code = error?.code || '';
      const message = error?.message || '';
      
      if (code === 'permission-denied' || message.includes('insufficient permissions')) {
        // This means we connected but server said no, which is a "working" connection
        return true; 
      }
      
      console.error("Firestore connection test failed:", error);
      return false;
    }
  },

  getTransactions: (callback: (transactions: Transaction[]) => void, isAdmin: boolean = false) => {
    const user = auth.currentUser;
    if (!user) {
      callback([]);
      return () => {};
    }

    let q;
    if (isAdmin) {
      q = query(
        collection(db, COLLECTION_NAME),
        orderBy('tanggal', 'desc')
      );
    } else {
      q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', user.uid),
        orderBy('tanggal', 'desc')
      );
    }

    return onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      callback(transactions);
    }, (error) => {
      console.error("Error in getTransactions snapshot listener:", error);
      handleFirestoreError(error, 'list', COLLECTION_NAME);
    });
  },

  addTransaction: async (transaction: Omit<Transaction, 'id'>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      return await addDoc(collection(db, COLLECTION_NAME), cleanData({
        ...transaction,
        userId: user.uid,
        createdAt: serverTimestamp()
      }));
    } catch (error) {
      return handleFirestoreError(error, 'create', COLLECTION_NAME);
    }
  },

  updateTransaction: async (transaction: Transaction) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    if (!transaction.id) throw new Error('Transaction ID is required');

    const { id, ...data } = transaction;
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      return await updateDoc(docRef, cleanData({
        ...data,
        updatedAt: serverTimestamp()
      }));
    } catch (error) {
      return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${id}`);
    }
  },

  deleteTransaction: async (id: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      return await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, 'delete', `${COLLECTION_NAME}/${id}`);
    }
  },

  bulkUpdateTransactions: async (ids: string[], updates: Partial<Transaction>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    if (ids.length === 0) return;

    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const cleanedUpdates = cleanData(updates);

      ids.forEach(id => {
        const docRef = doc(db, COLLECTION_NAME, id);
        batch.update(docRef, {
          ...cleanedUpdates,
          updatedAt: serverTimestamp()
        });
      });

      return await batch.commit();
    } catch (error) {
      return handleFirestoreError(error, 'write', COLLECTION_NAME);
    }
  },

  bulkDeleteTransactions: async (ids: string[]) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    if (ids.length === 0) return;

    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      ids.forEach(id => {
        const docRef = doc(db, COLLECTION_NAME, id);
        batch.delete(docRef);
      });

      return await batch.commit();
    } catch (error) {
      return handleFirestoreError(error, 'delete', COLLECTION_NAME);
    }
  }
};
