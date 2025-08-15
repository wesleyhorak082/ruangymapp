import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface UserMeasurement {
  id: string;
  measurement_name: string;
  current_value: string;
  previous_value: string;
  change_value: string;
  created_at: string;
  updated_at: string;
}

export function useUserMeasurements() {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<UserMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMeasurements = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMeasurements(data || []);
    } catch (error) {
      console.error('Error fetching measurements:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMeasurement = async (name: string, value: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_measurements')
        .insert({
          user_id: user.id,
          measurement_name: name,
          current_value: value,
        });

      if (error) throw error;
      await fetchMeasurements();
    } catch (error) {
      console.error('Error adding measurement:', error);
      throw error;
    }
  };

  const updateMeasurement = async (id: string, newValue: string) => {
    if (!user) return;

    try {
      // Get current measurement to set as previous
      const currentMeasurement = measurements.find(m => m.id === id);
      if (!currentMeasurement) return;

      const { error } = await supabase
        .from('user_measurements')
        .update({
          previous_value: currentMeasurement.current_value,
          current_value: newValue,
          change_value: 'Updated',
        })
        .eq('id', id);

      if (error) throw error;
      await fetchMeasurements();
    } catch (error) {
      console.error('Error updating measurement:', error);
      throw error;
    }
  };

  const deleteMeasurement = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_measurements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchMeasurements();
    } catch (error) {
      console.error('Error deleting measurement:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchMeasurements();
  }, [user]);

  return {
    measurements,
    loading,
    addMeasurement,
    updateMeasurement,
    deleteMeasurement,
    refetch: fetchMeasurements,
  };
}