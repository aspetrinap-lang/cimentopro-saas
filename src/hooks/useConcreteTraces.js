import { useState, useEffect } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';

export function useConcreteTraces() {
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ConcreteTrace.filter(scopedFilter({ active: true }), 'name').then(data => {
      setTraces(data);
      setLoading(false);
    });
  }, []);

  return { traces, loading };
}