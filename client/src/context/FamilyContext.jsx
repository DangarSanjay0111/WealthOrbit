import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const FamilyContext = createContext(null);

export function FamilyProvider({ children }) {
  const { families } = useAuth();
  const [activeFamily, setActiveFamily] = useState(null);

  // Auto-select first family when families load
  useEffect(() => {
    if (families.length > 0 && !activeFamily) {
      const savedFamilyId = localStorage.getItem('wo_active_family');
      const saved = families.find(f => f._id === savedFamilyId);
      setActiveFamily(saved || families[0]);
    }
  }, [families, activeFamily]);

  const switchFamily = (family) => {
    setActiveFamily(family);
    localStorage.setItem('wo_active_family', family._id);
  };

  const isHead = activeFamily?.role === 'head';

  return (
    <FamilyContext.Provider value={{
      activeFamily,
      switchFamily,
      isHead,
      families
    }}>
      {children}
    </FamilyContext.Provider>
  );
}

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (!context) throw new Error('useFamily must be used within FamilyProvider');
  return context;
};
