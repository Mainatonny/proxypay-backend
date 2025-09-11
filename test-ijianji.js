// test-proxies.js
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");

// List of proxies to test
const proxies = [
  { url: "socks5://60.161.5.84:333", note: "Kunming SOCKS5" },
  { url: "http://8.130.71.75:8080", note: "Proxy5" },
  { url: "http://27.189.129.161:8089", note: "Proxy5" },
  { url: "http://47.116.210.163:9098", note: "Shanghai HTTP" },
  { url: "http://47.116.210.163:8080", note: "Shanghai HTTP" },
  { url: "http://39.102.213.213:8089", note: "Proxy5" },
];

async function testProxy(proxy) {
  try {
    let agent;
    if (proxy.url.startsWith("socks")) {
      agent = new SocksProxyAgent(proxy.url);
    } else {
      agent = new HttpsProxyAgent(proxy.url);
    }

    const res = await axios.get("https://m.1jianji.com/login", {
      httpsAgent: agent,
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    console.log(`✅ ${proxy.note} (${proxy.url}) -> ${res.status}`);
  } catch (err) {
    console.log(`❌ ${proxy.note} (${proxy.url}) -> ${err.message}`);
  }
}

(async () => {
  for (let proxy of proxies) {
    await testProxy(proxy);
  }
})();