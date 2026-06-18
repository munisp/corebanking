// Service functions for Islamic Banking endpoints
// src/services/islamicBanking.ts

import apiClient from "./api";

const BASE_URL = "/islamic-banking/api/v1";

// ============================================================
// GET ALL PRODUCTS FOR TENANT
// ============================================================

export const getAllProducts = async () => {
  const res = await apiClient.get(`${BASE_URL}/products`);
  
  // Handle nested response structure where products are grouped by type
  // { data: { ijara: [...], murabaha: [...], musharaka: [...], sukuk: [...], takaful: [...] } }
  const data = res.data?.data || res.data;
  
  // If data is an object with product type keys, flatten all arrays into one
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const allProducts: any[] = [];
    const productTypes = ['ijara', 'murabaha', 'musharaka', 'sukuk', 'takaful'];
    
    productTypes.forEach(type => {
      if (Array.isArray(data[type])) {
        allProducts.push(...data[type]);
      }
    });
    
    return allProducts;
  }
  
  // Fallback for direct array response
  return Array.isArray(data) ? data : [];
};

// ============================================================
// PRODUCT DETAILS BY ID (Generic)
// ============================================================

export const getProductById = async (id: string) => {
  const res = await apiClient.get(`${BASE_URL}/products/${id}`);
  return res.data?.product || res.data?.data || res.data;
};

// ============================================================
// UPDATE PRODUCT STATUS (Generic)
// ============================================================

export const updateProductStatus = async (id: string, status: string) => {
  const res = await apiClient.patch(`${BASE_URL}/products/${id}/status`, {
    status,
  });
  return res.data?.product || res.data?.data || res.data;
};

// ============================================================
// CANCEL/DELETE PRODUCT (Generic)
// ============================================================

export const cancelProduct = async (id: string) => {
  const res = await apiClient.delete(`${BASE_URL}/products/${id}`);
  return res.data?.product || res.data?.data || res.data;
};

// ============================================================
// LEGACY FUNCTIONS (for backward compatibility)
// ============================================================

export const getAllMurabaha = async () => {
  return getAllProducts();
};

export const getMurabahaById = async (id: string) => {
  return getProductById(id);
};

export const updateMurabahaStatus = async (id: string, status: string) => {
  return updateProductStatus(id, status);
};

export const cancelMurabaha = async (id: string) => {
  return cancelProduct(id);
};

export const getAllMusharaka = async () => {
  return getAllProducts();
};

export const getMusharakaById = async (id: string) => {
  return getProductById(id);
};

export const updateMusharakaStatus = async (id: string, status: string) => {
  return updateProductStatus(id, status);
};

export const cancelMusharaka = async (id: string) => {
  return cancelProduct(id);
};

export const getAllIjara = async () => {
  return getAllProducts();
};

export const getIjaraById = async (id: string) => {
  return getProductById(id);
};

export const updateIjaraStatus = async (id: string, status: string) => {
  return updateProductStatus(id, status);
};

export const cancelIjara = async (id: string) => {
  return cancelProduct(id);
};

export const getAllTakaful = async () => {
  return getAllProducts();
};

export const getTakafulById = async (id: string) => {
  return getProductById(id);
};

export const updateTakafulStatus = async (id: string, status: string) => {
  return updateProductStatus(id, status);
};

export const cancelTakaful = async (id: string) => {
  return cancelProduct(id);
};

export const getAllSukuk = async () => {
  return getAllProducts();
};

export const getSukukById = async (id: string) => {
  return getProductById(id);
};

export const updateSukukStatus = async (id: string, status: string) => {
  return updateProductStatus(id, status);
};

export const cancelSukuk = async (id: string) => {
  return cancelProduct(id);
};
