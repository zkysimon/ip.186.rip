import whois from "whois";
const kv = new WeakMap();
const lookup = async (address) => {
  if (kv.has({ address })) {
    resolve(kv.get({ address }));
  } else {
    const data = await new Promise((resolve, reject) => {
      whois.lookup(address, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    })
    kv.set({ address }, data);
    return data;
  }
};
export const whoisLookup = lookup;
export const whoisLookupJSON = async (address) => {
  if (kv.has({ address: address + '-json' })) {
    resolve(kv.get({ address: address + '-json' }));
  } else {
    let attr, attrColon, tempStr = '', returnArray = [];

    const data = await lookup(address);

    data.split('\n').forEach(part => {
      if (!part) return;

      attrColon = part.indexOf(': ');
      attr = part.substr(0, attrColon);

      if (attr !== '') {
        returnArray.push({
          attribute: attr,
          value: part.substr(attrColon + 1).trim()
        });
      }
      else {
        tempStr += part.substr(attrColon + 1).trim() + '\n';
      }
    });

    returnArray.push({
      "attribute": "End Text",
      "value": tempStr
    });

    kv.set({ address: address + '-json' }, returnArray);
    return returnArray;
  }
}
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
  else if (req.headers.accept.includes("text/javascript")) type = "jsonp";

  const address =
    path.searchParams.get("address") || path.pathname.replace("/whois/", "");

  try {
    const answer = await lookup(address);
    //console.log(answer);

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
      case "html":
        break;
      default:
        throw new Error("Invalid method: " + type);
    }
    rep.end("\n");
  } catch (e) {
    rep.statusCode = 500;
    rep.send(`500 Server Error\n${e}`);
  }

  return;
};
