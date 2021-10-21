export default class MasterLRUCache {
  constructor(capacity = 50) {
    this.capacity = capacity;
    this.map = new Map();
  }
  has(key) {
    return this.map.has(key);
  }
  get(key) {
    if (this.map.has(key)) {
      const value = this.map.get(key);
      this.map.delete(key);
      this.map.set(key, value);
      return value;
    }
    return undefined;
  }
  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      console.log(`LRUCache Capacity > ${this.capacity}`);
      this.map.delete(this.map.keys().next().value);
    }
  }
}
