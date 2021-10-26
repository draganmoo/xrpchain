const xrpl = require("xrpl")

async function main() {
    const client = new xrpl.Client("https://s.altnet.rippletest.net:51234/")
    await client.connect()
    client.disconnect()
  }
  
  main()