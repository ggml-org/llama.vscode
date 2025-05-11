import * as crypto from 'crypto';

export class LRUCache {
    private capacity: number;
    private map: Map<string, string>;

    constructor(capacity: number) {
        if (capacity <= 0) {
            throw new Error("Capacity must be greater than 0");
        }
        this.capacity = capacity;
        this.map = new Map();
    }

    /**
     * Get the value associated with the key.
     * If the key exists, move it to the most recently used position.
     * @param key The key to retrieve.
     * @returns The value associated with the key, or undefined if the key is not found.
     */
    get = (key: string): string | undefined => {
        if (!this.map.has(key)) {
            return undefined;
        }

        // Move the key to the most recently used position
        const value = this.map.get(key)!;
        this.map.delete(key);
        this.map.set(key, value);

        return value;
    }

    /**
     * Insert or update the value associated with the key.
     * If the cache exceeds its capacity, evict the least recently used item.
     * @param key The key to insert or update.
     * @param value The value to associate with the key.
     */
    put = (key: string, value: string): void => {
        if (this.map.has(key)) {
            // If the key exists, delete it to refresh its position
            this.map.delete(key);
        }

        this.map.set(key, value);

        // If capacity is exceeded, evict the least recently used item
        if (this.map.size > this.capacity) {
            const leastRecentlyUsedKey = this.map.keys().next().value;
            if (leastRecentlyUsedKey != undefined) {
                this.map.delete(leastRecentlyUsedKey);
            }
        }
    }

    /**
     * Get the current size of the cache.
     * @returns The number of items in the cache.
     */
    size = (): number => {
        return this.map.size;
    }

    getHash = (request_context: string): string => {
        const hashSha256 = crypto.createHash('sha256');
        return hashSha256.update(request_context).digest('hex')
    }

    getMap = () => {
        return this.map;
    }
}
