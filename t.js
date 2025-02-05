fetch("http://127.0.0.1:1234/", {
  method: "POST",
  body: JSON.stringify({a: "b"}),
}).then((r) => r.text()).then(console.log);
