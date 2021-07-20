import whois from "whois";
const lookup = (address) =>
  new Promise((resolve, reject) => {
    whois.lookup(address, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

export const whoisLookup = lookup;
