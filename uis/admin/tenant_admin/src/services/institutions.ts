import axios from "axios";
import { BACKEND_URL } from "../const";

const API_BASE = `${BACKEND_URL}/education-loan/institutions`;

// Inline Institution type to avoid import error
export interface Institution {
  id: string;
  name: string;
  type: string;
  nuc_accredited: boolean;
  accreditation_number: string;
  country: string;
  state: string;
  city: string;
  address: string;
  bank_account_number: string;
  bank_name: string;
  bank_code: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  verification_status: string;
  year_of_establishment?: string;
}

export async function addInstitution(payload: Institution) {
  const res = await axios.post(API_BASE, payload);
  return res.data;
}

export async function getInstitutions(params?: { page?: number; limit?: number }) {
  const res = await axios.get(API_BASE, { params });
  return res.data;
}

export async function getInstitutionById(id: string) {
  const res = await axios.get(`${API_BASE}/${id}`);
  return res.data;
}

export async function getNucAccreditedInstitutions() {
  const res = await axios.get(`${API_BASE}/nuc-accredited`);
  return res.data;
}
