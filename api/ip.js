import ejs from "ejs";
import * as getFromGeoLite2 from "../utils/maxmind.js";
import xml from "xml2js";
import yaml from "yaml";
import fs from "fs";
import highlight from "highlight.js";

import crypto from "crypto";

const getkey = (key) => {
  const hash = crypto.createHash("md5");
  hash.update(key, "utf8");
  return hash.digest("hex").slice(16);
};

const kv = new WeakMap();

const getPage = async (fileName) => {
  if (kv.has({ fileName: fileName})) {
    return kv.get({ fileName: fileName });
  } else {
    const value = fs.readFileSync(`./pages/${fileName}.ejs`, {
      encoding: "utf8",
    });
    kv.set({ fileName:fileName }, new String(value));
    return value;
  }
};

const pageCache = async (key, ifNot) => {
  if (kv.has({ key: key})) {
    return kv.get({ key: key});
  } else {
    const value = await ifNot(key);
    kv.set({ key:key }, value);
    return value;
  }
};

Object.flatten = function (data) {
  var result = {};
  function recurse(cur, prop) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      for (var i = 0, l = cur.length; i < l; i++)
        recurse(cur[i], prop + "[" + i + "]");
      if (l == 0) result[prop] = [];
    } else {
      var isEmpty = true;
      for (var p in cur) {
        isEmpty = false;
        recurse(cur[p], prop ? prop + "." + p : p);
      }
      if (isEmpty && prop) result[prop] = {};
    }
  }
  recurse(data, "");
  return result;
};
const sendForIP = async (path, ip, req, rep) => {
  var type = "json";

  if (path.searchParams.get("ip") !== null) {
    ip = path.searchParams.get("ip");
  }
  if (
    typeof req.headers["sec-fetch-dest"] !== "undefined" &&
    req.headers["sec-fetch-dest"] === "script"
  )
    type = "jsonp";
  else if (path.searchParams.get("type") !== null)
    type = path.searchParams.get("type");
  else if (typeof req.headers.accept === "undefined") type = "json";
  else if (req.headers.accept.includes("text/html")) type = "html";
  else if (req.headers.accept.includes("application/json")) type = "json";
  else if (req.headers.accept.includes("text/xml")) type = "xml";
  else if (req.headers.accept.includes("text/javascript")) type = "jsonp";
  else if (req.headers.accept.includes("text/yaml")) type = "yaml";
  else if (path.pathname === "/") type = "plain";

  try {
    const format = path.searchParams.get("format") === "true" ? 4 : 0;
    switch (type) {
      case "json":
        rep.setHeader("Content-Type", "application/json; charset=utf-8");
        rep.send(
          JSON.stringify(
            await getFromGeoLite2.getJSON(
              ip,
              path.searchParams.get("lang") || "en"
            ),
            null,
            format
          )
        );
        break;
      case "plain":
        rep.send(ip);
        break;
      case "html":
        const ipinfo = await getFromGeoLite2.getJSON(
          ip,
          path.searchParams.get("lang") || "en"
        );
        rep.setHeader("Content-type", "text/html; charset=utf-8");
        const key = getkey(
          `page-index${ip}${path.searchParams.get("lang") || "en"}`
        );
        rep.setHeader("X-Request-ID", key);
        rep.send(
          await pageCache(key, async (key) => {
            return await ejs.render(
              await getPage("index"),
              { ip: ip, info: ipinfo, highlight, key },
              {
                async: true,
              }
            );
          })
        );
        break;
      case "xml":
        rep.setHeader("Content-type", "text/xml; charset=utf-8");
        const builder = new xml.Builder();
        rep.send(
          builder.buildObject(
            await getFromGeoLite2.getJSON(
              ip,
              path.searchParams.get("lang") || "en"
            )
          )
        );
        break;
      case "jsonp":
        rep.setHeader("Content-type", "text/javascript; charset=utf-8");
        const callback = path.searchParams.get("callback") || "ip_186_rip";
        rep.send(
          `${callback}(${JSON.stringify(
            await getFromGeoLite2.getJSON(
              ip,
              path.searchParams.get("lang") || "en"
            )
          )})`
        );
        break;
      case "yaml":
        rep.setHeader("Content-type", "text/yaml; charset=utf-8");
        rep.send(
          yaml.stringify(
            await getFromGeoLite2.getJSON(
              ip,
              path.searchParams.get("lang") || "en"
            )
          )
        );
        break;
      case "rawjson":
        rep.setHeader("Content-type", "application/json; charset=utf-8");
        rep.send(
          JSON.stringify(await getFromGeoLite2.default(ip), null, format)
        );
        break;
      case "humanReadable":
        const info = await getFromGeoLite2.getJSON(
          ip,
          path.searchParams.get("lang") || "en"
        );
        rep.send(
          `${ip}${
            typeof info.prefixLength !== "undefined"
              ? "/" + info.prefixLength
              : ""
          }`
        );
        try {
          rep.send(`\nASN Number: ${info.asn.number}\n`);
          rep.send(`ASN Organization: ${info.asn.organization}\n`);
          rep.send(`Location: ${info.country.name}\n`);
        } catch (e) {
          rep.send("\nInfo not available");
        }
        break;
      default:
        throw new Error("Type Node Found.");
    }
    rep.end("\n");
  } catch (e) {
    rep.setHeader("Content-Type", "text/plain; charset=utf-8");
    console.log(e);
    rep.statusCode = 400;
    rep.end(`400 Bad Request. \n${e}`);
  }
  rep.isEnd = true;
};

export const sendIP = sendForIP;
export const sendSelector = async (method, ip, lang, rep) => {
  const info = await getFromGeoLite2.getJSON(ip, lang);
  try {
    const answer = Object.flatten(info)[method];
    rep.setHeader("Content-Type", "text/plain; charset=utf-8");
    if (answer) {
      rep.send(answer);
    } else {
      rep.statusCode = 404;
      rep.send("404 method not found on info.");
    }
  } catch (e) {
    rep.statusCode = 404;
    console.log("Catch error: " + e);
    rep.send("404 method not found on info.");
  }
  rep.end("\n");
  return;
};
