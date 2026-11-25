import { createContext, useContext, useState, type ReactNode } from 'react';
import {type Patient } from '../types/patient';

interface AssistedPatientContextType {
  assistedPatient: Patient | null;
  setAssistedPatient: (patient: Patient | null) => void;
}

const AssistedPatientContext = createContext<AssistedPatientContextType | undefined>(undefined);

export const AssistedPatientProvider = ({ children }: { children: ReactNode }) => {
  const [assistedPatient, setAssistedPatient] = useState<Patient | null>(null);
  return (
    <AssistedPatientContext.Provider value={{ assistedPatient, setAssistedPatient }}>
      {children}
    </AssistedPatientContext.Provider>
  );
};

export const useAssistedPatient = () => {
  const ctx = useContext(AssistedPatientContext);
  if (!ctx) throw new Error('useAssistedPatient must be used within AssistedPatientProvider');
  return ctx;
};

export const useOptionalAssistedPatient = () => {
  return useContext(AssistedPatientContext); // undefined when no provider is present — used by AssessmentPage to detect helper mode
};