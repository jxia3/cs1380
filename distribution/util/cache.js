/**
 * Creates an efficient LRU cache backed by a mapping and a linked list.
 */
function createCache(capacity) {
  if (capacity <= 0) {
    throw new Error("Invalid cache capacity");
  }
  const cache = {
    capacity,
    keys: Object.create(null),
    head: null,
    tail: null,
    size: 0,
  };
  return {
    has: (key) => key in cache.keys,
    get: (key) => get(cache, key),
    put: (key, value) => put(cache, key, value),
    del: (key) => del(cache, key),
    getKeys: () => Object.keys(cache.keys),
    getKeysOrdered: () => getKeysOrdered(cache),
  };
}

/**
 * Returns the value associated with a key in the cache.
 */
function get(cache, key) {
  if (!(key in cache.keys)) {
    throw new Error(`Key '${key}' is not in the cache`);
  }
  refresh(cache, key);
  return cache.keys[key].value;
}

/**
 * Adds or updates a key-value pair. Returns an evicted key.
 */
function put(cache, key, value) {
  // Update an existing key
  if (key in cache.keys) {
    cache.keys[key].value = value;
    refresh(cache, key);
    return null;
  }

  // Possibly evict a key and add a new key
  let evicted = null;
  if (cache.size >= cache.capacity) {
    evicted = evict(cache);
  }
  insert(cache, key, value);
  return evicted;
}

/**
 * Removes a key and returns the value.
 */
function del(cache, key) {
  if (!(key in cache.keys)) {
    throw new Error(`Key '${key}' is not in the cache`);
  }

  const node = cache.keys[key].node;
  if (node.prev !== null) {
    node.prev.next = node.next;
  }
  if (node.next !== null) {
    node.next.prev = node.prev;
  }
  if (cache.head.key === key) {
    cache.head = node.next;
  }
  if (cache.tail.key === key) {
    cache.tail = node.prev;
  }

  const removed = {
    key,
    value: cache.keys[key].value,
  };
  delete cache.keys[key];
  cache.size -= 1;

  return removed;
}

/**
 * Inserts a key-value pair into the cache.
 */
function insert(cache, key, value) {
  if (key in cache.keys) {
    throw new Error(`Key '${key}' is already in the cache`);
  }

  const node = {
    key,
    prev: null,
    next: cache.head,
  };
  if (cache.head !== null) {
    cache.head.prev = node;
  }
  cache.head = node;
  if (cache.tail === null) {
    cache.tail = node;
  }

  cache.keys[key] = {value, node};
  cache.size += 1;
}

/**
 * Marks a key as the most recently used in the cache.
 */
function refresh(cache, key) {
  if (!(key in cache.keys)) {
    throw new Error(`Key '${key}' is not in the cache`);
  }
  if (cache.head.key === key) {
    return;
  }

  const node = cache.keys[key].node;
  if (node.prev !== null) {
    node.prev.next = node.next;
  }
  if (node.next !== null) {
    node.next.prev = node.prev;
  }
  if (cache.tail.key === key) {
    cache.tail = node.prev;
  }

  node.prev = null;
  node.next = cache.head;
  if (cache.head !== null) {
    cache.head.prev = node;
  }
  cache.head = node;
}

/**
 * Removes the least recently used key from the cache.
 */
function evict(cache) {
  const tail = cache.tail;
  if (tail === null) {
    throw new Error("Cache is empty");
  }

  if (tail.prev === null) {
    cache.head = null;
    cache.tail = null;
  } else {
    tail.prev.next = null;
    cache.tail = tail.prev;
  }

  const evicted = {
    key: tail.key,
    value: cache.keys[tail.key].value,
  };
  delete cache.keys[tail.key];
  cache.size -= 1;

  console.log("evicting", tail.key, cache.size);
  return evicted;
}

/**
 * Traverses the list to get the keys in order of recency. Only for debugging purposes.
 */
function getKeysOrdered(cache) {
  const listKeys = [];
  let node = cache.head;
  while (node !== null) {
    listKeys.push(node.key);
    node = node.next;
  }

  const mappingKeys = Object.keys(cache.keys);
  if (listKeys.length !== mappingKeys.length || listKeys.length !== cache.size) {
    throw new Error("Inconsistent key counts");
  }
  for (const key of listKeys) {
    if (!(key in cache.keys)) {
      throw new Error("Inconsistent cache keys");
    }
  }

  return listKeys;
}

module.exports = {createCache};
