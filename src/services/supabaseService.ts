import { supabase } from '../lib/supabase';
import { Transaction } from '../types';

const mapToDB = (tx: any) => {
  const mapped = { ...tx };
  if ('hargaModal' in tx) {
    mapped.harga_modal = tx.hargaModal;
    delete mapped.hargaModal;
  }
  return mapped;
};

const mapFromDB = (data: any): Transaction => {
  return {
    ...data,
    hargaModal: data.harga_modal
  };
};

export const supabaseService = {
  getTransactions: async (userId?: string, isAdmin: boolean = false) => {
    let query = supabase
      .from('transactions')
      .select('*')
      .order('tanggal', { ascending: false });

    if (!isAdmin && userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data.map(mapFromDB);
  },

  subscribeToTransactions: (callback: (transactions: Transaction[]) => void, userId?: string, isAdmin: boolean = false) => {
    // Initial fetch
    supabaseService.getTransactions(userId, isAdmin).then(callback);

    // Subscribe to changes
    const subscription = supabase
      .channel('public:transactions')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'transactions',
        filter: !isAdmin && userId ? `user_id=eq.${userId}` : undefined
      }, () => {
        // Refresh on any change
        supabaseService.getTransactions(userId, isAdmin).then(callback);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  },

  addTransaction: async (transaction: Omit<Transaction, 'id'>, userId: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert([mapToDB({
        ...transaction,
        user_id: userId
      })])
      .select()
      .single();

    if (error) throw error;
    return mapFromDB(data);
  },

  updateTransaction: async (transaction: Transaction) => {
    const { id, ...updates } = transaction;
    const { data, error } = await supabase
      .from('transactions')
      .update(mapToDB(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapFromDB(data);
  },

  deleteTransaction: async (id: string) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  bulkUpdateTransactions: async (ids: string[], updates: Partial<Transaction>) => {
    const { data, error } = await supabase
      .from('transactions')
      .update(mapToDB(updates))
      .in('id', ids)
      .select();

    if (error) throw error;
    return data.map(mapFromDB);
  },

  bulkDeleteTransactions: async (ids: string[]) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids);

    if (error) throw error;
    return true;
  },

  // Auth Helpers
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  updateProfile: async (userId: string, updates: any) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
