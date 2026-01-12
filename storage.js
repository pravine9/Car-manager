// Robust storage solution using IndexedDB to fix port/localhost issues
// This ensures data persists across different ports and localhost instances

const DB_NAME = 'CarToolsDB';
const DB_VERSION = 1;
const STORE_CARS = 'cars';
const STORE_LOGS = 'logs';
const STORE_INPUTS = 'inputs';

let db = null;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Create object stores if they don't exist
            if (!database.objectStoreNames.contains(STORE_CARS)) {
                const carsStore = database.createObjectStore(STORE_CARS, { keyPath: 'id', autoIncrement: true });
                carsStore.createIndex('registration', 'registration', { unique: false });
                carsStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            if (!database.objectStoreNames.contains(STORE_LOGS)) {
                const logsStore = database.createObjectStore(STORE_LOGS, { keyPath: 'id', autoIncrement: true });
                logsStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            if (!database.objectStoreNames.contains(STORE_INPUTS)) {
                database.createObjectStore(STORE_INPUTS, { keyPath: 'key' });
            }
        };
    });
}

// Generic function to get all items from a store
function getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
        initDB().then(database => {
            const transaction = database.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        }).catch(reject);
    });
}

// Generic function to add item to store
function addToStore(storeName, item) {
    return new Promise((resolve, reject) => {
        initDB().then(database => {
            const transaction = database.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        }).catch(reject);
    });
}

// Generic function to update item in store
function updateInStore(storeName, item) {
    return new Promise((resolve, reject) => {
        initDB().then(database => {
            const transaction = database.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        }).catch(reject);
    });
}

// Generic function to delete item from store
function deleteFromStore(storeName, id) {
    return new Promise((resolve, reject) => {
        initDB().then(database => {
            const transaction = database.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        }).catch(reject);
    });
}

// Generic function to clear a store
function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        initDB().then(database => {
            const transaction = database.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        }).catch(reject);
    });
}

// Cars storage functions
const CarStorage = {
    async getAll() {
        try {
            return await getAllFromStore(STORE_CARS);
        } catch (error) {
            console.error('Error getting cars:', error);
            // Fallback to localStorage for backward compatibility
            const stored = localStorage.getItem('carDetailsEntries');
            return stored ? JSON.parse(stored) : [];
        }
    },

    async save(car) {
        try {
            if (car.id) {
                return await updateInStore(STORE_CARS, car);
            } else {
                car.timestamp = new Date().toISOString();
                return await addToStore(STORE_CARS, car);
            }
        } catch (error) {
            console.error('Error saving car:', error);
            // Fallback to localStorage
            const cars = await this.getAll();
            if (car.id) {
                const index = cars.findIndex(c => c.id === car.id);
                if (index !== -1) {
                    cars[index] = car;
                }
            } else {
                car.id = Date.now();
                car.timestamp = new Date().toISOString();
                cars.push(car);
            }
            localStorage.setItem('carDetailsEntries', JSON.stringify(cars));
            return car.id || Date.now();
        }
    },

    async delete(id) {
        if (!id) {
            throw new Error('No ID provided for deletion');
        }
        
        try {
            // Try with the ID as-is first
            await deleteFromStore(STORE_CARS, id);
        } catch (error) {
            console.error('Error deleting from IndexedDB, trying fallback:', error);
            // Fallback: try with different ID type (string vs number)
            try {
                const idAsNumber = typeof id === 'string' ? parseInt(id, 10) : id;
                if (!isNaN(idAsNumber)) {
                    await deleteFromStore(STORE_CARS, idAsNumber);
                    return;
                }
            } catch (e) {
                // Continue to localStorage fallback
            }
            
            // Fallback to localStorage
            try {
                const cars = await this.getAll();
                const filtered = cars.filter(c => {
                    // Try both string and number comparison
                    return c.id !== id && c.id !== parseInt(id, 10) && String(c.id) !== String(id);
                });
                localStorage.setItem('carDetailsEntries', JSON.stringify(filtered));
            } catch (localError) {
                console.error('Error with localStorage fallback:', localError);
                throw new Error('Failed to delete car from all storage methods');
            }
        }
    },

    async clear() {
        try {
            await clearStore(STORE_CARS);
        } catch (error) {
            console.error('Error clearing cars:', error);
            localStorage.removeItem('carDetailsEntries');
        }
    }
};

// Logs storage functions (for backward compatibility with existing car log)
const LogStorage = {
    async getAll() {
        try {
            return await getAllFromStore(STORE_LOGS);
        } catch (error) {
            console.error('Error getting logs:', error);
            const stored = localStorage.getItem('carLogEntries');
            return stored ? JSON.parse(stored) : [];
        }
    },

    async save(log) {
        try {
            log.timestamp = new Date().toISOString();
            return await addToStore(STORE_LOGS, log);
        } catch (error) {
            console.error('Error saving log:', error);
            const logs = await this.getAll();
            logs.push(log);
            localStorage.setItem('carLogEntries', JSON.stringify(logs));
        }
    },

    async delete(id) {
        try {
            await deleteFromStore(STORE_LOGS, id);
        } catch (error) {
            console.error('Error deleting log:', error);
            const logs = await this.getAll();
            const filtered = logs.filter(l => l.id !== id);
            localStorage.setItem('carLogEntries', JSON.stringify(filtered));
        }
    },

    async clear() {
        try {
            await clearStore(STORE_LOGS);
        } catch (error) {
            console.error('Error clearing logs:', error);
            localStorage.removeItem('carLogEntries');
        }
    }
};

// Input storage functions
const InputStorage = {
    async save(key, value) {
        try {
            await initDB();
            const transaction = db.transaction([STORE_INPUTS], 'readwrite');
            const store = transaction.objectStore(STORE_INPUTS);
            await store.put({ key, value });
        } catch (error) {
            console.error('Error saving input:', error);
            const inputs = JSON.parse(localStorage.getItem('carToolInputs') || '{}');
            inputs[key] = value;
            localStorage.setItem('carToolInputs', JSON.stringify(inputs));
        }
    },

    async get(key) {
        try {
            await initDB();
            const transaction = db.transaction([STORE_INPUTS], 'readonly');
            const store = transaction.objectStore(STORE_INPUTS);
            const request = store.get(key);
            return new Promise((resolve) => {
                request.onsuccess = () => {
                    resolve(request.result ? request.result.value : null);
                };
                request.onerror = () => {
                    const inputs = JSON.parse(localStorage.getItem('carToolInputs') || '{}');
                    resolve(inputs[key] || null);
                };
            });
        } catch (error) {
            console.error('Error getting input:', error);
            const inputs = JSON.parse(localStorage.getItem('carToolInputs') || '{}');
            return inputs[key] || null;
        }
    },

    async getAll() {
        try {
            const all = await getAllFromStore(STORE_INPUTS);
            const result = {};
            all.forEach(item => {
                result[item.key] = item.value;
            });
            return result;
        } catch (error) {
            console.error('Error getting all inputs:', error);
            return JSON.parse(localStorage.getItem('carToolInputs') || '{}');
        }
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    initDB().catch(err => {
        console.warn('IndexedDB initialization failed, falling back to localStorage:', err);
    });
}
