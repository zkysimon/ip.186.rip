import whois from "whois";
whois.SERVERS["xyz"] = "whois.nic.xyz";
import ejs from "ejs";
import highlight from "highlight.js";
import fs from "fs";
import LRUCache from "./lib/lru.js";

const kv = new LRUCache();
const lookup = async (address) => {
  if (kv.has(address)) {
    return kv.get(address);
  } else {
    const data = await new Promise((resolve, reject) => {
      whois.lookup(address, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    kv.set(address, data);
    return data;
  }
};
const getPage = async (fileName) => {
  if (kv.has(fileName)) {
    return kv.get(fileName);
  } else {
    const value = fs.readFileSync(`./pages/${fileName}.ejs`, {
      encoding: "utf8",
    });
    kv.set(fileName, new String(value));
    return value;
  }
};
export const whoisLookup = lookup;
export const whoisLookuptoJSON = (data) => {
  let attr,
    attrColon,
    tempStr = "",
    returnArray = [];
  data.split("\n").forEach((part) => {
    if (!part) return;

    attrColon = part.indexOf(": ");
    attr = part.substr(0, attrColon);

    if (attr !== "") {
      returnArray.push({
        attribute: attr,
        value: part.substr(attrColon + 1).trim(),
      });
    } else {
      tempStr += part.substr(attrColon + 1).trim() + "\n";
    }
  });

  returnArray.push({
    attribute: "End Text",
    value: tempStr,
  });

  return returnArray;
};
export const whoisLookupJSON = async (address) => {
  if (kv.has({ address: address + "-json" })) {
    resolve(kv.get({ address: address + "-json" }));
  } else {
    const data = await lookup(address);
    const answer = whoisLookuptoJSON(data);
    kv.set({ address: address + "-json" }, answer);
    return answer;
  }
};
export const sendWhois = async (path, req, rep) => {
  var type = "plain";
  if (
    typeof req.headers["sec-fetch-dest"] !== "undefined" &&
    req.headers["sec-fetch-dest"] === "script"
  )
    type = "jsonp";
  else if (path.searchParams.get("type") !== null)
    type = path.searchParams.get("type");
  else if (req.headers.accept.includes("text/html")) type = "html";
  else if (req.headers.accept.includes("application/json")) type = "json";
  else if (req.headers.accept.includes("text/javascript")) type = "jsonp";

  const address =
    path.searchParams.get("address") || path.pathname.replace("/whois/", "");

  try {
    const answer = await lookup(address);
    //console.log(answer);
    const format = path.searchParams.get("format") === "true" ? 4 : 0;

    switch (type) {
      case "plain":
        rep.setHeader("Content-Type", "text/plain; charset=utf-8");
        rep.send(answer);
        break;
      case "jsonp":
        rep.setHeader("Content-Type", "text/javascript; charset=utf-8");
        const callback = path.searchParams.get("callback") || "ip_186_rip";
        rep.send(`${callback}("${answer}")`);
        break;
      case "json":
        rep.setHeader("Content-Type", "application/json; charset=utf-8");
        rep.send(JSON.stringify(whoisLookuptoJSON(answer), null, format));
        break;
      case "html":
        rep.setHeader("Content-Type", "text/html; charset=utf-8");
        rep.send(
          await ejs.render(await getPage("whois"), {
            address: address,
            answerPlain: answer,
            highlight,
            answerJSON: whoisLookuptoJSON(answer),
          })
        );
        break;
      default:
        throw new Error("Invalid method: " + type);
    }
    rep.end("\n");
  } catch (e) {
    rep.statusCode = 500;
    rep.send(`500 Server Error\n${e}`);
    console.warn(e);
  }

  return;
};
