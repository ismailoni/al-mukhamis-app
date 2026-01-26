// Offline support utilities for mobile app

/**
 * Store data locally for offline access
 * @param {string} key - Storage key
 * @param {any} data - Data to store
 */
export const saveOfflineData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save offline data:", error);
  }
};

/**
 * Retrieve locally stored data
 * @param {string} key - Storage key
 * @returns {any} Stored data or null
 */
export const getOfflineData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to retrieve offline data:", error);
    return null;
  }
};

/**
 * Clear offline data
 * @param {string} key - Storage key
 */
export const clearOfflineData = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to clear offline data:", error);
  }
};

/**
 * Queue sync operations for when online
 * @param {string} operation - Operation type (create, update, delete)
 * @param {string} collection - Firestore collection name
 * @param {any} data - Data to sync
 */
export const queueSyncOperation = (operation, collection, data) => {
  try {
    const queue = getOfflineData("syncQueue") || [];
    queue.push({
      operation,
      collection,
      data,
      timestamp: new Date().getTime(),
    });
    saveOfflineData("syncQueue", queue);
  } catch (error) {
    console.error("Failed to queue sync operation:", error);
  }
};

/**
 * Get pending sync operations
 * @returns {array} Array of pending operations
 */
export const getPendingSyncOperations = () => {
  return getOfflineData("syncQueue") || [];
};

/**
 * Clear sync queue after successful sync
 */
export const clearSyncQueue = () => {
  clearOfflineData("syncQueue");
};

/**
 * Cache products for offline use
 * @param {array} products - Products array
 */
export const cacheProducts = (products) => {
  saveOfflineData("cachedProducts", products);
};

/**
 * Get cached products
 * @returns {array} Cached products
 */
export const getCachedProducts = () => {
  return getOfflineData("cachedProducts") || [];
};

/**
 * Cache customers for offline use
 * @param {array} customers - Customers array
 */
export const cacheCustomers = (customers) => {
  saveOfflineData("cachedCustomers", customers);
};

/**
 * Get cached customers
 * @returns {array} Cached customers
 */
export const getCachedCustomers = () => {
  return getOfflineData("cachedCustomers") || [];
};

/**
 * Save draft invoice for recovery
 * @param {object} invoiceData - Invoice data
 */
export const saveDraftInvoice = (invoiceData) => {
  saveOfflineData("draftInvoice", invoiceData);
};

/**
 * Get draft invoice
 * @returns {object} Draft invoice data
 */
export const getDraftInvoice = () => {
  return getOfflineData("draftInvoice") || null;
};

/**
 * Clear draft invoice
 */
export const clearDraftInvoice = () => {
  clearOfflineData("draftInvoice");
};

/**
 * Check if app is online
 * @returns {boolean} True if online
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Listen for online/offline status changes
 * @param {function} callback - Function to call when status changes
 */
export const onOnlineStatusChange = (callback) => {
  window.addEventListener("online", () => callback(true));
  window.addEventListener("offline", () => callback(false));
};
