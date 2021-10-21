import maxmind from "maxmind";
import { whoisLookupJSON } from "../api/whois.js";
import axios from "axios";
import LRUCache from "../api/lib/lru.js";
const Cache = new LRUCache(100);
const cityReader = maxmind.open("./file/GeoLite2-City.mmdb");
const asnReader = maxmind.open("./file/GeoLite2-ASN.mmdb");
export default async (ip) => {
  if (!maxmind.validate(ip)) {
    throw new Error("Invalid IP address.");
  }
  return {
    cityResponse: (await cityReader).get(ip),
    asnResponse: (await asnReader).get(ip),
    prefixLength: (await asnReader).getWithPrefixLength(ip)[1],
  };
};
export async function getJSON(ip, lang = "en") {
  if (Cache.has(`${ip}-${lang}`)) {
    return Cache.get(`${ip}-${lang}`);
  } else {
    const value = getJSONWithoutCache(ip, lang);
    Cache.set(`${ip}-${lang}`, value);
    return value;
  }
}
export async function getJSONWithoutCache(ip, lang = "en") {
  if (!maxmind.validate(ip)) {
    throw new Error("Invalid IP address.");
  }
  const cityResponse = (await cityReader).get(ip),
    asnResponse = (await asnReader).get(ip);
  const answer = {
    ip: ip,
  };
  try {
    const whoisInfo = whoisLookupJSON(ip);
    let request = axios.get(
      `http://ip-api.com/json/${ip}?fields=status,city,zip,reverse,mobile,proxy,hosting&lang=${lang}`,
      {
        timeout: 5000,
      }
    );
    const IPinsightRequest = axios.get(`https://ipinsight.io/query?ip=${ip}`, {
      timeout: 5000,
    });
    answer.asn = {
      number: asnResponse.autonomous_system_number,
      organization: asnResponse.autonomous_system_organization,
    };
    answer.continent = {
      code: cityResponse.continent.code,
      id: cityResponse.continent.geoname_id,
      name: cityResponse.continent.names[lang],
    };
    answer.location = {
      latitude: cityResponse.location.latitude,
      longitude: cityResponse.location.longitude,
      timeZone: cityResponse.location.time_zone,
      accuracy: cityResponse.location.accuracy_radius,
    };
    answer.country = {
      code: cityResponse.country.iso_code,
      id: cityResponse.country.geoname_id,
      name: cityResponse.country.names[lang],
    };
    answer.description = (await whoisInfo)
      .map((data) => {
        if (data.attribute === "descr") return data.value;
        else return null;
      })
      .filter((e) => e);
    answer.route = (await whoisInfo)
      .map((data) => {
        if (data.attribute === "route") return data.value;
        else return null;
      })
      .filter((e) => e)[0];
    
    IPinsightRequest.catch((err) => {});
    request.catch((err) => {});

    const data = (await request).data;
    if (!data.status) {
      throw new Error(`API return Error.`);
    } else {
      answer.location.city = data.city;
      answer.location.zip = data.zip;
      answer.reverse = data.reverse;
      answer.type = {
        mobile: data.mobile,
        proxy: data.proxy,
        hosting: data.hosting,
        is: data.mobile
          ? "mobile"
          : data.proxy
            ? "proxy"
            : data.hosting
              ? "hosting"
              : "other",
      };
    }
    const ipinsightData = (await IPinsightRequest).data;
    {
      answer.location.city = ipinsightData.city_name;
      answer.location.latitude = ipinsightData.latitude;
      answer.location.longitude = ipinsightData.longitude;
      answer.location.province = ipinsightData.region_name;
    }
    answer.prefixLength = (await asnReader).getWithPrefixLength(ip)[1];
  } catch (e) {
    //console.log(e);
  }
  return answer;
}
