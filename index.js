import sw2express from "sw2express";

import process from "process";
import os from "os";

const app = new sw2express({
  cluster: process.env.CLUSTER || os.cpus().length - 1 || 1,
  ETag: true,
});

app.use(async (req, rep) => {
  if (req.headers["ip"]) {
    rep.set("realip", req.headers["ip"]);
  } else if (req.headers["cf-connecting-ip"]) {
    rep.set("realip", req.headers["cf-connecting-ip"]);
  } else if (req.headers["x-forward-ip"]) {
    rep.set("realip", req.headers["x-forward-ip"]);
  } else if (req.headers["x-forwarded-for"]) {
    rep.set("realip", req.headers["x-forwarded-for"]);
  } else {
    rep.set("realip", req.req.socket.remoteAddress);
  }
  rep.headers = Object.assign(
    {
      "Cache-Control": "nocache",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Max-Age": "86400000",
      "Access-Control-Request-Headers": "Content-Type",
      "Access-Control-Allow-Headers":
        "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    },
    rep.headers
  );
  delete rep.headers["X-Served-By"];
  rep.headers["Server"] = `IP.186.RIP`;
});

const main = async () => {
  (await import("./api/ip.js")).default(app);
  app.listen(process.env.PORT || 8080);
};

main();
