import { createContext, useState, useContext } from 'react';

const OperatorContext = createContext();
const STORAGE_KEY = 'cimentopro_active_operator';

function loadOperator() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export const OperatorProvider = ({ children }) => {
  const [activeOperator, setActiveOperatorState] = useState(loadOperator);

  const setActiveOperator = (op) => {
    setActiveOperatorState(op);
    if (op) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(op));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const clearOperator = () => setActiveOperator(null);

  return (
    <OperatorContext.Provider value={{ activeOperator, setActiveOperator, clearOperator }}>
      {children}
    </OperatorContext.Provider>
  );
};

export const useOperator = () => {
  const ctx = useContext(OperatorContext);
  if (!ctx) {
    throw new Error('useOperator deve ser usado dentro de OperatorProvider');
  }
  return ctx;
};