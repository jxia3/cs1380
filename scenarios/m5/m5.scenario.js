const distribution = require("../../config.js");
const id = distribution.util.id;

const ncdcGroup = {};
const dlibGroup = {};
const tfidfGroup = {};
const crawlGroup = {};
const urlxtrGroup = {};
const strmatchGroup = {};
const ridxGroup = {};
const rlgGroup = {};

/*
  The local node will be the orchestrator.
*/
let localServer = null;

const n1 = {ip: "127.0.0.1", port: 7110};
const n2 = {ip: "127.0.0.1", port: 7111};
const n3 = {ip: "127.0.0.1", port: 7112};

test("(0 pts) (scenario) all.mr:ncdc", (done) => {
  /* Implement the map and reduce functions.
     The map function should parse the string value and return an object with the year as the key and the temperature as the value.
     The reduce function should return the maximum temperature for each year.
     (The implementation for this scenario is provided below.) */

  const mapper = (key, value) => {
    const words = value.split(/(\s+)/).filter((e) => e !== " ");
    const out = {};
    out[words[1]] = parseInt(words[3]);
    return out;
  };

  const reducer = (key, values) => {
    const out = {};
    out[key] = values.reduce((a, b) => Math.max(a, b), -Infinity);
    return out;
  };

  const dataset = [
    {"000": "006701199099999 1950 0515070049999999N9 +0000 1+9999"},
    {"106": "004301199099999 1950 0515120049999999N9 +0022 1+9999"},
    {"212": "004301199099999 1950 0515180049999999N9 -0011 1+9999"},
    {"318": "004301265099999 1949 0324120040500001N9 +0111 1+9999"},
    {"424": "004301265099999 1949 0324180040500001N9 +0078 1+9999"},
  ];

  const expected = [{"1950": 22}, {"1949": 111}];

  const doMapReduce = (cb) => {
    distribution.ncdc.store.get(null, (e, v) => {
      try {
        expect(v.length).toBe(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.ncdc.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.ncdc.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test("(10 pts) (scenario) all.mr:dlib", (done) => {
  /* Implement the map and reduce functions.
     The map function should parse the string value and return an object with the word as the key and the value as 1.
     The reduce function should return the count of each word. */

  const mapper = (key, value) => {
    const result = [];
    const words = value.split(" ");
    for (const word of words) {
      result.push({[word]: 1});
    }
    return result;
  };

  const reducer = (key, values) => {
    return {[key]: values.reduce((a, b) => a + b, 0)};
  };

  const dataset = [
    {"b1-l1": "It was the best of times, it was the worst of times,"},
    {"b1-l2": "it was the age of wisdom, it was the age of foolishness,"},
    {"b1-l3": "it was the epoch of belief, it was the epoch of incredulity,"},
    {"b1-l4": "it was the season of Light, it was the season of Darkness,"},
    {"b1-l5": "it was the spring of hope, it was the winter of despair,"},
  ];

  const expected = [
    {It: 1}, {was: 10},
    {the: 10}, {best: 1},
    {of: 10}, {"times,": 2},
    {it: 9}, {worst: 1},
    {age: 2}, {"wisdom,": 1},
    {"foolishness,": 1}, {epoch: 2},
    {"belief,": 1}, {"incredulity,": 1},
    {season: 2}, {"Light,": 1},
    {"Darkness,": 1}, {spring: 1},
    {"hope,": 1}, {winter: 1},
    {"despair,": 1},
  ];

  const doMapReduce = (cb) => {
    distribution.dlib.store.get(null, (e, v) => {
      try {
        expect(v.length).toBe(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.dlib.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.dlib.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test("(10 pts) (scenario) all.mr:tfidf", (done) => {
  /* Implement the map and reduce functions.
     The map function should parse the string value and return an object with the word as the key and the document and count as the value.
     The reduce function should return the TF-IDF for each word.

     Hint:
     TF = (Number of times the term appears in a document) / (Total number of terms in the document)
     IDF = log10(Total number of documents / Number of documents with the term in it)
     TF-IDF = TF * IDF */

  const mapper = (key, value) => {
    const result = [];
    const words = value.split(" ");
    for (const word of words) {
      result.push({[word]: {doc: key, len: words.length}});
    }
    return result;
  };

  // Reduce function: calculate TF-IDF for each word
  const reducer = (key, values) => {
    const counts = {};
    for (const item of values) {
      if (!(item.doc in counts)) {
        counts[item.doc] = {count: 0, len: item.len};
      }
      counts[item.doc].count += 1;
    }

    const scores = {};
    const idf = Math.log10(3 / Object.keys(counts).length);
    for (const doc in counts) {
      const tf = counts[doc].count / counts[doc].len;
      scores[doc] = Math.round(tf * idf * 100) / 100;
    }
    return {[key]: scores};
  };

  const dataset = [
    {"doc1": "machine learning is amazing"},
    {"doc2": "deep learning powers amazing systems"},
    {"doc3": "machine learning and deep learning are related"},
  ];

  const expected = [
    {"is": {"doc1": 0.12}},
    {"deep": {"doc2": 0.04, "doc3": 0.03}},
    {"systems": {"doc2": 0.1}},
    {"learning": {"doc1": 0, "doc2": 0, "doc3": 0}},
    {"amazing": {"doc1": 0.04, "doc2": 0.04}},
    {"machine": {"doc1": 0.04, "doc3": 0.03}},
    {"are": {"doc3": 0.07}}, {"powers": {"doc2": 0.1}},
    {"and": {"doc3": 0.07}}, {"related": {"doc3": 0.07}},
  ];

  const doMapReduce = (cb) => {
    distribution.tfidf.store.get(null, (e, v) => {
      try {
        expect(v.length).toBe(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.tfidf.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.tfidf.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

/*
  The rest of the scenarios are left as an exercise.
  For each one you'd like to implement, you'll need to:
  - Define the map and reduce functions.
  - Create a dataset.
  - Run the map reduce.
*/

test("(10 pts) (scenario) all.mr:crawl", (done) => {
  const mapper = (key, value) => {
    return {[key]: {url: value, content: `CONTENT: ${value}`}};
  };

  const reducer = (key, values) => {
    return {[key]: values[0]};
  };

  const dataset = [
    {"0": "https://a.com"},
    {"1": "https://b.com"},
    {"2": "https://c.com"},
  ];

  const expected = [
    {"0": {"url": "https://a.com", "content": "CONTENT: https://a.com"}},
    {"1": {"url": "https://b.com", "content": "CONTENT: https://b.com"}},
    {"2": {"url": "https://c.com", "content": "CONTENT: https://c.com"}},
  ];

  const doMapReduce = (cb) => {
    distribution.crawl.store.get(null, (e, v) => {
      try {
        expect(v.length).toBe(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.crawl.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.crawl.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test("(10 pts) (scenario) all.mr:urlxtr", (done) => {
  const mapper = (key, value) => {
    const result = [];
    const terms = value.split(" ");
    for (const term of terms) {
      if (!term.startsWith("https://")) {
        continue;
      }
      result.push({[key]: term});
    }
    return result;
  };

  const reducer = (key, values) => {
    const urls = [];
    for (const value of values) {
      if (!urls.includes(value)) {
        urls.push(value);
      }
    }
    return {[key]: urls};
  };

  const dataset = [
    {"0": "foo https://a.com bar https://b.com baz https://c.com qux https://a.com"},
    {"1": "corge https://b.com grault https://c.com garply https://d.com waldo https://b.com"},
    {"2": "fred https://c.com plugh https://d.com xyzzy https://e.com thud https://c.com"},
  ];

  const expected = [
    {"0": ["https://a.com", "https://b.com", "https://c.com"]},
    {"1": ["https://b.com", "https://c.com", "https://d.com"]},
    {"2": ["https://c.com", "https://d.com", "https://e.com"]},
  ];

  const doMapReduce = (cb) => {
    distribution.urlxtr.store.get(null, (e, v) => {
      try {
        expect(v.length).toBe(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.urlxtr.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.urlxtr.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test("(10 pts) (scenario) all.mr:strmatch", (done) => {
  const mapper = (key, value) => {
    const regex = "^(?=.*\\d).*$";
    if ((new RegExp(regex)).test(key)) {
      return {[regex]: key};
    }
    return {[regex]: null};
  };

  const reducer = (key, values) => {
    return {[key]: values.filter((v) => v !== null)};
  };

  const dataset = [
    {"foobar1": "content 1"},
    {"12345": "content 2"},
    {"baz qux": "content 3"},
  ];

  const expected = [
    {"^(?=.*\\d).*$": ["foobar1", "12345"]},
  ];

  const doMapReduce = (cb) => {
    distribution.strmatch.store.get(null, (e, v) => {
      try {
        expect(v.length).toBe(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.strmatch.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          const expectedKeys = expected.flatMap((v) => Object.keys(v));
          expect(v.flatMap((v) => Object.keys(v))).toEqual(expect.arrayContaining(expectedKeys));
          for (const value of v) {
            const valueKey = Object.keys(value)[0];
            const expectedValue = expected.find((v) => Object.keys(v)[0] === valueKey);
            expect(value[valueKey]).toEqual(expect.arrayContaining(expectedValue[valueKey]));
          }
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.strmatch.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test("(10 pts) (scenario) all.mr:ridx", (done) => {
  const mapper = (key, value) => {
    const result = [];
    const words = value.split(" ");
    for (const word of words) {
      result.push({[word]: key});
    }
    return result;
  };

  const reducer = (key, values) => {
    const docs = [];
    for (const value of values) {
      if (!docs.includes(value)) {
        docs.push(value);
      }
    }
    return {[key]: docs};
  };

  const dataset = [
    {"0": "foo bar baz"},
    {"1": "foo baz qux"},
    {"2": "foo qux corge"},
  ];

  const expected = [
    {"foo": ["0", "1", "2"]},
    {"bar": ["0"]},
    {"baz": ["0", "1"]},
    {"qux": ["1", "2"]},
    {"corge": ["2"]},
  ];

  const doMapReduce = (cb) => {
    distribution.ridx.store.get(null, (e, v) => {
      try {
        expect(v.length).toBe(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.ridx.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          const expectedKeys = expected.flatMap((v) => Object.keys(v));
          expect(v.flatMap((v) => Object.keys(v))).toEqual(expect.arrayContaining(expectedKeys));
          for (const value of v) {
            const valueKey = Object.keys(value)[0];
            const expectedValue = expected.find((v) => Object.keys(v)[0] === valueKey);
            expect(value[valueKey]).toEqual(expect.arrayContaining(expectedValue[valueKey]));
          }
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.ridx.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test("(10 pts) (scenario) all.mr:rlg", (done) => {
  const mapper = (key, value) => {
    const result = [];
    const terms = value.split(" ");
    for (const term of terms) {
      if (!term.startsWith("https://")) {
        continue;
      }
      result.push({[term]: key});
    }
    return result;
  };

  const reducer = (key, values) => {
    const urls = [];
    for (const value of values) {
      if (!urls.includes(value)) {
        urls.push(value);
      }
    }
    return {[key]: urls};
  };

  const dataset = [
    {"https://a.com": "foo https://a.com bar https://b.com baz https://c.com qux https://a.com"},
    {"https://b.com": "corge https://b.com grault https://c.com garply https://d.com waldo https://b.com"},
    {"https://c.com": "fred https://c.com plugh https://d.com xyzzy https://e.com thud https://c.com"},
  ];

  const expected = [
    {"https://a.com": ["https://a.com"]},
    {"https://b.com": ["https://a.com", "https://b.com"]},
    {"https://c.com": ["https://a.com", "https://b.com", "https://c.com"]},
    {"https://d.com": ["https://b.com", "https://c.com"]},
    {"https://e.com": ["https://c.com"]},
  ];

  const doMapReduce = (cb) => {
    distribution.rlg.store.get(null, (e, v) => {
      try {
        expect(v.length).toBe(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.rlg.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          const expectedKeys = expected.flatMap((v) => Object.keys(v));
          expect(v.flatMap((v) => Object.keys(v))).toEqual(expect.arrayContaining(expectedKeys));
          for (const value of v) {
            const valueKey = Object.keys(value)[0];
            const expectedValue = expected.find((v) => Object.keys(v)[0] === valueKey);
            expect(value[valueKey]).toEqual(expect.arrayContaining(expectedValue[valueKey]));
          }
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.rlg.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

/*
  This is the setup for the test scenario.
  Do not modify the code below.
*/

beforeAll((done) => {
  ncdcGroup[id.getSID(n1)] = n1;
  ncdcGroup[id.getSID(n2)] = n2;
  ncdcGroup[id.getSID(n3)] = n3;

  dlibGroup[id.getSID(n1)] = n1;
  dlibGroup[id.getSID(n2)] = n2;
  dlibGroup[id.getSID(n3)] = n3;

  tfidfGroup[id.getSID(n1)] = n1;
  tfidfGroup[id.getSID(n2)] = n2;
  tfidfGroup[id.getSID(n3)] = n3;

  crawlGroup[id.getSID(n1)] = n1;
  crawlGroup[id.getSID(n2)] = n2;
  crawlGroup[id.getSID(n3)] = n3;

  urlxtrGroup[id.getSID(n1)] = n1;
  urlxtrGroup[id.getSID(n2)] = n2;
  urlxtrGroup[id.getSID(n3)] = n3;

  strmatchGroup[id.getSID(n1)] = n1;
  strmatchGroup[id.getSID(n2)] = n2;
  strmatchGroup[id.getSID(n3)] = n3;

  ridxGroup[id.getSID(n1)] = n1;
  ridxGroup[id.getSID(n2)] = n2;
  ridxGroup[id.getSID(n3)] = n3;

  rlgGroup[id.getSID(n1)] = n1;
  rlgGroup[id.getSID(n2)] = n2;
  rlgGroup[id.getSID(n3)] = n3;

  const startNodes = (cb) => {
    distribution.local.status.spawn(n1, (e, v) => {
      distribution.local.status.spawn(n2, (e, v) => {
        distribution.local.status.spawn(n3, (e, v) => {
          cb();
        });
      });
    });
  };

  const groups = [
    {name: "ncdc", nodes: ncdcGroup},
    {name: "dlib", nodes: dlibGroup},
    {name: "tfidf", nodes: tfidfGroup},
    {name: "crawl", nodes: crawlGroup},
    {name: "urlxtr", nodes: urlxtrGroup},
    {name: "strmatch", nodes: strmatchGroup},
    {name: "ridx", nodes: ridxGroup},
    {name: "rlg", nodes: rlgGroup},
  ];
  let index = 0;

  distribution.node.start((server) => {
    localServer = server;
    startNodes(() => {
      function addGroup() {
        if (index >= groups.length) {
          done();
          return;
        }
        const config = {gid: groups[index].name};
        distribution.local.groups.put(config, groups[index].nodes, (e, v) => {
          distribution[groups[index].name].groups.put(config, groups[index].nodes, (e, v) => {
            index += 1;
            addGroup();
          });
        });
      }
      addGroup();
    });
  });
});

afterAll((done) => {
  const remote = {service: "status", method: "stop"};
  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        localServer.close();
        done();
      });
    });
  });
});
